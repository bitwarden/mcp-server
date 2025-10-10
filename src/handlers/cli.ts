/**
 * CLI command handlers for personal vault operations
 */

import { executeCliCommand } from '../utils/cli.js';
import { withValidation } from '../utils/validation.js';
import {
  lockSchema,
  syncSchema,
  statusSchema,
  listSchema,
  getSchema,
  generateSchema,
  createItemSchema,
  createFolderSchema,
  editItemSchema,
  editFolderSchema,
  deleteSchema,
  confirmSchema,
  createOrgCollectionSchema,
  editOrgCollectionSchema,
  editItemCollectionsSchema,
  moveSchema,
  deviceApprovalListSchema,
  deviceApprovalApproveSchema,
  deviceApprovalApproveAllSchema,
  deviceApprovalDenySchema,
  deviceApprovalDenyAllSchema,
  restoreSchema,
  createTextSendSchema,
  createFileSendSchema,
  listSendSchema,
  getSendSchema,
  editSendSchema,
  deleteSendSchema,
  removeSendPasswordSchema,
  createAttachmentSchema,
} from '../schemas/cli.js';
import {
  CliResponse,
  BitwardenItem,
  BitwardenFolder,
  BitwardenSend,
} from '../utils/types.js';

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
  const response = await executeCliCommand('lock', []);
  return toMcpFormat(response);
});

export const handleSync = withValidation(syncSchema, async () => {
  const response = await executeCliCommand('sync', []);
  return toMcpFormat(response);
});

export const handleStatus = withValidation(statusSchema, async () => {
  const response = await executeCliCommand('status', []);
  return toMcpFormat(response);
});

export const handleList = withValidation(listSchema, async (validatedArgs) => {
  const { type, search, organizationid, url, folderid, collectionid, trash } =
    validatedArgs;
  const params: string[] = [type];
  if (search) {
    params.push('--search', search);
  }
  if (organizationid) {
    params.push('--organizationid', organizationid);
  }
  if (url) {
    params.push('--url', url);
  }
  if (folderid) {
    params.push('--folderid', folderid);
  }
  if (collectionid) {
    params.push('--collectionid', collectionid);
  }
  if (trash) {
    params.push('--trash');
  }
  const response = await executeCliCommand('list', params);
  return toMcpFormat(response);
});

export const handleGet = withValidation(getSchema, async (validatedArgs) => {
  const { object, id, organizationid, itemid, output } = validatedArgs;
  const params: string[] = [object, id];
  if (organizationid) {
    params.push('--organizationid', organizationid);
  }
  if (itemid) {
    params.push('--itemid', itemid);
  }
  if (output) {
    params.push('--output', output);
  }
  const response = await executeCliCommand('get', params);
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

    const response = await executeCliCommand('generate', params);
    return toMcpFormat(response);
  },
);

export const handleCreateItem = withValidation(
  createItemSchema,
  async (validatedArgs) => {
    const { name, type, notes, login, card, identity, secureNote, folderId } =
      validatedArgs;

    // Creating an item with the specified type
    const item: BitwardenItem = {
      name,
      type,
    };

    if (notes !== undefined) {
      item.notes = notes;
    }

    if (folderId !== undefined) {
      item.folderId = folderId;
    }

    // Set type-specific data based on item type
    if (type === 1 && login) {
      // Login type
      const loginData: BitwardenItem['login'] = {};
      if (login.username !== undefined) loginData.username = login.username;
      if (login.password !== undefined) loginData.password = login.password;
      if (login.totp !== undefined) loginData.totp = login.totp;
      if (login.uris !== undefined) loginData.uris = login.uris;
      item.login = loginData;
    } else if (type === 2 && secureNote) {
      // Secure Note type
      const secureNoteData: BitwardenItem['secureNote'] = {};
      if (secureNote.type !== undefined) secureNoteData.type = secureNote.type;
      item.secureNote = secureNoteData;
    } else if (type === 3 && card) {
      // Card type
      const cardData: BitwardenItem['card'] = {};
      if (card.cardholderName !== undefined)
        cardData.cardholderName = card.cardholderName;
      if (card.number !== undefined) cardData.number = card.number;
      if (card.brand !== undefined) cardData.brand = card.brand;
      if (card.expMonth !== undefined) cardData.expMonth = card.expMonth;
      if (card.expYear !== undefined) cardData.expYear = card.expYear;
      if (card.code !== undefined) cardData.code = card.code;
      item.card = cardData;
    } else if (type === 4 && identity) {
      // Identity type
      const identityData: BitwardenItem['identity'] = {};
      if (identity.title !== undefined) identityData.title = identity.title;
      if (identity.firstName !== undefined)
        identityData.firstName = identity.firstName;
      if (identity.middleName !== undefined)
        identityData.middleName = identity.middleName;
      if (identity.lastName !== undefined)
        identityData.lastName = identity.lastName;
      if (identity.address1 !== undefined)
        identityData.address1 = identity.address1;
      if (identity.address2 !== undefined)
        identityData.address2 = identity.address2;
      if (identity.address3 !== undefined)
        identityData.address3 = identity.address3;
      if (identity.city !== undefined) identityData.city = identity.city;
      if (identity.state !== undefined) identityData.state = identity.state;
      if (identity.postalCode !== undefined)
        identityData.postalCode = identity.postalCode;
      if (identity.country !== undefined)
        identityData.country = identity.country;
      if (identity.company !== undefined)
        identityData.company = identity.company;
      if (identity.email !== undefined) identityData.email = identity.email;
      if (identity.phone !== undefined) identityData.phone = identity.phone;
      if (identity.ssn !== undefined) identityData.ssn = identity.ssn;
      if (identity.username !== undefined)
        identityData.username = identity.username;
      if (identity.passportNumber !== undefined)
        identityData.passportNumber = identity.passportNumber;
      if (identity.licenseNumber !== undefined)
        identityData.licenseNumber = identity.licenseNumber;
      item.identity = identityData;
    }

    const itemJson = JSON.stringify(item);
    const encodedItem = Buffer.from(itemJson).toString('base64');
    const response = await executeCliCommand('create', ['item', encodedItem]);
    return toMcpFormat(response);
  },
);

