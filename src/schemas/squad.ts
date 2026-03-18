/**
 * Validation schemas for Squad tools
 */

import { z } from 'zod';

export const squadStoreSchema = z.object({
  name: z.string().min(1, 'Credential name is required'),
  username: z.string().optional(),
  password: z.string().min(1, 'Password/secret value is required'),
  uri: z.string().optional(),
  notes: z.string().optional(),
  agent: z.string().min(1, 'Agent name is required'),
  issue: z.string().optional(),
});

export const squadGetSchema = z.object({
  name: z.string().min(1, 'Credential name is required'),
  agent: z.string().min(1, 'Agent name is required'),
  reason: z.string().optional(),
});

export const squadListSchema = z.object({
  search: z.string().optional(),
  agent: z.string().min(1, 'Agent name is required'),
});

export const squadAuditSchema = z.object({
  limit: z.number().optional().default(20),
  item: z.string().optional(),
  agent: z.string().optional(),
});
