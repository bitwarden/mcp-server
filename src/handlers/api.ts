/**
 * Organization API handlers for enterprise management
 */

import { executeApiRequest } from '../utils/api.js';
import { withValidation } from '../utils/validation.js';
import {
  listCollectionsRequestSchema,
  getCollectionRequestSchema,
  createCollectionRequestSchema,
  updateCollectionRequestSchema,
  deleteCollectionRequestSchema,
  listMembersRequestSchema,
  getMemberRequestSchema,
  inviteMemberRequestSchema,
  updateMemberRequestSchema,
  removeMemberRequestSchema,
  listGroupsRequestSchema,
  getGroupRequestSchema,
  createGroupRequestSchema,
  updateGroupRequestSchema,
  deleteGroupRequestSchema,
  getGroupMembersRequestSchema,
  updateGroupMembersRequestSchema,
  listPoliciesRequestSchema,
  getPolicyRequestSchema,
  updatePolicyRequestSchema,
  getEventsRequestSchema,
  getOrganizationRequestSchema,
  updateOrganizationRequestSchema,
  getBillingRequestSchema,
  getSubscriptionRequestSchema,
} from '../schemas/api.js';

// Collections handlers
export const handleListOrgCollections = withValidation(
  listCollectionsRequestSchema,
  async () => {
    return executeApiRequest(`/public/collections`, 'GET');
  },
);

export const handleGetOrgCollection = withValidation(
  getCollectionRequestSchema,
  async (validatedArgs) => {
    const { collectionId } = validatedArgs;
    return executeApiRequest(`/public/collections/${collectionId}`, 'GET');
  },
);

export const handleCreateOrgCollection = withValidation(
  createCollectionRequestSchema,
  async (validatedArgs) => {
    const { name, externalId } = validatedArgs;
    const body = { name, externalId };
    return executeApiRequest(`/public/collections`, 'POST', body);
  },
);

export const handleUpdateOrgCollection = withValidation(
  updateCollectionRequestSchema,
  async (validatedArgs) => {
    const { collectionId, name, externalId } = validatedArgs;
    const body = { name, externalId };
    return executeApiRequest(
      `/public/collections/${collectionId}`,
      'PUT',
      body,
    );
  },
);

export const handleDeleteOrgCollection = withValidation(
  deleteCollectionRequestSchema,
  async (validatedArgs) => {
    const { collectionId } = validatedArgs;
    return executeApiRequest(`/public/collections/${collectionId}`, 'DELETE');
  },
);

// Members handlers
export const handleListOrgMembers = withValidation(
  listMembersRequestSchema,
  async () => {
    return executeApiRequest(`/public/members`, 'GET');
  },
);

export const handleGetOrgMember = withValidation(
  getMemberRequestSchema,
  async (validatedArgs) => {
    const { memberId } = validatedArgs;
    return executeApiRequest(`/public/members/${memberId}`, 'GET');
  },
);

export const handleInviteOrgMember = withValidation(
  inviteMemberRequestSchema,
  async (validatedArgs) => {
    const { email, type, externalId, collections, groups, permissions } =
      validatedArgs;
    const body = { email, type, externalId, collections, groups, permissions };
    return executeApiRequest(`/public/members`, 'POST', body);
  },
);

export const handleUpdateOrgMember = withValidation(
  updateMemberRequestSchema,
  async (validatedArgs) => {
    const { memberId, type, externalId, collections, groups, permissions } =
      validatedArgs;
    const body = { type, externalId, collections, groups, permissions };
    return executeApiRequest(`/public/members/${memberId}`, 'PUT', body);
  },
);

export const handleRemoveOrgMember = withValidation(
  removeMemberRequestSchema,
  async (validatedArgs) => {
    const { memberId } = validatedArgs;
    return executeApiRequest(`/public/members/${memberId}`, 'DELETE');
  },
);

// Groups handlers
export const handleListOrgGroups = withValidation(
  listGroupsRequestSchema,
  async () => {
    return executeApiRequest(`/public/groups`, 'GET');
  },
);