export const handleCreateFolder = withValidation(
  createFolderSchema,
  async (validatedArgs) => {
    const { name } = validatedArgs;

    const folder: BitwardenFolder = { name };
    const itemJson = JSON.stringify(folder);
    const encodedItem = Buffer.from(itemJson).toString('base64');
    const response = await executeCliCommand('create', ['folder', encodedItem]);
    return toMcpFormat(response);
  },
);

export const handleEditItem = withValidation(
  editItemSchema,
  async (validatedArgs) => {
    const { id, name, notes, login, card, identity, secureNote, folderId } =
      validatedArgs;

    // First, get the existing item
    const getResponse = await executeCliCommand('get', ['item', id]);

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

      // Update type-specific data
      if (login !== undefined) {
        // Merge login properties with existing login data
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

      if (card !== undefined) {
        // Merge card properties with existing card data
        const currentCard = existingItem.card || {};
        const updatedCard: BitwardenItem['card'] = {
          ...currentCard,
          ...(card.cardholderName !== undefined && {
            cardholderName: card.cardholderName,
          }),
          ...(card.number !== undefined && { number: card.number }),
          ...(card.brand !== undefined && { brand: card.brand }),
          ...(card.expMonth !== undefined && { expMonth: card.expMonth }),
          ...(card.expYear !== undefined && { expYear: card.expYear }),
          ...(card.code !== undefined && { code: card.code }),
        };
        existingItem.card = updatedCard;
      }

      if (identity !== undefined) {
        // Merge identity properties with existing identity data
        const currentIdentity = existingItem.identity || {};
        const updatedIdentity: BitwardenItem['identity'] = {
          ...currentIdentity,
          ...(identity.title !== undefined && { title: identity.title }),
          ...(identity.firstName !== undefined && {
            firstName: identity.firstName,
          }),
          ...(identity.middleName !== undefined && {
            middleName: identity.middleName,
          }),
          ...(identity.lastName !== undefined && {
            lastName: identity.lastName,
          }),
          ...(identity.address1 !== undefined && {
            address1: identity.address1,
          }),
          ...(identity.address2 !== undefined && {
            address2: identity.address2,
          }),
          ...(identity.address3 !== undefined && {
            address3: identity.address3,
          }),
          ...(identity.city !== undefined && { city: identity.city }),
          ...(identity.state !== undefined && { state: identity.state }),
          ...(identity.postalCode !== undefined && {
            postalCode: identity.postalCode,
          }),
          ...(identity.country !== undefined && { country: identity.country }),
          ...(identity.company !== undefined && { company: identity.company }),
          ...(identity.email !== undefined && { email: identity.email }),
          ...(identity.phone !== undefined && { phone: identity.phone }),
          ...(identity.ssn !== undefined && { ssn: identity.ssn }),
          ...(identity.username !== undefined && {
            username: identity.username,
          }),
          ...(identity.passportNumber !== undefined && {
            passportNumber: identity.passportNumber,
          }),
          ...(identity.licenseNumber !== undefined && {
            licenseNumber: identity.licenseNumber,
          }),
        };
        existingItem.identity = updatedIdentity;
      }

      if (secureNote !== undefined) {
        // Merge secure note properties with existing secure note data
        const currentSecureNote = existingItem.secureNote || {};
        const updatedSecureNote: BitwardenItem['secureNote'] = {
          ...currentSecureNote,
          ...(secureNote.type !== undefined && { type: secureNote.type }),
        };
        existingItem.secureNote = updatedSecureNote;
      }

      const updatesJson = JSON.stringify(existingItem);
      const encodedUpdates = Buffer.from(updatesJson).toString('base64');
      const response = await executeCliCommand('edit', [
        'item',
        id,
        encodedUpdates,
      ]);
      return toMcpFormat(response);
    } catch (error) {
      const errorResponse: CliResponse = {
        errorOutput: `Failed to parse existing item: ${error instanceof Error ? error.message : String(error)}`,
      };
      return toMcpFormat(errorResponse);
    }
  },
);

