/**
 * Organization API handlers for enterprise management
 */

import { executeApiRequest } from '../utils/api.js';
import { validateInput } from '../utils/validation.js';
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
import type { ApiResponse } from '../utils/types.js';

// Collections handlers
export async function handleListOrgCollections(
  args: unknown,
): Promise<ApiResponse> {
  const [success] = validateInput(listCollectionsRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for list organization collections' };
  }

  return executeApiRequest(`/public/collections`, 'GET');
}

export async function handleGetOrgCollection(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    getCollectionRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for get organization collection' };
  }

  const { collectionId } = validatedArgs;
  return executeApiRequest(`/public/collections/${collectionId}`, 'GET');
}

export async function handleCreateOrgCollection(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    createCollectionRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for create organization collection' };
  }

  const { name, externalId } = validatedArgs;
  const body = { name, externalId };
  return executeApiRequest(`/public/collections`, 'POST', body);
}

export async function handleUpdateOrgCollection(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    updateCollectionRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for update organization collection' };
  }

  const { collectionId, name, externalId } = validatedArgs;
  const body = { name, externalId };
  return executeApiRequest(`/public/collections/${collectionId}`, 'PUT', body);
}

export async function handleDeleteOrgCollection(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    deleteCollectionRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for delete organization collection' };
  }

  const { collectionId } = validatedArgs;
  return executeApiRequest(`/public/collections/${collectionId}`, 'DELETE');
}

// Members handlers
export async function handleListOrgMembers(
  args: unknown,
): Promise<ApiResponse> {
  const [success] = validateInput(listMembersRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for list organization members' };
  }

  return executeApiRequest(`/public/members`, 'GET');
}

export async function handleGetOrgMember(args: unknown): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(getMemberRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for get organization member' };
  }

  const { memberId } = validatedArgs;
  return executeApiRequest(`/public/members/${memberId}`, 'GET');
}

export async function handleInviteOrgMember(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    inviteMemberRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for invite organization member' };
  }

  const { emails, type, accessAll, externalId, collections } = validatedArgs;
  const body = { emails, type, accessAll, externalId, collections };
  return executeApiRequest(`/public/members`, 'POST', body);
}

export async function handleUpdateOrgMember(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    updateMemberRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for update organization member' };
  }

  const { memberId, type, accessAll, externalId, collections } = validatedArgs;
  const body = { type, accessAll, externalId, collections };
  return executeApiRequest(`/public/members/${memberId}`, 'PUT', body);
}

export async function handleRemoveOrgMember(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    removeMemberRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for remove organization member' };
  }

  const { memberId } = validatedArgs;
  return executeApiRequest(`/public/members/${memberId}`, 'DELETE');
}

// Groups handlers
export async function handleListOrgGroups(args: unknown): Promise<ApiResponse> {
  const [success] = validateInput(listGroupsRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for list organization groups' };
  }

  return executeApiRequest(`/public/groups`, 'GET');
}

export async function handleGetOrgGroup(args: unknown): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(getGroupRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for get organization group' };
  }

  const { groupId } = validatedArgs;
  return executeApiRequest(`/public/groups/${groupId}`, 'GET');
}

export async function handleCreateOrgGroup(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    createGroupRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for create organization group' };
  }

  const { name, accessAll, externalId, collections } = validatedArgs;
  const body = { name, accessAll, externalId, collections };
  return executeApiRequest(`/public/groups`, 'POST', body);
}

export async function handleUpdateOrgGroup(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    updateGroupRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for update organization group' };
  }

  const { groupId, name, accessAll, externalId, collections } = validatedArgs;
  const body = { name, accessAll, externalId, collections };
  return executeApiRequest(`/public/groups/${groupId}`, 'PUT', body);
}

export async function handleDeleteOrgGroup(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    deleteGroupRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for delete organization group' };
  }

  const { groupId } = validatedArgs;
  return executeApiRequest(`/public/groups/${groupId}`, 'DELETE');
}

export async function handleGetOrgGroupMembers(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    getGroupMembersRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for get organization group members' };
  }

  const { groupId } = validatedArgs;
  return executeApiRequest(`/public/groups/${groupId}/member-ids`, 'GET');
}

export async function handleUpdateOrgGroupMembers(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    updateGroupMembersRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for update organization group members' };
  }

  const { groupId, memberIds } = validatedArgs;
  const body = { memberIds };
  return executeApiRequest(`/public/groups/${groupId}/member-ids`, 'PUT', body);
}

// Policies handlers
export async function handleListOrgPolicies(
  args: unknown,
): Promise<ApiResponse> {
  const [success] = validateInput(listPoliciesRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for list organization policies' };
  }

  return executeApiRequest(`/public/policies`, 'GET');
}

export async function handleGetOrgPolicy(args: unknown): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(getPolicyRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for get organization policy' };
  }

  const { policyId } = validatedArgs;
  return executeApiRequest(`/public/policies/${policyId}`, 'GET');
}

export async function handleUpdateOrgPolicy(
  args: unknown,
): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    updatePolicyRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for update organization policy' };
  }

  const { policyId, enabled, data } = validatedArgs;
  const body = { enabled, data };
  return executeApiRequest(`/public/policies/${policyId}`, 'PUT', body);
}

// Events handlers
export async function handleGetOrgEvents(args: unknown): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(getEventsRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for get organization events' };
  }

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
}

// Organization handlers
export async function handleGetOrg(args: unknown): Promise<ApiResponse> {
  const [success] = validateInput(getOrganizationRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for get organization' };
  }

  return executeApiRequest(`/public/organization`, 'GET');
}

export async function handleUpdateOrg(args: unknown): Promise<ApiResponse> {
  const [success, validatedArgs] = validateInput(
    updateOrganizationRequestSchema,
    args,
  );
  if (!success) {
    return { error: 'Validation failed for update organization' };
  }

  const { name, businessName, billingEmail } = validatedArgs;
  const body = { name, businessName, billingEmail };
  return executeApiRequest(`/public/organization`, 'PUT', body);
}

export async function handleGetOrgBilling(args: unknown): Promise<ApiResponse> {
  const [success] = validateInput(getBillingRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for get organization billing' };
  }

  return executeApiRequest(`/public/organization/billing`, 'GET');
}

export async function handleGetOrgSubscription(
  args: unknown,
): Promise<ApiResponse> {
  const [success] = validateInput(getSubscriptionRequestSchema, args);
  if (!success) {
    return { error: 'Validation failed for get organization subscription' };
  }

  return executeApiRequest(`/public/organization/subscription`, 'GET');
}
