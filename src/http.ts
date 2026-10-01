import { randomUUID } from 'node:crypto';
import {
  createServer as createNodeHttpServer,
  type IncomingMessage,
  type Server as NodeHttpServer,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  allTools,
  createServer as createMcpServer,
  dispatchTool,
  serverInfo,
} from './server.js';

export const MODERN_PROTOCOL_VERSION = '2026-07-28';
export const HTTP_PATH = '/mcp';

const PROTOCOL_VERSION_META = 'io.modelcontextprotocol/protocolVersion';
const CLIENT_INFO_META = 'io.modelcontextprotocol/clientInfo';
const CLIENT_CAPABILITIES_META = 'io.modelcontextprotocol/clientCapabilities';
const SERVER_INFO_META = 'io.modelcontextprotocol/serverInfo';

export const DEFAULT_HTTP_LIMITS = {
  maxBodyBytes: 1024 * 1024,
  maxLegacySessions: 32,
  maxPendingPerSession: 8,
  legacyIdleTtlMs: 30 * 60 * 1000,
} as const;

type JsonObject = Record<string, unknown>;
type JsonRpcId = string | number | null;
type ToolDispatcher = typeof dispatchTool;

export interface HttpLimits {
  readonly maxBodyBytes: number;
  readonly maxLegacySessions: number;
  readonly maxPendingPerSession: number;
  readonly legacyIdleTtlMs: number;
}

interface LegacySession {
  readonly transport: StreamableHTTPServerTransport;
  readonly server: ReturnType<typeof createMcpServer>;
  lastActiveAt: number;
  pendingRequests: number;
  closing: boolean;
}

export interface HttpServerOptions {
  readonly host: string;
  readonly port: number;
  readonly limits?: Partial<HttpLimits>;
  readonly toolDispatcher?: ToolDispatcher;
}

export interface HttpService {
  readonly host: string;
  readonly port: number;
  readonly server: NodeHttpServer;
  legacySessionCount(): number;
  close(): Promise<void>;
}

export interface HttpCliOptions {
  readonly host: '127.0.0.1';
  readonly port: number;
}

class RequestBodyError extends Error {
  constructor(
    readonly status: number,
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export function parseHttpCliOptions(
  args: readonly string[],
): HttpCliOptions | undefined {
  if (args.length === 0) {
    return undefined;
  }

  let host: string | undefined;
  let portText: string | undefined;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag || value === undefined) {
      throw new Error('HTTP mode requires values for every option.');
    }
    if (flag === '--http-host' && host === undefined) {
      host = value;
    } else if (flag === '--http-port' && portText === undefined) {
      portText = value;
    } else {
      throw new Error(`Unknown or duplicate option: ${flag}`);
    }
  }

  if (host !== '127.0.0.1') {
    throw new Error('--http-host must be exactly 127.0.0.1.');
  }
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('--http-port must be an integer from 1 to 65535.');
  }
  return { host, port };
}

export function isLoopbackAddress(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::ffff:127.0.0.1';
}