export const handleEditFolder = withValidation(
  editFolderSchema,
  async (validatedArgs) => {
    const { id, name } = validatedArgs;

    const folder: BitwardenFolder = { name };
    const itemJson = JSON.stringify(folder);
    const encodedItem = Buffer.from(itemJson).toString('base64');
    const response = await executeCliCommand('edit', [
      'folder',
      id,
      encodedItem,
    ]);
    return toMcpFormat(response);
  },
);

export const handleDelete = withValidation(
  deleteSchema,
  async (validatedArgs) => {
    const { object, id, permanent } = validatedArgs;
    const params: string[] = [object, id];
    if (permanent) {
      params.push('--permanent');
    }
    const response = await executeCliCommand('delete', params);
    return toMcpFormat(response);
  },
);

export const handleConfirm = withValidation(
  confirmSchema,
  async (validatedArgs) => {
    const { organizationId, memberId } = validatedArgs;
    const response = await executeCliCommand('confirm', [
      'org-member',
      memberId,
      '--organizationid',
      organizationId,
    ]);
    return toMcpFormat(response);
  },
);

export const handleCreateOrgCollection = withValidation(
  createOrgCollectionSchema,
  async (validatedArgs) => {
    const { organizationId, name, externalId, groups } = validatedArgs;

    // Build the collection object
    const collection: Record<string, unknown> = {
      organizationId,
      name,
    };

    if (externalId) {
      collection['externalId'] = externalId;
    }

    if (groups && groups.length > 0) {
      collection['groups'] = groups;
    }

    // Encode the JSON as base64
    const collectionJson = JSON.stringify(collection);
    const encodedJson = Buffer.from(collectionJson, 'utf8').toString('base64');

    // Build the command
    const response = await executeCliCommand('create', [
      'org-collection',
      encodedJson,
      '--organizationid',
      organizationId,
    ]);
    return toMcpFormat(response);
  },
);

export const handleEditOrgCollection = withValidation(
  editOrgCollectionSchema,
  async (validatedArgs) => {
    const { organizationId, collectionId, name, externalId, groups } =
      validatedArgs;

    // First, get the existing collection
    const getResponse = await executeCliCommand('get', [
      'org-collection',
      collectionId,
      '--organizationid',
      organizationId,
    ]);

    if (getResponse.errorOutput) {
      return toMcpFormat(getResponse);
    }

    // Parse the existing collection
    let collection: Record<string, unknown>;
    try {
      collection = JSON.parse(getResponse.output || '{}');
    } catch {
      const errorResponse: CliResponse = {
        output: '',
        errorOutput: 'Failed to parse existing collection data',
      };
      return toMcpFormat(errorResponse);
    }

    // Update with new values
    if (name !== undefined) {
      collection['name'] = name;
    }
    if (externalId !== undefined) {
      collection['externalId'] = externalId;
    }
    if (groups !== undefined) {
      collection['groups'] = groups;
    }

    // Ensure organizationId is set
    collection['organizationId'] = organizationId;

    // Encode the JSON as base64
    const collectionJson = JSON.stringify(collection);
    const encodedJson = Buffer.from(collectionJson, 'utf8').toString('base64');

    // Build the command
    const response = await executeCliCommand('edit', [
      'org-collection',
      collectionId,
      encodedJson,
      '--organizationid',
      organizationId,
    ]);
    return toMcpFormat(response);
  },
);

