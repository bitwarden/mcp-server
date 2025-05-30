#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

// define handlers that implement tools
export interface CliResponse {
  output?: string;
  errorOutput?: string;
}

const execPromise = promisify(exec);

async function executeCliCommand(command: string): Promise<CliResponse> {
  try {
    const { stdout, stderr } = await execPromise('bw ${command}');
    return {
      output: stdout,
      errorOutput: stderr,
    };
  } catch (e: unknown) {
    if (e instanceof Error) {
      return {
        errorOutput: e.message,
      };
    }
  }

  return {
    errorOutput: 'An error occurred while executing the command',
  };
}

// require session from environment variable
function getSession(): string {
  const session = process.env.BW_SESSION;

  if (!session) {
    console.error('Please set the BW_SESSION environment variable');
    process.exit(1);
  }

  return session;
}

const BW_SESSION = getSession();

// set up server
const server = new Server({
  name: 'bitwarden',
  version: '0.1.0',
  capabilities: {
    tools: {},
  },
});

// register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'lock',
        description: 'Lock the vault.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name } = request.params;

    switch (name) {
      case 'lock': {
        const result = await executeCliCommand('lock');

        return {
          content: [
            {
              type: 'text',
              text: result.output || result.errorOutput,
            },
          ],
          isError: result.errorOutput ? true : false,
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${request.params.name}`,
            },
          ],
          isError: true,
        };
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
});

// start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Bitwarden MCP Server running on stdio');
}

runServer().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
