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
import { CliResponse, BitwardenItem, BitwardenFolder } from '../utils/types.js';

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
    const { objectType, name, type, notes, login, folderId } = validatedArgs;

    if (objectType === 'folder') {
      const folder: BitwardenFolder = { name };
      const itemJson = JSON.stringify(folder);
      const encodedItem = Buffer.from(itemJson).toString('base64');
      const command = buildSafeCommand('create', ['folder', encodedItem]);
      const response = await executeCliCommand(command);
      return toMcpFormat(response);
    } else {
      // Creating an item
      const item: BitwardenItem = {
        name,
      };

      if (type !== undefined) {
        item.type = type;
      }

      if (notes !== undefined) {
        item.notes = notes;
      }

      if (folderId !== undefined) {
        item.folderId = folderId;
      }

      if (type === 1 && login) {
        // Only set defined login properties
        const loginData: BitwardenItem['login'] = {};
        if (login.username !== undefined) loginData.username = login.username;
        if (login.password !== undefined) loginData.password = login.password;
        if (login.totp !== undefined) loginData.totp = login.totp;
        if (login.uris !== undefined) loginData.uris = login.uris;
        item.login = loginData;
      }

      const itemJson = JSON.stringify(item);
      const encodedItem = Buffer.from(itemJson).toString('base64');
      const command = buildSafeCommand('create', ['item', encodedItem]);
      const response = await executeCliCommand(command);
      return toMcpFormat(response);
    }
  },
);

export const handleEdit = withValidation(editSchema, async (validatedArgs) => {
  const { objectType, id, name, notes, login, folderId } = validatedArgs;

  if (objectType === 'folder') {
    // For folders, we still just update the name directly
    const folder: BitwardenFolder = { name: name! }; // name is required for folder operations
    const itemJson = JSON.stringify(folder);
    const encodedItem = Buffer.from(itemJson).toString('base64');
    const command = buildSafeCommand('edit', ['folder', id, encodedItem]);
    const response = await executeCliCommand(command);
    return toMcpFormat(response);
  } else {
    // First, get the existing item
    const getCommand = buildSafeCommand('get', ['item', id]);
    const getResponse = await executeCliCommand(getCommand);

    if (getResponse.errorOutput) {
      return toMcpFormat(getResponse);
    }

    try {
      // Parse the existing item with proper typing
      const existingItem: BitwardenItem = JSON.parse(
        getResponse.output || '{}',
      );

      // Only update properties that were provided
      if (name !== undefined) existingItem.name = name;
      if (notes !== undefined) existingItem.notes = notes;
      if (folderId !== undefined) existingItem.folderId = folderId;
      if (login !== undefined) {
        // Merge login properties with existing login data, maintaining type safety
        const currentLogin = existingItem.login || {};
        const updatedLogin: BitwardenItem['login'] = {
          ...currentLogin,
          ...(login.username !== undefined && { username: login.username }),
          ...(login.password !== undefined && { password: login.password }),
          ...(login.totp !== undefined && { totp: login.totp }),
          ...(login.uris !== undefined && { uris: login.uris }),
        };
        existingItem.login = updatedLogin;
      }

      const updatesJson = JSON.stringify(existingItem);
      const encodedUpdates = Buffer.from(updatesJson).toString('base64');
      const command = buildSafeCommand('edit', ['item', id, encodedUpdates]);
      const response = await executeCliCommand(command);
      return toMcpFormat(response);
    } catch (error) {
      const errorResponse: CliResponse = {
        errorOutput: `Failed to parse existing item: ${error instanceof Error ? error.message : String(error)}`,
      };
      return toMcpFormat(errorResponse);
    }
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
