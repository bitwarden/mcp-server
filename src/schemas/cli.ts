/**
 * Zod validation schemas for CLI operations
 * Handles validation for personal vault operations using the Bitwarden CLI
 *
 * Features:
 * - Vault locking/unlocking operations
 * - Item listing, retrieval, and management
 * - Password generation and secure operations
 * - Folder and item creation/editing/deletion
 */

import { z } from 'zod';

// Schema for validating 'lock' command parameters (no parameters required)
export const lockSchema = z.object({});

// Schema for validating 'unlock' command parameters
export const unlockSchema = z.object({
  // Master password for unlocking the vault
  password: z.string().min(1, 'Password is required'),
});

// Schema for validating 'sync' command parameters (no parameters required)
export const syncSchema = z.object({});

// Schema for validating 'status' command parameters (no parameters required)
export const statusSchema = z.object({});

// Schema for validating 'list' command parameters
export const listSchema = z
  .object({
    // Type of items to list from the vault or organization
    type: z.enum([
      'items',
      'folders',
      'collections',
      'organizations',
      'org-collections',
      'org-members',
    ]),
    // Optional search term to filter results
    search: z.string().optional(),
    // Organization ID (required for org-collections and org-members)
    organizationid: z.string().optional(),
  })
  .refine(
    (data) => {
      // org-collections and org-members require organizationid
      if (
        (data.type === 'org-collections' || data.type === 'org-members') &&
        !data.organizationid
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'organizationid is required when listing org-collections or org-members',
    },
  );

// Schema for validating 'get' command parameters
export const getSchema = z
  .object({
    // Type of object to retrieve from the vault or organization
    object: z.enum([
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
    ]),
    // ID or search term to identify the object
    id: z.string().min(1, 'ID or search term is required'),
    // Organization ID (required for org-collection)
    organizationid: z.string().optional(),
  })
  .refine(
    (data) => {
      // org-collection requires organizationid
      if (data.object === 'org-collection' && !data.organizationid) {
        return false;
      }
      return true;
    },
    {
      message: 'organizationid is required when getting org-collection',
    },
  );

// Schema for validating 'generate' command parameters
export const generateSchema = z
  .object({
    // Length of the generated password (minimum 5)
    length: z.number().int().min(5).optional(),
    // Include uppercase characters in the password
    uppercase: z.boolean().optional(),
    // Include lowercase characters in the password
    lowercase: z.boolean().optional(),
    // Include numbers in the password
    number: z.boolean().optional(),
    // Include special characters in the password
    special: z.boolean().optional(),
    // Generate a passphrase instead of a password
    passphrase: z.boolean().optional(),
    // Number of words to include in the passphrase
    words: z.number().int().min(1).optional(),
    // Character to use between words in the passphrase
    separator: z.string().optional(),
    // Capitalize the first letter of each word in the passphrase
    capitalize: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // If passphrase is true, words and separator are relevant
      // If not, then length, uppercase, lowercase, etc. are relevant
      if (data.passphrase) {
        return true; // Accept any combination for passphrase
      } else {
        return true; // Accept any combination for regular password
      }
    },
    {
      message:
        'Provide valid options based on whether generating a passphrase or password',
    },
  );

// Schema for validating URI objects in login items
export const uriSchema = z.object({
  // URI associated with the login (e.g., https://example.com)
  uri: z.string().url('Must be a valid URL'),
  // URI match type for auto-fill functionality (0: Domain, 1: Host, 2: Starts With, 3: Exact, 4: Regular Expression, 5: Never)
  match: z
    .union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ])
    .optional(),
});

// Schema for validating login information in vault items
export const loginSchema = z.object({
  // Username for the login
  username: z.string().optional(),
  // Password for the login
  password: z.string().optional(),
  // List of URIs associated with the login
  uris: z.array(uriSchema).optional(),
  // Time-based one-time password (TOTP) secret
  totp: z.string().optional(),
});

// Schema for validating 'create item' command parameters
export const createItemSchema = z.object({
  // Name of the item to create
  name: z.string().min(1, 'Name is required'),
  // Optional notes for the item
  notes: z.string().optional(),
  // Login details (required for login items)
  login: loginSchema,
  // Folder ID to assign the item to
  folderId: z.string().optional(),
});

// Schema for validating 'create folder' command parameters
export const createFolderSchema = z.object({
  // Name of the folder to create
  name: z.string().min(1, 'Name is required'),
});

// Schema for validating login fields during item editing
export const editLoginSchema = z.object({
  // New username for the login
  username: z.string().optional(),
  // New password for the login
  password: z.string().optional(),
  // List of URIs associated with the login
  uris: z.array(uriSchema).optional(),
  // Time-based one-time password (TOTP) secret
  totp: z.string().optional(),
});

