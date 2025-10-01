/**
 * CLI command handlers for personal vault operations
 */

import { executeCliCommand } from '../utils/cli.js';
import { withValidation } from '../utils/validation.js';
import { buildSafeCommand } from '../utils/security.js';
import {
  lockSchema,
  unlockSchema,
  syncSchema,
  statusSchema,
  listSchema,
  getSchema,
  generateSchema,
  createSchema,
  editSchema,
  deleteSchema,
} from '../schemas/cli.js';
import { CliResponse } from '../utils/types.js';

function toMcpFormat(response: CliResponse) {
  return {
    isError: response.errorOutput ? true : false,
    content: [
      {
        type: 'text',
        text:
          response.output ||
          response.errorOutput ||
          'Success: Operation completed',
      },
    ],
  };
}

export const handleLock = withValidation(lockSchema, async () => {
  const response = await executeCliCommand('lock');
  return toMcpFormat(response);
});

export const handleUnlock = withValidation(
  unlockSchema,
  async (validatedArgs) => {
    const { password } = validatedArgs;
    const command = buildSafeCommand('unlock', [password, '--raw']);
    const response = await executeCliCommand(command);
    return toMcpFormat(response);
  },
);

export const handleSync = withValidation(syncSchema, async () => {
  const response = await executeCliCommand('sync');
  return toMcpFormat(response);
});

export const handleStatus = withValidation(statusSchema, async () => {
  const response = await executeCliCommand('status');
  return toMcpFormat(response);
});

export const handleList = withValidation(listSchema, async (validatedArgs) => {
  const { type, search } = validatedArgs;
  const params: string[] = [type];
  if (search) {
    params.push('--search', search);
  }
  const command = buildSafeCommand('list', params);
  const response = await executeCliCommand(command);
  return toMcpFormat(response);
});

export const handleGet = withValidation(getSchema, async (validatedArgs) => {
  const { object, id } = validatedArgs;
  const command = buildSafeCommand('get', [object, id]);
  const response = await executeCliCommand(command);
  return toMcpFormat(response);
});

export const handleGenerate = withValidation(
  generateSchema,
  async (validatedArgs) => {
    const params: string[] = [];

    if (validatedArgs.passphrase) {
      params.push('--passphrase');
      if (validatedArgs.words) {
        params.push('--words', validatedArgs.words.toString());
      }
      if (validatedArgs.separator) {
        params.push('--separator', validatedArgs.separator);
      }
      if (validatedArgs.capitalize) {
        params.push('--capitalize');
      }
    } else {
      if (validatedArgs.length) {
        params.push('--length', validatedArgs.length.toString());
      }
      if (validatedArgs.uppercase === false) {
        params.push('--noUppercase');
      }
      if (validatedArgs.lowercase === false) {
        params.push('--noLowercase');
      }
      if (validatedArgs.number === false) {
        params.push('--noNumbers');
      }
      if (validatedArgs.special === false) {
        params.push('--noSpecial');
      }
    }

    const command = buildSafeCommand('generate', params);
    const response = await executeCliCommand(command);
    return toMcpFormat(response);
  },
);

export const handleCreate = withValidation(
  createSchema,
  async (validatedArgs) => {
    const { objectType, name, type, notes, login } = validatedArgs;

    if (objectType === 'folder') {
      const encodedItem = JSON.stringify({ name });
      const command = buildSafeCommand('create', ['folder', encodedItem]);
      const response = await executeCliCommand(command);
      return toMcpFormat(response);
    } else {
      // Creating an item
      const item: Record<string, unknown> = {
        name,
        type,
        notes,
      };

      if (type === 1 && login) {
        item['login'] = login;
      }

      const encodedItem = JSON.stringify(item);
      const command = buildSafeCommand('create', ['item', encodedItem]);
      const response = await executeCliCommand(command);
      return toMcpFormat(response);
    }
  },
);

export const handleEdit = withValidation(editSchema, async (validatedArgs) => {
  const { objectType, id, name, notes, login } = validatedArgs;

  if (objectType === 'folder') {
    const encodedItem = JSON.stringify({ name });
    const command = buildSafeCommand('edit', ['folder', id, encodedItem]);
    const response = await executeCliCommand(command);
    return toMcpFormat(response);
  } else {
    // Editing an item
    const updates: Record<string, unknown> = {};
    if (name) updates['name'] = name;
    if (notes) updates['notes'] = notes;
    if (login) updates['login'] = login;

    const encodedUpdates = JSON.stringify(updates);
    const command = buildSafeCommand('edit', ['item', id, encodedUpdates]);
    const response = await executeCliCommand(command);
    return toMcpFormat(response);
  }
});

export const handleDelete = withValidation(
  deleteSchema,
  async (validatedArgs) => {
    const { object, id, permanent } = validatedArgs;
    const params: string[] = [object, id];
    if (permanent) {
      params.push('--permanent');
    }
    const command = buildSafeCommand('delete', params);
    const response = await executeCliCommand(command);
    return toMcpFormat(response);
  },
);
