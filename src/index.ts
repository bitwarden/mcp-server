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

// define tools
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
  description: 'Create a new item in your vault',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the item',
      },
      type: {
        type: 'number',
        description:
          'Type of item (1: Login, 2: Secure Note, 3: Card, 4: Identity)',
        enum: [1, 2, 3, 4],
      },
      notes: {
        type: 'string',
        description: 'Notes for the item',
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
    required: ['name', 'type'],
  },
};

const editTool: Tool = {
  name: 'edit',
  description: 'Edit an existing item in your vault',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID of the item to edit',
      },
      name: {
        type: 'string',
        description: 'New name for the item',
      },
      notes: {
        type: 'string',
        description: 'New notes for the item',
      },
      login: {
        type: 'object',
        description: 'Login information to update',
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
    required: ['id'],
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

// implement logic to support tools
export interface CliResponse {
  output?: string;
  errorOutput?: string;
}

const execPromise = promisify(exec);

async function executeCliCommand(command: string): Promise<CliResponse> {
  try {
    const { stdout, stderr } = await execPromise(`bw ${command}`);
    return {
      output: stdout,
      errorOutput: stderr,
    };
  } catch (e: unknown) {
    if (e instanceof Error) {
      return {
        errorOutput: e.message,
      };
    }
  }

  return {
    errorOutput: 'An error occurred while executing the command',
  };
}

// start server
async function runServer() {
  // require session from environment variable
  if (!process.env.BW_SESSION) {
    console.error('Please set the BW_SESSION environment variable');
    process.exit(1);
  }

  // set up server
  console.error('Bitwarden MCP Server starting ...');
  const server = new Server(
    {
      name: 'Bitwarden MCP Server',
      version: '0.1.0',
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
            const { password } = request.params.arguments as {
              password: string;
            };
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
            const { type, search } = request.params.arguments as {
              type: string;
              search?: string;
            };

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
            const { object, id } = request.params.arguments as {
              object: string;
              id: string;
            };

            const result = await executeCliCommand(`get ${object} "${id}"`);

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
            const args = request.params.arguments as {
              length?: number;
              uppercase?: boolean;
              lowercase?: boolean;
              number?: boolean;
              special?: boolean;
              passphrase?: boolean;
              words?: number;
              separator?: string;
              capitalize?: boolean;
            };

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
            const {
              name: itemName,
              type: itemType,
              notes,
              login,
            } = request.params.arguments as {
              name: string;
              type: number;
              notes?: string;
              login?: {
                username?: string;
                password?: string;
                uris?: { uri: string; match?: number }[];
                totp?: string;
              };
            };

            // For login items (type 1), we need to construct the login data
            let createCommand = `create item "{"name":"${itemName}","type":${itemType}`;

            if (notes) {
              createCommand += `,"notes":"${notes}"`;
            }

            // Add login properties for login items
            if (itemType === 1 && login) {
              createCommand += ',"login":{';

              const loginProps = [];

              if (login.username) {
                loginProps.push(`"username":"${login.username}"`);
              }

              if (login.password) {
                loginProps.push(`"password":"${login.password}"`);
              }

              if (login.totp) {
                loginProps.push(`"totp":"${login.totp}"`);
              }

              if (login.uris && login.uris.length > 0) {
                const urisJson = JSON.stringify(login.uris);
                loginProps.push(`"uris":${urisJson}`);
              }

              createCommand += `${loginProps.join(',')}}"`;
            } else {
              createCommand += '}"';
            }

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

          case 'edit': {
            const {
              id,
              name: itemName,
              notes,
              login,
            } = request.params.arguments as {
              id: string;
              name?: string;
              notes?: string;
              login?: {
                username?: string;
                password?: string;
              };
            };

            // First, get the current item to edit
            const getResult = await executeCliCommand(`get item ${id}`);

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
            interface BitwardenItem {
              id?: string;
              name?: string;
              notes?: string;
              type?: number;
              login?: {
                username?: string;
                password?: string;
                uris?: { uri: string; match?: number }[];
                totp?: string;
              };
            }

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
            const editCommand = `edit item ${id} '${JSON.stringify(currentItem)}'`;
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

          case 'delete': {
            const { object, id, permanent } = request.params.arguments as {
              object: string;
              id: string;
              permanent?: boolean;
            };

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

runServer().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
