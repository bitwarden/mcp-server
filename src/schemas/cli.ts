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
export const listSchema = z.object({
  // Type of items to list from the vault
  type: z.enum(['items', 'folders', 'collections', 'organizations']),
  // Optional search term to filter results
  search: z.string().optional(),
});

// Schema for validating 'get' command parameters
export const getSchema = z.object({
  // Type of object to retrieve from the vault
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
  ]),
  // ID or search term to identify the object
  id: z.string().min(1, 'ID or search term is required'),
});

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

// Schema for validating 'create' command parameters
export const createSchema = z
  .object({
    // Name of the item/folder to create
    name: z.string().min(1, 'Name is required'),
    // Type of object to create: 'item' or 'folder'
    objectType: z.enum(['item', 'folder']),
    // Type of item to create (only for items)
    type: z
      .union([
        z.literal(1), // Login
        z.literal(2), // Secure Note
        z.literal(3), // Card
        z.literal(4), // Identity
      ])
      .optional(),
    // Optional notes for the item
    notes: z.string().optional(),
    // Login details (required when type is 1)
    login: loginSchema.optional(),
  })
  .refine(
    (data) => {
      // If objectType is item, type should be provided
      if (data.objectType === 'item') {
        if (!data.type) {
          return false;
        }
        // If type is login (1), login object should be provided
        if (data.type === 1) {
          return !!data.login; // login object should exist
        }
      }
      // Notes should only be provided for items, not folders
      if (data.objectType === 'folder' && data.notes) {
        return false;
      }
      // Login should only be provided for items, not folders
      if (data.objectType === 'folder' && data.login) {
        return false;
      }
      return true;
    },
    {
      message:
        'Item type is required for items, login details are required for login items, and notes/login are only valid for items',
    },
  );

// Schema for validating login fields during item editing
export const editLoginSchema = z.object({
  // New username for the login
  username: z.string().optional(),
  // New password for the login
  password: z.string().optional(),
});

// Schema for validating 'edit' command parameters
export const editSchema = z
  .object({
    // Type of object to edit: 'item' or 'folder'
    objectType: z.enum(['item', 'folder']),
    // ID of the item/folder to edit
    id: z.string().min(1, 'ID is required'),
    // New name for the item/folder
    name: z.string().optional(),
    // New notes for the item
    notes: z.string().optional(),
    // Updated login information (only for items)
    login: editLoginSchema.optional(),
  })
  .refine(
    (data) => {
      // Notes should only be provided for items, not folders
      if (data.objectType === 'folder' && data.notes) {
        return false;
      }
      // Login should only be provided for items, not folders
      if (data.objectType === 'folder' && data.login) {
        return false;
      }
      return true;
    },
    {
      message:
        'Notes and login information are only valid for items, not folders',
    },
  );

// Schema for validating 'delete' command parameters
export const deleteSchema = z.object({
  // Type of object to delete
  object: z.enum(['item', 'attachment', 'folder', 'org-collection']),
  // ID of the object to delete
  id: z.string().min(1, 'Object ID is required'),
  // Whether to permanently delete the item (skip trash)
  permanent: z.boolean().optional(),
});
