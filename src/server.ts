/**
 * Bitwarden MCP Server - Main entry point
 *
 *
 * Features:
 * - Personal vault operations (CLI-based)
 * - Organization management (API-based)
 * - Secure OAuth2 authentication with token caching
 * - Input validation and sanitization
 * - Comprehensive error handling
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool definitions
import { cliTools, organizationApiTools } from './tools/index.js';

// Import handlers
import {
  handleLock,
  handleUnlock,
  handleSync,
  handleStatus,
  handleList,
  handleGet,
  handleGenerate,
  handleCreateItem,
  handleCreateFolder,
  handleEditItem,
  handleEditFolder,
  handleDelete,
  handleConfirm,
  handleCreateOrgCollection,
  handleEditOrgCollection,
  handleEditItemCollections,
  handleMove,
  handleDeviceApprovalList,
  handleDeviceApprovalApprove,
  handleDeviceApprovalApproveAll,
  handleDeviceApprovalDeny,
  handleDeviceApprovalDenyAll,
  handleRestore,
  handleCreateTextSend,
  handleCreateFileSend,
  handleListSend,
  handleGetSend,
  handleEditSend,
  handleDeleteSend,
  handleRemoveSendPassword,
  handleCreateAttachment,
} from './handlers/cli.js';

import {
  handleListOrgCollections,
  handleGetOrgCollection,
  handleUpdateOrgCollection,
  handleDeleteOrgCollection,
  handleListOrgMembers,
  handleGetOrgMember,
  handleInviteOrgMember,
  handleUpdateOrgMember,
  handleRemoveOrgMember,
  handleGetOrgMemberGroups,
  handleUpdateOrgMemberGroups,
  handleReinviteOrgMember,
  handleRevokeOrgMember,
  handleRestoreOrgMember,
  handleListOrgGroups,
  handleGetOrgGroup,
  handleGetOrgGroupMembers,
  handleCreateOrgGroup,
  handleUpdateOrgGroup,
  handleDeleteOrgGroup,
  handleUpdateOrgGroupMembers,
  handleListOrgPolicies,
  handleGetOrgPolicy,
  handleUpdateOrgPolicy,
  handleGetOrgEvents,
  handleGetOrgSubscription,
  handleUpdateOrgSubscription,
  handleImportOrgUsersAndGroups,
} from './handlers/api.js';

export const serverInfo = {
  name: 'Bitwarden MCP Server',
  version: '2026.7.0',
} as const;

export const allTools = [...cliTools, ...organizationApiTools];

const toolHandlers = {
  lock: handleLock,
  unlock: handleUnlock,
  sync: handleSync,
  status: handleStatus,
  list: handleList,
  get: handleGet,
  generate: handleGenerate,
  create_item: handleCreateItem,
  create_folder: handleCreateFolder,
  edit_item: handleEditItem,
  edit_folder: handleEditFolder,
  delete: handleDelete,
  confirm: handleConfirm,
  create_org_collection: handleCreateOrgCollection,
  edit_org_collection: handleEditOrgCollection,
  edit_item_collections: handleEditItemCollections,
  move: handleMove,
  device_approval_list: handleDeviceApprovalList,
  device_approval_approve: handleDeviceApprovalApprove,
  device_approval_approve_all: handleDeviceApprovalApproveAll,
  device_approval_deny: handleDeviceApprovalDeny,
  device_approval_deny_all: handleDeviceApprovalDenyAll,
  restore: handleRestore,
  create_text_send: handleCreateTextSend,
  create_file_send: handleCreateFileSend,
  list_send: handleListSend,
  get_send: handleGetSend,
  edit_send: handleEditSend,
  delete_send: handleDeleteSend,
  remove_send_password: handleRemoveSendPassword,
  create_attachment: handleCreateAttachment,
  list_org_collections: handleListOrgCollections,
  get_org_collection: handleGetOrgCollection,
  update_org_collection: handleUpdateOrgCollection,
  delete_org_collection: handleDeleteOrgCollection,
  list_org_members: handleListOrgMembers,
  get_org_member: handleGetOrgMember,
  invite_org_member: handleInviteOrgMember,
  update_org_member: handleUpdateOrgMember,
  remove_org_member: handleRemoveOrgMember,
  get_org_member_groups: handleGetOrgMemberGroups,
  update_org_member_groups: handleUpdateOrgMemberGroups,
  reinvite_org_member: handleReinviteOrgMember,
  revoke_org_member: handleRevokeOrgMember,
  restore_org_member: handleRestoreOrgMember,
  list_org_groups: handleListOrgGroups,
  get_org_group: handleGetOrgGroup,
  get_org_group_members: handleGetOrgGroupMembers,
  create_org_group: handleCreateOrgGroup,
  update_org_group: handleUpdateOrgGroup,
  delete_org_group: handleDeleteOrgGroup,
  update_org_group_members: handleUpdateOrgGroupMembers,
  list_org_policies: handleListOrgPolicies,
  get_org_policy: handleGetOrgPolicy,
  update_org_policy: handleUpdateOrgPolicy,
  get_org_events: handleGetOrgEvents,
  get_org_subscription: handleGetOrgSubscription,
  update_org_subscription: handleUpdateOrgSubscription,
  import_org_users_and_groups: handleImportOrgUsersAndGroups,
} as const;

export async function dispatchTool(name: string, args: unknown) {
  try {
    const handler = toolHandlers[name as keyof typeof toolHandlers];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return await handler(args);
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Main server setup and execution
 */
export function createServer(): Server {
  const server = new Server(serverInfo, {
    capabilities: {
      tools: {},
    },
  });

  // Set up tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return dispatchTool(name, args);
  });

  // Set up tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools,
    };
  });

  return server;
}
