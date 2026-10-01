import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  request as nodeHttpRequest,
  type IncomingHttpHeaders,
  type OutgoingHttpHeaders,
} from 'node:http';
import {
  DEFAULT_HTTP_LIMITS,
  MODERN_PROTOCOL_VERSION,
  parseHttpCliOptions,
  startHttpServer,
  type HttpService,
} from '../src/http.js';

type JsonObject = Record<string, unknown>;

interface TestResponse {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly json: JsonObject | undefined;
}

const services: HttpService[] = [];

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.close()));
});

async function start(
  options: Parameters<typeof startHttpServer>[0] = {
    host: '127.0.0.1',
    port: 0,
  },
): Promise<HttpService> {
  const service = await startHttpServer(options);
  services.push(service);
  return service;
}

function send(
  service: HttpService,
  method: string,
  body?: JsonObject,
  headers: OutgoingHttpHeaders = {},
): Promise<TestResponse> {
  const encodedBody = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = nodeHttpRequest(
      {
        hostname: service.host,
        port: service.port,
        path: '/mcp',
        method,
        headers: {
          Accept: 'application/json, text/event-stream',
          ...(encodedBody === undefined
            ? {}
            : {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(encodedBody),
              }),
          ...headers,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.once('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            json: text ? (JSON.parse(text) as JsonObject) : undefined,
          });
        });
      },
    );
    request.once('error', reject);
    if (encodedBody !== undefined) request.end(encodedBody);
    else request.end();
  });
}

function modernRequest(
  method: string,
  id: number,
  params: JsonObject = {},
): JsonObject {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params: {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientCapabilities': {},
        'io.modelcontextprotocol/clientInfo': {
          name: 'http-test-client',
          version: '1.0.0',
        },
      },
    },
  };
}

function modernHeaders(method: string): OutgoingHttpHeaders {
  return {
    'MCP-Protocol-Version': MODERN_PROTOCOL_VERSION,
    'Mcp-Method': method,
  };
}

function resultOf(response: TestResponse): JsonObject {
  return response.json?.['result'] as JsonObject;
}

describe('HTTP CLI options', () => {
  it('keeps the audited resource limits stable', () => {
    expect(DEFAULT_HTTP_LIMITS).toEqual({
      maxBodyBytes: 1024 * 1024,
      maxLegacySessions: 32,
      maxPendingPerSession: 8,
      legacyIdleTtlMs: 30 * 60 * 1000,
    });
  });

  it('keeps stdio as the zero-argument default', () => {
    expect(parseHttpCliOptions([])).toBeUndefined();
  });

  it('accepts only an explicit loopback host and valid port', () => {
    expect(
      parseHttpCliOptions(['--http-host', '127.0.0.1', '--http-port', '13420']),
    ).toEqual({ host: '127.0.0.1', port: 13420 });
    expect(() =>
      parseHttpCliOptions(['--http-host', '0.0.0.0', '--http-port', '13420']),
    ).toThrow('127.0.0.1');
    expect(() => parseHttpCliOptions(['--http-port', '0'])).toThrow();
  });
});

