/**
 * CLI tool definitions for personal vault operations
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const lockTool: Tool = {
  name: 'lock',
  description: 'Lock the vault',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const unlockTool: Tool = {
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

export const syncTool: Tool = {
  name: 'sync',
  description: 'Sync vault data from the Bitwarden server',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const statusTool: Tool = {
  name: 'status',
  description: 'Check the status of the Bitwarden CLI',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const listTool: Tool = {
  name: 'list',
  description: 'List items from your vault or organization',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description:
          'Type of items to list (items, folders, collections, organizations, org-collections, org-members)',
        enum: [
          'items',
          'folders',
          'collections',
          'organizations',
          'org-collections',
          'org-members',
        ],
      },
      search: {
        type: 'string',
        description: 'Optional search term to filter results',
      },
      organizationid: {
        type: 'string',
        description:
          'Organization ID (required for org-collections and org-members)',
      },
    },
    required: ['type'],
  },
};

export const getTool: Tool = {
  name: 'get',
  description: 'Get a specific item from your vault or organization',
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
          'org-collection',
        ],
      },
      id: {
        type: 'string',
        description: 'ID or search term for the object',
      },
      organizationid: {
        type: 'string',
        description: 'Organization ID (required for org-collection)',
      },
    },
    required: ['object', 'id'],
  },
};

export const generateTool: Tool = {
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

export const createTool: Tool = {
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
      folderId: {
        type: 'string',
        description:
          'Folder ID to assign the item to (only valid for items, not folders)',
      },
    },
    required: ['objectType', 'name'],
  },
};

export const editTool: Tool = {
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
      folderId: {
        type: 'string',
        description:
          'New folder ID to assign the item to (only valid for items, not folders)',
      },
    },
    required: ['objectType', 'id'],
  },
};

export const deleteTool: Tool = {
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

export const confirmTool: Tool = {
  name: 'confirm',
  description:
    'Confirm an invited organization member who has accepted their invitation',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Organization ID',
      },
      memberId: {
        type: 'string',
        description: 'Member ID (user identifier) to confirm',
      },
    },
    required: ['organizationId', 'memberId'],
  },
};

export const createOrgCollectionTool: Tool = {
  name: 'create_org_collection',
  description: 'Create a new organization collection',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Organization ID',
      },
      name: {
        type: 'string',
        description: 'Name of the collection',
      },
      externalId: {
        type: 'string',
        description: 'External ID for the collection (optional)',
      },
      groups: {
        type: 'array',
        description: 'Array of group IDs with access to this collection',
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
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether passwords are hidden from the group',
            },
          },
          required: ['id'],
        },
      },
    },
    required: ['organizationId', 'name'],
  },
};

export const editOrgCollectionTool: Tool = {
  name: 'edit_org_collection',
  description: 'Edit an existing organization collection',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Organization ID',
      },
      collectionId: {
        type: 'string',
        description: 'Collection ID to edit',
      },
      name: {
        type: 'string',
        description: 'New name for the collection',
      },
      externalId: {
        type: 'string',
        description: 'External ID for the collection (optional)',
      },
      groups: {
        type: 'array',
        description: 'Array of group IDs with access to this collection',
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
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether passwords are hidden from the group',
            },
          },
          required: ['id'],
        },
      },
    },
    required: ['organizationId', 'collectionId'],
  },
};

export const editItemCollectionsTool: Tool = {
  name: 'edit_item_collections',
  description: 'Edit which collections an item belongs to',
  inputSchema: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'Item ID to edit collections for',
      },
      organizationId: {
        type: 'string',
        description: 'Organization ID',
      },
      collectionIds: {
        type: 'array',
        description: 'Array of collection IDs the item should belong to',
        items: {
          type: 'string',
        },
      },
    },
    required: ['itemId', 'organizationId', 'collectionIds'],
  },
};

// Export all CLI tools as an array
export const cliTools = [
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
  confirmTool,
  createOrgCollectionTool,
  editOrgCollectionTool,
  editItemCollectionsTool,
];
