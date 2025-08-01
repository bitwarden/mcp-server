#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';

// Zod schemas for validating Bitwarden CLI tool inputs

// Schema for validating 'lock' command parameters (no parameters required)
const lockSchema = z.object({});

// Schema for validating 'unlock' command parameters
const unlockSchema = z.object({
  // Master password for unlocking the vault
  password: z.string().min(1, 'Password is required'),
});

// Schema for validating 'sync' command parameters (no parameters required)
const syncSchema = z.object({});

// Schema for validating 'status' command parameters (no parameters required)
const statusSchema = z.object({});

// Schema for validating 'list' command parameters
const listSchema = z.object({
  // Type of items to list from the vault
  type: z.enum(['items', 'folders', 'collections', 'organizations']),
  // Optional search term to filter results
  search: z.string().optional(),
});

// Schema for validating 'get' command parameters
const getSchema = z.object({
  // Type of object to retrieve from the vault
  object: z.enum([
    'item',
    'username',
    'password',
    'uri',
    'totp',
    'notes',
    'exposed',
    'attachment',
    'folder',
    'collection',
    'organization',
  ]),
  // ID or search term to identify the object
  id: z.string().min(1, 'ID or search term is required'),
});

// Schema for validating 'generate' command parameters
const generateSchema = z
  .object({
    // Length of the generated password (minimum 5)
    length: z.number().int().min(5).optional(),
    // Include uppercase characters in the password
    uppercase: z.boolean().optional(),
    // Include lowercase characters in the password
    lowercase: z.boolean().optional(),
    // Include numbers in the password
    number: z.boolean().optional(),
    // Include special characters in the password
    special: z.boolean().optional(),
    // Generate a passphrase instead of a password
    passphrase: z.boolean().optional(),
    // Number of words to include in the passphrase
    words: z.number().int().min(1).optional(),
    // Character to use between words in the passphrase
    separator: z.string().optional(),
    // Capitalize the first letter of each word in the passphrase
    capitalize: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // If passphrase is true, words and separator are relevant
      // If not, then length, uppercase, lowercase, etc. are relevant
      if (data.passphrase) {
        return true; // Accept any combination for passphrase
      } else {
        return true; // Accept any combination for regular password
      }
    },
    {
      message:
        'Provide valid options based on whether generating a passphrase or password',
    },
  );

// Schema for validating URI objects in login items
const uriSchema = z.object({
  // URI associated with the login (e.g., https://example.com)
  uri: z.string().url('Must be a valid URL'),
  // URI match type for auto-fill functionality (0: Domain, 1: Host, 2: Starts With, 3: Exact, 4: Regular Expression, 5: Never)
  match: z
    .union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ])
    .optional(),
});

// Schema for validating login information in vault items
const loginSchema = z.object({
  // Username for the login
  username: z.string().optional(),
  // Password for the login
  password: z.string().optional(),
  // List of URIs associated with the login
  uris: z.array(uriSchema).optional(),
  // Time-based one-time password (TOTP) secret
  totp: z.string().optional(),
});

// Schema for validating 'create' command parameters
const createSchema = z
  .object({
    // Name of the item/folder to create
    name: z.string().min(1, 'Name is required'),
    // Type of object to create: 'item' or 'folder'
    objectType: z.enum(['item', 'folder']),
    // Type of item to create (only for items)
    type: z
      .union([
        z.literal(1), // Login
        z.literal(2), // Secure Note
        z.literal(3), // Card
        z.literal(4), // Identity
      ])
      .optional(),
    // Optional notes for the item
    notes: z.string().optional(),
    // Login details (required when type is 1)
    login: loginSchema.optional(),
  })
  .refine(
    (data) => {
      // If objectType is item, type should be provided
      if (data.objectType === 'item') {
        if (!data.type) {
          return false;
        }
        // If type is login (1), login object should be provided
        if (data.type === 1) {
          return !!data.login; // login object should exist
        }
      }
      // Notes should only be provided for items, not folders
      if (data.objectType === 'folder' && data.notes) {
        return false;
      }
      // Login should only be provided for items, not folders
      if (data.objectType === 'folder' && data.login) {
        return false;
      }
      return true;
    },
    {
      message:
        'Item type is required for items, login details are required for login items, and notes/login are only valid for items',
    },
  );

// Schema for validating login fields during item editing
const editLoginSchema = z.object({
  // New username for the login
  username: z.string().optional(),
  // New password for the login
  password: z.string().optional(),
});

