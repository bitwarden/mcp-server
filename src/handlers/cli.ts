/**
 * CLI command handlers for personal vault operations
 */

import { executeCliCommand } from '../utils/cli.js';
import { validateInput } from '../utils/validation.js';
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
import type { CliResponse } from '../utils/types.js';

export async function handleLock(): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(lockSchema, {});
  if (!success) {
    return validatedArgs;
  }
  return executeCliCommand('lock');
}

export async function handleUnlock(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(unlockSchema, args);
  if (!success) {
    return validatedArgs;
  }
  const { password } = validatedArgs;
  const command = buildSafeCommand('unlock', [password, '--raw']);
  return executeCliCommand(command);
}

export async function handleSync(): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(syncSchema, {});
  if (!success) {
    return validatedArgs;
  }
  return executeCliCommand('sync');
}

export async function handleStatus(): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(statusSchema, {});
  if (!success) {
    return validatedArgs;
  }
  return executeCliCommand('status');
}

export async function handleList(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(listSchema, args);
  if (!success) {
    return validatedArgs;
  }
  const { type, search } = validatedArgs;
  const params: string[] = [type];
  if (search) {
    params.push('--search', search);
  }
  const command = buildSafeCommand('list', params);
  return executeCliCommand(command);
}

export async function handleGet(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(getSchema, args);
  if (!success) {
    return validatedArgs;
  }
  const { object, id } = validatedArgs;
  const command = buildSafeCommand('get', [object, id]);
  return executeCliCommand(command);
}

export async function handleGenerate(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(generateSchema, args);
  if (!success) {
    return validatedArgs;
  }

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
  return executeCliCommand(command);
}

export async function handleCreate(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(createSchema, args);
  if (!success) {
    return validatedArgs;
  }
  const { objectType, name, type, notes, login } = validatedArgs;

  if (objectType === 'folder') {
    const encodedItem = JSON.stringify({ name });
    const command = buildSafeCommand('create', ['folder', encodedItem]);
    return executeCliCommand(command);
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
    return executeCliCommand(command);
  }
}

export async function handleEdit(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(editSchema, args);
  if (!success) {
    return validatedArgs;
  }
  const { objectType, id, name, notes, login } = validatedArgs;

  if (objectType === 'folder') {
    const encodedItem = JSON.stringify({ name });
    const command = buildSafeCommand('edit', ['folder', id, encodedItem]);
    return executeCliCommand(command);
  } else {
    // Editing an item
    const updates: Record<string, unknown> = {};
    if (name) updates['name'] = name;
    if (notes) updates['notes'] = notes;
    if (login) updates['login'] = login;

    const encodedUpdates = JSON.stringify(updates);
    const command = buildSafeCommand('edit', ['item', id, encodedUpdates]);
    return executeCliCommand(command);
  }
}

export async function handleDelete(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(deleteSchema, args);
  if (!success) {
    return validatedArgs;
  }
  const { object, id, permanent } = validatedArgs;
  const params: string[] = [object, id];
  if (permanent) {
    params.push('--permanent');
  }
  const command = buildSafeCommand('delete', params);
  return executeCliCommand(command);
}
