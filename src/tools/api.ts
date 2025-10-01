/**
 * Organization API tool definitions for enterprise management
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Organization Collections Tools
export const listOrgCollectionsTool: Tool = {
  name: 'list_org_collections',
  description: 'List all collections',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getOrgCollectionTool: Tool = {
  name: 'get_org_collection',
  description: 'Retrieve a collection',
  inputSchema: {
    type: 'object',
    properties: {
      collectionId: {
        type: 'string',
        description: 'ID of the collection',
      },
    },
    required: ['collectionId'],
  },
};

export const updateOrgCollectionTool: Tool = {
  name: 'update_org_collection',
  description: 'Update a collection',
  inputSchema: {
    type: 'object',
    properties: {
      collectionId: {
        type: 'string',
        description: 'ID of the collection',
      },
      externalId: {
        type: 'string',
        description:
          'External identifier for reference or linking this collection to another system',
        maxLength: 300,
      },
      groups: {
        type: 'array',
        description:
          'The associated groups that this collection is assigned to',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: "The associated object's unique identifier",
            },
            readOnly: {
              type: 'boolean',
              description:
                'When true, the read only permission will not allow the user or group to make changes to items',
            },
            hidePasswords: {
              type: 'boolean',
              description:
                'When true, the hide passwords permission will not allow the user or group to view passwords',
            },
            manage: {
              type: 'boolean',
              description:
                'When true, the manage permission allows a user to both edit the ciphers within a collection and edit the users/groups that are assigned to the collection',
            },
          },
          required: ['id', 'readOnly'],
        },
      },
    },
    required: ['collectionId'],
  },
};

export const deleteOrgCollectionTool: Tool = {
  name: 'delete_org_collection',
  description: 'Delete a collection',
  inputSchema: {
    type: 'object',
    properties: {
      collectionId: {
        type: 'string',
        description: 'ID of the collection',
      },
    },
    required: ['collectionId'],
  },
};

// Organization Members Tools
export const listOrgMembersTool: Tool = {
  name: 'list_org_members',
  description: 'List all members',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getOrgMemberTool: Tool = {
  name: 'get_org_member',
  description: 'Retrieve a member',
  inputSchema: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        description: 'ID of the member',
      },
    },
    required: ['memberId'],
  },
};

export const inviteOrgMemberTool: Tool = {
  name: 'invite_org_member',
  description: 'Create a member',
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'Email address to invite',
        maxLength: 256,
      },
      type: {
        type: 'number',
        description: 'User type (0: Owner, 1: Admin, 2: User, 4: Custom)',
        enum: [0, 1, 2, 4],
      },
      externalId: {
        type: 'string',
        description: 'External ID for the member (optional)',
        maxLength: 300,
      },
      permissions: {
        type: 'object',
        description: 'Custom permissions if the member has a Custom role',
        properties: {
          accessEventLogs: { type: 'boolean' },
          accessImportExport: { type: 'boolean' },
          accessReports: { type: 'boolean' },
          createNewCollections: { type: 'boolean' },
          editAnyCollection: { type: 'boolean' },
          deleteAnyCollection: { type: 'boolean' },
          manageGroups: { type: 'boolean' },
          managePolicies: { type: 'boolean' },
          manageSso: { type: 'boolean' },
          manageUsers: { type: 'boolean' },
          manageResetPassword: { type: 'boolean' },
          manageScim: { type: 'boolean' },
        },
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
      groups: {
        type: 'array',
        description: 'Array of group IDs the member belongs to',
        items: {
          type: 'string',
          format: 'uuid',
          description: 'Group ID',
        },
      },
    },
    required: ['email', 'type'],
  },
};

export const updateOrgMemberTool: Tool = {
  name: 'update_org_member',
  description: 'Update a member',
  inputSchema: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        format: 'uuid',
        description: 'ID of the member',
      },
      type: {
        type: 'number',
        description: 'User type (0: Owner, 1: Admin, 2: User, 4: Custom)',
        enum: [0, 1, 2, 4],
      },
      externalId: {
        type: 'string',
        description: 'External ID for the member (optional)',
        maxLength: 300,
      },
      permissions: {
        type: 'object',
        description: 'Custom permissions if the member has a Custom role',
        properties: {
          accessEventLogs: { type: 'boolean' },
          accessImportExport: { type: 'boolean' },
          accessReports: { type: 'boolean' },
          createNewCollections: { type: 'boolean' },
          editAnyCollection: { type: 'boolean' },
          deleteAnyCollection: { type: 'boolean' },
          manageGroups: { type: 'boolean' },
          managePolicies: { type: 'boolean' },
          manageSso: { type: 'boolean' },
          manageUsers: { type: 'boolean' },
          manageResetPassword: { type: 'boolean' },
          manageScim: { type: 'boolean' },
        },
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
      groups: {
        type: 'array',
        description: 'Array of group IDs the member belongs to',
        items: {
          type: 'string',
          format: 'uuid',
          description: 'Group ID',
        },
      },
    },
    required: ['memberId', 'type'],
  },
};

export const removeOrgMemberTool: Tool = {
  name: 'remove_org_member',
  description: 'Remove a member',
  inputSchema: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        description: 'ID of the member',
      },
    },
    required: ['memberId'],
  },
};

// Organization Groups Tools
export const listOrgGroupsTool: Tool = {
  name: 'list_org_groups',
  description: 'List all groups',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getOrgGroupTool: Tool = {
  name: 'get_org_group',
  description: 'Retrieve a group',
  inputSchema: {
    type: 'object',
    properties: {
      groupId: {
        type: 'string',
        format: 'uuid',
        description: 'ID of the group',
      },
    },
    required: ['groupId'],
  },
};

export const createOrgGroupTool: Tool = {
  name: 'create_org_group',
  description: 'Create a group',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the group',
        maxLength: 100,
      },
      externalId: {
        type: 'string',
        description: 'External ID for the group (optional)',
        maxLength: 300,
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
    required: ['name'],
  },
};

export const updateOrgGroupTool: Tool = {
  name: 'update_org_group',
  description: 'Update a group',
  inputSchema: {
    type: 'object',
    properties: {
      groupId: {
        type: 'string',
        description: 'ID of the group',
      },
      name: {
        type: 'string',
        description: 'New name for the group',
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
    required: ['groupId', 'name'],
  },
};

export const deleteOrgGroupTool: Tool = {
  name: 'delete_org_group',
  description: 'Delete a group',
  inputSchema: {
    type: 'object',
    properties: {
      groupId: {
        type: 'string',
        description: 'ID of the group',
      },
    },
    required: ['groupId'],
  },
};

export const getOrgMemberGroupsTool: Tool = {
  name: 'get_org_member_groups',
  description: "Retrieve a member's group ids",
  inputSchema: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        format: 'uuid',
        description: 'ID of the member',
      },
    },
    required: ['memberId'],
  },
};

export const getOrgGroupMembersTool: Tool = {
  name: 'get_org_group_members',
  description: "Retrieve a group's member ids",
  inputSchema: {
    type: 'object',
    properties: {
      groupId: {
        type: 'string',
        format: 'uuid',
        description: 'ID of the group',
      },
    },
    required: ['groupId'],
  },
};

export const updateOrgMemberGroupsTool: Tool = {
  name: 'update_org_member_groups',
  description: "Update a member's groups",
  inputSchema: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        format: 'uuid',
        description: 'ID of the member',
      },
      groupIds: {
        type: 'array',
        description: 'Array of group IDs that the member should belong to',
        items: {
          type: 'string',
          format: 'uuid',
        },
      },
    },
    required: ['memberId', 'groupIds'],
  },
};

export const reinviteOrgMemberTool: Tool = {
  name: 'reinvite_org_member',
  description: 'Re-invite a member',
  inputSchema: {
    type: 'object',
    properties: {
      memberId: {
        type: 'string',
        format: 'uuid',
        description: 'ID of the member to re-invite',
      },
    },
    required: ['memberId'],
  },
};

export const updateOrgGroupMembersTool: Tool = {
  name: 'update_org_group_members',
  description: "Update a group's members",
  inputSchema: {
    type: 'object',
    properties: {
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
    required: ['groupId', 'memberIds'],
  },
};

// Organization Policies Tools
export const listOrgPoliciesTool: Tool = {
  name: 'list_org_policies',
  description: 'List all policies',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getOrgPolicyTool: Tool = {
  name: 'get_org_policy',
  description: 'Retrieve a policy',
  inputSchema: {
    type: 'object',
    properties: {
      policyType: {
        type: 'integer',
        description:
          'Type of the policy (0=TwoFactorAuthentication, 1=MasterPassword, 2=PasswordGenerator, 3=SingleOrg, 4=RequireSso, 5=OrganizationDataOwnership, 6=DisableSend, 7=SendOptions, 8=ResetPassword, 9=MaximumVaultTimeout, 10=DisablePersonalVaultExport, 11=ActivateAutofill, 12=AutomaticAppLogIn, 13=FreeFamiliesSponsorshipPolicy, 14=RemoveUnlockWithPin, 15=RestrictedItemTypesPolicy)',
        minimum: 0,
        maximum: 15,
      },
    },
    required: ['policyType'],
  },
};

export const updateOrgPolicyTool: Tool = {
  name: 'update_org_policy',
  description: 'Update a policy',
  inputSchema: {
    type: 'object',
    properties: {
      policyType: {
        type: 'integer',
        description:
          'Type of the policy (0=TwoFactorAuthentication, 1=MasterPassword, 2=PasswordGenerator, 3=SingleOrg, 4=RequireSso, 5=OrganizationDataOwnership, 6=DisableSend, 7=SendOptions, 8=ResetPassword, 9=MaximumVaultTimeout, 10=DisablePersonalVaultExport, 11=ActivateAutofill, 12=AutomaticAppLogIn, 13=FreeFamiliesSponsorshipPolicy, 14=RemoveUnlockWithPin, 15=RestrictedItemTypesPolicy)',
        minimum: 0,
        maximum: 15,
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
    required: ['policyType', 'enabled'],
  },
};

// Organization Events Tools
export const getOrgEventsTool: Tool = {
  name: 'get_org_events',
  description: 'List all events',
  inputSchema: {
    type: 'object',
    properties: {
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
    required: ['start', 'end'],
  },
};

// Organization Billing Tools
export const getOrgSubscriptionTool: Tool = {
  name: 'get_org_subscription',
  description: 'Retrieve the subscription details for the current organization',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const updateOrgSubscriptionTool: Tool = {
  name: 'update_org_subscription',
  description:
    "Update the organization's current subscription for Password Manager and/or Secrets Manager",
  inputSchema: {
    type: 'object',
    properties: {
      passwordManager: {
        type: 'object',
        description: 'Password Manager subscription details',
        properties: {
          seats: {
            type: 'integer',
            description: 'Number of Password Manager seats',
          },
          storage: {
            type: 'integer',
            description: 'Storage in GB',
          },
          maxAutoScaleSeats: {
            type: 'integer',
            description: 'Maximum auto-scale seats for Password Manager',
          },
        },
      },
      secretsManager: {
        type: 'object',
        description: 'Secrets Manager subscription details',
        properties: {
          seats: {
            type: 'integer',
            description: 'Number of Secrets Manager seats',
          },
          maxAutoScaleSeats: {
            type: 'integer',
            description: 'Maximum auto-scale seats for Secrets Manager',
          },
          serviceAccounts: {
            type: 'integer',
            description: 'Number of Secrets Manager service accounts',
          },
          maxAutoScaleServiceAccounts: {
            type: 'integer',
            description: 'Maximum auto-scale service accounts',
          },
        },
      },
    },
    required: [],
  },
};

export const importOrgUsersAndGroupsTool: Tool = {
  name: 'import_org_users_and_groups',
  description: 'Import members and groups from an external system',
  inputSchema: {
    type: 'object',
    properties: {
      groups: {
        type: 'array',
        description: 'Groups to import',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the group',
              maxLength: 100,
            },
            externalId: {
              type: 'string',
              description: 'External ID for the group',
              maxLength: 300,
            },
            memberExternalIds: {
              type: 'array',
              description: 'External IDs of members in this group',
              items: {
                type: 'string',
              },
            },
          },
          required: ['name', 'externalId'],
        },
      },
      members: {
        type: 'array',
        description: 'Members to import',
        items: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address (required for non-deleted users)',
              maxLength: 256,
            },
            externalId: {
              type: 'string',
              description: 'External ID for the member',
              maxLength: 300,
            },
            deleted: {
              type: 'boolean',
              description:
                'Whether this member should be removed from the organization',
              default: false,
            },
          },
          required: ['externalId'],
        },
      },
      overwriteExisting: {
        type: 'boolean',
        description: 'Whether to overwrite existing data or append to it',
        default: false,
      },
      largeImport: {
        type: 'boolean',
        description:
          'Indicates an import of over 2000 users and/or groups is expected',
        default: false,
      },
    },
    required: ['overwriteExisting'],
  },
};

// Export all organization API tools as an array
export const organizationApiTools = [
  // Collections
  listOrgCollectionsTool,
  getOrgCollectionTool,
  updateOrgCollectionTool,
  deleteOrgCollectionTool,
  // Members
  listOrgMembersTool,
  getOrgMemberTool,
  getOrgMemberGroupsTool,
  inviteOrgMemberTool,
  updateOrgMemberTool,
  updateOrgMemberGroupsTool,
  removeOrgMemberTool,
  reinviteOrgMemberTool,
  // Groups
  listOrgGroupsTool,
  getOrgGroupTool,
  getOrgGroupMembersTool,
  createOrgGroupTool,
  updateOrgGroupTool,
  deleteOrgGroupTool,
  updateOrgGroupMembersTool,
  // Policies
  listOrgPoliciesTool,
  getOrgPolicyTool,
  updateOrgPolicyTool,
  // Events
  getOrgEventsTool,
  // Organization Billing
  getOrgSubscriptionTool,
  updateOrgSubscriptionTool,
  // Organization Import
  importOrgUsersAndGroupsTool,
];
