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
      url: {
        type: 'string',
        description:
          'Filter items by URL (items only, supports "null" and "notnull" literals)',
      },
      folderid: {
        type: 'string',
        description:
          'Filter items by folder ID (items only, supports "null" and "notnull" literals)',
      },
      collectionid: {
        type: 'string',
        description:
          'Filter items by collection ID (items only, supports "null" and "notnull" literals)',
      },
      trash: {
        type: 'boolean',
        description: 'Filter for items in trash (items only)',
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
          'fingerprint',
        ],
      },
      id: {
        type: 'string',
        description:
          'ID or search term for the object (use "me" for your own fingerprint, or filename for attachment)',
      },
      organizationid: {
        type: 'string',
        description: 'Organization ID (required for org-collection)',
      },
      itemid: {
        type: 'string',
        description: 'Item ID (required for attachment)',
      },
      output: {
        type: 'string',
        description:
          'Output directory path for downloading attachment (optional, should end with /)',
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

export const createItemTool: Tool = {
  name: 'create_item',
  description:
    'Create a new item (login, secure note, card, or identity) in your vault',
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
          'Type of item to create (1: Login, 2: Secure Note, 3: Card, 4: Identity)',
        enum: [1, 2, 3, 4],
      },
      notes: {
        type: 'string',
        description: 'Notes for the item',
      },
      login: {
        type: 'object',
        description: 'Login information (required for type 1 - login items)',
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
      secureNote: {
        type: 'object',
        description:
          'Secure note information (required for type 2 - secure note items)',
        properties: {
          type: {
            type: 'number',
            description: 'Type of secure note (0: Generic)',
            enum: [0],
          },
        },
      },
      card: {
        type: 'object',
        description: 'Card information (required for type 3 - card items)',
        properties: {
          cardholderName: {
            type: 'string',
            description: 'Cardholder name',
          },
          number: {
            type: 'string',
            description: 'Card number',
          },
          brand: {
            type: 'string',
            description: 'Card brand (Visa, Mastercard, Amex, Discover, etc.)',
          },
          expMonth: {
            type: 'string',
            description: 'Expiration month (MM)',
          },
          expYear: {
            type: 'string',
            description: 'Expiration year (YYYY)',
          },
          code: {
            type: 'string',
            description: 'Security code (CVV)',
          },
        },
      },
      identity: {
        type: 'object',
        description:
          'Identity information (required for type 4 - identity items)',
        properties: {
          title: {
            type: 'string',
            description: 'Title (Mr, Mrs, Ms, Dr, etc.)',
          },
          firstName: {
            type: 'string',
            description: 'First name',
          },
          middleName: {
            type: 'string',
            description: 'Middle name',
          },
          lastName: {
            type: 'string',
            description: 'Last name',
          },
          address1: {
            type: 'string',
            description: 'Address line 1',
          },
          address2: {
            type: 'string',
            description: 'Address line 2',
          },
          address3: {
            type: 'string',
            description: 'Address line 3',
          },
          city: {
            type: 'string',
            description: 'City',
          },
          state: {
            type: 'string',
            description: 'State or province',
          },
          postalCode: {
            type: 'string',
            description: 'Postal code',
          },
          country: {
            type: 'string',
            description: 'Country',
          },
          company: {
            type: 'string',
            description: 'Company name',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
          phone: {
            type: 'string',
            description: 'Phone number',
          },
          ssn: {
            type: 'string',
            description: 'Social Security Number',
          },
          username: {
            type: 'string',
            description: 'Username',
          },
          passportNumber: {
            type: 'string',
            description: 'Passport number',
          },
          licenseNumber: {
            type: 'string',
            description: 'License number',
          },
        },
      },
      folderId: {
        type: 'string',
        description: 'Folder ID to assign the item to',
      },
    },
    required: ['name', 'type'],
  },
};

export const createFolderTool: Tool = {
  name: 'create_folder',
  description: 'Create a new folder in your vault',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the folder',
      },
    },
    required: ['name'],
  },
};