export async function startHttpServer(
  options: HttpServerOptions,
): Promise<HttpService> {
  if (options.host !== '127.0.0.1') {
    throw new Error('Bitwarden MCP HTTP may only bind to 127.0.0.1.');
  }
  if (
    !Number.isInteger(options.port) ||
    options.port < 0 ||
    options.port > 65535
  ) {
    throw new Error('HTTP port must be an integer from 0 to 65535.');
  }

  const limits: HttpLimits = { ...DEFAULT_HTTP_LIMITS, ...options.limits };
  assertPositiveLimits(limits);

  const toolDispatcher = options.toolDispatcher ?? dispatchTool;
  const sessions = new Map<string, LegacySession>();
  let initializingSessions = 0;
  let boundPort = options.port;

  const closeLegacySession = async (
    sessionId: string,
    context: LegacySession,
  ): Promise<void> => {
    if (context.closing) return;
    context.closing = true;
    sessions.delete(sessionId);
    await context.server.close();
  };

  const sweepTimer = setInterval(
    () => {
      const expiry = Date.now() - limits.legacyIdleTtlMs;
      for (const [sessionId, context] of sessions) {
        if (context.pendingRequests === 0 && context.lastActiveAt <= expiry) {
          void closeLegacySession(sessionId, context).catch(() => {
            // The context was already removed. A close failure must not expose
            // request or environment data, and the next sweep has nothing to do.
          });
        }
      }
    },
    Math.min(60_000, limits.legacyIdleTtlMs),
  );
  sweepTimer.unref();

  const handleLegacyRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
    body: JsonObject | undefined,
  ): Promise<void> => {
    const sessionId = singleHeader(request, 'mcp-session-id');
    if (sessionId) {
      const context = sessions.get(sessionId);
      if (!context || context.closing) {
        writeJsonRpcError(response, 404, -32001, 'Session not found', null);
        return;
      }
      if (context.pendingRequests >= limits.maxPendingPerSession) {
        writeJsonRpcError(
          response,
          429,
          -32000,
          'Too many requests for this session',
          requestId(body),
        );
        return;
      }

      context.pendingRequests += 1;
      context.lastActiveAt = Date.now();
      try {
        await context.transport.handleRequest(request, response, body);
      } finally {
        context.pendingRequests -= 1;
        context.lastActiveAt = Date.now();
      }
      return;
    }

    if (request.method !== 'POST' || !body || !isInitializeRequest(body)) {
      writeJsonRpcError(
        response,
        request.method === 'POST' ? 400 : 405,
        -32000,
        'A valid legacy session is required',
        requestId(body),
      );
      return;
    }
    if (sessions.size + initializingSessions >= limits.maxLegacySessions) {
      writeJsonRpcError(
        response,
        429,
        -32000,
        'Legacy session limit reached',
        requestId(body),
      );
      return;
    }

    initializingSessions += 1;
    const mcpServer = createMcpServer();
    const contextHolder: { current?: LegacySession } = {};
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      enableJsonResponse: true,
      onsessioninitialized: (newSessionId) => {
        const initializedContext = contextHolder.current;
        if (initializedContext) {
          sessions.set(newSessionId, initializedContext);
        }
      },
    });
    const context: LegacySession = {
      transport,
      server: mcpServer,
      lastActiveAt: Date.now(),
      pendingRequests: 1,
      closing: false,
    };
    contextHolder.current = context;
    transport.onclose = () => {
      const closedSessionId = transport.sessionId;
      if (closedSessionId) sessions.delete(closedSessionId);
    };

    try {
      // The SDK's HTTP transport and base Transport declarations disagree
      // under exactOptionalPropertyTypes even though the runtime contract is
      // identical. Keep the compatibility cast confined to this boundary.
      await mcpServer.connect(transport as unknown as Transport);
      await transport.handleRequest(request, response, body);
      context.pendingRequests = 0;
      context.lastActiveAt = Date.now();
      if (!transport.sessionId) {
        await mcpServer.close();
      }
    } catch (error) {
      context.pendingRequests = 0;
      const initializedSessionId = transport.sessionId;
      if (initializedSessionId) {
        sessions.delete(initializedSessionId);
      }
      await mcpServer.close().catch(() => {
        // Preserve the request failure while still attempting cleanup.
      });
      throw error;
    } finally {
      initializingSessions -= 1;
    }
  };

  const handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (!validateConnection(request, response, boundPort)) return;

    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname !== HTTP_PATH) {
      writeJsonRpcError(response, 404, -32601, 'Method not found', null);
      return;
    }

    if (!['GET', 'POST', 'DELETE'].includes(request.method ?? '')) {
      writeJsonRpcError(response, 405, -32601, 'Method not allowed', null);
      return;
    }

    let body: JsonObject | undefined;
    if (request.method === 'POST') {
      try {
        body = await readJsonBody(request, limits.maxBodyBytes);
      } catch (error) {
        if (error instanceof RequestBodyError) {
          writeJsonRpcError(
            response,
            error.status,
            error.code,
            error.message,
            null,
          );
          return;
        }
        writeJsonRpcError(response, 400, -32700, 'Parse error', null);
        return;
      }
    }

    if (body && hasModernSignal(request, body)) {
      if (request.method !== 'POST') {
        writeJsonRpcError(response, 405, -32601, 'Method not allowed', null);
        return;
      }
      await handleModernRequest(request, response, body, toolDispatcher);
      return;
    }

    await handleLegacyRequest(request, response, body);
  };

  const nodeServer = createNodeHttpServer((request, response) => {
    void handleRequest(request, response).catch(() => {
      if (!response.headersSent) {
        writeJsonRpcError(response, 500, -32603, 'Internal server error', null);
      } else {
        response.destroy();
      }
    });
  });
  nodeServer.requestTimeout = 30_000;
  nodeServer.headersTimeout = 10_000;
  nodeServer.keepAliveTimeout = 5_000;

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      nodeServer.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      nodeServer.off('error', onError);
      resolve();
    };
    nodeServer.once('error', onError);
    nodeServer.once('listening', onListening);
    nodeServer.listen(options.port, options.host);
  });

  const address = nodeServer.address() as AddressInfo;
  boundPort = address.port;

  return {
    host: options.host,
    port: boundPort,
    server: nodeServer,
    legacySessionCount: () => sessions.size,
    close: async () => {
      clearInterval(sweepTimer);
      await Promise.all(
        [...sessions].map(([sessionId, context]) =>
          closeLegacySession(sessionId, context),
        ),
      );
      await closeNodeServer(nodeServer);
    },
  };
}

