#!/usr/bin/env node

/**
 * Bitwarden OpenAI Apps SDK Server
 *
 * HTTP server that exposes Bitwarden MCP tools via OpenAI Apps SDK format.
 * Built on the Model Context Protocol with OpenAI-specific extensions.
 *
 * Key differences from stdio MCP server:
 * - HTTP transport instead of stdio
 * - MCP endpoint for tool calls
 * - OpenAI-formatted responses with structuredContent and _meta
 * - Health check endpoint for monitoring
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

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

// Import OpenAI adapter
import {
  convertToOpenAIFormat,
  isMCPResponse,
} from './utils/openai-adapter.js';

// Configuration
const PORT = process.env['PORT'] || 3000;
const HOST = process.env['HOST'] || '0.0.0.0';

/**
 * Route tool calls to appropriate handlers
 * Reuses all existing handler logic from MCP server
 */
async function routeToolCall(name: string, args: unknown): Promise<unknown> {
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
}

/**
 * Main server setup
 */
async function startServer(): Promise<void> {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  // Note: We don't use the MCP Server class here because we're handling
  // HTTP requests directly. The MCP Server class is designed for stdio transport.
  // Instead, we route requests directly to handlers and convert responses.

  // Root endpoint - service info (GET)
  app.get('/', (_req: Request, res: Response) => {
    return res.json({
      name: 'Bitwarden OpenAI Apps SDK Server',
      version: '2025.10.3',
      documentation: 'https://github.com/bitwarden/mcp-server',
      timestamp: new Date().toISOString(),
      status: 'healthy',
    });
  });

  // Root endpoint - handle MCP requests (POST)
  app.post('/', async (req: Request, res: Response) => {
    try {
      const request = req.body;

      // Validate JSON-RPC 2.0 request format
      if (!request || typeof request !== 'object') {
        return res.json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request',
          },
          id: null,
        });
      }

      const { jsonrpc, method, id, params } = request;

      // Validate JSON-RPC version
      if (jsonrpc !== '2.0') {
        return res.json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request: jsonrpc must be "2.0"',
          },
          id: id || null,
        });
      }

      // Handle different MCP methods
      switch (method) {
        case 'initialize': {
          // MCP initialization handshake
          return res.json({
            jsonrpc: '2.0',
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'Bitwarden OpenAI App',
                version: '2025.10.3',
              },
            },
            id,
          });
        }

        case 'tools/list': {
          // Return list of all available tools
          const tools = [...cliTools, ...organizationApiTools];
          return res.json({
            jsonrpc: '2.0',
            result: {
              tools,
            },
            id,
          });
        }

        case 'tools/call': {
          // Validate tool call request
          if (!params || !params.name) {
            return res.json({
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: 'Invalid params: missing tool name',
              },
              id,
            });
          }

          const { name, arguments: args } = params;

          try {
            // Route to appropriate handler (reuses existing logic)
            const mcpResponse = await routeToolCall(name, args || {});

            // Validate response type before conversion
            if (!isMCPResponse(mcpResponse)) {
              throw new Error('Invalid response format from handler');
            }

            // Convert MCP response to OpenAI format
            const openaiResponse = convertToOpenAIFormat(mcpResponse);

            return res.json({
              jsonrpc: '2.0',
              result: openaiResponse,
              id,
            });
          } catch (toolError) {
            // Tool execution error
            const errorResponse = {
              content: [
                {
                  type: 'text',
                  text: `Error: ${toolError instanceof Error ? toolError.message : String(toolError)}`,
                },
              ],
              isError: true,
            };
            const openaiErrorResponse = convertToOpenAIFormat(errorResponse);

            return res.json({
              jsonrpc: '2.0',
              result: openaiErrorResponse,
              id,
            });
          }
        }

        case 'notifications/initialized': {
          // Client notification that initialization is complete
          // No response needed for notifications
          return res.status(204).end();
        }

        default: {
          return res.json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
            id,
          });
        }
      }
    } catch (error) {
      console.error('Error handling MCP request:', error);
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error),
        },
        id: req.body?.id || null,
      });
    }
  });

  // Favicon handler (silences browser 404 errors)
  app.get('/favicon.ico', (_req: Request, res: Response) => {
    return res.status(204).end();
  });

  // Favicon handler (silences browser 404 errors)
  app.get('/favicon.png', (_req: Request, res: Response) => {
    return res.status(204).end();
  });

  // Favicon handler (silences browser 404 errors)
  app.get('/favicon.svg', (_req: Request, res: Response) => {
    return res.status(204).end();
  });

  // Error handling middleware
  app.use((err: Error, _req: Request, res: Response) => {
    console.error('Unhandled error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  // Start listening
  app.listen(Number(PORT), HOST, () => {
    console.log(`Bitwarden OpenAI App running on http://${HOST}:${PORT}`);
    console.log(`Health check: GET http://${HOST}:${PORT}/`);
    console.log(`MCP endpoint: POST http://${HOST}:${PORT}/`);
    console.log(`\nEnvironment variables required:`);
    console.log(`  - BW_SESSION (for CLI tools)`);
    console.log(`  - BW_CLIENT_ID (for API tools)`);
    console.log(`  - BW_CLIENT_SECRET (for API tools)`);
  });
}

// Run server if executed directly
const isMainModule =
  process.argv[1] && process.argv[1].endsWith('openai-app.js');
if (isMainModule) {
  startServer().catch((error) => {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  });
}

export { startServer };
