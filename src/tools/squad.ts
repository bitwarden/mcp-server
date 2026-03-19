/**
 * Squad-specific tool definitions for AI agent credential management
 *
 * These tools provide restricted, audited access to Bitwarden vault
 * for AI squad agents. Key restrictions:
 * - All items namespaced per squad (e.g., "tamresearch1/key", "content-empire/token")
 * - No delete operations
 * - All access logged to audit trail
 * - Multi-squad support via configurable collection mapping
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const squadParam = {
  type: 'string',
  description:
    'Squad name for multi-squad isolation. Each squad gets its own namespace ' +
    'and can map to a separate Bitwarden Collection. ' +
    'If omitted, uses the default squad from BW_SQUAD_DEFAULT_NAME env var (or "squad"). ' +
    'Examples: "tamresearch1", "content-empire", "research"',
};

export const squadStoreTool: Tool = {
  name: 'squad_store',
  description:
    'Store a credential in a squad vault. Items are namespaced per squad. ' +
    'Use for API keys, tokens, service passwords that squad agents need. ' +
    'All stores are logged to the audit trail.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Name for the credential (will be prefixed with "{squad}/" if not already). ' +
          'Examples: "github-api-key", "azure-storage-key", "npm-token"',
      },
      username: {
        type: 'string',
        description: 'Username or identifier for the credential',
      },
      password: {
        type: 'string',
        description: 'Password, token, or secret value to store',
      },
      uri: {
        type: 'string',
        description: 'URL associated with the credential (optional)',
      },
      notes: {
        type: 'string',
        description:
          'Notes about the credential — include agent name, purpose, and issue number. ' +
          'Example: "Created by Data for Azure deployment. Issue: #729"',
      },
      agent: {
        type: 'string',
        description: 'Name of the squad agent storing this credential',
      },
      issue: {
        type: 'string',
        description: 'Related issue number (e.g., "#729")',
      },
      squad: squadParam,
    },
    required: ['name', 'password', 'agent'],
  },
};

export const squadGetTool: Tool = {
  name: 'squad_get',
  description:
    'Retrieve a credential from a squad vault by name. ' +
    'Only items in the squad namespace are accessible. ' +
    'All retrievals are logged to the audit trail.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Name of the credential to retrieve (with or without squad prefix)',
      },
      agent: {
        type: 'string',
        description: 'Name of the squad agent retrieving this credential',
      },
      reason: {
        type: 'string',
        description: 'Why this credential is needed (logged to audit trail)',
      },
      squad: squadParam,
    },
    required: ['name', 'agent'],
  },
};

export const squadListTool: Tool = {
  name: 'squad_list',
  description:
    'List all credentials in a squad vault namespace. ' +
    'Returns names and metadata only — not passwords.',
  inputSchema: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description: 'Optional search term to filter squad credentials',
      },
      agent: {
        type: 'string',
        description: 'Name of the squad agent listing credentials',
      },
      squad: squadParam,
    },
    required: ['agent'],
  },
};

export const squadAuditTool: Tool = {
  name: 'squad_audit',
  description:
    'View the squad credential access audit log. ' +
    'Shows who accessed what and when. ' +
    'Available to all squad agents for transparency.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of audit entries to return (default: 20)',
      },
      item: {
        type: 'string',
        description: 'Filter audit log by item name',
      },
      agent: {
        type: 'string',
        description: 'Filter audit log by agent name',
      },
      squad: squadParam,
    },
  },
};

export const squadTools: Tool[] = [
  squadStoreTool,
  squadGetTool,
  squadListTool,
  squadAuditTool,
];
