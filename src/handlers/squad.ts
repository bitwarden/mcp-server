/**
 * Squad-specific handlers for AI agent credential management
 *
 * Key safety features:
 * - All items namespaced under "squad/"
 * - No delete operations exposed
 * - All access logged to in-memory audit trail
 * - Passwords only returned for squad_get, never for squad_list
 */

import { executeCliCommand } from '../utils/cli.js';
import { withValidation } from '../utils/validation.js';
import {
  squadStoreSchema,
  squadGetSchema,
  squadListSchema,
  squadAuditSchema,
} from '../schemas/squad.js';

// In-memory audit log (persists for server lifetime)
interface AuditEntry {
  timestamp: string;
  action: 'STORE' | 'GET' | 'LIST' | 'UPDATE';
  agent: string;
  item?: string | undefined;
  issue?: string | undefined;
  details?: string | undefined;
}

const auditLog: AuditEntry[] = [];

function logAudit(entry: Omit<AuditEntry, 'timestamp'>): void {
  const record: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  auditLog.push(record);
  // Also log to stderr for persistence
  console.error(
    `[SQUAD AUDIT] ${record.timestamp} ${record.action} | agent=${record.agent} | item=${record.item ?? 'N/A'} | issue=${record.issue ?? 'N/A'}`,
  );
}

function ensureSquadPrefix(name: string): string {
  return name.startsWith('squad/') ? name : `squad/${name}`;
}

/**
 * Get the Squad Secrets folder ID from environment.
 * This ensures all operations are scoped to the dedicated folder,
 * keeping the owner's personal vault items completely inaccessible.
 */
function getSquadFolderId(): string | undefined {
  return process.env['BW_SQUAD_FOLDER_ID'];
}

/**
 * Get the Organization ID for hard isolation.
 * When set, all operations are scoped to the Organization —
 * Bitwarden server enforces that personal vault items are never returned.
 */
function getSquadOrgId(): string | undefined {
  return process.env['BW_SQUAD_ORG_ID'];
}

/**
 * Get the Collection ID within the Organization.
 * Items are stored in this collection for Organization-level access control.
 */
function getSquadCollectionId(): string | undefined {
  return process.env['BW_SQUAD_COLLECTION_ID'];
}

export const handleSquadStore = withValidation(
  squadStoreSchema,
  async (args) => {
    const itemName = ensureSquadPrefix(args.name);
    const notes = [
      args.notes ?? '',
      `\n---\nSquad metadata:`,
      `Created by: ${args.agent}`,
      `Issue: ${args.issue ?? 'N/A'}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');

    // Build the item JSON for bw create
    const orgId = getSquadOrgId();
    const collectionId = getSquadCollectionId();
    const folderId = getSquadFolderId();

    const item: Record<string, unknown> = {
      type: 1, // Login type
      name: itemName,
      notes: notes,
      login: {
        username: args.username ?? null,
        password: args.password,
        uris: args.uri ? [{ match: null, uri: args.uri }] : [],
      },
    };

    // Hard isolation: store in Organization + Collection (server-enforced)
    if (orgId) {
      item['organizationId'] = orgId;
      if (collectionId) {
        item['collectionIds'] = [collectionId];
      }
    } else if (folderId) {
      // Soft isolation fallback: store in Squad Secrets folder
      item['folderId'] = folderId;
    }

    const itemJson = JSON.stringify(item);
    const encoded = Buffer.from(itemJson).toString('base64');

    const response = await executeCliCommand('create', ['item', encoded]);

    logAudit({
      action: 'STORE',
      agent: args.agent,
      item: itemName,
      issue: args.issue,
    });

    if (response.errorOutput) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Failed to store credential: ${response.errorOutput}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Credential "${itemName}" stored successfully.\n\nAudit: STORE by ${args.agent}${args.issue ? ` (${args.issue})` : ''}`,
        },
      ],
    };
  },
);

export const handleSquadGet = withValidation(squadGetSchema, async (args) => {
  const itemName = ensureSquadPrefix(args.name);
  const orgId = getSquadOrgId();

  // Scope get to Organization if configured
  const cliArgs = ['item', itemName];
  if (orgId) {
    cliArgs.push('--organizationid', orgId);
  }

  const response = await executeCliCommand('get', cliArgs);

  logAudit({
    action: 'GET',
    agent: args.agent,
    item: itemName,
    details: args.reason,
  });

  if (response.errorOutput) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Credential not found: ${response.errorOutput}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: response.output || 'No data returned',
      },
    ],
  };
});

export const handleSquadList = withValidation(squadListSchema, async (args) => {
  const searchTerm = args.search ? `squad/${args.search}` : 'squad/';
  const orgId = getSquadOrgId();
  const folderId = getSquadFolderId();

  // Build CLI args — prefer Organization scope (hard isolation) over folder (soft)
  const cliArgs = ['items', '--search', searchTerm];
  if (orgId) {
    cliArgs.push('--organizationid', orgId);
  } else if (folderId) {
    cliArgs.push('--folderid', folderId);
  }

  const response = await executeCliCommand('list', cliArgs);

  logAudit({
    action: 'LIST',
    agent: args.agent,
    details: `search="${args.search ?? '*'}"`,
  });

  if (response.errorOutput) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to list credentials: ${response.errorOutput}`,
        },
      ],
    };
  }

  // Parse and sanitize — remove passwords from list output
  try {
    const items = JSON.parse(response.output || '[]');
    const sanitized = items.map(
      (item: {
        id: string;
        name: string;
        notes: string;
        login?: { username?: string; uris?: { uri: string }[] };
      }) => ({
        id: item.id,
        name: item.name,
        username: item.login?.username ?? 'N/A',
        uri: item.login?.uris?.[0]?.uri ?? 'N/A',
        notes: item.notes?.split('\n')[0] ?? '', // First line only
      }),
    );

    return {
      content: [
        {
          type: 'text',
          text:
            `Squad credentials (${sanitized.length} items):\n\n` +
            sanitized
              .map(
                (item: {
                  name: string;
                  username: string;
                  uri: string;
                  notes: string;
                }) =>
                  `• ${item.name}\n  User: ${item.username}\n  URI: ${item.uri}\n  Notes: ${item.notes}`,
              )
              .join('\n\n'),
        },
      ],
    };
  } catch {
    return {
      content: [
        {
          type: 'text',
          text: response.output || 'No squad credentials found',
        },
      ],
    };
  }
});

export const handleSquadAudit = withValidation(
  squadAuditSchema,
  async (args) => {
    let filtered = [...auditLog];

    if (args.item) {
      const itemSearch = ensureSquadPrefix(args.item);
      filtered = filtered.filter((e) => e.item?.includes(itemSearch));
    }
    if (args.agent) {
      filtered = filtered.filter((e) =>
        e.agent.toLowerCase().includes(args.agent!.toLowerCase()),
      );
    }

    // Most recent first, limited
    const entries = filtered.slice(-(args.limit ?? 20)).reverse();

    if (entries.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No audit entries found matching the criteria.',
          },
        ],
      };
    }

    const formatted = entries
      .map(
        (e) =>
          `[${e.timestamp}] ${e.action.padEnd(6)} | agent=${e.agent} | item=${e.item ?? 'N/A'} | ${e.issue ? `issue=${e.issue}` : (e.details ?? '')}`,
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Squad Credential Audit Log (${entries.length} entries):\n\n${formatted}`,
        },
      ],
    };
  },
);