// Schema for validating 'edit' command parameters
const editSchema = z
  .object({
    // Type of object to edit: 'item' or 'folder'
    objectType: z.enum(['item', 'folder']),
    // ID of the item/folder to edit
    id: z.string().min(1, 'ID is required'),
    // New name for the item/folder
    name: z.string().optional(),
    // New notes for the item
    notes: z.string().optional(),
    // Updated login information (only for items)
    login: editLoginSchema.optional(),
  })
  .refine(
    (data) => {
      // Notes should only be provided for items, not folders
      if (data.objectType === 'folder' && data.notes) {
        return false;
      }
      // Login should only be provided for items, not folders
      if (data.objectType === 'folder' && data.login) {
        return false;
      }
      return true;
    },
    {
      message:
        'Notes and login information are only valid for items, not folders',
    },
  );

// Schema for validating 'delete' command parameters
const deleteSchema = z.object({
  // Type of object to delete
  object: z.enum(['item', 'attachment', 'folder', 'org-collection']),
  // ID of the object to delete
  id: z.string().min(1, 'Object ID is required'),
  // Whether to permanently delete the item (skip trash)
  permanent: z.boolean().optional(),
});

// Define tools
const lockTool: Tool = {
  name: 'lock',
  description: 'Lock the vault',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const unlockTool: Tool = {
  name: 'unlock',
  description: 'Unlock the vault with your master password',
  inputSchema: {
    type: 'object',
    properties: {
      password: {
        type: 'string',
        description: 'Master password for the vault',
      },
    },
    required: ['password'],
  },
};

const syncTool: Tool = {
  name: 'sync',
  description: 'Sync vault data from the Bitwarden server',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const statusTool: Tool = {
  name: 'status',
  description: 'Check the status of the Bitwarden CLI',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const listTool: Tool = {
  name: 'list',
  description: 'List items from your vault',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description:
          'Type of items to list (items, folders, collections, organizations)',
        enum: ['items', 'folders', 'collections', 'organizations'],
      },
      search: {
        type: 'string',
        description: 'Optional search term to filter results',
      },
    },
    required: ['type'],
  },
};

const getTool: Tool = {
  name: 'get',
  description: 'Get a specific item from your vault',
  inputSchema: {
    type: 'object',
    properties: {
      object: {
        type: 'string',
        description: 'Type of object to retrieve',
        enum: [
          'item',
          'username',
          'password',
          'uri',
          'totp',
          'notes',
          'exposed',
          'attachment',
          'folder',
          'collection',
          'organization',
        ],
      },
      id: {
        type: 'string',
        description: 'ID or search term for the object',
      },
    },
    required: ['object', 'id'],
  },
};

const generateTool: Tool = {
  name: 'generate',
  description: 'Generate a secure password or passphrase',
  inputSchema: {
    type: 'object',
    properties: {
      length: {
        type: 'number',
        description: 'Length of the password (minimum 5)',
        minimum: 5,
      },
      uppercase: {
        type: 'boolean',
        description: 'Include uppercase characters',
      },
      lowercase: {
        type: 'boolean',
        description: 'Include lowercase characters',
      },
      number: {
        type: 'boolean',
        description: 'Include numeric characters',
      },
      special: {
        type: 'boolean',
        description: 'Include special characters',
      },
      passphrase: {
        type: 'boolean',
        description: 'Generate a passphrase instead of a password',
      },
      words: {
        type: 'number',
        description: 'Number of words in the passphrase',
      },
      separator: {
        type: 'string',
        description: 'Character that separates words in the passphrase',
      },
      capitalize: {
        type: 'boolean',
        description:
          'Capitalize the first letter of each word in the passphrase',
      },
    },
  },
};

