/**
 * CLI command handlers for personal vault operations
 */

import { executeCliCommand } from '../utils/cli.js';
import { validateInput } from '../utils/validation.js';
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
  const [success] = validateInput(lockSchema, {});
  if (!success) {
    return { errorOutput: 'Validation failed for lock command' };
  }
  return executeCliCommand('lock');
}

export async function handleUnlock(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(unlockSchema, args);
  if (!success) {
    return { errorOutput: 'Validation failed for unlock command' };
  }
  const { password } = validatedArgs;
  return executeCliCommand(`unlock ${password} --raw`);
}

export async function handleSync(): Promise<CliResponse> {
  const [success] = validateInput(syncSchema, {});
  if (!success) {
    return { errorOutput: 'Validation failed for sync command' };
  }
  return executeCliCommand('sync');
}

export async function handleStatus(): Promise<CliResponse> {
  const [success] = validateInput(statusSchema, {});
  if (!success) {
    return { errorOutput: 'Validation failed for status command' };
  }
  return executeCliCommand('status');
}

export async function handleList(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(listSchema, args);
  if (!success) {
    return { errorOutput: 'Validation failed for list command' };
  }
  const { type, search } = validatedArgs;
  let command = `list ${type}`;
  if (search) {
    command += ` --search "${search}"`;
  }
  return executeCliCommand(command);
}

export async function handleGet(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(getSchema, args);
  if (!success) {
    return { errorOutput: 'Validation failed for get command' };
  }
  const { object, id } = validatedArgs;
  return executeCliCommand(`get ${object} "${id}"`);
}

export async function handleGenerate(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(generateSchema, args);
  if (!success) {
    return { errorOutput: 'Validation failed for generate command' };
  }

  let command = 'generate';

  if (validatedArgs.passphrase) {
    command += ' --passphrase';
    if (validatedArgs.words) {
      command += ` --words ${validatedArgs.words}`;
    }
    if (validatedArgs.separator) {
      command += ` --separator "${validatedArgs.separator}"`;
    }
    if (validatedArgs.capitalize) {
      command += ' --capitalize';
    }
  } else {
    if (validatedArgs.length) {
      command += ` --length ${validatedArgs.length}`;
    }
    if (validatedArgs.uppercase === false) {
      command += ' --noUppercase';
    }
    if (validatedArgs.lowercase === false) {
      command += ' --noLowercase';
    }
    if (validatedArgs.number === false) {
      command += ' --noNumbers';
    }
    if (validatedArgs.special === false) {
      command += ' --noSpecial';
    }
  }

  return executeCliCommand(command);
}

export async function handleCreate(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(createSchema, args);
  if (!success) {
    return { errorOutput: 'Validation failed for create command' };
  }
  const { objectType, name, type, notes, login } = validatedArgs;

  if (objectType === 'folder') {
    const encodedItem = JSON.stringify({ name });
    return executeCliCommand(`create folder '${encodedItem}'`);
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
    return executeCliCommand(`create item '${encodedItem}'`);
  }
}

export async function handleEdit(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(editSchema, args);
  if (!success) {
    return { errorOutput: 'Validation failed for edit command' };
  }
  const { objectType, id, name, notes, login } = validatedArgs;

  if (objectType === 'folder') {
    const encodedItem = JSON.stringify({ name });
    return executeCliCommand(`edit folder ${id} '${encodedItem}'`);
  } else {
    // Editing an item
    const updates: Record<string, unknown> = {};
    if (name) updates['name'] = name;
    if (notes) updates['notes'] = notes;
    if (login) updates['login'] = login;

    const encodedUpdates = JSON.stringify(updates);
    return executeCliCommand(`edit item ${id} '${encodedUpdates}'`);
  }
}

export async function handleDelete(args: unknown): Promise<CliResponse> {
  const [success, validatedArgs] = validateInput(deleteSchema, args);
  if (!success) {
    return { errorOutput: 'Validation failed for delete command' };
  }
  const { object, id, permanent } = validatedArgs;
  let command = `delete ${object} ${id}`;
  if (permanent) {
    command += ' --permanent';
  }
  return executeCliCommand(command);
}
