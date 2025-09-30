/**
 * Organization API tool definitions for enterprise management
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Organization Collections Tools
export const listOrgCollectionsTool: Tool = {
  name: 'list_org_collections',
  description: 'List all collections in an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
    },
    required: ['organizationId'],
  },
};

export const getOrgCollectionTool: Tool = {
  name: 'get_org_collection',
  description: 'Get details of a specific organization collection',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      collectionId: {
        type: 'string',
        description: 'ID of the collection',
      },
    },
    required: ['organizationId', 'collectionId'],
  },
};

export const createOrgCollectionTool: Tool = {
  name: 'create_org_collection',
  description: 'Create a new collection in an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      name: {
        type: 'string',
        description: 'Name of the collection',
      },
      externalId: {
        type: 'string',
        description: 'External ID for the collection (optional)',
      },
    },
    required: ['organizationId', 'name'],
  },
};

export const updateOrgCollectionTool: Tool = {
  name: 'update_org_collection',
  description: 'Update an existing organization collection',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      collectionId: {
        type: 'string',
        description: 'ID of the collection',
      },
      name: {
        type: 'string',
        description: 'New name for the collection',
      },
      externalId: {
        type: 'string',
        description: 'New external ID for the collection (optional)',
      },
    },
    required: ['organizationId', 'collectionId', 'name'],
  },
};

export const deleteOrgCollectionTool: Tool = {
  name: 'delete_org_collection',
  description: 'Delete an organization collection',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      collectionId: {
        type: 'string',
        description: 'ID of the collection',
      },
    },
    required: ['organizationId', 'collectionId'],
  },
};

// Organization Members Tools
export const listOrgMembersTool: Tool = {
  name: 'list_org_members',
  description: 'List all members in an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
    },
    required: ['organizationId'],
  },
};

export const getOrgMemberTool: Tool = {
  name: 'get_org_member',
  description: 'Get details of a specific organization member',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      memberId: {
        type: 'string',
        description: 'ID of the member',
      },
    },
    required: ['organizationId', 'memberId'],
  },
};

export const inviteOrgMemberTool: Tool = {
  name: 'invite_org_member',
  description: 'Invite a new member to an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      emails: {
        type: 'array',
        description: 'Array of email addresses to invite',
        items: {
          type: 'string',
          format: 'email',
        },
      },
      type: {
        type: 'number',
        description: 'User type (0: Owner, 1: Admin, 2: User, 3: Manager)',
        enum: [0, 1, 2, 3],
      },
      accessAll: {
        type: 'boolean',
        description: 'Whether the member has access to all collections',
      },
      externalId: {
        type: 'string',
        description: 'External ID for the member (optional)',
      },
      collections: {
        type: 'array',
        description: 'Array of collection IDs the member has access to',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Collection ID',
            },
            readOnly: {
              type: 'boolean',
              description: 'Whether access is read-only',
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether to hide passwords',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the member can manage the collection',
            },
          },
          required: ['id'],
        },
      },
    },
    required: ['organizationId', 'emails', 'type'],
  },
};

export const updateOrgMemberTool: Tool = {
  name: 'update_org_member',
  description: 'Update an existing organization member',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      memberId: {
        type: 'string',
        description: 'ID of the member',
      },
      type: {
        type: 'number',
        description: 'User type (0: Owner, 1: Admin, 2: User, 3: Manager)',
        enum: [0, 1, 2, 3],
      },
      accessAll: {
        type: 'boolean',
        description: 'Whether the member has access to all collections',
      },
      externalId: {
        type: 'string',
        description: 'External ID for the member (optional)',
      },
      collections: {
        type: 'array',
        description: 'Array of collection IDs the member has access to',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Collection ID',
            },
            readOnly: {
              type: 'boolean',
              description: 'Whether access is read-only',
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether to hide passwords',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the member can manage the collection',
            },
          },
          required: ['id'],
        },
      },
    },
    required: ['organizationId', 'memberId', 'type'],
  },
};

export const removeOrgMemberTool: Tool = {
  name: 'remove_org_member',
  description: 'Remove a member from an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      memberId: {
        type: 'string',
        description: 'ID of the member',
      },
    },
    required: ['organizationId', 'memberId'],
  },
};

// Organization Groups Tools
export const listOrgGroupsTool: Tool = {
  name: 'list_org_groups',
  description: 'List all groups in an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
    },
    required: ['organizationId'],
  },
};

export const getOrgGroupTool: Tool = {
  name: 'get_org_group',
  description: 'Get details of a specific organization group',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      groupId: {
        type: 'string',
        description: 'ID of the group',
      },
    },
    required: ['organizationId', 'groupId'],
  },
};

export const createOrgGroupTool: Tool = {
  name: 'create_org_group',
  description: 'Create a new group in an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      name: {
        type: 'string',
        description: 'Name of the group',
      },
      accessAll: {
        type: 'boolean',
        description: 'Whether the group has access to all collections',
      },
      externalId: {
        type: 'string',
        description: 'External ID for the group (optional)',
      },
      collections: {
        type: 'array',
        description: 'Array of collection IDs the group has access to',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Collection ID',
            },
            readOnly: {
              type: 'boolean',
              description: 'Whether access is read-only',
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether to hide passwords',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the group can manage the collection',
            },
          },
          required: ['id'],
        },
      },
    },
    required: ['organizationId', 'name'],
  },
};

export const updateOrgGroupTool: Tool = {
  name: 'update_org_group',
  description: 'Update an existing organization group',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      groupId: {
        type: 'string',
        description: 'ID of the group',
      },
      name: {
        type: 'string',
        description: 'New name for the group',
      },
      accessAll: {
        type: 'boolean',
        description: 'Whether the group has access to all collections',
      },
      externalId: {
        type: 'string',
        description: 'External ID for the group (optional)',
      },
      collections: {
        type: 'array',
        description: 'Array of collection IDs the group has access to',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Collection ID',
            },
            readOnly: {
              type: 'boolean',
              description: 'Whether access is read-only',
            },
            hidePasswords: {
              type: 'boolean',
              description: 'Whether to hide passwords',
            },
            manage: {
              type: 'boolean',
              description: 'Whether the group can manage the collection',
            },
          },
          required: ['id'],
        },
      },
    },
    required: ['organizationId', 'groupId', 'name'],
  },
};

export const deleteOrgGroupTool: Tool = {
  name: 'delete_org_group',
  description: 'Delete an organization group',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      groupId: {
        type: 'string',
        description: 'ID of the group',
      },
    },
    required: ['organizationId', 'groupId'],
  },
};

export const getOrgGroupMembersTool: Tool = {
  name: 'get_org_group_members',
  description: 'Get members of a specific organization group',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      groupId: {
        type: 'string',
        description: 'ID of the group',
      },
    },
    required: ['organizationId', 'groupId'],
  },
};

export const updateOrgGroupMembersTool: Tool = {
  name: 'update_org_group_members',
  description: 'Update members of an organization group',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      groupId: {
        type: 'string',
        description: 'ID of the group',
      },
      memberIds: {
        type: 'array',
        description: 'Array of member IDs to add to the group',
        items: {
          type: 'string',
        },
      },
    },
    required: ['organizationId', 'groupId', 'memberIds'],
  },
};

// Organization Policies Tools
export const listOrgPoliciesTool: Tool = {
  name: 'list_org_policies',
  description: 'List all policies in an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
    },
    required: ['organizationId'],
  },
};

export const getOrgPolicyTool: Tool = {
  name: 'get_org_policy',
  description: 'Get details of a specific organization policy',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      policyId: {
        type: 'string',
        description: 'ID of the policy',
      },
    },
    required: ['organizationId', 'policyId'],
  },
};

export const updateOrgPolicyTool: Tool = {
  name: 'update_org_policy',
  description: 'Update an organization policy',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      policyId: {
        type: 'string',
        description: 'ID of the policy',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether the policy is enabled',
      },
      data: {
        type: 'object',
        description: 'Policy configuration data',
      },
    },
    required: ['organizationId', 'policyId', 'enabled'],
  },
};

// Organization Events Tools
export const getOrgEventsTool: Tool = {
  name: 'get_org_events',
  description: 'Get events for an organization',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      start: {
        type: 'string',
        description: 'Start date for events (ISO 8601 format)',
      },
      end: {
        type: 'string',
        description: 'End date for events (ISO 8601 format)',
      },
      actingUserId: {
        type: 'string',
        description: 'Filter by acting user ID (optional)',
      },
      itemId: {
        type: 'string',
        description: 'Filter by item ID (optional)',
      },
      collectionId: {
        type: 'string',
        description: 'Filter by collection ID (optional)',
      },
      groupId: {
        type: 'string',
        description: 'Filter by group ID (optional)',
      },
      policyId: {
        type: 'string',
        description: 'Filter by policy ID (optional)',
      },
      memberId: {
        type: 'string',
        description: 'Filter by member ID (optional)',
      },
    },
    required: ['organizationId', 'start', 'end'],
  },
};

// Organization Info Tools
export const getOrgTool: Tool = {
  name: 'get_org',
  description: 'Get organization details',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
    },
    required: ['organizationId'],
  },
};

export const updateOrgTool: Tool = {
  name: 'update_org',
  description: 'Update organization settings',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
      name: {
        type: 'string',
        description: 'New name for the organization',
      },
      businessName: {
        type: 'string',
        description: 'Business name for the organization',
      },
      billingEmail: {
        type: 'string',
        description: 'Billing email for the organization',
        format: 'email',
      },
    },
    required: ['organizationId'],
  },
};

export const getOrgBillingTool: Tool = {
  name: 'get_org_billing',
  description: 'Get organization billing information',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
    },
    required: ['organizationId'],
  },
};

export const getOrgSubscriptionTool: Tool = {
  name: 'get_org_subscription',
  description: 'Get organization subscription information',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'ID of the organization',
      },
    },
    required: ['organizationId'],
  },
};

// Export all organization API tools as an array
export const organizationApiTools = [
  // Collections
  listOrgCollectionsTool,
  getOrgCollectionTool,
  createOrgCollectionTool,
  updateOrgCollectionTool,
  deleteOrgCollectionTool,
  // Members
  listOrgMembersTool,
  getOrgMemberTool,
  inviteOrgMemberTool,
  updateOrgMemberTool,
  removeOrgMemberTool,
  // Groups
  listOrgGroupsTool,
  getOrgGroupTool,
  createOrgGroupTool,
  updateOrgGroupTool,
  deleteOrgGroupTool,
  getOrgGroupMembersTool,
  updateOrgGroupMembersTool,
  // Policies
  listOrgPoliciesTool,
  getOrgPolicyTool,
  updateOrgPolicyTool,
  // Events
  getOrgEventsTool,
  // Organization
  getOrgTool,
  updateOrgTool,
  getOrgBillingTool,
  getOrgSubscriptionTool,
];