export const handleGetOrgGroup = withValidation(
  getGroupRequestSchema,
  async (validatedArgs) => {
    const { groupId } = validatedArgs;
    return executeApiRequest(`/public/groups/${groupId}`, 'GET');
  },
);

export const handleCreateOrgGroup = withValidation(
  createGroupRequestSchema,
  async (validatedArgs) => {
    const { name, externalId, collections } = validatedArgs;
    const body = { name, externalId, collections };
    return executeApiRequest(`/public/groups`, 'POST', body);
  },
);

export const handleUpdateOrgGroup = withValidation(
  updateGroupRequestSchema,
  async (validatedArgs) => {
    const { groupId, name, externalId, collections } = validatedArgs;
    const body = { name, externalId, collections };
    return executeApiRequest(`/public/groups/${groupId}`, 'PUT', body);
  },
);

export const handleDeleteOrgGroup = withValidation(
  deleteGroupRequestSchema,
  async (validatedArgs) => {
    const { groupId } = validatedArgs;
    return executeApiRequest(`/public/groups/${groupId}`, 'DELETE');
  },
);

export const handleGetOrgGroupMembers = withValidation(
  getGroupMembersRequestSchema,
  async (validatedArgs) => {
    const { groupId } = validatedArgs;
    return executeApiRequest(`/public/groups/${groupId}/member-ids`, 'GET');
  },
);

export const handleUpdateOrgGroupMembers = withValidation(
  updateGroupMembersRequestSchema,
  async (validatedArgs) => {
    const { groupId, memberIds } = validatedArgs;
    const body = { memberIds };
    return executeApiRequest(
      `/public/groups/${groupId}/member-ids`,
      'PUT',
      body,
    );
  },
);

// Policies handlers
export const handleListOrgPolicies = withValidation(
  listPoliciesRequestSchema,
  async () => {
    return executeApiRequest(`/public/policies`, 'GET');
  },
);

export const handleGetOrgPolicy = withValidation(
  getPolicyRequestSchema,
  async (validatedArgs) => {
    const { policyType } = validatedArgs;
    return executeApiRequest(`/public/policies/${policyType}`, 'GET');
  },
);

export const handleUpdateOrgPolicy = withValidation(
  updatePolicyRequestSchema,
  async (validatedArgs) => {
    const { policyType, enabled, data } = validatedArgs;
    const body = { enabled, data };
    return executeApiRequest(`/public/policies/${policyType}`, 'PUT', body);
  },
);

// Events handlers
export const handleGetOrgEvents = withValidation(
  getEventsRequestSchema,
  async (validatedArgs) => {
    const {
      start,
      end,
      actingUserId,
      itemId,
      collectionId,
      groupId,
      policyId,
      memberId,
    } = validatedArgs;
    const params = new URLSearchParams({
      start,
      end,
      ...(actingUserId && { actingUserId }),
      ...(itemId && { itemId }),
      ...(collectionId && { collectionId }),
      ...(groupId && { groupId }),
      ...(policyId && { policyId }),
      ...(memberId && { memberId }),
    });

    return executeApiRequest(`/public/events?${params.toString()}`, 'GET');
  },
);

// Organization handlers
export const handleGetOrg = withValidation(
  getOrganizationRequestSchema,
  async () => {
    return executeApiRequest(`/public/organization`, 'GET');
  },
);

export const handleUpdateOrg = withValidation(
  updateOrganizationRequestSchema,
  async (validatedArgs) => {
    const { name, businessName, billingEmail } = validatedArgs;
    const body = { name, businessName, billingEmail };
    return executeApiRequest(`/public/organization`, 'PUT', body);
  },
);

export const handleGetOrgBilling = withValidation(
  getBillingRequestSchema,
  async () => {
    return executeApiRequest(`/public/organization/billing`, 'GET');
  },
);

export const handleGetOrgSubscription = withValidation(
  getSubscriptionRequestSchema,
  async () => {
    return executeApiRequest(`/public/organization/subscription`, 'GET');
  },
);