export const editItemTool: Tool = {
  name: 'edit_item',
  description:
    'Edit an existing item (login, secure note, card, or identity) in your vault',
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
      secureNote: {
        type: 'object',
        description: 'Secure note information to update',
        properties: {
          type: {
            type: 'number',
            description: 'Type of secure note (0: Generic)',
            enum: [0],
          },
        },
      },
      card: {
        type: 'object',
        description: 'Card information to update',
        properties: {
          cardholderName: {
            type: 'string',
            description: 'Cardholder name',
          },
          number: {
            type: 'string',
            description: 'Card number',
          },
          brand: {
            type: 'string',
            description: 'Card brand (Visa, Mastercard, Amex, Discover, etc.)',
          },
          expMonth: {
            type: 'string',
            description: 'Expiration month (MM)',
          },
          expYear: {
            type: 'string',
            description: 'Expiration year (YYYY)',
          },
          code: {
            type: 'string',
            description: 'Security code (CVV)',
          },
        },
      },
      identity: {
        type: 'object',
        description: 'Identity information to update',
        properties: {
          title: {
            type: 'string',
            description: 'Title (Mr, Mrs, Ms, Dr, etc.)',
          },
          firstName: {
            type: 'string',
            description: 'First name',
          },
          middleName: {
            type: 'string',
            description: 'Middle name',
          },
          lastName: {
            type: 'string',
            description: 'Last name',
          },
          address1: {
            type: 'string',
            description: 'Address line 1',
          },
          address2: {
            type: 'string',
            description: 'Address line 2',
          },
          address3: {
            type: 'string',
            description: 'Address line 3',
          },
          city: {
            type: 'string',
            description: 'City',
          },
          state: {
            type: 'string',
            description: 'State or province',
          },
          postalCode: {
            type: 'string',
            description: 'Postal code',
          },
          country: {
            type: 'string',
            description: 'Country',
          },
          company: {
            type: 'string',
            description: 'Company name',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
          phone: {
            type: 'string',
            description: 'Phone number',
          },
          ssn: {
            type: 'string',
            description: 'Social Security Number',
          },
          username: {
            type: 'string',
            description: 'Username',
          },
          passportNumber: {
            type: 'string',
            description: 'Passport number',
          },
          licenseNumber: {
            type: 'string',
            description: 'License number',
          },
        },
      },
      folderId: {
        type: 'string',
        description: 'New folder ID to assign the item to',
      },
    },
    required: ['id'],
  },
};

export const editFolderTool: Tool = {
  name: 'edit_folder',
  description: 'Edit an existing folder in your vault',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID of the folder to edit',
      },
      name: {
        type: 'string',
        description: 'New name for the folder',
      },
    },
    required: ['id', 'name'],
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

export const moveTool: Tool = {
  name: 'move',
  description:
    'Move (share) a vault item to an organization (formerly the share command)',
  inputSchema: {
    type: 'object',
    properties: {
      itemId: {
        type: 'string',
        description: 'Item ID to move to organization',
      },
      organizationId: {
        type: 'string',
        description: 'Organization ID to move the item to',
      },
      collectionIds: {
        type: 'array',
        description:
          'Array of collection IDs the item should be added to in the organization',
        items: {
          type: 'string',
        },
      },
    },
    required: ['itemId', 'organizationId', 'collectionIds'],
  },
};

export const deviceApprovalListTool: Tool = {
  name: 'device_approval_list',
  description: 'List all pending device approval requests for an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Organization ID',
      },
    },
    required: ['organizationId'],
  },
};

export const deviceApprovalApproveTool: Tool = {
  name: 'device_approval_approve',
  description: 'Approve a pending device authorization request',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Organization ID',
      },
      requestId: {
        type: 'string',
        description: 'Device approval request ID',
      },
    },
    required: ['organizationId', 'requestId'],
  },
};

export const deviceApprovalApproveAllTool: Tool = {
  name: 'device_approval_approve_all',
  description: 'Approve all current pending device authorization requests',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Organization ID',
      },
    },
    required: ['organizationId'],
  },
};

export const deviceApprovalDenyTool: Tool = {
  name: 'device_approval_deny',
  description: 'Deny a pending device authorization request',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Organization ID',
      },
      requestId: {
        type: 'string',
        description: 'Device approval request ID',
      },
    },
    required: ['organizationId', 'requestId'],
  },
};

export const deviceApprovalDenyAllTool: Tool = {
  name: 'device_approval_deny_all',
  description: 'Deny all pending device authorization requests',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Organization ID',
      },
    },
    required: ['organizationId'],
  },
};

export const restoreTool: Tool = {
  name: 'restore',
  description: 'Restore an item from trash',
  inputSchema: {
    type: 'object',
    properties: {
      object: {
        type: 'string',
        description: 'Type of object to restore',
        enum: ['item'],
      },
      id: {
        type: 'string',
        description: 'ID of the object to restore',
      },
    },
    required: ['object', 'id'],
  },
};