function assertPositiveLimits(limits: HttpLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive integer.`);
    }
  }
}

function validateConnection(
  request: IncomingMessage,
  response: ServerResponse,
  port: number,
): boolean {
  if (!isLoopbackAddress(request.socket.remoteAddress)) {
    writeJsonRpcError(response, 403, -32600, 'Forbidden', null);
    return false;
  }

  const host = singleHeader(request, 'host');
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (!host || !allowedHosts.has(host)) {
    writeJsonRpcError(response, 403, -32600, 'Forbidden', null);
    return false;
  }

  const origin = singleHeader(request, 'origin');
  if (origin !== undefined) {
    const allowedOrigins = new Set(
      [...allowedHosts].map((allowedHost) => `http://${allowedHost}`),
    );
    if (!allowedOrigins.has(origin)) {
      writeJsonRpcError(response, 403, -32600, 'Forbidden', null);
      return false;
    }
  }
  return true;
}

async function handleModernRequest(
  request: IncomingMessage,
  response: ServerResponse,
  body: JsonObject,
  toolDispatcher: ToolDispatcher,
): Promise<void> {
  const id = requestId(body);
  if (body['jsonrpc'] !== '2.0' || id === null) {
    writeJsonRpcError(response, 400, -32600, 'Invalid Request', id);
    return;
  }

  const method = body['method'];
  const params = asObject(body['params']);
  const meta = asObject(params?.['_meta']);
  if (typeof method !== 'string' || !params || !meta) {
    writeJsonRpcError(response, 400, -32602, 'Invalid params', id);
    return;
  }

  const protocolVersion = meta[PROTOCOL_VERSION_META];
  if (typeof protocolVersion !== 'string') {
    writeJsonRpcError(response, 400, -32602, 'Invalid params', id);
    return;
  }
  if (protocolVersion !== MODERN_PROTOCOL_VERSION) {
    writeJsonRpcError(
      response,
      400,
      -32022,
      'Unsupported protocol version',
      id,
      { supportedVersions: [MODERN_PROTOCOL_VERSION] },
    );
    return;
  }
  if (!asObject(meta[CLIENT_CAPABILITIES_META])) {
    writeJsonRpcError(response, 400, -32602, 'Invalid params', id);
    return;
  }
  const clientInfo = meta[CLIENT_INFO_META];
  if (clientInfo !== undefined && !isImplementation(clientInfo)) {
    writeJsonRpcError(response, 400, -32602, 'Invalid params', id);
    return;
  }

  const contentType = singleHeader(request, 'content-type');
  const accept = singleHeader(request, 'accept');
  if (!contentType?.toLowerCase().startsWith('application/json')) {
    writeJsonRpcError(response, 400, -32600, 'Invalid Content-Type', id);
    return;
  }
  const acceptedTypes = new Set(
    (accept ?? '')
      .toLowerCase()
      .split(',')
      .map((value) => value.split(';', 1)[0]?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  if (
    !acceptedTypes.has('application/json') ||
    !acceptedTypes.has('text/event-stream')
  ) {
    writeJsonRpcError(response, 400, -32600, 'Invalid Accept header', id);
    return;
  }

  const headerVersion = singleHeader(request, 'mcp-protocol-version');
  const headerMethod = singleHeader(request, 'mcp-method');
  if (headerVersion !== protocolVersion || headerMethod !== method) {
    writeJsonRpcError(response, 400, -32020, 'Header mismatch', id);
    return;
  }

  if (method === 'server/discover') {
    writeJsonRpcResult(response, id, {
      resultType: 'complete',
      supportedVersions: [MODERN_PROTOCOL_VERSION],
      capabilities: { tools: {} },
      _meta: { [SERVER_INFO_META]: serverInfo },
      instructions:
        'Provides personal vault and organization administration tools.',
      ttlMs: 3_600_000,
      cacheScope: 'private',
    });
    return;
  }

  if (method === 'tools/list') {
    writeJsonRpcResult(response, id, {
      resultType: 'complete',
      tools: allTools,
      _meta: { [SERVER_INFO_META]: serverInfo },
      ttlMs: 300_000,
      cacheScope: 'private',
    });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params['name'];
    const toolArgs = params['arguments'] ?? {};
    if (typeof toolName !== 'string' || !asObject(toolArgs)) {
      writeJsonRpcError(response, 400, -32602, 'Invalid params', id);
      return;
    }
    let headerName: string;
    try {
      headerName = decodeMcpHeader(singleHeader(request, 'mcp-name'));
    } catch {
      writeJsonRpcError(response, 400, -32020, 'Header mismatch', id);
      return;
    }
    if (headerName !== toolName) {
      writeJsonRpcError(response, 400, -32020, 'Header mismatch', id);
      return;
    }

    const result = await toolDispatcher(toolName, toolArgs);
    writeJsonRpcResult(response, id, {
      resultType: 'complete',
      ...result,
      _meta: { [SERVER_INFO_META]: serverInfo },
    });
    return;
  }

  writeJsonRpcError(response, 404, -32601, 'Method not found', id);
}

function hasModernSignal(request: IncomingMessage, body: JsonObject): boolean {
  if (body['method'] === 'server/discover') return true;
  if (singleHeader(request, 'mcp-method') !== undefined) return true;

  const params = asObject(body['params']);
  const meta = asObject(params?.['_meta']);
  return Boolean(
    meta &&
    (PROTOCOL_VERSION_META in meta ||
      CLIENT_CAPABILITIES_META in meta ||
      CLIENT_INFO_META in meta),
  );
}

function decodeMcpHeader(value: string | undefined): string {
  if (value === undefined) throw new Error('missing header');
  if (/^[\x20-\x7e]+$/.test(value) && !value.startsWith('=?base64?')) {
    return value;
  }

  const match = /^=\?base64\?([A-Za-z0-9+/]*={0,2})\?=$/.exec(value);
  if (!match?.[1]) throw new Error('invalid encoded header');
  const decoded = Buffer.from(match[1], 'base64');
  if (decoded.toString('base64') !== match[1]) {
    throw new Error('invalid encoded header');
  }
  return decoded.toString('utf8');
}

function singleHeader(
  request: IncomingMessage,
  name: string,
): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? undefined : value;
}

function asObject(value: unknown): JsonObject | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonObject;
}