const createTool: Tool = {
  name: 'create',
  description: 'Create a new item or folder in your vault',
  inputSchema: {
    type: 'object',
    properties: {
      objectType: {
        type: 'string',
        description: 'Type of object to create',
        enum: ['item', 'folder'],
      },
      name: {
        type: 'string',
        description: 'Name of the item or folder',
      },
      type: {
        type: 'number',
        description:
          'Type of item (1: Login, 2: Secure Note, 3: Card, 4: Identity) - required for items',
        enum: [1, 2, 3, 4],
      },
      notes: {
        type: 'string',
        description: 'Notes for the item (only valid for items, not folders)',
      },
      login: {
        type: 'object',
        description: 'Login information (required for type=1)',
        properties: {
          username: {
            type: 'string',
            description: 'Username for the login',
          },
          password: {
            type: 'string',
            description: 'Password for the login',
          },
          uris: {
            type: 'array',
            description: 'List of URIs associated with the login',
            items: {
              type: 'object',
              properties: {
                uri: {
                  type: 'string',
                  description: 'URI for the login (e.g., https://example.com)',
                },
                match: {
                  type: 'number',
                  description:
                    'URI match type (0: Domain, 1: Host, 2: Starts With, 3: Exact, 4: Regular Expression, 5: Never)',
                  enum: [0, 1, 2, 3, 4, 5],
                },
              },
              required: ['uri'],
            },
          },
          totp: {
            type: 'string',
            description: 'TOTP secret for the login',
          },
        },
      },
    },
    required: ['objectType', 'name'],
  },
};

const editTool: Tool = {
  name: 'edit',
  description: 'Edit an existing item or folder in your vault',
  inputSchema: {
    type: 'object',
    properties: {
      objectType: {
        type: 'string',
        description: 'Type of object to edit',
        enum: ['item', 'folder'],
      },
      id: {
        type: 'string',
        description: 'ID of the item or folder to edit',
      },
      name: {
        type: 'string',
        description: 'New name for the item or folder',
      },
      notes: {
        type: 'string',
        description:
          'New notes for the item (only valid for items, not folders)',
      },
      login: {
        type: 'object',
        description: 'Login information to update (only for items)',
        properties: {
          username: {
            type: 'string',
            description: 'New username for the login',
          },
          password: {
            type: 'string',
            description: 'New password for the login',
          },
        },
      },
    },
    required: ['objectType', 'id'],
  },
};

const deleteTool: Tool = {
  name: 'delete',
  description: 'Delete an item from your vault',
  inputSchema: {
    type: 'object',
    properties: {
      object: {
        type: 'string',
        description: 'Type of object to delete',
        enum: ['item', 'attachment', 'folder', 'org-collection'],
      },
      id: {
        type: 'string',
        description: 'ID of the object to delete',
      },
      permanent: {
        type: 'boolean',
        description: 'Permanently delete the item instead of moving to trash',
      },
    },
    required: ['object', 'id'],
  },
};

// Implement logic to support tools

/**
 * Interface representing the response from a Bitwarden CLI command execution.
 *
 * @interface
 * @property {string} [output] - Standard output from the command, if successful
 * @property {string} [errorOutput] - Error output from the command, if an error occurred
 */
export interface CliResponse {
  output?: string;
  errorOutput?: string;
}

/**
 * Interface representing a Bitwarden vault item structure.
 * Used to parse and modify items during create and edit operations.
 *
 * @interface
 */
interface BitwardenItem {
  // Unique identifier for the item
  readonly id?: string;
  // Display name of the item
  name?: string;
  // Additional notes for the item
  notes?: string;
  // Item type (1: Login, 2: Secure Note, 3: Card, 4: Identity)
  type?: number;
  // Login-specific details, only applicable for type=1
  login?: {
    // Username for the login
    username?: string;
    // Password for the login
    password?: string;
    // List of URIs associated with the login
    uris?: readonly {
      readonly uri: string;
      readonly match?: number | undefined;
    }[];
    // Time-based one-time password
    totp?: string;
  };
}

/**
 * Interface representing a Bitwarden folder structure.
 * Used to parse and modify folders during create and edit operations.
 *
 * @interface
 */
interface BitwardenFolder {
  // Unique identifier for the folder
  readonly id?: string;
  // Display name of the folder
  name?: string;
}

/**
 * Validates input against a Zod schema and returns either the validated data or a structured error response.
 *
 * @template T - Type of the validated output
 * @param {z.ZodType<T>} schema - The Zod schema to validate against
 * @param {unknown} args - The input arguments to validate
 * @returns {[true, T] | [false, { content: Array<{ type: string; text: string }>; isError: true }]}
 *   A tuple with either:
 *   - [true, validatedData] if validation succeeds
 *   - [false, errorObject] if validation fails
 */