export const createTextSendTool: Tool = {
  name: 'create_text_send',
  description: 'Create a new Bitwarden Send for securely sharing text',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the Send',
      },
      text: {
        type: 'string',
        description: 'Text content to share',
      },
      hidden: {
        type: 'boolean',
        description: 'Hide text content (requires visibility toggle)',
      },
      notes: {
        type: 'string',
        description: 'Private notes (not shared with recipient)',
      },
      password: {
        type: 'string',
        description: 'Access password for the Send',
      },
      maxAccessCount: {
        type: 'number',
        description: 'Maximum number of times the Send can be accessed',
      },
      expirationDate: {
        type: 'string',
        description: 'Expiration date in ISO 8601 format',
      },
      deletionDate: {
        type: 'string',
        description: 'Deletion date in ISO 8601 format',
      },
    },
    required: ['name', 'text'],
  },
};

export const createFileSendTool: Tool = {
  name: 'create_file_send',
  description: 'Create a new Bitwarden Send for securely sharing a file',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the Send',
      },
      filePath: {
        type: 'string',
        description: 'Path to the file to share',
      },
      notes: {
        type: 'string',
        description: 'Private notes (not shared with recipient)',
      },
      password: {
        type: 'string',
        description: 'Access password for the Send',
      },
      maxAccessCount: {
        type: 'number',
        description: 'Maximum number of times the Send can be accessed',
      },
      expirationDate: {
        type: 'string',
        description: 'Expiration date in ISO 8601 format',
      },
      deletionDate: {
        type: 'string',
        description: 'Deletion date in ISO 8601 format',
      },
    },
    required: ['name', 'filePath'],
  },
};

export const listSendTool: Tool = {
  name: 'list_send',
  description: 'List all Bitwarden Sends',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const getSendTool: Tool = {
  name: 'get_send',
  description: 'Get details of a specific Bitwarden Send',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID of the Send to retrieve',
      },
    },
    required: ['id'],
  },
};

export const editSendTool: Tool = {
  name: 'edit_send',
  description: 'Edit an existing Bitwarden Send',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID of the Send to edit',
      },
      name: {
        type: 'string',
        description: 'New name for the Send',
      },
      notes: {
        type: 'string',
        description: 'New private notes',
      },
      password: {
        type: 'string',
        description: 'New access password',
      },
      maxAccessCount: {
        type: 'number',
        description: 'New maximum access count',
      },
      expirationDate: {
        type: 'string',
        description: 'New expiration date in ISO 8601 format',
      },
      deletionDate: {
        type: 'string',
        description: 'New deletion date in ISO 8601 format',
      },
      disabled: {
        type: 'boolean',
        description: 'Disable the Send',
      },
    },
    required: ['id'],
  },
};

export const deleteSendTool: Tool = {
  name: 'delete_send',
  description: 'Delete a Bitwarden Send',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID of the Send to delete',
      },
    },
    required: ['id'],
  },
};

export const removeSendPasswordTool: Tool = {
  name: 'remove_send_password',
  description: 'Remove the access password from a Bitwarden Send',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'ID of the Send to remove password from',
      },
    },
    required: ['id'],
  },
};

export const createAttachmentTool: Tool = {
  name: 'create_attachment',
  description: 'Attach a file to an existing vault item',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file to attach',
      },
      itemId: {
        type: 'string',
        description: 'ID of the vault item to attach the file to',
      },
    },
    required: ['filePath', 'itemId'],
  },
};

// Export all CLI tools as an array
export const cliTools = [
  lockTool,
  syncTool,
  statusTool,
  listTool,
  getTool,
  generateTool,
  createItemTool,
  createFolderTool,
  editItemTool,
  editFolderTool,
  deleteTool,
  confirmTool,
  createOrgCollectionTool,
  editOrgCollectionTool,
  editItemCollectionsTool,
  moveTool,
  deviceApprovalListTool,
  deviceApprovalApproveTool,
  deviceApprovalApproveAllTool,
  deviceApprovalDenyTool,
  deviceApprovalDenyAllTool,
  restoreTool,
  createTextSendTool,
  createFileSendTool,
  listSendTool,
  getSendTool,
  editSendTool,
  deleteSendTool,
  removeSendPasswordTool,
  createAttachmentTool,
];
