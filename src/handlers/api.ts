/**
 * Organization API handlers for enterprise management
 */

import { executeApiRequest } from '../utils/api.js';
import { withValidation } from '../utils/validation.js';
import {
  listCollectionsRequestSchema,
  getCollectionRequestSchema,
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
  getMemberGroupsRequestSchema,
  getGroupMembersRequestSchema,
  updateMemberGroupsRequestSchema,
  updateGroupMembersRequestSchema,
  reinviteMemberRequestSchema,
  listPoliciesRequestSchema,
  getPolicyRequestSchema,
  updatePolicyRequestSchema,
  getEventsRequestSchema,
  getOrgSubscriptionRequestSchema,
  updateOrgSubscriptionRequestSchema,
  importOrganizationUsersAndGroupsRequestSchema,
} from '../schemas/api.js';
import { ApiResponse } from '../utils/types.js';

function toMcpFormat(response: ApiResponse) {
  let text = 'Success: Operation completed';
  if (response.errorMessage) {
    text = `Error: ${response.errorMessage}${response.data ? `\nDetails: ${JSON.stringify(response.data, null, 2)}` : ''}`;
  } else if (response.data) {
    text = JSON.stringify(response.data, null, 2);
  }

  return {
    isError: response.errorMessage ? true : false,
    content: [
      {
        type: 'text',
        text: text,
      },
    ],
  };
}

// Collections handlers
export const handleListOrgCollections = withValidation(
  listCollectionsRequestSchema,
  async () => {
    const response = await executeApiRequest(`/public/collections`, 'GET');
    return toMcpFormat(response);
  },
);

export const handleGetOrgCollection = withValidation(
  getCollectionRequestSchema,
  async (validatedArgs) => {
    const { collectionId } = validatedArgs;
    const response = await executeApiRequest(
      `/public/collections/${collectionId}`,
      'GET',
    );
    return toMcpFormat(response);
  },
);

export const handleUpdateOrgCollection = withValidation(
  updateCollectionRequestSchema,
  async (validatedArgs) => {
    const { collectionId, externalId, groups } = validatedArgs;
    const body = { externalId, groups };
    const response = await executeApiRequest(
      `/public/collections/${collectionId}`,
      'PUT',
      body,
    );
    return toMcpFormat(response);
  },
);

export const handleDeleteOrgCollection = withValidation(
  deleteCollectionRequestSchema,
  async (validatedArgs) => {
    const { collectionId } = validatedArgs;
    const response = await executeApiRequest(
      `/public/collections/${collectionId}`,
      'DELETE',
    );
    return toMcpFormat(response);
  },
);

// Members handlers
export const handleListOrgMembers = withValidation(
  listMembersRequestSchema,
  async () => {
    const response = await executeApiRequest(`/public/members`, 'GET');
    return toMcpFormat(response);
  },
);

export const handleGetOrgMember = withValidation(
  getMemberRequestSchema,
  async (validatedArgs) => {
    const { memberId } = validatedArgs;
    const response = await executeApiRequest(
      `/public/members/${memberId}`,
      'GET',
    );
    return toMcpFormat(response);
  },
);

export const handleInviteOrgMember = withValidation(
  inviteMemberRequestSchema,
  async (validatedArgs) => {
    const { email, type, externalId, collections, groups, permissions } =
      validatedArgs;
    const body = { email, type, externalId, collections, groups, permissions };
    const response = await executeApiRequest(`/public/members`, 'POST', body);
    return toMcpFormat(response);
  },
);

export const handleUpdateOrgMember = withValidation(
  updateMemberRequestSchema,
  async (validatedArgs) => {
    const { memberId, type, externalId, collections, groups, permissions } =
      validatedArgs;
    const body = { type, externalId, collections, groups, permissions };
    const response = await executeApiRequest(
      `/public/members/${memberId}`,
      'PUT',
      body,
    );
    return toMcpFormat(response);
  },
);

export const handleRemoveOrgMember = withValidation(
  removeMemberRequestSchema,
  async (validatedArgs) => {
    const { memberId } = validatedArgs;
    const response = await executeApiRequest(
      `/public/members/${memberId}`,
      'DELETE',
    );
    return toMcpFormat(response);
  },
);

// Groups handlers
export const handleListOrgGroups = withValidation(
  listGroupsRequestSchema,
  async () => {
    const response = await executeApiRequest(`/public/groups`, 'GET');
    return toMcpFormat(response);
  },
);

export const handleGetOrgGroup = withValidation(
  getGroupRequestSchema,
  async (validatedArgs) => {
    const { groupId } = validatedArgs;
    const response = await executeApiRequest(
      `/public/groups/${groupId}`,
      'GET',
    );
    return toMcpFormat(response);
  },
);

