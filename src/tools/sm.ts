/**
 * Secrets Manager tool definitions for projects and secrets
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const generateProperty = {
  type: 'object',
  description:
    'Generate a random value on the server instead of passing one. The generated value is stored but never returned.',
  properties: {
    length: {
      type: 'number',
      description: 'Length of the value (5-256, default 32)',
    },
    uppercase: {
      type: 'boolean',
      description: 'Include uppercase characters (default true)',
    },
    lowercase: {
      type: 'boolean',
      description: 'Include lowercase characters (default true)',
    },
    number: {
      type: 'boolean',
      description: 'Include numbers (default true)',
    },
    special: {
      type: 'boolean',
      description: 'Include special characters (default true)',
    },
  },
} as const;

// Secrets Manager Projects Tools
export const listSmProjectsTool: Tool = {
  name: 'list_sm_projects',
  description:
    'List the Secrets Manager projects the machine account can access',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const getSmProjectTool: Tool = {
  name: 'get_sm_project',
  description: 'Retrieve a Secrets Manager project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'ID of the project',
      },
    },
    required: ['projectId'],
  },
};

export const createSmProjectTool: Tool = {
  name: 'create_sm_project',
  description: 'Create a Secrets Manager project',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the project',
      },
    },
    required: ['name'],
  },
};

export const editSmProjectTool: Tool = {
  name: 'edit_sm_project',
  description: 'Rename a Secrets Manager project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'ID of the project',
      },
      name: {
        type: 'string',
        description: 'New name of the project',
      },
    },
    required: ['projectId', 'name'],
  },
};

export const deleteSmProjectTool: Tool = {
  name: 'delete_sm_project',
  description: 'Delete a Secrets Manager project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'ID of the project',
      },
    },
    required: ['projectId'],
  },
};

// Secrets Manager Secrets Tools
export const listSmSecretsTool: Tool = {
  name: 'list_sm_secrets',
  description:
    'List Secrets Manager secrets with their keys and metadata. Values are never included; use get_sm_secret when a value is needed.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Only list the secrets of this project',
      },
    },
  },
};

export const getSmSecretTool: Tool = {
  name: 'get_sm_secret',
  description:
    'Retrieve a Secrets Manager secret, including its value. Use it only when the value itself is needed.',
  inputSchema: {
    type: 'object',
    properties: {
      secretId: {
        type: 'string',
        description: 'ID of the secret',
      },
    },
    required: ['secretId'],
  },
};

export const createSmSecretTool: Tool = {
  name: 'create_sm_secret',
  description:
    'Create a secret in a Secrets Manager project. Pass either value or generate. The result does not include the value.',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Name of the secret (e.g. DATABASE_PASSWORD)',
      },
      projectId: {
        type: 'string',
        description: 'ID of the project the secret is added to',
      },
      value: {
        type: 'string',
        description: 'Value of the secret',
      },
      generate: generateProperty,
      note: {
        type: 'string',
        description: 'Optional note',
      },
    },
    required: ['key', 'projectId'],
  },
};

export const editSmSecretTool: Tool = {
  name: 'edit_sm_secret',
  description:
    'Edit a Secrets Manager secret: its key, value (passed or generated), note or project. The result does not include the value.',
  inputSchema: {
    type: 'object',
    properties: {
      secretId: {
        type: 'string',
        description: 'ID of the secret',
      },
      key: {
        type: 'string',
        description: 'New name of the secret',
      },
      value: {
        type: 'string',
        description: 'New value of the secret',
      },
      generate: generateProperty,
      note: {
        type: 'string',
        description: 'New note',
      },
      projectId: {
        type: 'string',
        description: 'ID of the project to move the secret to',
      },
    },
    required: ['secretId'],
  },
};

export const deleteSmSecretTool: Tool = {
  name: 'delete_sm_secret',
  description: 'Delete a Secrets Manager secret',
  inputSchema: {
    type: 'object',
    properties: {
      secretId: {
        type: 'string',
        description: 'ID of the secret',
      },
    },
    required: ['secretId'],
  },
};

export const importSmSecretsTool: Tool = {
  name: 'import_sm_secrets',
  description:
    'Create secrets in a Secrets Manager project from a dotenv file (KEY=VALUE lines) inside BW_ALLOWED_DIRECTORIES. The server reads the values; the result lists only the keys created, updated, skipped or failed.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the dotenv file to read',
      },
      projectId: {
        type: 'string',
        description: 'ID of the project the secrets are written to',
      },
      overwrite: {
        type: 'boolean',
        description:
          'Replace the value of secrets whose key already exists in the project (default false: they are skipped)',
      },
    },
    required: ['filePath', 'projectId'],
  },
};

export const exportSmSecretsTool: Tool = {
  name: 'export_sm_secrets',
  description:
    'Write the secrets of a Secrets Manager project to a dotenv file inside BW_ALLOWED_DIRECTORIES, readable only by its owner. The result lists only the keys written or skipped.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the dotenv file to write',
      },
      projectId: {
        type: 'string',
        description: 'ID of the project whose secrets are exported',
      },
      overwrite: {
        type: 'boolean',
        description: 'Replace the file if it already exists (default false)',
      },
    },
    required: ['filePath', 'projectId'],
  },
};

// Export all Secrets Manager tools as an array
export const secretsManagerTools = [
  // Projects
  listSmProjectsTool,
  getSmProjectTool,
  createSmProjectTool,
  editSmProjectTool,
  deleteSmProjectTool,
  // Secrets
  listSmSecretsTool,
  getSmSecretTool,
  createSmSecretTool,
  editSmSecretTool,
  deleteSmSecretTool,
  importSmSecretsTool,
  exportSmSecretsTool,
];