export function validateInput<T>(
  schema: z.ZodType<T>,
  args: unknown,
):
  | readonly [true, T]
  | readonly [
      false,
      {
        readonly content: readonly [
          { readonly type: 'text'; readonly text: string },
        ];
        readonly isError: true;
      },
    ] {
  try {
    const validatedInput = schema.parse(args ?? {});
    return [true, validatedInput] as const;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((issue) => issue.message)
        .join(', ');

      return [
        false,
        {
          content: [
            {
              type: 'text',
              text: `Validation error: ${errorMessage}`,
            } as const,
          ],
          isError: true,
        } as const,
      ] as const;
    }

    throw error;
  }
}

const execPromise = promisify(exec);

/**
 * Sanitizes a string to prevent command injection by removing dangerous characters
 * and escape sequences that could be used to execute arbitrary commands.
 *
 * @param {string} input - The input string to sanitize
 * @returns {string} The sanitized string safe for use in shell commands
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string');
  }

  // Remove or escape dangerous characters that could be used for command injection
  return (
    input
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove command separators and operators
      .replace(/[;&|`$(){}[\]<>'"]/g, '')
      // Remove escape sequences and control characters
      .replace(/\\./g, '')
      // Remove newlines and carriage returns
      .replace(/[\r\n]/g, '')
      // Remove tab characters
      .replace(/\t/g, ' ')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      // Trim whitespace
      .trim()
  );
}

/**
 * Safely escapes a parameter value for use in shell commands by using single quotes
 * and properly escaping any single quotes within the value.
 *
 * @param {string} value - The parameter value to escape
 * @returns {string} The safely escaped parameter
 */
export function escapeShellParameter(value: string): string {
  if (typeof value !== 'string') {
    throw new TypeError('Parameter must be a string');
  }

  // Replace single quotes with '\'' (end quote, escaped quote, start quote)
  // This is the safest way to handle single quotes in shell parameters
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Builds a safe Bitwarden CLI command with properly escaped parameters.
 *
 * @param {string} baseCommand - The base command (e.g., 'get', 'list')
 * @param {string[]} parameters - Array of parameters to append safely
 * @returns {string} The safely constructed command
 */
export function buildSafeCommand(
  baseCommand: string,
  parameters: readonly string[] = [],
): string {
  const sanitizedBase = sanitizeInput(baseCommand);
  const escapedParams = parameters.map((param) => escapeShellParameter(param));

  return [sanitizedBase, ...escapedParams].join(' ');
}

/**
 * Validates that a command is safe and contains only allowed Bitwarden CLI commands.
 *
 * @param {string} command - The command to validate
 * @returns {boolean} True if the command is safe, false otherwise
 */
export function isValidBitwardenCommand(command: string): boolean {
  const allowedCommands = [
    'lock',
    'unlock',
    'sync',
    'status',
    'list',
    'get',
    'generate',
    'create',
    'edit',
    'delete',
    'confirm',
    'import',
    'export',
    'serve',
    'config',
    'login',
    'logout',
  ] as const;

  const parts = command.trim().split(/\s+/);

  if (parts.length === 0) {
    return false;
  }

  const baseCommand = parts[0];
  return allowedCommands.includes(
    baseCommand as (typeof allowedCommands)[number],
  );
}

/**
 * Executes a Bitwarden CLI command safely with input sanitization and validation.
 *
 * @async
 * @param {string} command - The Bitwarden CLI command to execute (without 'bw' prefix)
 * @returns {Promise<CliResponse>} A promise that resolves to an object containing output and/or error output
 */
async function executeCliCommand(command: string): Promise<CliResponse> {
  try {
    const sanitizedCommand = sanitizeInput(command);

    if (!isValidBitwardenCommand(sanitizedCommand)) {
      return {
        errorOutput:
          'Invalid or unsafe command. Only Bitwarden CLI commands are allowed.',
      } as const;
    }

    const { stdout, stderr } = await execPromise(`bw ${sanitizedCommand}`);
    const result: CliResponse = {};
    if (stdout) result.output = stdout;
    if (stderr) result.errorOutput = stderr;
    return result;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      errorOutput: errorMessage,
    } as const;
  }
}

/**
 * Initializes and starts the MCP server for handling Bitwarden CLI commands.
 * Requires the BW_SESSION environment variable to be set.
 *
 * @async
 * @returns {Promise<void>}
 */