// Schema for validating 'edit item' command parameters (login)
export const editItemSchema = z.object({
  // ID of the item to edit
  id: z.string().min(1, 'ID is required'),
  // New name for the item
  name: z.string().optional(),
  // New notes for the item
  notes: z.string().optional(),
  // Updated login information
  login: editLoginSchema.optional(),
  // New folder ID to assign the item to
  folderId: z.string().optional(),
});

// Schema for validating 'edit folder' command parameters
export const editFolderSchema = z.object({
  // ID of the folder to edit
  id: z.string().min(1, 'ID is required'),
  // New name for the folder
  name: z.string().min(1, 'Name is required'),
});

// Schema for validating 'delete' command parameters
export const deleteSchema = z.object({
  // Type of object to delete
  object: z.enum(['item', 'attachment', 'folder', 'org-collection']),
  // ID of the object to delete
  id: z.string().min(1, 'Object ID is required'),
  // Whether to permanently delete the item (skip trash)
  permanent: z.boolean().optional(),
});

// Schema for validating 'confirm' command parameters
export const confirmSchema = z.object({
  // Organization ID where the member is being confirmed
  organizationId: z.string().min(1, 'Organization ID is required'),
  // Member ID (user identifier) to confirm
  memberId: z.string().min(1, 'Member ID is required'),
});

// Schema for group access in collections
const collectionGroupSchema = z.object({
  // Group ID
  id: z.string().min(1, 'Group ID is required'),
  // Whether the group has read-only access
  readOnly: z.boolean().optional(),
  // Whether passwords are hidden from the group
  hidePasswords: z.boolean().optional(),
});

// Schema for validating 'create org-collection' command parameters
export const createOrgCollectionSchema = z.object({
  // Organization ID where the collection will be created
  organizationId: z.string().min(1, 'Organization ID is required'),
  // Name of the collection
  name: z.string().min(1, 'Collection name is required'),
  // Optional external ID for the collection
  externalId: z.string().optional(),
  // Optional array of groups with access to this collection
  groups: z.array(collectionGroupSchema).optional(),
});

// Schema for validating 'edit org-collection' command parameters
export const editOrgCollectionSchema = z.object({
  // Organization ID where the collection exists
  organizationId: z.string().min(1, 'Organization ID is required'),
  // Collection ID to edit
  collectionId: z.string().min(1, 'Collection ID is required'),
  // New name for the collection
  name: z.string().optional(),
  // Optional external ID for the collection
  externalId: z.string().optional(),
  // Optional array of groups with access to this collection
  groups: z.array(collectionGroupSchema).optional(),
});

// Schema for validating 'edit item-collections' command parameters
export const editItemCollectionsSchema = z.object({
  // Item ID to edit collections for
  itemId: z.string().min(1, 'Item ID is required'),
  // Organization ID
  organizationId: z.string().min(1, 'Organization ID is required'),
  // Array of collection IDs the item should belong to
  collectionIds: z.array(z.string().min(1, 'Collection ID cannot be empty')),
});

// Schema for validating 'move' command parameters
export const moveSchema = z.object({
  // Item ID to move to organization
  itemId: z.string().min(1, 'Item ID is required'),
  // Organization ID to move the item to
  organizationId: z.string().min(1, 'Organization ID is required'),
  // Array of collection IDs the item should be added to
  collectionIds: z.array(z.string().min(1, 'Collection ID cannot be empty')),
});

// Schema for validating 'device-approval list' command parameters
export const deviceApprovalListSchema = z.object({
  // Organization ID
  organizationId: z.string().min(1, 'Organization ID is required'),
});

// Schema for validating 'device-approval approve' command parameters
export const deviceApprovalApproveSchema = z.object({
  // Organization ID
  organizationId: z.string().min(1, 'Organization ID is required'),
  // Device approval request ID
  requestId: z.string().min(1, 'Request ID is required'),
});

// Schema for validating 'device-approval approve-all' command parameters
export const deviceApprovalApproveAllSchema = z.object({
  // Organization ID
  organizationId: z.string().min(1, 'Organization ID is required'),
});

// Schema for validating 'device-approval deny' command parameters
export const deviceApprovalDenySchema = z.object({
  // Organization ID
  organizationId: z.string().min(1, 'Organization ID is required'),
  // Device approval request ID
  requestId: z.string().min(1, 'Request ID is required'),
});

// Schema for validating 'device-approval deny-all' command parameters
export const deviceApprovalDenyAllSchema = z.object({
  // Organization ID
  organizationId: z.string().min(1, 'Organization ID is required'),
});

// Schema for validating 'restore' command parameters
export const restoreSchema = z.object({
  // Type of object to restore
  object: z.enum(['item']),
  // ID of the object to restore from trash
  id: z.string().min(1, 'Object ID is required'),
});
