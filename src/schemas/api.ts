/**
 * Request handler schemas for Organization API operations
 * These combine path parameters with request body schemas
 */

import { z } from 'zod';

// Base schema with organizationId for path parameter
const organizationPathSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
});

// Collections Schemas
export const listCollectionsRequestSchema = organizationPathSchema;

export const getCollectionRequestSchema = organizationPathSchema.extend({
  collectionId: z.string().min(1, 'Collection ID is required'),
});

export const createCollectionRequestSchema = organizationPathSchema.extend({
  name: z.string().min(1, 'Collection name is required'),
  externalId: z.string().optional(),
});

export const updateCollectionRequestSchema = organizationPathSchema.extend({
  collectionId: z.string().min(1, 'Collection ID is required'),
  name: z.string().min(1, 'Collection name is required'),
  externalId: z.string().optional(),
});

export const deleteCollectionRequestSchema = getCollectionRequestSchema;

// Members Schemas
export const listMembersRequestSchema = organizationPathSchema;

export const getMemberRequestSchema = organizationPathSchema.extend({
  memberId: z.string().min(1, 'Member ID is required'),
});

export const inviteMemberRequestSchema = organizationPathSchema.extend({
  emails: z.array(z.string().email('Valid email address is required')),
  type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  accessAll: z.boolean().optional(),
  externalId: z.string().optional(),
  collections: z
    .array(
      z.object({
        id: z.string().min(1, 'Collection ID is required'),
        readOnly: z.boolean().optional(),
        hidePasswords: z.boolean().optional(),
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const updateMemberRequestSchema = organizationPathSchema.extend({
  memberId: z.string().min(1, 'Member ID is required'),
  type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  accessAll: z.boolean().optional(),
  externalId: z.string().optional(),
  collections: z
    .array(
      z.object({
        id: z.string().min(1, 'Collection ID is required'),
        readOnly: z.boolean().optional(),
        hidePasswords: z.boolean().optional(),
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const removeMemberRequestSchema = getMemberRequestSchema;

// Groups Schemas
export const listGroupsRequestSchema = organizationPathSchema;

export const getGroupRequestSchema = organizationPathSchema.extend({
  groupId: z.string().min(1, 'Group ID is required'),
});

export const createGroupRequestSchema = organizationPathSchema.extend({
  name: z.string().min(1, 'Group name is required'),
  accessAll: z.boolean().optional(),
  externalId: z.string().optional(),
  collections: z
    .array(
      z.object({
        id: z.string().min(1, 'Collection ID is required'),
        readOnly: z.boolean().optional(),
        hidePasswords: z.boolean().optional(),
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const updateGroupRequestSchema = organizationPathSchema.extend({
  groupId: z.string().min(1, 'Group ID is required'),
  name: z.string().min(1, 'Group name is required'),
  accessAll: z.boolean().optional(),
  externalId: z.string().optional(),
  collections: z
    .array(
      z.object({
        id: z.string().min(1, 'Collection ID is required'),
        readOnly: z.boolean().optional(),
        hidePasswords: z.boolean().optional(),
        manage: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const deleteGroupRequestSchema = getGroupRequestSchema;

export const getGroupMembersRequestSchema = getGroupRequestSchema;

export const updateGroupMembersRequestSchema = organizationPathSchema.extend({
  groupId: z.string().min(1, 'Group ID is required'),
  memberIds: z.array(z.string().min(1, 'Member ID is required')),
});

// Policies Schemas
export const listPoliciesRequestSchema = organizationPathSchema;

export const getPolicyRequestSchema = organizationPathSchema.extend({
  policyId: z.string().min(1, 'Policy ID is required'),
});

export const updatePolicyRequestSchema = organizationPathSchema.extend({
  policyId: z.string().min(1, 'Policy ID is required'),
  enabled: z.boolean(),
  data: z.record(z.string(), z.unknown()).optional(),
});

// Events Schemas
export const getEventsRequestSchema = organizationPathSchema.extend({
  start: z.string().min(1, 'Start date is required'),
  end: z.string().min(1, 'End date is required'),
  actingUserId: z.string().optional(),
  itemId: z.string().optional(),
  collectionId: z.string().optional(),
  groupId: z.string().optional(),
  policyId: z.string().optional(),
  memberId: z.string().optional(),
});

// Organization Schemas
export const getOrganizationRequestSchema = organizationPathSchema;

export const updateOrganizationRequestSchema = organizationPathSchema.extend({
  name: z.string().optional(),
  businessName: z.string().optional(),
  billingEmail: z.string().email().optional(),
});

export const getBillingRequestSchema = organizationPathSchema;

export const getSubscriptionRequestSchema = organizationPathSchema;
