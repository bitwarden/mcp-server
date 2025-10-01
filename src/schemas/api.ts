/**
 * Zod validation schemas for Organization API operations
 * Based on official Bitwarden Public API specification
 *
 * Note: Collection creation is NOT supported by the Public API.
 * The Public API only supports: list, get, update, and delete operations for collections.
 */

import { z } from 'zod';

// Collections Schemas
export const listCollectionsRequestSchema = z.object({});

export const getCollectionRequestSchema = z.object({
  collectionId: z.string().min(1, 'Collection ID is required'),
});

export const updateCollectionRequestSchema = z.object({
  collectionId: z.string().min(1, 'Collection ID is required'),
  externalId: z
    .string()
    .max(300, 'External ID must be 300 characters or less')
    .optional(),
  groups: z
    .array(
      z.object({
        id: z.string().uuid('Group ID must be a valid UUID'),
        readOnly: z.boolean(),
        hidePasswords: z.boolean().optional(),
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const deleteCollectionRequestSchema = getCollectionRequestSchema;

// Members Schemas
export const listMembersRequestSchema = z.object({});

export const getMemberRequestSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
});

export const inviteMemberRequestSchema = z.object({
  email: z
    .string()
    .email('Valid email address is required')
    .max(256, 'Email must be 256 characters or less'),
  type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]), // 0=Owner, 1=Admin, 2=User, 4=Custom (3=Manager was deleted)
  externalId: z
    .string()
    .max(300, 'External ID must be 300 characters or less')
    .optional(),
  permissions: z
    .object({
      accessEventLogs: z.boolean().optional(),
      accessImportExport: z.boolean().optional(),
      accessReports: z.boolean().optional(),
      createNewCollections: z.boolean().optional(),
      editAnyCollection: z.boolean().optional(),
      deleteAnyCollection: z.boolean().optional(),
      manageGroups: z.boolean().optional(),
      managePolicies: z.boolean().optional(),
      manageSso: z.boolean().optional(),
      manageUsers: z.boolean().optional(),
      manageResetPassword: z.boolean().optional(),
      manageScim: z.boolean().optional(),
    })
    .optional(),
  collections: z
    .array(
      z.object({
        id: z.string().uuid('Collection ID must be a valid UUID'),
        readOnly: z.boolean().optional(),
        hidePasswords: z.boolean().optional(),
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
  groups: z.array(z.string().uuid('Group ID must be a valid UUID')).optional(),
});

export const updateMemberRequestSchema = z.object({
  memberId: z.string().uuid('Member ID must be a valid UUID'),
  type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]), // 0=Owner, 1=Admin, 2=User, 4=Custom
  externalId: z
    .string()
    .max(300, 'External ID must be 300 characters or less')
    .optional(),
  permissions: z
    .object({
      accessEventLogs: z.boolean().optional(),
      accessImportExport: z.boolean().optional(),
      accessReports: z.boolean().optional(),
      createNewCollections: z.boolean().optional(),
      editAnyCollection: z.boolean().optional(),
      deleteAnyCollection: z.boolean().optional(),
      manageGroups: z.boolean().optional(),
      managePolicies: z.boolean().optional(),
      manageSso: z.boolean().optional(),
      manageUsers: z.boolean().optional(),
      manageResetPassword: z.boolean().optional(),
      manageScim: z.boolean().optional(),
    })
    .optional(),
  collections: z
    .array(
      z.object({
        id: z.string().uuid('Collection ID must be a valid UUID'),
        readOnly: z.boolean().optional(),
        hidePasswords: z.boolean().optional(),
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
  groups: z.array(z.string().uuid('Group ID must be a valid UUID')).optional(),
});

export const removeMemberRequestSchema = getMemberRequestSchema;

// Groups Schemas
export const listGroupsRequestSchema = z.object({});

export const getGroupRequestSchema = z.object({
  groupId: z.string().uuid('Group ID must be a valid UUID'),
});

export const createGroupRequestSchema = z.object({
  name: z
    .string()
    .min(1, 'Group name is required')
    .max(100, 'Group name must be 100 characters or less'),
  externalId: z
    .string()
    .max(300, 'External ID must be 300 characters or less')
    .optional(),
  collections: z
    .array(
      z.object({
        id: z.string().uuid('Collection ID must be a valid UUID'),
        readOnly: z.boolean().optional(),
        hidePasswords: z.boolean().optional(),
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const updateGroupRequestSchema = z.object({
  groupId: z.string().uuid('Group ID must be a valid UUID'),
  name: z
    .string()
    .min(1, 'Group name is required')
    .max(100, 'Group name must be 100 characters or less'),
  externalId: z
    .string()
    .max(300, 'External ID must be 300 characters or less')
    .optional(),
  collections: z
    .array(
      z.object({
        id: z.string().uuid('Collection ID must be a valid UUID'),
        readOnly: z.boolean().optional(),
        hidePasswords: z.boolean().optional(),
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const deleteGroupRequestSchema = getGroupRequestSchema;

export const getMemberGroupsRequestSchema = z.object({
  memberId: z.string().uuid('Member ID must be a valid UUID'),
});

export const getGroupMembersRequestSchema = z.object({
  groupId: z.string().uuid('Group ID must be a valid UUID'),
});

export const updateMemberGroupsRequestSchema = z.object({
  memberId: z.string().uuid('Member ID must be a valid UUID'),
  groupIds: z.array(z.string().uuid('Group ID must be a valid UUID')),
});

export const updateGroupMembersRequestSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  memberIds: z.array(z.string().min(1, 'Member ID is required')),
});

export const reinviteMemberRequestSchema = z.object({
  memberId: z.string().uuid('Member ID must be a valid UUID'),
});

// Policies Schemas
export const listPoliciesRequestSchema = z.object({});

export const getPolicyRequestSchema = z.object({
  policyType: z
    .number()
    .int('Policy type must be an integer')
    .min(0, 'Policy type must be a valid enum value'),
});

export const updatePolicyRequestSchema = z.object({
  policyType: z
    .number()
    .int('Policy type must be an integer')
    .min(0, 'Policy type must be a valid enum value'),
  enabled: z.boolean(),
  data: z.record(z.string(), z.unknown()).optional(),
});

// Events Schemas
export const getEventsRequestSchema = z.object({
  start: z.string().min(1, 'Start date is required'),
  end: z.string().min(1, 'End date is required'),
  actingUserId: z.string().optional(),
  itemId: z.string().optional(),
  collectionId: z.string().optional(),
  groupId: z.string().optional(),
  policyId: z.string().optional(),
  memberId: z.string().optional(),
});

// Organization Billing Schemas
export const getOrgSubscriptionRequestSchema = z.object({});

export const updateOrgSubscriptionRequestSchema = z.object({
  passwordManager: z
    .object({
      seats: z.number().int().optional(),
      storage: z.number().int().optional(),
      maxAutoScaleSeats: z.number().int().optional(),
    })
    .optional(),
  secretsManager: z
    .object({
      seats: z.number().int().optional(),
      maxAutoScaleSeats: z.number().int().optional(),
      serviceAccounts: z.number().int().optional(),
      maxAutoScaleServiceAccounts: z.number().int().optional(),
    })
    .optional(),
});

// Organization Import Schemas
export const importOrganizationUsersAndGroupsRequestSchema = z.object({
  groups: z
    .array(
      z.object({
        name: z
          .string()
          .min(1, 'Group name is required')
          .max(100, 'Group name must be 100 characters or less'),
        externalId: z
          .string()
          .min(1, 'External ID is required')
          .max(300, 'External ID must be 300 characters or less'),
        memberExternalIds: z.array(z.string()).optional(),
      }),
    )
    .optional()
    .default([]),
  members: z
    .array(
      z.object({
        email: z
          .string()
          .email('Valid email address is required')
          .max(256, 'Email must be 256 characters or less')
          .nullable()
          .optional(),
        externalId: z
          .string()
          .min(1, 'External ID is required')
          .max(300, 'External ID must be 300 characters or less'),
        deleted: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'Determines if this member should be removed from the organization during import',
          ),
      }),
    )
    .optional()
    .default([]),
  overwriteExisting: z.boolean(),
  largeImport: z.boolean().optional().default(false),
});