describe('modern 2026-07-28 HTTP transport', () => {
  it('discovers the server without creating a protocol session', async () => {
    const service = await start();
    const response = await send(
      service,
      'POST',
      modernRequest('server/discover', 1),
      {
        ...modernHeaders('server/discover'),
        'Mcp-Session-Id': 'ignored-modern-session',
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers['mcp-session-id']).toBeUndefined();
    expect(resultOf(response)).toMatchObject({
      resultType: 'complete',
      supportedVersions: [MODERN_PROTOCOL_VERSION],
      cacheScope: 'private',
    });
    expect(service.legacySessionCount()).toBe(0);
  });

  it('lists all tools and dispatches a named tool', async () => {
    const dispatcher = jest.fn(async (_name: string, _args: unknown) => ({
      acknowledged: Boolean(_name) && _args !== undefined,
      content: [{ type: 'text', text: 'shared result' }],
      isError: false,
    }));
    const service = await start({
      host: '127.0.0.1',
      port: 0,
      toolDispatcher: dispatcher,
    });

    const listResponse = await send(
      service,
      'POST',
      modernRequest('tools/list', 2),
      modernHeaders('tools/list'),
    );
    expect(listResponse.status).toBe(200);
    expect(resultOf(listResponse)['resultType']).toBe('complete');
    expect(resultOf(listResponse)['tools']).toHaveLength(59);

    const callResponse = await send(
      service,
      'POST',
      modernRequest('tools/call', 3, {
        name: 'status',
        arguments: { ignored: true },
      }),
      { ...modernHeaders('tools/call'), 'Mcp-Name': 'status' },
    );
    expect(callResponse.status).toBe(200);
    expect(resultOf(callResponse)).toMatchObject({
      resultType: 'complete',
      content: [{ type: 'text', text: 'shared result' }],
    });
    expect(dispatcher).toHaveBeenCalledWith('status', { ignored: true });
  });

  it('rejects cross-origin requests and header/body mismatches', async () => {
    const service = await start();
    const forbidden = await send(
      service,
      'POST',
      modernRequest('server/discover', 4),
      {
        ...modernHeaders('server/discover'),
        Origin: 'https://attacker.example',
      },
    );
    expect(forbidden.status).toBe(403);

    const mismatch = await send(
      service,
      'POST',
      modernRequest('tools/list', 5),
      modernHeaders('server/discover'),
    );
    expect(mismatch.status).toBe(400);
    expect((mismatch.json?.['error'] as JsonObject)['code']).toBe(-32020);
  });

  it('rejects unsupported protocol versions with supported versions', async () => {
    const service = await start();
    const body = modernRequest('server/discover', 6);
    const params = body['params'] as JsonObject;
    const meta = params['_meta'] as JsonObject;
    meta['io.modelcontextprotocol/protocolVersion'] = '2099-01-01';

    const response = await send(service, 'POST', body, {
      'MCP-Protocol-Version': '2099-01-01',
      'Mcp-Method': 'server/discover',
    });
    expect(response.status).toBe(400);
    const error = response.json?.['error'] as JsonObject;
    expect(error['code']).toBe(-32022);
    expect(error['data']).toEqual({
      supportedVersions: [MODERN_PROTOCOL_VERSION],
    });
  });
});

describe('legacy Streamable HTTP compatibility', () => {
  function initializeRequest(id: number): JsonObject {
    return {
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: `legacy-${id}`, version: '1.0.0' },
      },
    };
  }

  it('keeps two client sessions isolated and closes both explicitly', async () => {
    const service = await start();
    const [first, second] = await Promise.all([
      send(service, 'POST', initializeRequest(10)),
      send(service, 'POST', initializeRequest(11)),
    ]);
    const firstSession = first.headers['mcp-session-id'];
    const secondSession = second.headers['mcp-session-id'];
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(typeof firstSession).toBe('string');
    expect(typeof secondSession).toBe('string');
    expect(firstSession).not.toBe(secondSession);
    expect(service.legacySessionCount()).toBe(2);

    const sessionHeaders = (session: string): OutgoingHttpHeaders => ({
      'Mcp-Session-Id': session,
      'MCP-Protocol-Version': '2025-11-25',
    });
    const initialized = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };
    await Promise.all([
      send(service, 'POST', initialized, sessionHeaders(String(firstSession))),
      send(service, 'POST', initialized, sessionHeaders(String(secondSession))),
    ]);

    const [firstList, secondList] = await Promise.all([
      send(
        service,
        'POST',
        { jsonrpc: '2.0', id: 12, method: 'tools/list', params: {} },
        sessionHeaders(String(firstSession)),
      ),
      send(
        service,
        'POST',
        { jsonrpc: '2.0', id: 13, method: 'tools/list', params: {} },
        sessionHeaders(String(secondSession)),
      ),
    ]);
    expect(firstList.status).toBe(200);
    expect(secondList.status).toBe(200);
    expect(resultOf(firstList)['tools'] as unknown[]).toHaveLength(59);
    expect(resultOf(secondList)['tools'] as unknown[]).toHaveLength(59);

    await Promise.all([
      send(service, 'DELETE', undefined, sessionHeaders(String(firstSession))),
      send(service, 'DELETE', undefined, sessionHeaders(String(secondSession))),
    ]);
    expect(service.legacySessionCount()).toBe(0);
  });

  it('enforces the bounded legacy session cap', async () => {
    const service = await start({
      host: '127.0.0.1',
      port: 0,
      limits: { maxLegacySessions: 1 },
    });
    const first = await send(service, 'POST', initializeRequest(20));
    expect(first.status).toBe(200);

    const second = await send(service, 'POST', initializeRequest(21));
    expect(second.status).toBe(429);
    expect((second.json?.['error'] as JsonObject)['message']).toBe(
      'Legacy session limit reached',
    );
  });
});
