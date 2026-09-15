#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseHttpCliOptions, startHttpServer } from './http.js';
import { createServer } from './server.js';

async function run(): Promise<void> {
  const httpOptions = parseHttpCliOptions(process.argv.slice(2));
  if (!httpOptions) {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Bitwarden MCP Server running on stdio');
    return;
  }

  const service = await startHttpServer(httpOptions);
  console.error(
    `Bitwarden MCP Server running at http://${service.host}:${service.port}/mcp`,
  );

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    void service.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) return false;
  try {
    return (
      realpathSync(entryPoint) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  run().catch(() => {
    console.error('Bitwarden MCP Server failed to start.');
    process.exit(1);
  });
}

export { run };