export const handleEditItemCollections = withValidation(
  editItemCollectionsSchema,
  async (validatedArgs) => {
    const { itemId, organizationId, collectionIds } = validatedArgs;

    // Encode the collection IDs array as JSON
    const collectionIdsJson = JSON.stringify(collectionIds);
    const encodedJson = Buffer.from(collectionIdsJson, 'utf8').toString(
      'base64',
    );

    // Build the command
    const response = await executeCliCommand('edit', [
      'item-collections',
      itemId,
      encodedJson,
      '--organizationid',
      organizationId,
    ]);
    return toMcpFormat(response);
  },
);

/**
 * Handles moving (sharing) a vault item to an organization.
 *
 * @param {Record<string, unknown>} args - Arguments from the tool call.
 * @returns {Promise<McpResponse>} Promise resolving to the formatted result.
 */
export const handleMove = withValidation(
  moveSchema,
  async ({ itemId, organizationId, collectionIds }) => {
    // Encode the collection IDs array as JSON
    const collectionIdsJson = JSON.stringify(collectionIds);
    const encodedJson = Buffer.from(collectionIdsJson, 'utf8').toString(
      'base64',
    );

    // Build the command
    const response = await executeCliCommand('move', [
      itemId,
      organizationId,
      encodedJson,
    ]);
    return toMcpFormat(response);
  },
);

/**
 * Handles listing pending device approval requests for an organization.
 *
 * @param {Record<string, unknown>} args - Arguments from the tool call.
 * @returns {Promise<McpResponse>} Promise resolving to the formatted result.
 */
export const handleDeviceApprovalList = withValidation(
  deviceApprovalListSchema,
  async ({ organizationId }) => {
    // Build the command
    const response = await executeCliCommand('device-approval', [
      'list',
      '--organizationid',
      organizationId,
    ]);
    return toMcpFormat(response);
  },
);

/**
 * Handles approving a pending device authorization request.
 *
 * @param {Record<string, unknown>} args - Arguments from the tool call.
 * @returns {Promise<McpResponse>} Promise resolving to the formatted result.
 */
export const handleDeviceApprovalApprove = withValidation(
  deviceApprovalApproveSchema,
  async ({ organizationId, requestId }) => {
    // Build the command
    const response = await executeCliCommand('device-approval', [
      'approve',
      '--organizationid',
      organizationId,
      requestId,
    ]);
    return toMcpFormat(response);
  },
);

/**
 * Handles approving all pending device authorization requests.
 *
 * @param {Record<string, unknown>} args - Arguments from the tool call.
 * @returns {Promise<McpResponse>} Promise resolving to the formatted result.
 */
export const handleDeviceApprovalApproveAll = withValidation(
  deviceApprovalApproveAllSchema,
  async ({ organizationId }) => {
    // Build the command
    const response = await executeCliCommand('device-approval', [
      'approve-all',
      '--organizationid',
      organizationId,
    ]);
    return toMcpFormat(response);
  },
);

/**
 * Handles denying a pending device authorization request.
 *
 * @param {Record<string, unknown>} args - Arguments from the tool call.
 * @returns {Promise<McpResponse>} Promise resolving to the formatted result.
 */
export const handleDeviceApprovalDeny = withValidation(
  deviceApprovalDenySchema,
  async ({ organizationId, requestId }) => {
    // Build the command
    const response = await executeCliCommand('device-approval', [
      'deny',
      '--organizationid',
      organizationId,
      requestId,
    ]);
    return toMcpFormat(response);
  },
);

/**
 * Handles denying all pending device authorization requests.
 *
 * @param {Record<string, unknown>} args - Arguments from the tool call.
 * @returns {Promise<McpResponse>} Promise resolving to the formatted result.
 */
export const handleDeviceApprovalDenyAll = withValidation(
  deviceApprovalDenyAllSchema,
  async ({ organizationId }) => {
    // Build the command
    const response = await executeCliCommand('device-approval', [
      'deny-all',
      '--organizationid',
      organizationId,
    ]);
    return toMcpFormat(response);
  },
);

export const handleRestore = withValidation(
  restoreSchema,
  async (validatedArgs) => {
    const { object, id } = validatedArgs;
    const response = await executeCliCommand('restore', [object, id]);
    return toMcpFormat(response);
  },
);

