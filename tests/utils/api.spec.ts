import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Store original environment variables
const originalEnv = { ...process.env };

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('API Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Set up required environment variables
    process.env['BW_CLIENT_ID'] = 'organization.test-client-id';
    process.env['BW_CLIENT_SECRET'] = 'test-client-secret';
    process.env['BW_API_BASE_URL'] = 'https://api.bitwarden.test';
    process.env['BW_IDENTITY_URL'] = 'https://identity.bitwarden.test';
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('getAccessToken', () => {
    it('should obtain a new access token', async () => {
      // Need to import fresh for each test to reset token cache
      const { getAccessToken } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token-123',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      const token = await getAccessToken();

      expect(token).toBe('test-token-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://identity.bitwarden.test/connect/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      // Verify body contains correct parameters
      const call = mockFetch.mock.calls[0];
      expect(call).toBeDefined();
      const body = call![1]?.body as URLSearchParams;
      expect(body.get('grant_type')).toBe('client_credentials');
      expect(body.get('scope')).toBe('api.organization');
      expect(body.get('client_id')).toBe('organization.test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
    });

    it('should return cached token on subsequent calls', async () => {
      jest.resetModules();
      const { getAccessToken } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'cached-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      // First call - should fetch token
      const token1 = await getAccessToken();
      expect(token1).toBe('cached-token');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cached token
      const token2 = await getAccessToken();
      expect(token2).toBe('cached-token');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should throw error when credentials are missing', async () => {
      delete process.env['BW_CLIENT_ID'];
      delete process.env['BW_CLIENT_SECRET'];

      jest.resetModules();
      const { getAccessToken } = await import('../../src/utils/api.js');

      await expect(getAccessToken()).rejects.toThrow(
        'BW_CLIENT_ID and BW_CLIENT_SECRET environment variables are required',
      );
    });

    it('should throw error on failed token request', async () => {
      jest.resetModules();
      const { getAccessToken } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(getAccessToken()).rejects.toThrow(
        'OAuth2 token request failed: 401 Unauthorized',
      );
    });

    it('should throw error on network failure', async () => {
      jest.resetModules();
      const { getAccessToken } = await import('../../src/utils/api.js');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getAccessToken()).rejects.toThrow(
        'Failed to obtain access token: Network error',
      );
    });
  });

  describe('buildSafeApiRequest', () => {
    it('should build request with authorization header', async () => {
      jest.resetModules();
      const { buildSafeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'auth-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      const request = await buildSafeApiRequest('/public/collections', 'GET');

      expect(request).toEqual({
        method: 'GET',
        headers: {
          Authorization: 'Bearer auth-token',
          'Content-Type': 'application/json',
          'User-Agent': 'Bitwarden-MCP-Server/2026.1.0',
        },
      });
    });

    it('should include body for POST requests', async () => {
      jest.resetModules();
      const { buildSafeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      const request = await buildSafeApiRequest('/public/groups', 'POST', {
        name: 'Test Group',
      });

      expect(request.method).toBe('POST');
      expect(request.body).toBe(JSON.stringify({ name: 'Test Group' }));
    });

    it('should include body for PUT requests', async () => {
      jest.resetModules();
      const { buildSafeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      const request = await buildSafeApiRequest(
        '/public/collections/12345678-1234-1234-1234-123456789012',
        'PUT',
        { externalId: 'ext-123' },
      );

      expect(request.method).toBe('PUT');
      expect(request.body).toBe(JSON.stringify({ externalId: 'ext-123' }));
    });

    it('should not include body for GET requests', async () => {
      jest.resetModules();
      const { buildSafeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      const request = await buildSafeApiRequest('/public/members', 'GET', {
        ignored: 'data',
      });

      expect(request.body).toBeUndefined();
    });

    it('should reject invalid endpoint', async () => {
      jest.resetModules();
      const { buildSafeApiRequest } = await import('../../src/utils/api.js');

      await expect(
        buildSafeApiRequest('/invalid/endpoint', 'GET'),
      ).rejects.toThrow('Invalid API endpoint');
    });

    it('should reject invalid HTTP method', async () => {
      jest.resetModules();
      const { buildSafeApiRequest } = await import('../../src/utils/api.js');

      await expect(
        buildSafeApiRequest('/public/collections', 'PATCH'),
      ).rejects.toThrow('Invalid HTTP method');
    });

    it('should sanitize API parameters', async () => {
      jest.resetModules();
      const { buildSafeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      const request = await buildSafeApiRequest('/public/groups', 'POST', {
        name: 'Test<script>alert("xss")</script>',
      });

      // Verify body is sanitized
      expect(request.body).toBe(
        JSON.stringify({ name: 'Testscriptalert(xss)/script' }),
      );
    });

    it('should convert method to uppercase', async () => {
      jest.resetModules();
      const { buildSafeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      const request = await buildSafeApiRequest('/public/collections', 'get');

      expect(request.method).toBe('GET');
    });
  });

  describe('executeApiRequest', () => {
    it('should execute GET request and return data', async () => {
      jest.resetModules();
      const { executeApiRequest } = await import('../../src/utils/api.js');

      // Mock token request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      // Mock API request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [{ id: '1' }, { id: '2' }] }),
      } as Response);

      const result = await executeApiRequest('/public/collections', 'GET');

      expect(result).toEqual({
        status: 200,
        data: { data: [{ id: '1' }, { id: '2' }] },
      });
    });

    it('should execute POST request with data', async () => {
      jest.resetModules();
      const { executeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 'new-group-id', name: 'Engineering' }),
      } as Response);

      const result = await executeApiRequest('/public/groups', 'POST', {
        name: 'Engineering',
      });

      expect(result).toEqual({
        status: 201,
        data: { id: 'new-group-id', name: 'Engineering' },
      });
    });

    it('should handle API error response', async () => {
      jest.resetModules();
      const { executeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Collection not found' }),
      } as Response);

      const result = await executeApiRequest(
        '/public/collections/12345678-1234-1234-1234-123456789012',
        'GET',
      );

      expect(result).toEqual({
        status: 404,
        errorMessage: 'API request failed: 404 Not Found',
        data: { message: 'Collection not found' },
      });
    });

    it('should handle non-JSON response', async () => {
      jest.resetModules();
      const { executeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'No Content',
      } as Response);

      const result = await executeApiRequest(
        '/public/collections/12345678-1234-1234-1234-123456789012',
        'DELETE',
      );

      expect(result).toEqual({
        status: 204,
        data: 'No Content',
      });
    });

    it('should handle network error', async () => {
      jest.resetModules();
      const { executeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await executeApiRequest('/public/collections', 'GET');

      expect(result).toEqual({
        status: 500,
        errorMessage: 'API request error: Network timeout',
      });
    });

    it('should handle JSON parse error gracefully', async () => {
      jest.resetModules();
      const { executeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      const result = await executeApiRequest('/public/collections', 'GET');

      expect(result.status).toBe(200);
      expect(result.data).toContain('Failed to parse JSON response');
    });

    it('should use correct API base URL', async () => {
      jest.resetModules();
      const { executeApiRequest } = await import('../../src/utils/api.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      } as Response);

      await executeApiRequest('/public/members', 'GET');

      // Second call should be the API request
      const apiCall = mockFetch.mock.calls[1];
      expect(apiCall).toBeDefined();
      expect(apiCall![0]).toBe('https://api.bitwarden.test/public/members');
    });

    it('should handle invalid endpoint error', async () => {
      jest.resetModules();
      const { executeApiRequest } = await import('../../src/utils/api.js');

      const result = await executeApiRequest('/invalid/endpoint', 'GET');

      expect(result).toEqual({
        status: 500,
        errorMessage:
          'API request error: Invalid API endpoint: /invalid/endpoint',
      });
    });
  });
});
