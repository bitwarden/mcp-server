/**
 * Zod validation schemas for Secrets Manager operations
 * Handles validation for projects and secrets using the Bitwarden Secrets Manager CLI (bws)
 */

import { z } from 'zod';
import { validateFilePath } from '../utils/security.js';

const projectId = z.string().uuid('Project ID must be a valid UUID');
const secretId = z.string().uuid('Secret ID must be a valid UUID');

const envFilePath = z
  .string()
  .min(1, 'File path is required')
  .refine((path) => validateFilePath(path), {
    message:
      'Invalid file path: it must be inside BW_ALLOWED_DIRECTORIES and contain no path traversal patterns',
  });

// Options for a server-generated secret value
const generateOptionsSchema = z
  .object({
    // Length of the generated value (default 32)
    length: z.number().int().min(5).max(256).optional(),
    // Include uppercase characters (default true)
    uppercase: z.boolean().optional(),
    // Include lowercase characters (default true)
    lowercase: z.boolean().optional(),
    // Include numbers (default true)
    number: z.boolean().optional(),
    // Include special characters (default true)
    special: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.uppercase !== false ||
      data.lowercase !== false ||
      data.number !== false ||
      data.special !== false,
    { message: 'At least one character set must be enabled' },
  );

// Schema for validating 'list_sm_projects' parameters (no parameters required)
export const listSmProjectsSchema = z.object({});

// Schema for validating 'get_sm_project' parameters
export const getSmProjectSchema = z.object({
  projectId,
});

// Schema for validating 'create_sm_project' parameters
export const createSmProjectSchema = z.object({
  // Name of the new project
  name: z.string().min(1, 'Name is required'),
});

// Schema for validating 'edit_sm_project' parameters
export const editSmProjectSchema = z.object({
  projectId,
  // New name of the project
  name: z.string().min(1, 'Name is required'),
});

// Schema for validating 'delete_sm_project' parameters
export const deleteSmProjectSchema = z.object({
  projectId,
});

// Schema for validating 'list_sm_secrets' parameters
export const listSmSecretsSchema = z.object({
  // Only list the secrets of this project
  projectId: projectId.optional(),
});

// Schema for validating 'get_sm_secret' parameters
export const getSmSecretSchema = z.object({
  secretId,
});

// Schema for validating 'create_sm_secret' parameters
export const createSmSecretSchema = z
  .object({
    // Name of the secret (e.g. DATABASE_PASSWORD)
    key: z.string().min(1, 'Key is required'),
    // Project the secret is added to
    projectId,
    // Value of the secret (mutually exclusive with generate)
    value: z.string().optional(),
    // Generate a random value on the server instead of passing one
    generate: generateOptionsSchema.optional(),
    // Optional note
    note: z.string().optional(),
  })
  .refine((data) => (data.value === undefined) !== !data.generate, {
    message: 'Provide exactly one of value or generate',
  });

// Schema for validating 'edit_sm_secret' parameters
export const editSmSecretSchema = z
  .object({
    secretId,
    // New name of the secret
    key: z.string().min(1, 'Key cannot be empty').optional(),
    // New value of the secret (mutually exclusive with generate)
    value: z.string().optional(),
    // Generate a new random value on the server
    generate: generateOptionsSchema.optional(),
    // New note
    note: z.string().optional(),
    // Move the secret to another project
    projectId: projectId.optional(),
  })
  .refine((data) => data.value === undefined || !data.generate, {
    message: 'Provide value or generate, not both',
  })
  .refine(
    (data) =>
      data.key !== undefined ||
      data.value !== undefined ||
      data.generate !== undefined ||
      data.note !== undefined ||
      data.projectId !== undefined,
    { message: 'Provide at least one field to change' },
  );

// Schema for validating 'delete_sm_secret' parameters
export const deleteSmSecretSchema = z.object({
  secretId,
});

// Schema for validating 'import_sm_secrets' parameters
export const importSmSecretsSchema = z.object({
  // dotenv file to read (inside BW_ALLOWED_DIRECTORIES)
  filePath: envFilePath,
  // Project the secrets are written to
  projectId,
  // Replace the value of secrets whose key already exists in the project
  overwrite: z.boolean().optional(),
});

// Schema for validating 'export_sm_secrets' parameters
export const exportSmSecretsSchema = z.object({
  // dotenv file to write (inside BW_ALLOWED_DIRECTORIES)
  filePath: envFilePath,
  // Project whose secrets are exported
  projectId,
  // Replace the file if it already exists
  overwrite: z.boolean().optional(),
});