export const handleCreateTextSend = withValidation(
  createTextSendSchema,
  async (validatedArgs) => {
    const {
      name,
      text,
      hidden,
      notes,
      password,
      maxAccessCount,
      expirationDate,
      deletionDate,
      disabled,
    } = validatedArgs;

    // Build the Send object
    const send: BitwardenSend = {
      type: 0, // Text Send
      name,
      text: {
        text,
      },
      disabled,
      deletionDate,
    };

    if (hidden !== undefined && send.text) {
      send.text.hidden = hidden;
    }

    if (notes) send.notes = notes;
    if (password) send.password = password;
    if (maxAccessCount) send.maxAccessCount = maxAccessCount;
    if (expirationDate) send.expirationDate = expirationDate;

    const sendJson = JSON.stringify(send);
    const encodedSend = Buffer.from(sendJson).toString('base64');
    const response = await executeCliCommand('send', ['create', encodedSend]);
    return toMcpFormat(response);
  },
);

export const handleCreateFileSend = withValidation(
  createFileSendSchema,
  async (validatedArgs) => {
    const {
      name,
      filePath,
      notes,
      password,
      maxAccessCount,
      expirationDate,
      deletionDate,
      disabled,
    } = validatedArgs;

    // Build the Send object
    const send: BitwardenSend = {
      type: 1, // File Send
      name,
      disabled,
      deletionDate,
    };

    if (notes) send.notes = notes;
    if (password) send.password = password;
    if (maxAccessCount) send.maxAccessCount = maxAccessCount;
    if (expirationDate) send.expirationDate = expirationDate;

    const sendJson = JSON.stringify(send);
    const encodedSend = Buffer.from(sendJson).toString('base64');
    const response = await executeCliCommand('send', [
      'create',
      encodedSend,
      '--file',
      filePath,
    ]);
    return toMcpFormat(response);
  },
);

export const handleListSend = withValidation(listSendSchema, async () => {
  const response = await executeCliCommand('send', ['list']);
  return toMcpFormat(response);
});

export const handleGetSend = withValidation(
  getSendSchema,
  async (validatedArgs) => {
    const { id } = validatedArgs;
    const response = await executeCliCommand('send', ['get', id]);
    return toMcpFormat(response);
  },
);

export const handleEditSend = withValidation(
  editSendSchema,
  async (validatedArgs) => {
    const {
      id,
      name,
      notes,
      password,
      maxAccessCount,
      expirationDate,
      deletionDate,
      disabled,
    } = validatedArgs;

    // First, get the existing Send
    const getResponse = await executeCliCommand('send', ['get', id]);

    if (getResponse.errorOutput) {
      return toMcpFormat(getResponse);
    }

    try {
      // Parse the existing Send
      const existingSend: BitwardenSend = JSON.parse(
        getResponse.output || '{}',
      );

      // Update with new values
      if (name !== undefined) existingSend.name = name;
      if (notes !== undefined) existingSend.notes = notes;
      if (password !== undefined) existingSend.password = password;
      if (maxAccessCount !== undefined)
        existingSend.maxAccessCount = maxAccessCount;
      if (expirationDate !== undefined)
        existingSend.expirationDate = expirationDate;
      if (deletionDate !== undefined) existingSend.deletionDate = deletionDate;
      if (disabled !== undefined) existingSend.disabled = disabled;

      const updatesJson = JSON.stringify(existingSend);
      const encodedUpdates = Buffer.from(updatesJson).toString('base64');
      const response = await executeCliCommand('send', [
        'edit',
        encodedUpdates,
      ]);
      return toMcpFormat(response);
    } catch (error) {
      const errorResponse: CliResponse = {
        errorOutput: `Failed to parse existing Send: ${error instanceof Error ? error.message : String(error)}`,
      };
      return toMcpFormat(errorResponse);
    }
  },
);

export const handleDeleteSend = withValidation(
  deleteSendSchema,
  async (validatedArgs) => {
    const { id } = validatedArgs;
    const response = await executeCliCommand('send', ['delete', id]);
    return toMcpFormat(response);
  },
);

export const handleRemoveSendPassword = withValidation(
  removeSendPasswordSchema,
  async (validatedArgs) => {
    const { id } = validatedArgs;
    const response = await executeCliCommand('send', ['remove-password', id]);
    return toMcpFormat(response);
  },
);

export const handleCreateAttachment = withValidation(
  createAttachmentSchema,
  async (validatedArgs) => {
    const { filePath, itemId } = validatedArgs;
    const response = await executeCliCommand('create', [
      'attachment',
      '--file',
      filePath,
      '--itemid',
      itemId,
    ]);
    return toMcpFormat(response);
  },
);
