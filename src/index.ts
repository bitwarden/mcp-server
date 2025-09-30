#!/usr/bin/env node

/**
 * Bitwarden MCP Server - Main entry point
 *
 * A Model Context Protocol (MCP) server that provides comprehensive access to Bitwarden
 * password manager functionality through both CLI commands and Public API operations.
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
  handleCreateOrgCollection,
  handleUpdateOrgCollection,
  handleDeleteOrgCollection,
  handleListOrgMembers,
  handleGetOrgMember,
  handleInviteOrgMember,
  handleUpdateOrgMember,
  handleRemoveOrgMember,
  handleListOrgGroups,
  handleGetOrgGroup,
  handleCreateOrgGroup,
  handleUpdateOrgGroup,
  handleDeleteOrgGroup,
  handleGetOrgGroupMembers,
  handleUpdateOrgGroupMembers,
  handleListOrgPolicies,
  handleGetOrgPolicy,
  handleUpdateOrgPolicy,
  handleGetOrgEvents,
  handleGetOrg,
  handleUpdateOrg,
  handleGetOrgBilling,
  handleGetOrgSubscription,
} from './handlers/api.js';

/**
 * Main server setup and execution
 */
async function runServer(): Promise<void> {
  const server = new Server(
    {
      name: 'bitwarden-mcp-server',
      version: '2025.8.2',
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
            return { content: [await handleLock()] };
          case 'unlock':
            return { content: [await handleUnlock(args)] };
          case 'sync':
            return { content: [await handleSync()] };
          case 'status':
            return { content: [await handleStatus()] };
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
          case 'create_org_collection':
            return { content: [await handleCreateOrgCollection(args)] };
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

          // Organization API Tools - Groups
          case 'list_org_groups':
            return { content: [await handleListOrgGroups(args)] };
          case 'get_org_group':
            return { content: [await handleGetOrgGroup(args)] };
          case 'create_org_group':
            return { content: [await handleCreateOrgGroup(args)] };
          case 'update_org_group':
            return { content: [await handleUpdateOrgGroup(args)] };
          case 'delete_org_group':
            return { content: [await handleDeleteOrgGroup(args)] };
          case 'get_org_group_members':
            return { content: [await handleGetOrgGroupMembers(args)] };
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

          // Organization API Tools - Organization
          case 'get_org':
            return { content: [await handleGetOrg(args)] };
          case 'update_org':
            return { content: [await handleUpdateOrg(args)] };
          case 'get_org_billing':
            return { content: [await handleGetOrgBilling(args)] };
          case 'get_org_subscription':
            return { content: [await handleGetOrgSubscription(args)] };

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
const isMainModule = process.argv[1] && process.argv[1].endsWith('index.js');
if (isMainModule) {
  runServer().catch((error) => {
    console.error('Fatal error running server:', error);
    process.exit(1);
  });
}