function isImplementation(value: unknown): boolean {
  const implementation = asObject(value);
  return Boolean(
    implementation &&
    typeof implementation['name'] === 'string' &&
    typeof implementation['version'] === 'string',
  );
}

function requestId(body: JsonObject | undefined): JsonRpcId {
  const id = body?.['id'];
  return typeof id === 'string' || typeof id === 'number' ? id : null;
}

async function readJsonBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<JsonObject> {
  const contentLength = singleHeader(request, 'content-length');
  if (contentLength !== undefined) {
    const declaredLength = Number(contentLength);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      request.resume();
      throw new RequestBodyError(413, -32600, 'Request body too large');
    }
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      request.resume();
      throw new RequestBodyError(413, -32600, 'Request body too large');
    }
    chunks.push(buffer);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestBodyError(400, -32700, 'Parse error');
  }
  const body = asObject(parsed);
  if (!body) {
    throw new RequestBodyError(400, -32600, 'Invalid Request');
  }
  return body;
}

function writeJsonRpcResult(
  response: ServerResponse,
  id: Exclude<JsonRpcId, null>,
  result: JsonObject,
): void {
  writeJson(response, 200, { jsonrpc: '2.0', id, result });
}

function writeJsonRpcError(
  response: ServerResponse,
  status: number,
  code: number,
  message: string,
  id: JsonRpcId,
  data?: JsonObject,
): void {
  const error: JsonObject = { code, message };
  if (data) error['data'] = data;
  writeJson(response, status, { jsonrpc: '2.0', id, error });
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: JsonObject,
): void {
  if (response.headersSent) return;
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

function closeNodeServer(server: NodeHttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
