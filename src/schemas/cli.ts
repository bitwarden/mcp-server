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
import { validateFilePath } from '../utils/security.js';

// Schema for validating 'lock' command parameters (no parameters required)
export const lockSchema = z.object({});

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
    // Filter items by URL (items only, supports 'null' and 'notnull' literals)
    url: z.string().optional(),
    // Filter items by folder ID (items only, supports 'null' and 'notnull' literals)
    folderid: z.string().optional(),
    // Filter items by collection ID (items only, supports 'null' and 'notnull' literals)
    collectionid: z.string().optional(),
    // Filter for items in trash (items only)
    trash: z.boolean().optional(),
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
      'fingerprint',
    ]),
    // ID or search term to identify the object (use 'me' for your own fingerprint, or filename for attachment)
    id: z.string().min(1, 'ID or search term is required'),
    // Organization ID (required for org-collection)
    organizationid: z.string().optional(),
    // Item ID (required for attachment)
    itemid: z.string().optional(),
    // Output directory for attachment downloads (optional, must end with /)
    output: z
      .string()
      .optional()
      .refine((path) => !path || validateFilePath(path), {
        message: 'Invalid output path: path traversal patterns are not allowed',
      }),
  })
  .refine(
    (data) => {
      // org-collection requires organizationid
      if (data.object === 'org-collection' && !data.organizationid) {
        return false;
      }
      // attachment requires itemid
      if (data.object === 'attachment' && !data.itemid) {
        return false;
      }
      return true;
    },
    {
      message:
        'organizationid is required for org-collection, itemid is required for attachment',
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

// Schema for validating card information in vault items
export const cardSchema = z.object({
  // Cardholder name
  cardholderName: z.string().optional(),
  // Card number
  number: z.string().optional(),
  // Card brand (Visa, Mastercard, Amex, Discover, etc.)
  brand: z.string().optional(),
  // Expiration month (MM)
  expMonth: z
    .string()
    .regex(/^\d{2}$/, 'Expiration month must be exactly 2 digits (MM)')
    .optional(),
  // Expiration year (YYYY)
  expYear: z
    .string()
    .regex(/^\d{4}$/, 'Expiration year must be exactly 4 digits (YYYY)')
    .optional(),
  // Security code (CVV)
  code: z.string().optional(),
});

// Schema for validating identity information in vault items
export const identitySchema = z.object({
  // Title (Mr, Mrs, Ms, Dr, etc.)
  title: z.string().optional(),
  // First name
  firstName: z.string().optional(),
  // Middle name
  middleName: z.string().optional(),
  // Last name
  lastName: z.string().optional(),
  // Address line 1
  address1: z.string().optional(),
  // Address line 2
  address2: z.string().optional(),
  // Address line 3
  address3: z.string().optional(),
  // City
  city: z.string().optional(),
  // State or province
  state: z.string().optional(),
  // Postal code
  postalCode: z.string().optional(),
  // Country
  country: z.string().optional(),
  // Company name
  company: z.string().optional(),
  // Email address
  email: z.string().optional(),
  // Phone number
  phone: z.string().optional(),
  // Social Security Number
  ssn: z.string().optional(),
  // Username
  username: z.string().optional(),
  // Passport number
  passportNumber: z.string().optional(),
  // License number
  licenseNumber: z.string().optional(),
});

// Schema for validating secure note information
export const secureNoteSchema = z.object({
  // Type of secure note (0: Generic)
  type: z.literal(0).optional(),
});

// Schema for validating 'create item' command parameters
export const createItemSchema = z
  .object({
    // Name of the item to create
    name: z.string().min(1, 'Name is required'),
    // Type of item (1: Login, 2: Secure Note, 3: Card, 4: Identity)
    type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    // Optional notes for the item
    notes: z.string().optional(),
    // Login details (required for login items)
    login: loginSchema.optional(),
    // Card details (required for card items)
    card: cardSchema.optional(),
    // Identity details (required for identity items)
    identity: identitySchema.optional(),
    // Secure note details (required for secure note items)
    secureNote: secureNoteSchema.optional(),
    // Folder ID to assign the item to
    folderId: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validate that the appropriate type-specific data is provided
      if (data.type === 1 && !data.login) {
        return false;
      }
      if (data.type === 2 && !data.secureNote) {
        return false;
      }
      if (data.type === 3 && !data.card) {
        return false;
      }
      if (data.type === 4 && !data.identity) {
        return false;
      }
      return true;
    },
    {
      message:
        'Type-specific data is required: login for type 1, secureNote for type 2, card for type 3, identity for type 4',
    },
  );

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

// Schema for validating card fields during item editing
export const editCardSchema = z.object({
  // Cardholder name
  cardholderName: z.string().optional(),
  // Card number
  number: z.string().optional(),
  // Card brand (Visa, Mastercard, Amex, Discover, etc.)
  brand: z.string().optional(),
  // Expiration month (MM)
  expMonth: z
    .string()
    .regex(/^\d{2}$/, 'Expiration month must be exactly 2 digits (MM)')
    .optional(),
  // Expiration year (YYYY)
  expYear: z
    .string()
    .regex(/^\d{4}$/, 'Expiration year must be exactly 4 digits (YYYY)')
    .optional(),
  // Security code (CVV)
  code: z.string().optional(),
});

// Schema for validating identity fields during item editing
export const editIdentitySchema = z.object({
  // Title (Mr, Mrs, Ms, Dr, etc.)
  title: z.string().optional(),
  // First name
  firstName: z.string().optional(),
  // Middle name
  middleName: z.string().optional(),
  // Last name
  lastName: z.string().optional(),
  // Address line 1
  address1: z.string().optional(),
  // Address line 2
  address2: z.string().optional(),
  // Address line 3
  address3: z.string().optional(),
  // City
  city: z.string().optional(),
  // State or province
  state: z.string().optional(),
  // Postal code
  postalCode: z.string().optional(),
  // Country
  country: z.string().optional(),
  // Company name
  company: z.string().optional(),
  // Email address
  email: z.string().optional(),
  // Phone number
  phone: z.string().optional(),
  // Social Security Number
  ssn: z.string().optional(),
  // Username
  username: z.string().optional(),
  // Passport number
  passportNumber: z.string().optional(),
  // License number
  licenseNumber: z.string().optional(),
});

// Schema for validating secure note fields during item editing
export const editSecureNoteSchema = z.object({
  // Type of secure note (0: Generic)
  type: z.literal(0).optional(),
});

// Schema for validating 'edit item' command parameters
export const editItemSchema = z.object({
  // ID of the item to edit
  id: z.string().min(1, 'ID is required'),
  // New name for the item
  name: z.string().optional(),
  // New notes for the item
  notes: z.string().optional(),
  // Updated login information
  login: editLoginSchema.optional(),
  // Updated card information
  card: editCardSchema.optional(),
  // Updated identity information
  identity: editIdentitySchema.optional(),
  // Updated secure note information
  secureNote: editSecureNoteSchema.optional(),
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

// Schema for validating 'send create' command parameters for text Sends
export const createTextSendSchema = z
  .object({
    // Name of the Send
    name: z.string().min(1, 'Name is required'),
    // Text content to send
    text: z.string().min(1, 'Text content is required'),
    // Hide text content (requires visibility toggle)
    hidden: z.boolean().optional(),
    // Private notes (not shared with recipient)
    notes: z.string().optional(),
    // Access password
    password: z.string().optional(),
    // Maximum access count
    maxAccessCount: z.number().int().positive().optional(),
    // Expiration date (ISO 8601 format)
    expirationDate: z.string().optional(),
    // Deletion date (ISO 8601 format, defaults to 7 days from now)
    deletionDate: z.string().optional(),
    // Disable the Send
    disabled: z.boolean().default(false),
  })
  .transform((data) => ({
    ...data,
    deletionDate:
      data.deletionDate ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));

// Schema for validating 'send create' command parameters for file Sends
export const createFileSendSchema = z
  .object({
    // Name of the Send
    name: z.string().min(1, 'Name is required'),
    // File path to send
    filePath: z
      .string()
      .min(1, 'File path is required')
      .refine((path) => validateFilePath(path), {
        message: 'Invalid file path: path traversal patterns are not allowed',
      }),
    // Private notes (not shared with recipient)
    notes: z.string().optional(),
    // Access password
    password: z.string().optional(),
    // Maximum access count
    maxAccessCount: z.number().int().positive().optional(),
    // Expiration date (ISO 8601 format)
    expirationDate: z.string().optional(),
    // Deletion date (ISO 8601 format, defaults to 7 days from now)
    deletionDate: z.string().optional(),
    // Disable the Send
    disabled: z.boolean().default(false),
  })
  .transform((data) => ({
    ...data,
    deletionDate:
      data.deletionDate ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));

// Schema for validating 'send list' command parameters
export const listSendSchema = z.object({});

// Schema for validating 'send get' command parameters
export const getSendSchema = z.object({
  // ID of the Send to retrieve
  id: z.string().min(1, 'Send ID is required'),
});

// Schema for validating 'send edit' command parameters
export const editSendSchema = z.object({
  // ID of the Send to edit
  id: z.string().min(1, 'Send ID is required'),
  // New name for the Send
  name: z.string().optional(),
  // Private notes (not shared with recipient)
  notes: z.string().optional(),
  // Access password
  password: z.string().optional(),
  // Maximum access count
  maxAccessCount: z.number().int().positive().optional(),
  // Expiration date (ISO 8601 format)
  expirationDate: z.string().optional(),
  // Deletion date (ISO 8601 format)
  deletionDate: z.string().optional(),
  // Disable the Send
  disabled: z.boolean().optional(),
});

// Schema for validating 'send delete' command parameters
export const deleteSendSchema = z.object({
  // ID of the Send to delete
  id: z.string().min(1, 'Send ID is required'),
});

// Schema for validating 'send remove-password' command parameters
export const removeSendPasswordSchema = z.object({
  // ID of the Send to remove password from
  id: z.string().min(1, 'Send ID is required'),
});

// Schema for validating 'create attachment' command parameters
export const createAttachmentSchema = z.object({
  // Path to the file to attach
  filePath: z
    .string()
    .min(1, 'File path is required')
    .refine((path) => validateFilePath(path), {
      message: 'Invalid file path: path traversal patterns are not allowed',
    }),
  // ID of the item to attach the file to
  itemId: z.string().min(1, 'Item ID is required'),
});