export const handleCreateOrgGroup = withValidation(
  createGroupRequestSchema,
  async (validatedArgs) => {
    const { name, externalId, collections } = validatedArgs;
    const body = { name, externalId, collections };
    const response = await executeApiRequest(`/public/groups`, 'POST', body);
    return toMcpFormat(response);
  },
);

export const handleUpdateOrgGroup = withValidation(
  updateGroupRequestSchema,
  async (validatedArgs) => {
    const { groupId, name, externalId, collections } = validatedArgs;
    const body = { name, externalId, collections };
    const response = await executeApiRequest(
      `/public/groups/${groupId}`,
      'PUT',
      body,
    );
    return toMcpFormat(response);
  },
);

export const handleDeleteOrgGroup = withValidation(
  deleteGroupRequestSchema,
  async (validatedArgs) => {
    const { groupId } = validatedArgs;
    const response = await executeApiRequest(
      `/public/groups/${groupId}`,
      'DELETE',
    );
    return toMcpFormat(response);
  },
);

export const handleGetOrgMemberGroups = withValidation(
  getMemberGroupsRequestSchema,
  async (validatedArgs) => {
    const { memberId } = validatedArgs;
    const response = await executeApiRequest(
      `/public/members/${memberId}/group-ids`,
      'GET',
    );
    return toMcpFormat(response);
  },
);

export const handleGetOrgGroupMembers = withValidation(
  getGroupMembersRequestSchema,
  async (validatedArgs) => {
    const { groupId } = validatedArgs;
    const response = await executeApiRequest(
      `/public/groups/${groupId}/member-ids`,
      'GET',
    );
    return toMcpFormat(response);
  },
);

export const handleUpdateOrgMemberGroups = withValidation(
  updateMemberGroupsRequestSchema,
  async (validatedArgs) => {
    const { memberId, groupIds } = validatedArgs;
    const body = { groupIds };
    const response = await executeApiRequest(
      `/public/members/${memberId}/group-ids`,
      'PUT',
      body,
    );
    return toMcpFormat(response);
  },
);

export const handleReinviteOrgMember = withValidation(
  reinviteMemberRequestSchema,
  async (validatedArgs) => {
    const { memberId } = validatedArgs;
    const response = await executeApiRequest(
      `/public/members/${memberId}/reinvite`,
      'POST',
    );
    return toMcpFormat(response);
  },
);

export const handleUpdateOrgGroupMembers = withValidation(
  updateGroupMembersRequestSchema,
  async (validatedArgs) => {
    const { groupId, memberIds } = validatedArgs;
    const body = { memberIds };
    const response = await executeApiRequest(
      `/public/groups/${groupId}/member-ids`,
      'PUT',
      body,
    );
    return toMcpFormat(response);
  },
);

// Policies handlers
export const handleListOrgPolicies = withValidation(
  listPoliciesRequestSchema,
  async () => {
    const response = await executeApiRequest(`/public/policies`, 'GET');
    return toMcpFormat(response);
  },
);

export const handleGetOrgPolicy = withValidation(
  getPolicyRequestSchema,
  async (validatedArgs) => {
    const { policyType } = validatedArgs;
    const response = await executeApiRequest(
      `/public/policies/${policyType}`,
      'GET',
    );
    return toMcpFormat(response);
  },
);

export const handleUpdateOrgPolicy = withValidation(
  updatePolicyRequestSchema,
  async (validatedArgs) => {
    const { policyType, enabled, data } = validatedArgs;
    const body = { enabled, data };
    const response = await executeApiRequest(
      `/public/policies/${policyType}`,
      'PUT',
      body,
    );
    return toMcpFormat(response);
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

    const response = await executeApiRequest(
      `/public/events?${params.toString()}`,
      'GET',
    );
    return toMcpFormat(response);
  },
);

// Organization Billing handlers
export const handleGetOrgSubscription = withValidation(
  getOrgSubscriptionRequestSchema,
  async () => {
    const response = await executeApiRequest(
      `/public/organization/subscription`,
      'GET',
    );
    return toMcpFormat(response);
  },
);

export const handleUpdateOrgSubscription = withValidation(
  updateOrgSubscriptionRequestSchema,
  async (validatedArgs) => {
    const { passwordManager, secretsManager } = validatedArgs;
    const body = { passwordManager, secretsManager };
    const response = await executeApiRequest(
      `/public/organization/subscription`,
      'PUT',
      body,
    );
    return toMcpFormat(response);
  },
);

export const handleImportOrgUsersAndGroups = withValidation(
  importOrganizationUsersAndGroupsRequestSchema,
  async (validatedArgs) => {
    const { groups, members, overwriteExisting, largeImport } = validatedArgs;
    const body = {
      groups: groups || [],
      members: members || [],
      overwriteExisting: overwriteExisting,
      largeImport: largeImport || false,
    };
    const response = await executeApiRequest(
      `/public/organization/import`,
      'POST',
      body,
    );
    return toMcpFormat(response);
  },
);
