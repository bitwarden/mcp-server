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
  handleUnlock,
  handleSync,
  handleStatus,
  handleList,
  handleGet,
  handleGenerate,
  handleCreate,
  handleEdit,
  handleDelete,
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
  handleGetPublicOrg,
  handleUpdateOrgSecretsManagerSubscription,
  handleImportOrgUsersAndGroups,
} from './handlers/api.js';

/**
 * Main server setup and execution
 */
async function runServer(): Promise<void> {
  const server = new Server(
    {
      name: 'Bitwarden MCP Server',
      version: '2025.9.0',
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
            return { content: [await handleLock(args)] };
          case 'unlock':
            return { content: [await handleUnlock(args)] };
          case 'sync':
            return { content: [await handleSync(args)] };
          case 'status':
            return { content: [await handleStatus(args)] };
          case 'list':
            return { content: [await handleList(args)] };
          case 'get':
            return { content: [await handleGet(args)] };
          case 'generate':
            return { content: [await handleGenerate(args)] };
          case 'create':
            return { content: [await handleCreate(args)] };
          case 'edit':
            return { content: [await handleEdit(args)] };
          case 'delete':
            return { content: [await handleDelete(args)] };

          // Organization API Tools - Collections
          case 'list_org_collections':
            return { content: [await handleListOrgCollections(args)] };
          case 'get_org_collection':
            return { content: [await handleGetOrgCollection(args)] };
          case 'update_org_collection':
            return { content: [await handleUpdateOrgCollection(args)] };
          case 'delete_org_collection':
            return { content: [await handleDeleteOrgCollection(args)] };

          // Organization API Tools - Members
          case 'list_org_members':
            return { content: [await handleListOrgMembers(args)] };
          case 'get_org_member':
            return { content: [await handleGetOrgMember(args)] };
          case 'invite_org_member':
            return { content: [await handleInviteOrgMember(args)] };
          case 'update_org_member':
            return { content: [await handleUpdateOrgMember(args)] };
          case 'remove_org_member':
            return { content: [await handleRemoveOrgMember(args)] };
          case 'get_org_member_groups':
            return { content: [await handleGetOrgMemberGroups(args)] };
          case 'update_org_member_groups':
            return { content: [await handleUpdateOrgMemberGroups(args)] };
          case 'reinvite_org_member':
            return { content: [await handleReinviteOrgMember(args)] };

          // Organization API Tools - Groups
          case 'list_org_groups':
            return { content: [await handleListOrgGroups(args)] };
          case 'get_org_group':
            return { content: [await handleGetOrgGroup(args)] };
          case 'get_org_group_members':
            return { content: [await handleGetOrgGroupMembers(args)] };
          case 'create_org_group':
            return { content: [await handleCreateOrgGroup(args)] };
          case 'update_org_group':
            return { content: [await handleUpdateOrgGroup(args)] };
          case 'delete_org_group':
            return { content: [await handleDeleteOrgGroup(args)] };
          case 'update_org_group_members':
            return { content: [await handleUpdateOrgGroupMembers(args)] };

          // Organization API Tools - Policies
          case 'list_org_policies':
            return { content: [await handleListOrgPolicies(args)] };
          case 'get_org_policy':
            return { content: [await handleGetOrgPolicy(args)] };
          case 'update_org_policy':
            return { content: [await handleUpdateOrgPolicy(args)] };

          // Organization API Tools - Events
          case 'get_org_events':
            return { content: [await handleGetOrgEvents(args)] };

          // Organization API Tools - Billing (Public API)
          case 'get_public_org':
            return { content: [await handleGetPublicOrg(args)] };
          case 'update_org_sm_subscription':
            return {
              content: [await handleUpdateOrgSecretsManagerSubscription(args)],
            };
          case 'import_org_users_and_groups':
            return { content: [await handleImportOrgUsersAndGroups(args)] };

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
