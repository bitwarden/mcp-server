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

// API Configuration
const API_BASE_URL =
  process.env['BW_API_BASE_URL'] || 'https://api.bitwarden.com';
const IDENTITY_URL =
  process.env['BW_IDENTITY_URL'] || 'https://identity.bitwarden.com';
const CLIENT_ID = process.env['BW_CLIENT_ID'];
const CLIENT_SECRET = process.env['BW_CLIENT_SECRET'];

// OAuth2 Token Management
interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Obtains an OAuth2 access token using client credentials flow
 * Caches tokens and automatically refreshes when expired
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 5 minute buffer)
  if (cachedToken && now < tokenExpiry - 300000) {
    return cachedToken;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      'BW_CLIENT_ID and BW_CLIENT_SECRET environment variables are required for API operations',
    );
  }

  try {
    const response = await fetch(`${IDENTITY_URL}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'api.organization',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OAuth2 token request failed: ${response.status} ${response.statusText}`,
      );
    }

    const tokenData: TokenResponse = (await response.json()) as TokenResponse;

    cachedToken = tokenData.access_token;
    tokenExpiry = now + tokenData.expires_in * 1000; // Convert seconds to milliseconds

    return cachedToken;
  } catch (error) {
    throw new Error(
      `Failed to obtain access token: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

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

// Zod schemas for validating Bitwarden Public API tool inputs

// Schema for validating 'list-collections' command parameters
const listCollectionsSchema = z.object({});

// Schema for validating 'get-collection' command parameters
const getCollectionSchema = z.object({
  // Collection ID to retrieve
  id: z.string().min(1, 'Collection ID is required'),
});

// Schema for validating 'create-collection' command parameters
const createCollectionSchema = z.object({
  // Name of the collection
  name: z.string().min(1, 'Collection name is required'),
  // External identifier for the collection
  externalId: z.string().optional(),
  // Groups with access to this collection
  groups: z
    .array(
      z.object({
        // Group ID
        id: z.string().min(1, 'Group ID is required'),
        // Whether the group has read-only access
        readOnly: z.boolean().default(false),
        // Whether the group should hide passwords
        hidePasswords: z.boolean().optional(),
        // Whether the group can manage the collection
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

// Schema for validating 'update-collection' command parameters
const updateCollectionSchema = z.object({
  // Collection ID to update
  id: z.string().min(1, 'Collection ID is required'),
  // External identifier for the collection
  externalId: z.string().optional(),
  // Groups with access to this collection
  groups: z
    .array(
      z.object({
        // Group ID
        id: z.string().min(1, 'Group ID is required'),
        // Whether the group has read-only access
        readOnly: z.boolean().default(false),
        // Whether the group should hide passwords
        hidePasswords: z.boolean().optional(),
        // Whether the group can manage the collection
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

// Schema for validating 'delete-collection' command parameters
const deleteCollectionSchema = z.object({
  // Collection ID to delete
  id: z.string().min(1, 'Collection ID is required'),
});

// Schema for validating 'list-members' command parameters
const listMembersSchema = z.object({});

// Schema for validating 'get-member' command parameters
const getMemberSchema = z.object({
  // Member ID to retrieve
  id: z.string().min(1, 'Member ID is required'),
});

// Schema for validating 'invite-member' command parameters
const inviteMemberSchema = z.object({
  // Email address of the user to invite
  email: z.string().email('Valid email address is required'),
  // Type of user (0: Owner, 1: Admin, 2: User, 4: Custom)
  type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]),
  // External identifier for the member
  externalId: z.string().optional(),
  // Collections the member should have access to
  collections: z
    .array(
      z.object({
        // Collection ID
        id: z.string().min(1, 'Collection ID is required'),
        // Whether the member has read-only access to this collection
        readOnly: z.boolean().default(false),
        // Whether the member should hide passwords in this collection
        hidePasswords: z.boolean().optional(),
        // Whether the member can manage this collection
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
  // Groups the member should be assigned to
  groups: z.array(z.string().uuid('Group ID must be a valid UUID')).optional(),
  // Custom permissions for Custom type users only
  permissions: z
    .object({
      // Access event logs
      accessEventLogs: z.boolean().optional(),
      // Access import/export functionality
      accessImportExport: z.boolean().optional(),
      // Access to reports
      accessReports: z.boolean().optional(),
      // Create new collections
      createNewCollections: z.boolean().optional(),
      // Edit any collection
      editAnyCollection: z.boolean().optional(),
      // Delete any collection
      deleteAnyCollection: z.boolean().optional(),
      // Manage groups
      manageGroups: z.boolean().optional(),
      // Manage policies
      managePolicies: z.boolean().optional(),
      // Manage SSO
      manageSso: z.boolean().optional(),
      // Manage users
      manageUsers: z.boolean().optional(),
      // Manage reset password
      manageResetPassword: z.boolean().optional(),
      // Manage SCIM
      manageScim: z.boolean().optional(),
    })
    .optional(),
});

// Schema for validating 'update-member' command parameters
const updateMemberSchema = z.object({
  // Member ID to update
  id: z.string().min(1, 'Member ID is required'),
  // Type of user (0: Owner, 1: Admin, 2: User, 4: Custom)
  type: z
    .union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)])
    .optional(),
  // External identifier for the member
  externalId: z.string().optional(),
  // Collections the member should have access to
  collections: z
    .array(
      z.object({
        // Collection ID
        id: z.string().min(1, 'Collection ID is required'),
        // Whether the member has read-only access to this collection
        readOnly: z.boolean().default(false),
        // Whether the member should hide passwords in this collection
        hidePasswords: z.boolean().optional(),
        // Whether the member can manage this collection
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

// Schema for validating 'remove-member' command parameters
const removeMemberSchema = z.object({
  // Member ID to remove
  id: z.string().min(1, 'Member ID is required'),
});

// Schema for validating 'list-events' command parameters
const listEventsSchema = z.object({
  // Start date for event filtering (ISO 8601 format)
  start: z.string().optional(),
  // End date for event filtering (ISO 8601 format)
  end: z.string().optional(),
  // Continuation token for pagination
  continuationToken: z.string().optional(),
});

// Groups API Schemas
// Schema for validating 'list-groups' command parameters
const listGroupsSchema = z.object({});

// Schema for validating 'get-group' command parameters
const getGroupSchema = z.object({
  // Group ID to retrieve
  id: z.string().min(1, 'Group ID is required'),
});

// Schema for validating 'create-group' command parameters
const createGroupSchema = z.object({
  // Name of the group
  name: z.string().min(1, 'Group name is required'),
  // External identifier for the group
  externalId: z.string().optional(),
  // Collections the group should have access to
  collections: z
    .array(
      z.object({
        // Collection ID
        id: z.string().min(1, 'Collection ID is required'),
        // Whether the group has read-only access to this collection
        readOnly: z.boolean().default(false),
        // Whether the group should hide passwords in this collection
        hidePasswords: z.boolean().optional(),
        // Whether the group can manage this collection
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

// Schema for validating 'update-group' command parameters
const updateGroupSchema = z.object({
  // Group ID to update
  id: z.string().min(1, 'Group ID is required'),
  // Name of the group
  name: z.string().min(1, 'Group name is required'),
  // External identifier for the group
  externalId: z.string().optional(),
  // Collections the group should have access to
  collections: z
    .array(
      z.object({
        // Collection ID
        id: z.string().min(1, 'Collection ID is required'),
        // Whether the group has read-only access to this collection
        readOnly: z.boolean().default(false),
        // Whether the group should hide passwords in this collection
        hidePasswords: z.boolean().optional(),
        // Whether the group can manage this collection
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

// Schema for validating 'delete-group' command parameters
const deleteGroupSchema = z.object({
  // Group ID to delete
  id: z.string().min(1, 'Group ID is required'),
});

// Schema for validating 'get-group-member-ids' command parameters
const getGroupMemberIdsSchema = z.object({
  // Group ID to retrieve member IDs for
  id: z.string().min(1, 'Group ID is required'),
});

// Schema for validating 'update-group-member-ids' command parameters
const updateGroupMemberIdsSchema = z.object({
  // Group ID to update
  id: z.string().min(1, 'Group ID is required'),
  // Member IDs to assign to the group
  memberIds: z.array(z.string().uuid('Member ID must be a valid UUID')),
});

// Policies API Schemas
// Schema for validating 'list-policies' command parameters
const listPoliciesSchema = z.object({});

// Schema for validating 'get-policy' command parameters
const getPolicySchema = z.object({
  // Policy type to retrieve (0: TwoFactorAuthentication, 1: MasterPassword, etc.)
  type: z.number().int().min(0, 'Policy type is required'),
});

// Schema for validating 'update-policy' command parameters
const updatePolicySchema = z.object({
  // Policy type to update
  type: z.number().int().min(0, 'Policy type is required'),
  // Whether the policy is enabled
  enabled: z.boolean(),
  // Policy data (JSON object specific to each policy type)
  data: z.record(z.string(), z.any()).optional(),
});

// Organization API Schemas
// Schema for validating 'get-organization-subscription' command parameters
const getOrganizationSubscriptionSchema = z.object({});

// Schema for validating 'update-organization-subscription' command parameters
const updateOrganizationSubscriptionSchema = z.object({
  // Password Manager subscription details
  passwordManager: z
    .object({
      // Number of seats for Password Manager
      seats: z.number().int().min(0).optional(),
      // Maximum number of autoscale seats
      maxAutoscaleSeats: z.number().int().min(0).optional(),
    })
    .optional(),
  // Secrets Manager subscription details
  secretsManager: z
    .object({
      // Number of seats for Secrets Manager
      seats: z.number().int().min(0).optional(),
      // Number of service accounts
      serviceAccounts: z.number().int().min(0).optional(),
      // Maximum number of autoscale seats for Secrets Manager
      maxAutoscaleSeats: z.number().int().min(0).optional(),
      // Maximum number of autoscale service accounts
      maxAutoscaleServiceAccounts: z.number().int().min(0).optional(),
    })
    .optional(),
});

// Schema for validating 'import-organization' command parameters
const importOrganizationSchema = z.object({
  // Groups to import
  groups: z
    .array(
      z.object({
        // External ID for the group
        externalId: z.string(),
        // Name of the group
        name: z.string().min(1, 'Group name is required'),
      }),
    )
    .optional(),
  // Members to import
  members: z
    .array(
      z.object({
        // External ID for the member
        externalId: z.string().optional(),
        // Email address of the member
        email: z.string().email('Valid email address is required'),
        // Whether this member should be deleted
        deleted: z.boolean().optional(),
      }),
    )
    .optional(),
  // Whether to overwrite existing members and groups
  overwriteExisting: z.boolean().optional(),
});

// Additional Member API Schemas
// Schema for validating 'get-member-group-ids' command parameters
const getMemberGroupIdsSchema = z.object({
  // Member ID to retrieve group IDs for
  id: z.string().min(1, 'Member ID is required'),
});

// Schema for validating 'update-member-group-ids' command parameters
const updateMemberGroupIdsSchema = z.object({
  // Member ID to update
  id: z.string().min(1, 'Member ID is required'),
  // Group IDs to assign the member to
  groupIds: z.array(z.string().uuid('Group ID must be a valid UUID')),
});

// Schema for validating 'reinvite-member' command parameters
const reinviteMemberSchema = z.object({
  // Member ID to reinvite
  id: z.string().min(1, 'Member ID is required'),
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

// Organization API Tools

const listCollectionsTool: Tool = {
  name: 'list-collections',
  description: 'List all collections in your organization',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const getCollectionTool: Tool = {
  name: 'get-collection',
  description: 'Retrieve details of a specific collection',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Collection ID to retrieve',
      },
    },
    required: ['id'],
  },
};

const createCollectionTool: Tool = {
  name: 'create-collection',
  description: 'Create a new collection in your organization',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the collection',
      },
      externalId: {
        type: 'string',
        description: 'External identifier for the collection',
      },
      groups: {
        type: 'array',
        description: 'Groups with access to this collection',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Group ID',
            },
            readOnly: {
              type: 'boolean',
              description: 'Whether the group has read-only access',
              default: false,
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether the group should hide passwords',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the group can manage the collection',
            },
          },
          required: ['id', 'readOnly'],
        },
      },
    },
    required: ['name'],
  },
};

const updateCollectionTool: Tool = {
  name: 'update-collection',
  description: 'Update an existing collection in your organization',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Collection ID to update',
      },
      externalId: {
        type: 'string',
        description: 'External identifier for the collection',
      },
      groups: {
        type: 'array',
        description: 'Groups with access to this collection',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Group ID',
            },
            readOnly: {
              type: 'boolean',
              description: 'Whether the group has read-only access',
              default: false,
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether the group should hide passwords',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the group can manage the collection',
            },
          },
          required: ['id', 'readOnly'],
        },
      },
    },
    required: ['id'],
  },
};

const deleteCollectionTool: Tool = {
  name: 'delete-collection',
  description: 'Delete a collection from your organization',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Collection ID to delete',
      },
    },
    required: ['id'],
  },
};

const listMembersTool: Tool = {
  name: 'list-members',
  description: 'List all members in your organization',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const getMemberTool: Tool = {
  name: 'get-member',
  description: 'Retrieve details of a specific organization member',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Member ID to retrieve',
      },
    },
    required: ['id'],
  },
};

const inviteMemberTool: Tool = {
  name: 'invite-member',
  description: 'Invite a new user to join your organization',
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Email address of the user to invite',
      },
      type: {
        type: 'number',
        description: 'Type of user (0: Owner, 1: Admin, 2: User, 4: Custom)',
        enum: [0, 1, 2, 4],
      },
      externalId: {
        type: 'string',
        description: 'External identifier for the member',
      },
      collections: {
        type: 'array',
        description: 'Collections the member should have access to',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Collection ID',
            },
            readOnly: {
              type: 'boolean',
              description:
                'Whether the member has read-only access to this collection',
              default: false,
            },
            hidePasswords: {
              type: 'boolean',
              description:
                'Whether the member should hide passwords in this collection',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the member can manage this collection',
            },
          },
          required: ['id', 'readOnly'],
        },
      },
      groups: {
        type: 'array',
        description:
          'Groups the member should be assigned to (array of group IDs)',
        items: {
          type: 'string',
          description: 'Group ID (UUID)',
        },
      },
      permissions: {
        type: 'object',
        description: 'Custom permissions for Custom type users only',
        properties: {
          accessEventLogs: {
            type: 'boolean',
            description: 'Access event logs',
          },
          accessImportExport: {
            type: 'boolean',
            description: 'Access to import/export',
          },
          accessReports: {
            type: 'boolean',
            description: 'Access to reports',
          },
          createNewCollections: {
            type: 'boolean',
            description: 'Create new collections',
          },
          editAnyCollection: {
            type: 'boolean',
            description: 'Edit any collection',
          },
          deleteAnyCollection: {
            type: 'boolean',
            description: 'Delete any collection',
          },
          manageGroups: {
            type: 'boolean',
            description: 'Manage groups',
          },
          managePolicies: {
            type: 'boolean',
            description: 'Manage policies',
          },
          manageSso: {
            type: 'boolean',
            description: 'Manage SSO',
          },
          manageUsers: {
            type: 'boolean',
            description: 'Manage users',
          },
          manageResetPassword: {
            type: 'boolean',
            description: 'Manage reset password',
          },
          manageScim: {
            type: 'boolean',
            description: 'Manage SCIM',
          },
        },
      },
    },
    required: ['email', 'type'],
  },
};

const updateMemberTool: Tool = {
  name: 'update-member',
  description: 'Update an existing organization member',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Member ID to update',
      },
      type: {
        type: 'number',
        description: 'Type of user (0: Owner, 1: Admin, 2: User, 4: Custom)',
        enum: [0, 1, 2, 4],
      },
      externalId: {
        type: 'string',
        description: 'External identifier for the member',
      },
      collections: {
        type: 'array',
        description: 'Collections the member should have access to',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Collection ID',
            },
            readOnly: {
              type: 'boolean',
              description:
                'Whether the member has read-only access to this collection',
              default: false,
            },
            hidePasswords: {
              type: 'boolean',
              description:
                'Whether the member should hide passwords in this collection',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the member can manage this collection',
            },
          },
          required: ['id', 'readOnly'],
        },
      },
    },
    required: ['id'],
  },
};

const removeMemberTool: Tool = {
  name: 'remove-member',
  description: 'Remove a member from your organization',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Member ID to remove',
      },
    },
    required: ['id'],
  },
};

const listEventsTool: Tool = {
  name: 'list-events',
  description: 'Retrieve organization audit logs and events',
  inputSchema: {
    type: 'object',
    properties: {
      start: {
        type: 'string',
        description: 'Start date for event filtering (ISO 8601 format)',
      },
      end: {
        type: 'string',
        description: 'End date for event filtering (ISO 8601 format)',
      },
      continuationToken: {
        type: 'string',
        description: 'Continuation token for pagination',
      },
    },
  },
};

// Groups API Tools
const listGroupsTool: Tool = {
  name: 'list-groups',
  description: 'List all groups in your organization',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const getGroupTool: Tool = {
  name: 'get-group',
  description: 'Retrieve details of a specific group',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Group ID to retrieve',
      },
    },
    required: ['id'],
  },
};

const createGroupTool: Tool = {
  name: 'create-group',
  description: 'Create a new group in your organization',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the group',
      },
      externalId: {
        type: 'string',
        description: 'External identifier for the group',
      },
      collections: {
        type: 'array',
        description: 'Collections the group should have access to',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Collection ID',
            },
            readOnly: {
              type: 'boolean',
              description: 'Whether the group has read-only access',
              default: false,
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether the group should hide passwords',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the group can manage the collection',
            },
          },
          required: ['id', 'readOnly'],
        },
      },
    },
    required: ['name'],
  },
};

const updateGroupTool: Tool = {
  name: 'update-group',
  description: 'Update an existing group in your organization',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Group ID to update',
      },
      name: {
        type: 'string',
        description: 'Name of the group',
      },
      externalId: {
        type: 'string',
        description: 'External identifier for the group',
      },
      collections: {
        type: 'array',
        description: 'Collections the group should have access to',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Collection ID',
            },
            readOnly: {
              type: 'boolean',
              description: 'Whether the group has read-only access',
              default: false,
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether the group should hide passwords',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the group can manage the collection',
            },
          },
          required: ['id', 'readOnly'],
        },
      },
    },
    required: ['id', 'name'],
  },
};

const deleteGroupTool: Tool = {
  name: 'delete-group',
  description: 'Delete a group from your organization',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Group ID to delete',
      },
    },
    required: ['id'],
  },
};

const getGroupMemberIdsTool: Tool = {
  name: 'get-group-member-ids',
  description: 'Retrieve member IDs associated with a group',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Group ID to retrieve member IDs for',
      },
    },
    required: ['id'],
  },
};

const updateGroupMemberIdsTool: Tool = {
  name: 'update-group-member-ids',
  description: 'Update the members assigned to a group',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Group ID to update',
      },
      memberIds: {
        type: 'array',
        description: 'Array of member IDs to assign to the group',
        items: {
          type: 'string',
          description: 'Member ID (UUID)',
        },
      },
    },
    required: ['id', 'memberIds'],
  },
};

// Policies API Tools
const listPoliciesTool: Tool = {
  name: 'list-policies',
  description: 'List all policies in your organization',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const getPolicyTool: Tool = {
  name: 'get-policy',
  description: 'Retrieve details of a specific policy',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'number',
        description:
          'Policy type (0: TwoFactorAuthentication, 1: MasterPassword, etc.)',
      },
    },
    required: ['type'],
  },
};

const updatePolicyTool: Tool = {
  name: 'update-policy',
  description: 'Update a policy in your organization',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'number',
        description: 'Policy type to update',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether the policy is enabled',
      },
      data: {
        type: 'object',
        description: 'Policy data (JSON object specific to each policy type)',
      },
    },
    required: ['type', 'enabled'],
  },
};

// Organization API Tools
const getOrganizationSubscriptionTool: Tool = {
  name: 'get-organization-subscription',
  description: 'Retrieve organization subscription details',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const updateOrganizationSubscriptionTool: Tool = {
  name: 'update-organization-subscription',
  description: 'Update organization subscription details',
  inputSchema: {
    type: 'object',
    properties: {
      passwordManager: {
        type: 'object',
        description: 'Password Manager subscription details',
        properties: {
          seats: {
            type: 'number',
            description: 'Number of seats for Password Manager',
          },
          maxAutoscaleSeats: {
            type: 'number',
            description: 'Maximum number of autoscale seats',
          },
        },
      },
      secretsManager: {
        type: 'object',
        description: 'Secrets Manager subscription details',
        properties: {
          seats: {
            type: 'number',
            description: 'Number of seats for Secrets Manager',
          },
          serviceAccounts: {
            type: 'number',
            description: 'Number of service accounts',
          },
          maxAutoscaleSeats: {
            type: 'number',
            description:
              'Maximum number of autoscale seats for Secrets Manager',
          },
          maxAutoscaleServiceAccounts: {
            type: 'number',
            description: 'Maximum number of autoscale service accounts',
          },
        },
      },
    },
  },
};

const importOrganizationTool: Tool = {
  name: 'import-organization',
  description: 'Import members and groups from an external system',
  inputSchema: {
    type: 'object',
    properties: {
      groups: {
        type: 'array',
        description: 'Groups to import',
        items: {
          type: 'object',
          properties: {
            externalId: {
              type: 'string',
              description: 'External ID for the group',
            },
            name: {
              type: 'string',
              description: 'Name of the group',
            },
          },
          required: ['externalId', 'name'],
        },
      },
      members: {
        type: 'array',
        description: 'Members to import',
        items: {
          type: 'object',
          properties: {
            externalId: {
              type: 'string',
              description: 'External ID for the member',
            },
            email: {
              type: 'string',
              description: 'Email address of the member',
            },
            deleted: {
              type: 'boolean',
              description: 'Whether this member should be deleted',
            },
          },
          required: ['email'],
        },
      },
      overwriteExisting: {
        type: 'boolean',
        description: 'Whether to overwrite existing members and groups',
      },
    },
  },
};

// Additional Member API Tools
const getMemberGroupIdsTool: Tool = {
  name: 'get-member-group-ids',
  description: 'Retrieve group IDs associated with a member',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Member ID to retrieve group IDs for',
      },
    },
    required: ['id'],
  },
};

const updateMemberGroupIdsTool: Tool = {
  name: 'update-member-group-ids',
  description: 'Update the groups a member is assigned to',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Member ID to update',
      },
      groupIds: {
        type: 'array',
        description: 'Array of group IDs to assign the member to',
        items: {
          type: 'string',
          description: 'Group ID (UUID)',
        },
      },
    },
    required: ['id', 'groupIds'],
  },
};

const reinviteMemberTool: Tool = {
  name: 'reinvite-member',
  description: 'Re-invite a member to the organization',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Member ID to reinvite',
      },
    },
    required: ['id'],
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

    // Pass environment variables to child process so BW_SESSION is available
    const { stdout, stderr } = await execPromise(`bw ${sanitizedCommand}`, {
      env: { ...process.env },
    });
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

// API Security Functions

/**
 * Validates that an API endpoint path is safe and matches allowed patterns.
 *
 * @param {string} endpoint - The API endpoint path to validate
 * @returns {boolean} True if the endpoint is safe, false otherwise
 */
export function validateApiEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== 'string') {
    return false;
  }

  // Allowed API endpoint patterns for Bitwarden Public API
  const allowedPatterns = [
    /^\/public\/collections$/,
    /^\/public\/collections\/[a-f0-9-]{36}$/,
    /^\/public\/members$/,
    /^\/public\/members\/[a-f0-9-]{36}$/,
    /^\/public\/members\/[a-f0-9-]{36}\/group-ids$/,
    /^\/public\/members\/[a-f0-9-]{36}\/reinvite$/,
    /^\/public\/groups$/,
    /^\/public\/groups\/[a-f0-9-]{36}$/,
    /^\/public\/groups\/[a-f0-9-]{36}\/member-ids$/,
    /^\/public\/policies$/,
    /^\/public\/policies\/[0-9]+$/,
    /^\/public\/events$/,
    /^\/public\/organization\/subscription$/,
    /^\/public\/organization\/import$/,
  ] as const;

  return allowedPatterns.some((pattern) => pattern.test(endpoint));
}

/**
 * Sanitizes API parameters to prevent injection attacks.
 *
 * @param {unknown} params - The parameters to sanitize
 * @returns {unknown} The sanitized parameters
 */
export function sanitizeApiParameters(params: unknown): unknown {
  if (params === null || params === undefined) {
    return params;
  }

  if (typeof params === 'string') {
    // Remove potentially dangerous characters from strings
    return params.replace(/[<>"'&]/g, '');
  }

  if (Array.isArray(params)) {
    return params.map(sanitizeApiParameters);
  }

  if (typeof params === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      // Sanitize both keys and values
      const sanitizedKey = key.replace(/[<>"'&]/g, '');
      sanitized[sanitizedKey] = sanitizeApiParameters(value);
    }
    return sanitized;
  }

  return params;
}

/**
 * Builds a safe API request with proper authentication and validation.
 *
 * @param {string} endpoint - The API endpoint path
 * @param {string} method - The HTTP method
 * @param {unknown} data - The request data
 * @returns {Promise<RequestInit>} The safe request configuration
 */
export async function buildSafeApiRequest(
  endpoint: string,
  method: string,
  data?: unknown,
): Promise<RequestInit> {
  if (!validateApiEndpoint(endpoint)) {
    throw new Error(`Invalid API endpoint: ${endpoint}`);
  }

  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'] as const;
  const upperMethod = method.toUpperCase();

  if (
    !allowedMethods.includes(upperMethod as (typeof allowedMethods)[number])
  ) {
    throw new Error(`Invalid HTTP method: ${method}`);
  }

  const token = await getAccessToken();
  const sanitizedData = data ? sanitizeApiParameters(data) : undefined;

  const requestConfig: RequestInit = {
    method: upperMethod,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Bitwarden-MCP-Server/2025.9.0',
    },
  };

  if (sanitizedData && (upperMethod === 'POST' || upperMethod === 'PUT')) {
    requestConfig.body = JSON.stringify(sanitizedData);
  }

  return requestConfig;
}

/**
 * Interface representing the response from a Bitwarden API request.
 */
export interface ApiResponse {
  data?: unknown;
  errorMessage?: string;
  status: number;
}

/**
 * Executes a safe API request to the Bitwarden Public API.
 *
 * @async
 * @param {string} endpoint - The API endpoint path
 * @param {string} method - The HTTP method
 * @param {unknown} data - The request data
 * @returns {Promise<ApiResponse>} A promise that resolves to the API response
 */
export async function executeApiRequest(
  endpoint: string,
  method: string,
  data?: unknown,
): Promise<ApiResponse> {
  try {
    const requestConfig = await buildSafeApiRequest(endpoint, method, data);
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, requestConfig);

    let responseData: unknown;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = (await response.json()) as unknown;
      } catch (error) {
        // If JSON parsing fails, create a simple error message
        responseData = `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`;
      }
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      return {
        status: response.status,
        errorMessage: `API request failed: ${response.status} ${response.statusText}`,
        data: responseData,
      };
    }

    return {
      status: response.status,
      data: responseData,
    };
  } catch (error) {
    return {
      status: 500,
      errorMessage: `API request error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Initializes and starts the MCP server for handling Bitwarden CLI commands and API operations.
 * Requires either BW_SESSION (for CLI) or BW_CLIENT_ID/BW_CLIENT_SECRET (for API) environment variables.
 *
 * @async
 * @returns {Promise<void>}
 */
async function runServer(): Promise<void> {
  const hasCliAuth = !!process.env['BW_SESSION'];
  const hasApiAuth = !!(CLIENT_ID && CLIENT_SECRET);

  if (!hasCliAuth && !hasApiAuth) {
    console.error('Please set either:');
    console.error(
      '  - BW_SESSION environment variable (for CLI vault operations), or',
    );
    console.error(
      '  - BW_CLIENT_ID and BW_CLIENT_SECRET environment variables (for API operations)',
    );
    process.exit(1);
  }

  if (hasCliAuth && hasApiAuth) {
    console.error(
      'Bitwarden MCP Server starting with both CLI and API support...',
    );
  } else if (hasCliAuth) {
    console.error('Bitwarden MCP Server starting with CLI support only...');
  } else {
    console.error('Bitwarden MCP Server starting with API support only...');
  }

  console.error('Bitwarden MCP Server starting ...');
  const server = new Server(
    {
      name: 'Bitwarden MCP Server',
      version: '2025.9.0',
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

          // Organization API Cases

          case 'list-collections': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              listCollectionsSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest(
              '/public/collections',
              'GET',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'get-collection': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              getCollectionSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id } = validationResult;
            const result = await executeApiRequest(
              `/public/collections/${id}`,
              'GET',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'create-collection': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              createCollectionSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest(
              '/public/collections',
              'POST',
              validationResult,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'update-collection': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              updateCollectionSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id, ...updateData } = validationResult;
            const result = await executeApiRequest(
              `/public/collections/${id}`,
              'PUT',
              updateData,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'delete-collection': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              deleteCollectionSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id } = validationResult;
            const result = await executeApiRequest(
              `/public/collections/${id}`,
              'DELETE',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage ||
                    `Collection ${id} deleted successfully`,
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'list-members': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              listMembersSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest('/public/members', 'GET');

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'get-member': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              getMemberSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id } = validationResult;
            const result = await executeApiRequest(
              `/public/members/${id}`,
              'GET',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'invite-member': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              inviteMemberSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest(
              '/public/members',
              'POST',
              validationResult,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'update-member': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              updateMemberSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id, ...updateData } = validationResult;
            const result = await executeApiRequest(
              `/public/members/${id}`,
              'PUT',
              updateData,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'remove-member': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              removeMemberSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id } = validationResult;
            const result = await executeApiRequest(
              `/public/members/${id}`,
              'DELETE',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || `Member ${id} removed successfully`,
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'list-events': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              listEventsSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            let endpoint = '/public/events';
            const params = new URLSearchParams();

            if (validationResult.start) {
              params.append('start', validationResult.start);
            }
            if (validationResult.end) {
              params.append('end', validationResult.end);
            }
            if (validationResult.continuationToken) {
              params.append(
                'continuationToken',
                validationResult.continuationToken,
              );
            }

            if (params.toString()) {
              endpoint += `?${params.toString()}`;
            }

            const result = await executeApiRequest(endpoint, 'GET');

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          // Groups API Handlers
          case 'list-groups': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              listGroupsSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest('/public/groups', 'GET');

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'get-group': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              getGroupSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id } = validationResult;
            const result = await executeApiRequest(
              `/public/groups/${id}`,
              'GET',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'create-group': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              createGroupSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest(
              '/public/groups',
              'POST',
              validationResult,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'update-group': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              updateGroupSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id, ...updateData } = validationResult;
            const result = await executeApiRequest(
              `/public/groups/${id}`,
              'PUT',
              updateData,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'delete-group': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              deleteGroupSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id } = validationResult;
            const result = await executeApiRequest(
              `/public/groups/${id}`,
              'DELETE',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || `Group ${id} deleted successfully`,
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'get-group-member-ids': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              getGroupMemberIdsSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id } = validationResult;
            const result = await executeApiRequest(
              `/public/groups/${id}/member-ids`,
              'GET',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'update-group-member-ids': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              updateGroupMemberIdsSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id, memberIds } = validationResult;
            const result = await executeApiRequest(
              `/public/groups/${id}/member-ids`,
              'PUT',
              { MemberIds: memberIds },
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          // Policies API Handlers
          case 'list-policies': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              listPoliciesSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest('/public/policies', 'GET');

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'get-policy': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              getPolicySchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { type } = validationResult;
            const result = await executeApiRequest(
              `/public/policies/${type}`,
              'GET',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'update-policy': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              updatePolicySchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { type, ...updateData } = validationResult;
            const result = await executeApiRequest(
              `/public/policies/${type}`,
              'PUT',
              updateData,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          // Organization API Handlers
          case 'get-organization-subscription': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              getOrganizationSubscriptionSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest(
              '/public/organization/subscription',
              'GET',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'update-organization-subscription': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              updateOrganizationSubscriptionSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest(
              '/public/organization/subscription',
              'PUT',
              validationResult,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'import-organization': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              importOrganizationSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const result = await executeApiRequest(
              '/public/organization/import',
              'POST',
              validationResult,
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage ||
                    'Organization data imported successfully',
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          // Additional Member API Handlers
          case 'get-member-group-ids': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              getMemberGroupIdsSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id } = validationResult;
            const result = await executeApiRequest(
              `/public/members/${id}/group-ids`,
              'GET',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'update-member-group-ids': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              updateMemberGroupIdsSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id, groupIds } = validationResult;
            const result = await executeApiRequest(
              `/public/members/${id}/group-ids`,
              'PUT',
              { GroupIds: groupIds },
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage || JSON.stringify(result.data, null, 2),
                },
              ],
              isError: !!result.errorMessage,
            };
          }

          case 'reinvite-member': {
            // Validate inputs
            const [isValid, validationResult] = validateInput(
              reinviteMemberSchema,
              request.params.arguments,
            );

            if (!isValid) {
              return validationResult;
            }

            const { id } = validationResult;
            const result = await executeApiRequest(
              `/public/members/${id}/reinvite`,
              'POST',
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    result.errorMessage ||
                    `Member ${id} reinvited successfully`,
                },
              ],
              isError: !!result.errorMessage,
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
        listCollectionsTool,
        getCollectionTool,
        createCollectionTool,
        updateCollectionTool,
        deleteCollectionTool,
        listMembersTool,
        getMemberTool,
        inviteMemberTool,
        updateMemberTool,
        removeMemberTool,
        listEventsTool,
        // Groups API Tools
        listGroupsTool,
        getGroupTool,
        createGroupTool,
        updateGroupTool,
        deleteGroupTool,
        getGroupMemberIdsTool,
        updateGroupMemberIdsTool,
        // Policies API Tools
        listPoliciesTool,
        getPolicyTool,
        updatePolicyTool,
        // Organization API Tools
        getOrganizationSubscriptionTool,
        updateOrganizationSubscriptionTool,
        importOrganizationTool,
        // Additional Member API Tools
        getMemberGroupIdsTool,
        updateMemberGroupIdsTool,
        reinviteMemberTool,
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
