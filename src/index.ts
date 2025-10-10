#!/usr/bin/env node

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
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool definitions
import { cliTools, organizationApiTools } from './tools/index.js';

// Import handlers
import {
  handleLock,
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

/**
 * Main server setup and execution
 */
async function runServer(): Promise<void> {
  const server = new Server(
    {
      name: 'Bitwarden MCP Server',
      version: '2025.10.2',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Set up tool call handler
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // CLI Tools (Personal Vault Operations)
          case 'lock':
            return await handleLock(args);
          case 'sync':
            return await handleSync(args);
          case 'status':
            return await handleStatus(args);
          case 'list':
            return await handleList(args);
          case 'get':
            return await handleGet(args);
          case 'generate':
            return await handleGenerate(args);
          case 'create_item':
            return await handleCreateItem(args);
          case 'create_folder':
            return await handleCreateFolder(args);
          case 'edit_item':
            return await handleEditItem(args);
          case 'edit_folder':
            return await handleEditFolder(args);
          case 'delete':
            return await handleDelete(args);
          case 'confirm':
            return await handleConfirm(args);
          case 'create_org_collection':
            return await handleCreateOrgCollection(args);
          case 'edit_org_collection':
            return await handleEditOrgCollection(args);
          case 'edit_item_collections':
            return await handleEditItemCollections(args);
          case 'move':
            return await handleMove(args);
          case 'device_approval_list':
            return await handleDeviceApprovalList(args);
          case 'device_approval_approve':
            return await handleDeviceApprovalApprove(args);
          case 'device_approval_approve_all':
            return await handleDeviceApprovalApproveAll(args);
          case 'device_approval_deny':
            return await handleDeviceApprovalDeny(args);
          case 'device_approval_deny_all':
            return await handleDeviceApprovalDenyAll(args);
          case 'restore':
            return await handleRestore(args);

          // Send Tools
          case 'create_text_send':
            return await handleCreateTextSend(args);
          case 'create_file_send':
            return await handleCreateFileSend(args);
          case 'list_send':
            return await handleListSend(args);
          case 'get_send':
            return await handleGetSend(args);
          case 'edit_send':
            return await handleEditSend(args);
          case 'delete_send':
            return await handleDeleteSend(args);
          case 'remove_send_password':
            return await handleRemoveSendPassword(args);

          // Attachment Tools
          case 'create_attachment':
            return await handleCreateAttachment(args);

          // Organization API Tools - Collections
          case 'list_org_collections':
            return await handleListOrgCollections(args);
          case 'get_org_collection':
            return await handleGetOrgCollection(args);
          case 'update_org_collection':
            return await handleUpdateOrgCollection(args);
          case 'delete_org_collection':
            return await handleDeleteOrgCollection(args);

          // Organization API Tools - Members
          case 'list_org_members':
            return await handleListOrgMembers(args);
          case 'get_org_member':
            return await handleGetOrgMember(args);
          case 'invite_org_member':
            return await handleInviteOrgMember(args);
          case 'update_org_member':
            return await handleUpdateOrgMember(args);
          case 'remove_org_member':
            return await handleRemoveOrgMember(args);
          case 'get_org_member_groups':
            return await handleGetOrgMemberGroups(args);
          case 'update_org_member_groups':
            return await handleUpdateOrgMemberGroups(args);
          case 'reinvite_org_member':
            return await handleReinviteOrgMember(args);

          // Organization API Tools - Groups
          case 'list_org_groups':
            return await handleListOrgGroups(args);
          case 'get_org_group':
            return await handleGetOrgGroup(args);
          case 'get_org_group_members':
            return await handleGetOrgGroupMembers(args);
          case 'create_org_group':
            return await handleCreateOrgGroup(args);
          case 'update_org_group':
            return await handleUpdateOrgGroup(args);
          case 'delete_org_group':
            return await handleDeleteOrgGroup(args);
          case 'update_org_group_members':
            return await handleUpdateOrgGroupMembers(args);

          // Organization API Tools - Policies
          case 'list_org_policies':
            return await handleListOrgPolicies(args);
          case 'get_org_policy':
            return await handleGetOrgPolicy(args);
          case 'update_org_policy':
            return await handleUpdateOrgPolicy(args);

          // Organization API Tools - Events
          case 'get_org_events':
            return await handleGetOrgEvents(args);

          // Organization API Tools - Billing
          case 'get_org_subscription':
            return await handleGetOrgSubscription(args);
          case 'update_org_subscription':
            return await handleUpdateOrgSubscription(args);
          case 'import_org_users_and_groups':
            return await handleImportOrgUsersAndGroups(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Set up tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [...cliTools, ...organizationApiTools],
    };
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Bitwarden MCP Server running on stdio');
}

// Only run the server if this file is executed directly
// Check if this is the main module by comparing file paths
const isMainModule = process.argv[1] && process.argv[1].endsWith('index.js');
if (isMainModule) {
  runServer().catch((error) => {
    console.error('Fatal error running server:', error);
    process.exit(1);
  });
}