async function runServer(): Promise<void> {
  if (!process.env['BW_SESSION']) {
    console.error('Please set the BW_SESSION environment variable');
    process.exit(1);
  }

  console.error('Bitwarden MCP Server starting ...');
  const server = new Server(
    {
      name: 'Bitwarden MCP Server',
      version: '2025.8.1',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      try {
        const { name } = request.params;

        switch (name) {
          case 'lock': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              lockSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeCliCommand('lock');

            return {
              content: [
                {
                  type: 'text',
                  text: result.output || result.errorOutput,
                },
              ],
              isError: result.errorOutput ? true : false,
            };
          }
          case 'unlock': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              unlockSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { password } = validationResult;
            // Use echo to pipe password to bw unlock
            const result = await executeCliCommand(
              `unlock "${password}" --raw`,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.output ||
                    result.errorOutput ||
                    'Vault unlocked successfully',
                },
              ],
              isError: result.errorOutput ? true : false,
            };
          }

          case 'sync': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              syncSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeCliCommand('sync');

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.output ||
                    result.errorOutput ||
                    'Vault synced successfully',
                },
              ],
              isError: result.errorOutput ? true : false,
            };
          }

          case 'status': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              statusSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeCliCommand('status');

            return {
              content: [
                {
                  type: 'text',
                  text: result.output || result.errorOutput,
                },
              ],
              isError: result.errorOutput ? true : false,
            };
          }

          case 'list': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              listSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { type, search } = validationResult;

            // Construct the command with the optional search parameter
            let command = `list ${type}`;
            if (search) {
              command += ` --search "${search}"`;
            }

            const result = await executeCliCommand(command);

            return {
              content: [
                {
                  type: 'text',
                  text: result.output || result.errorOutput,
                },
              ],
              isError: result.errorOutput ? true : false,
            };
          }

          case 'get': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              getSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { object, id } = validationResult;
            const command = buildSafeCommand('get', [object, id]);
            const result = await executeCliCommand(command);

            return {
              content: [
                {
                  type: 'text',
                  text: result.output || result.errorOutput,
                },
              ],
              isError: result.errorOutput ? true : false,
            };
          }

          case 'generate': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              generateSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const args = validationResult;
            let command = 'generate';

            if (args.passphrase) {
              command += ' --passphrase';

              if (args.words) {
                command += ` --words ${args.words}`;
              }

              if (args.separator) {
                command += ` --separator "${args.separator}"`;
              }

              if (args.capitalize) {
                command += ' --capitalize';
              }
            } else {
              // Regular password generation
              if (args.uppercase) {
                command += ' --uppercase';
              }

              if (args.lowercase) {
                command += ' --lowercase';
              }

              if (args.number) {
                command += ' --number';
              }

              if (args.special) {
                command += ' --special';
              }

              if (args.length) {
                command += ` --length ${args.length}`;
              }
            }

            const result = await executeCliCommand(command);

            return {
              content: [
                {
                  type: 'text',
                  text: result.output || result.errorOutput,
                },
              ],
              isError: result.errorOutput ? true : false,
            };
          }

          case 'create': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              createSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const {
              objectType,
              name: itemName,
              type: itemType,
              notes,
              login,
            } = validationResult;

            if (objectType === 'folder') {
              // Create folder
              const folderObject: BitwardenFolder = {
                name: itemName,
              };

              const folderJson = JSON.stringify(folderObject);
              const folderBase64 = Buffer.from(folderJson, 'utf8').toString(
                'base64',
              );
              const createCommand = buildSafeCommand('create', [
                'folder',
                folderBase64,
              ]);
              const result = await executeCliCommand(createCommand);

              return {
                content: [
                  {
                    type: 'text',
                    text: result.output || result.errorOutput,
                  },
                ],
                isError: result.errorOutput ? true : false,
              };
            } else {
              // Create item
              const itemObject: BitwardenItem = {
                name: itemName,
                ...(itemType !== undefined && { type: itemType }),
              };

              if (notes) {
                itemObject.notes = notes;
              }

              // Add login properties for login items
              if (itemType === 1 && login) {
                itemObject.login = {};

                if (login.username) {
                  itemObject.login.username = login.username;
                }

                if (login.password) {
                  itemObject.login.password = login.password;
                }

                if (login.totp) {
                  itemObject.login.totp = login.totp;
                }

                if (login.uris && login.uris.length > 0) {
                  itemObject.login.uris = login.uris;
                }
              }

              const itemJson = JSON.stringify(itemObject);
              const itemBase64 = Buffer.from(itemJson, 'utf8').toString(
                'base64',
              );
              const createCommand = buildSafeCommand('create', [
                'item',
                itemBase64,
              ]);
              const result = await executeCliCommand(createCommand);

              return {
                content: [
                  {
                    type: 'text',
                    text: result.output || result.errorOutput,
                  },
                ],
                isError: result.errorOutput ? true : false,
              };
            }
          }

          case 'edit': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              editSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const {
              objectType,
              id,
              name: itemName,
              notes,
              login,
            } = validationResult;

            if (objectType === 'folder') {
              // Edit folder
              const command = buildSafeCommand('get', ['folder', id]);
              const getResult = await executeCliCommand(command);

              if (getResult.errorOutput) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Error retrieving folder to edit: ${getResult.errorOutput}`,
                    },
                  ],
                  isError: true,
                };
              }

              // Parse the current folder
              let currentFolder: BitwardenFolder;
              try {
                currentFolder = JSON.parse(
                  getResult.output || '{}',
                ) as BitwardenFolder;
              } catch (error) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Error parsing folder data: ${error}`,
                    },
                  ],
                  isError: true,
                };
              }

              // Update folder name
              if (itemName) {
                currentFolder.name = itemName;
              }

              const folderJson = JSON.stringify(currentFolder);
              const folderBase64 = Buffer.from(folderJson, 'utf8').toString(
                'base64',
              );
              const editCommand = buildSafeCommand('edit', [
                'folder',
                id,
                folderBase64,
              ]);
              const result = await executeCliCommand(editCommand);

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      result.output ||
                      result.errorOutput ||
                      `Folder ${id} updated successfully`,
                  },
                ],
                isError: result.errorOutput ? true : false,
              };
            } else {
              // Edit item
              const command = buildSafeCommand('get', ['item', id]);
              const getResult = await executeCliCommand(command);

              if (getResult.errorOutput) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Error retrieving item to edit: ${getResult.errorOutput}`,
                    },
                  ],
                  isError: true,
                };
              }

              // Parse the current item
              let currentItem: BitwardenItem;
              try {
                currentItem = JSON.parse(
                  getResult.output || '{}',
                ) as BitwardenItem;
              } catch (error) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Error parsing item data: ${error}`,
                    },
                  ],
                  isError: true,
                };
              }

              // Update fields
              if (itemName) {
                currentItem.name = itemName;
              }

              if (notes) {
                currentItem.notes = notes;
              }

              // Update login fields if this is a login item
              if (currentItem.type === 1 && login) {
                if (!currentItem.login) {
                  currentItem.login = {};
                }

                if (login.username) {
                  currentItem.login.username = login.username;
                }

                if (login.password) {
                  currentItem.login.password = login.password;
                }
              }

              // Perform the edit
              const itemJson = JSON.stringify(currentItem);
              const itemBase64 = Buffer.from(itemJson, 'utf8').toString(
                'base64',
              );
              const editCommand = buildSafeCommand('edit', [
                'item',
                id,
                itemBase64,
              ]);
              const result = await executeCliCommand(editCommand);

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      result.output ||
                      result.errorOutput ||
                      `Item ${id} updated successfully`,
                  },
                ],
                isError: result.errorOutput ? true : false,
              };
            }
          }

          case 'delete': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              deleteSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { object, id, permanent } = validationResult;

            let command = `delete ${object} ${id}`;
            if (permanent) {
              command += ' --permanent';
            }

            const result = await executeCliCommand(command);

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.output ||
                    result.errorOutput ||
                    `${object} ${id} deleted successfully`,
                },
              ],
              isError: result.errorOutput ? true : false,
            };
          }

          default:
            return {
              content: [
                {
                  type: 'text',
                  text: `Unknown tool: ${request.params.name}`,
                },
              ],
              isError: true,
            };
        }
      } catch (error) {
        console.error('Error handling tool request:', error);

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        lockTool,
        unlockTool,
        syncTool,
        statusTool,
        listTool,
        getTool,
        generateTool,
        createTool,
        editTool,
        deleteTool,
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Bitwarden MCP Server running on stdio');
}

// Only run the server if this file is executed directly
// Check if this is the main module by comparing file paths
const isMainModule = process.argv[1] && process.argv[1].endsWith('index.js');
if (isMainModule) {
  runServer().catch((error) => {
    console.error('Fatal error running server:', error);
    process.exit(1);
  });
}
