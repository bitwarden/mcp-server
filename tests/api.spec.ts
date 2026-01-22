import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { z } from 'zod';
import { validateInput } from '../src/utils/validation.js';
import {
  validateApiEndpoint,
  sanitizeApiParameters,
} from '../src/utils/security.js';

// Store original environment variables
const originalEnv = { ...process.env };

// Mock fetch globally for handler tests
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('API Security Functions', () => {
  describe('validateApiEndpoint', () => {
    it('should allow valid collection endpoints', () => {
      expect(validateApiEndpoint('/public/collections')).toBe(true);
      expect(
        validateApiEndpoint(
          '/public/collections/a1b2c3d4-5678-9abc-def0-123456789abc',
        ),
      ).toBe(true);
    });

    it('should allow valid member endpoints', () => {
      expect(validateApiEndpoint('/public/members')).toBe(true);
      expect(
        validateApiEndpoint(
          '/public/members/a1b2c3d4-5678-9abc-def0-123456789abc',
        ),
      ).toBe(true);
      expect(
        validateApiEndpoint(
          '/public/members/a1b2c3d4-5678-9abc-def0-123456789abc/group-ids',
        ),
      ).toBe(true);
      expect(
        validateApiEndpoint(
          '/public/members/a1b2c3d4-5678-9abc-def0-123456789abc/reinvite',
        ),
      ).toBe(true);
    });

    it('should allow valid group endpoints', () => {
      expect(validateApiEndpoint('/public/groups')).toBe(true);
      expect(
        validateApiEndpoint(
          '/public/groups/a1b2c3d4-5678-9abc-def0-123456789abc',
        ),
      ).toBe(true);
      expect(
        validateApiEndpoint(
          '/public/groups/a1b2c3d4-5678-9abc-def0-123456789abc/member-ids',
        ),
      ).toBe(true);
    });

    it('should allow valid policy endpoints', () => {
      expect(validateApiEndpoint('/public/policies')).toBe(true);
      expect(validateApiEndpoint('/public/policies/0')).toBe(true); // TwoFactorAuthentication
      expect(validateApiEndpoint('/public/policies/1')).toBe(true); // MasterPassword
      expect(validateApiEndpoint('/public/policies/15')).toBe(true); // RestrictedItemTypesPolicy
    });

    it('should allow valid event endpoints', () => {
      expect(validateApiEndpoint('/public/events')).toBe(true);
      expect(
        validateApiEndpoint('/public/events?start=2023-01-01&end=2023-12-31'),
      ).toBe(true);
      expect(validateApiEndpoint('/public/events?actingUserId=123')).toBe(true);
    });

    it('should allow valid organization endpoints', () => {
      expect(validateApiEndpoint('/public/organization/subscription')).toBe(
        true,
      );
      expect(validateApiEndpoint('/public/organization/import')).toBe(true);
    });

    it('should reject invalid endpoints', () => {
      expect(validateApiEndpoint('/admin/users')).toBe(false);
      expect(validateApiEndpoint('/public/../admin')).toBe(false);
      expect(validateApiEndpoint('/public/collections/<script>')).toBe(false);
      expect(validateApiEndpoint('../../../../etc/passwd')).toBe(false);
      expect(validateApiEndpoint('/public/collections/invalid-uuid')).toBe(
        false,
      );
    });

    it('should reject non-string inputs', () => {
      expect(validateApiEndpoint(123 as unknown as string)).toBe(false);
      expect(validateApiEndpoint(null as unknown as string)).toBe(false);
      expect(validateApiEndpoint(undefined as unknown as string)).toBe(false);
    });
  });

  describe('sanitizeApiParameters', () => {
    it('should sanitize string parameters', () => {
      const input = 'test<script>alert("xss")</script>';
      const result = sanitizeApiParameters(input);
      expect(result).toBe('testscriptalert(xss)/script');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeApiParameters(null)).toBe(null);
      expect(sanitizeApiParameters(undefined)).toBe(undefined);
    });

    it('should sanitize object parameters', () => {
      const input = {
        'name<script>': 'value"with"quotes',
        nested: {
          field: 'test&value',
        },
      };
      const result = sanitizeApiParameters(input) as Record<string, unknown>;
      expect(result['namescript']).toBe('valuewithquotes');
      expect((result['nested'] as Record<string, unknown>)['field']).toBe(
        'testvalue',
      );
    });

    it('should sanitize array parameters', () => {
      const input = ['test<tag>', 'value"quotes"', 'normal'];
      const result = sanitizeApiParameters(input) as string[];
      expect(result[0]).toBe('testtag');
      expect(result[1]).toBe('valuequotes');
      expect(result[2]).toBe('normal');
    });

    it('should preserve non-string values', () => {
      expect(sanitizeApiParameters(123)).toBe(123);
      expect(sanitizeApiParameters(true)).toBe(true);
      expect(sanitizeApiParameters(false)).toBe(false);
    });
  });
});

describe('API Schema Validation', () => {
  describe('Collections schemas', () => {
    it('should validate create collection schema', () => {
      const createCollectionSchema = z.object({
        name: z.string().min(1, 'Collection name is required'),
        externalId: z.string().optional(),
        groups: z
          .array(
            z.object({
              id: z.string().min(1, 'Group ID is required'),
              readOnly: z.boolean().optional(),
              hidePasswords: z.boolean().optional(),
              manage: z.boolean().optional(),
            }),
          )
          .optional(),
      });

      const validInput = {
        name: 'Test Collection',
        groups: [{ id: 'group-123', readOnly: true }],
      };

      const [isValid, result] = validateInput(
        createCollectionSchema,
        validInput,
      );
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject create collection with empty name', () => {
      const createCollectionSchema = z.object({
        name: z.string().min(1, 'Collection name is required'),
      });

      const invalidInput = { name: '' };
      const [isValid, result] = validateInput(
        createCollectionSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Collection name is required');
      }
    });

    it('should validate update collection schema', () => {
      const updateCollectionSchema = z.object({
        id: z.string().min(1, 'Collection ID is required'),
        name: z.string().min(1, 'Collection name is required'),
        externalId: z.string().optional(),
      });

      const validInput = {
        id: 'collection-123',
        name: 'Updated Collection',
        externalId: 'ext-123',
      };

      const [isValid, result] = validateInput(
        updateCollectionSchema,
        validInput,
      );
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });
  });

  describe('Members schemas', () => {
    it('should validate invite member schema', () => {
      const inviteMemberSchema = z.object({
        email: z.string().email('Valid email address is required'),
        type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]),
        accessSecretsManager: z.boolean().optional(),
        collections: z
          .array(
            z.object({
              id: z.string().min(1, 'Collection ID is required'),
              readOnly: z.boolean().optional(),
              hidePasswords: z.boolean().optional(),
              manage: z.boolean().optional(),
            }),
          )
          .optional(),
      });

      const validInput = {
        email: 'test@example.com',
        type: 2 as const,
        collections: [{ id: 'collection-123', readOnly: false }],
      };

      const [isValid, result] = validateInput(inviteMemberSchema, validInput);
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject invite member with invalid email', () => {
      const inviteMemberSchema = z.object({
        email: z.string().email('Valid email address is required'),
        type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]),
      });

      const invalidInput = { email: 'invalid-email', type: 2 };
      const [isValid, result] = validateInput(inviteMemberSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Valid email address is required',
        );
      }
    });

    it('should reject invite member with invalid type', () => {
      const inviteMemberSchema = z.object({
        email: z.string().email('Valid email address is required'),
        type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]),
      });

      const invalidInput = { email: 'test@example.com', type: 99 };
      const [isValid, result] = validateInput(inviteMemberSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });
  });

  describe('Events schemas', () => {
    it('should validate list events schema', () => {
      const listEventsSchema = z.object({
        start: z.string().optional(),
        end: z.string().optional(),
        continuationToken: z.string().optional(),
      });

      const validInput = {
        start: '2023-01-01T00:00:00Z',
        end: '2023-12-31T23:59:59Z',
        continuationToken: 'token123',
      };

      const [isValid, result] = validateInput(listEventsSchema, validInput);
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate empty events schema', () => {
      const listEventsSchema = z.object({
        start: z.string().optional(),
        end: z.string().optional(),
        continuationToken: z.string().optional(),
      });

      const validInput = {};
      const [isValid, result] = validateInput(listEventsSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });
  });

  describe('Groups schemas', () => {
    it('should validate create group schema', () => {
      const createGroupSchema = z.object({
        name: z.string().min(1, 'Group name is required'),
        externalId: z.string().optional(),
        collections: z
          .array(
            z.object({
              id: z.string().min(1, 'Collection ID is required'),
              readOnly: z.boolean().optional(),
              hidePasswords: z.boolean().optional(),
              manage: z.boolean().optional(),
            }),
          )
          .optional(),
      });

      const validInput = {
        name: 'Test Group',
        externalId: 'ext-123',
        collections: [{ id: 'collection-456', readOnly: false }],
      };

      const [isValid, result] = validateInput(createGroupSchema, validInput);
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate update group member ids schema', () => {
      const updateGroupMemberIdsSchema = z.object({
        id: z.string().min(1, 'Group ID is required'),
        memberIds: z.array(z.string().uuid('Member ID must be a valid UUID')),
      });

      const validInput = {
        id: 'group-123',
        memberIds: [
          '550e8400-e29b-41d4-a716-446655440000',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        ],
      };

      const [isValid, result] = validateInput(
        updateGroupMemberIdsSchema,
        validInput,
      );
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject update group member ids with invalid UUID', () => {
      const updateGroupMemberIdsSchema = z.object({
        id: z.string().min(1, 'Group ID is required'),
        memberIds: z.array(z.string().uuid('Member ID must be a valid UUID')),
      });

      const invalidInput = {
        id: 'group-123',
        memberIds: ['invalid-uuid'],
      };

      const [isValid, result] = validateInput(
        updateGroupMemberIdsSchema,
        invalidInput,
      );
      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Member ID must be a valid UUID',
        );
      }
    });
  });

  describe('Policies schemas', () => {
    it('should validate update policy schema', () => {
      const updatePolicySchema = z.object({
        type: z.number().int().min(0, 'Policy type is required'),
        enabled: z.boolean(),
        data: z.record(z.string(), z.any()).optional(),
      });

      const validInput = {
        type: 1,
        enabled: true,
        data: { minComplexity: 8, requireUpper: true },
      };

      const [isValid, result] = validateInput(updatePolicySchema, validInput);
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate get policy schema', () => {
      const getPolicySchema = z.object({
        type: z.number().int().min(0, 'Policy type is required'),
      });

      const validInput = { type: 0 };

      const [isValid, result] = validateInput(getPolicySchema, validInput);
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });
  });

  describe('Organization schemas', () => {
    it('should validate update organization subscription schema', () => {
      const updateOrganizationSubscriptionSchema = z.object({
        passwordManager: z
          .object({
            seats: z.number().int().min(0).optional(),
            maxAutoscaleSeats: z.number().int().min(0).optional(),
          })
          .optional(),
        secretsManager: z
          .object({
            seats: z.number().int().min(0).optional(),
            serviceAccounts: z.number().int().min(0).optional(),
            maxAutoscaleSeats: z.number().int().min(0).optional(),
            maxAutoscaleServiceAccounts: z.number().int().min(0).optional(),
          })
          .optional(),
      });

      const validInput = {
        passwordManager: {
          seats: 10,
          maxAutoscaleSeats: 20,
        },
        secretsManager: {
          seats: 5,
          serviceAccounts: 15,
        },
      };

      const [isValid, result] = validateInput(
        updateOrganizationSubscriptionSchema,
        validInput,
      );
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate import organization schema', () => {
      const importOrganizationSchema = z.object({
        groups: z
          .array(
            z.object({
              externalId: z.string(),
              name: z.string().min(1, 'Group name is required'),
            }),
          )
          .optional(),
        members: z
          .array(
            z.object({
              externalId: z.string().optional(),
              email: z.string().email('Valid email address is required'),
              deleted: z.boolean().optional(),
            }),
          )
          .optional(),
        overwriteExisting: z.boolean().optional(),
      });

      const validInput = {
        groups: [
          { externalId: 'ext-group-1', name: 'Admin Group' },
          { externalId: 'ext-group-2', name: 'User Group' },
        ],
        members: [
          { externalId: 'ext-user-1', email: 'admin@example.com' },
          { email: 'user@example.com', deleted: false },
        ],
        overwriteExisting: true,
      };

      const [isValid, result] = validateInput(
        importOrganizationSchema,
        validInput,
      );
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });
  });
});

describe('API Handlers', () => {
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

  // Helper to mock token and API responses
  function mockTokenAndApiResponse(apiResponse: object, status = 200) {
    // First call is token request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'test-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    } as Response);

    // Second call is API request
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => apiResponse,
    } as Response);
  }

  describe('toMcpFormat (via handlers)', () => {
    it('should format successful response with data', async () => {
      const { handleListOrgCollections } = await import(
        '../src/handlers/api.js'
      );

      mockTokenAndApiResponse({ data: [{ id: '123', name: 'Test' }] });

      const result = await handleListOrgCollections({});

      expect(result.isError).toBe(false);
      expect(result.content[0]!.text).toContain('123');
      expect(result.content[0]!.text).toContain('Test');
    });

    it('should format error response', async () => {
      const { handleListOrgCollections } = await import(
        '../src/handlers/api.js'
      );

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      // Mock failed API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Not found' }),
      } as Response);

      const result = await handleListOrgCollections({});

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('404');
    });
  });

  describe('Collections Handlers', () => {
    describe('handleListOrgCollections', () => {
      it('should call correct endpoint', async () => {
        const { handleListOrgCollections } = await import(
          '../src/handlers/api.js'
        );

        mockTokenAndApiResponse({ data: [] });

        await handleListOrgCollections({});

        // Second call should be the API request
        expect(mockFetch.mock.calls[1]![0]).toBe(
          'https://api.bitwarden.test/public/collections',
        );
      });
    });

    describe('handleGetOrgCollection', () => {
      it('should call correct endpoint with collectionId', async () => {
        const { handleGetOrgCollection } = await import(
          '../src/handlers/api.js'
        );

        mockTokenAndApiResponse({ id: '12345678-1234-1234-1234-123456789012' });

        await handleGetOrgCollection({
          collectionId: '12345678-1234-1234-1234-123456789012',
        });

        expect(mockFetch.mock.calls[1]![0]).toBe(
          'https://api.bitwarden.test/public/collections/12345678-1234-1234-1234-123456789012',
        );
      });

      it('should return error for invalid UUID format', async () => {
        const { handleGetOrgCollection } = await import(
          '../src/handlers/api.js'
        );

        const result = await handleGetOrgCollection({
          collectionId: 'invalid',
        });

        expect(result.isError).toBe(true);
        // The endpoint validation rejects invalid UUIDs because the pattern requires UUID format
        expect(result.content[0]!.text).toContain('Invalid API endpoint');
      });
    });

    describe('handleUpdateOrgCollection', () => {
      it('should call correct endpoint with PUT method', async () => {
        const { handleUpdateOrgCollection } = await import(
          '../src/handlers/api.js'
        );

        mockTokenAndApiResponse({ id: '12345678-1234-1234-1234-123456789012' });

        await handleUpdateOrgCollection({
          collectionId: '12345678-1234-1234-1234-123456789012',
          externalId: 'ext-123',
          groups: [],
        });

        const apiCall = mockFetch.mock.calls[1];
        expect(apiCall![0]).toBe(
          'https://api.bitwarden.test/public/collections/12345678-1234-1234-1234-123456789012',
        );
        expect((apiCall![1] as RequestInit).method).toBe('PUT');
      });
    });

    describe('handleDeleteOrgCollection', () => {
      it('should call correct endpoint with DELETE method', async () => {
        const { handleDeleteOrgCollection } = await import(
          '../src/handlers/api.js'
        );

        // Mock token
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
        } as Response);

        // Mock DELETE response (no content)
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: async () => '',
        } as Response);

        await handleDeleteOrgCollection({
          collectionId: '12345678-1234-1234-1234-123456789012',
        });

        const apiCall = mockFetch.mock.calls[1];
        expect(apiCall![0]).toBe(
          'https://api.bitwarden.test/public/collections/12345678-1234-1234-1234-123456789012',
        );
        expect((apiCall![1] as RequestInit).method).toBe('DELETE');
      });
    });
  });

  describe('Members Handlers', () => {
    describe('handleListOrgMembers', () => {
      it('should call correct endpoint', async () => {
        const { handleListOrgMembers } = await import('../src/handlers/api.js');

        mockTokenAndApiResponse({ data: [] });

        await handleListOrgMembers({});

        expect(mockFetch.mock.calls[1]![0]).toBe(
          'https://api.bitwarden.test/public/members',
        );
      });
    });

    describe('handleGetOrgMember', () => {
      it('should call correct endpoint with memberId', async () => {
        const { handleGetOrgMember } = await import('../src/handlers/api.js');

        mockTokenAndApiResponse({ id: '12345678-1234-1234-1234-123456789012' });

        await handleGetOrgMember({
          memberId: '12345678-1234-1234-1234-123456789012',
        });

        expect(mockFetch.mock.calls[1]![0]).toBe(
          'https://api.bitwarden.test/public/members/12345678-1234-1234-1234-123456789012',
        );
      });
    });

    describe('handleInviteOrgMember', () => {
      it('should call correct endpoint with POST method', async () => {
        const { handleInviteOrgMember } = await import(
          '../src/handlers/api.js'
        );

        mockTokenAndApiResponse({ id: 'new-member-id' }, 201);

        await handleInviteOrgMember({
          email: 'test@example.com',
          type: 2,
          accessAll: false,
          collections: [],
        });

        const apiCall = mockFetch.mock.calls[1];
        expect(apiCall![0]).toBe('https://api.bitwarden.test/public/members');
        expect((apiCall![1] as RequestInit).method).toBe('POST');

        const body = JSON.parse((apiCall![1] as RequestInit).body as string);
        expect(body.email).toBe('test@example.com');
        expect(body.type).toBe(2);
      });

      it('should return validation error for invalid email', async () => {
        const { handleInviteOrgMember } = await import(
          '../src/handlers/api.js'
        );

        const result = await handleInviteOrgMember({
          email: 'invalid-email',
          type: 2,
          accessAll: false,
          collections: [],
        });

        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain('email');
      });
    });

    describe('handleRemoveOrgMember', () => {
      it('should call correct endpoint with DELETE method', async () => {
        const { handleRemoveOrgMember } = await import(
          '../src/handlers/api.js'
        );

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
        } as Response);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: async () => '',
        } as Response);

        await handleRemoveOrgMember({
          memberId: '12345678-1234-1234-1234-123456789012',
        });

        const apiCall = mockFetch.mock.calls[1];
        expect((apiCall![1] as RequestInit).method).toBe('DELETE');
      });
    });
  });

  describe('Groups Handlers', () => {
    describe('handleListOrgGroups', () => {
      it('should call correct endpoint', async () => {
        const { handleListOrgGroups } = await import('../src/handlers/api.js');

        mockTokenAndApiResponse({ data: [] });

        await handleListOrgGroups({});

        expect(mockFetch.mock.calls[1]![0]).toBe(
          'https://api.bitwarden.test/public/groups',
        );
      });
    });

    describe('handleCreateOrgGroup', () => {
      it('should call correct endpoint with POST method', async () => {
        const { handleCreateOrgGroup } = await import('../src/handlers/api.js');

        mockTokenAndApiResponse({ id: 'new-group-id' }, 201);

        await handleCreateOrgGroup({
          name: 'Engineering',
          accessAll: false,
          collections: [],
        });

        const apiCall = mockFetch.mock.calls[1];
        expect(apiCall![0]).toBe('https://api.bitwarden.test/public/groups');
        expect((apiCall![1] as RequestInit).method).toBe('POST');

        const body = JSON.parse((apiCall![1] as RequestInit).body as string);
        expect(body.name).toBe('Engineering');
      });

      it('should return validation error for empty name', async () => {
        const { handleCreateOrgGroup } = await import('../src/handlers/api.js');

        const result = await handleCreateOrgGroup({
          name: '',
          accessAll: false,
          collections: [],
        });

        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain('name');
      });
    });

    describe('handleDeleteOrgGroup', () => {
      it('should call correct endpoint with DELETE method', async () => {
        const { handleDeleteOrgGroup } = await import('../src/handlers/api.js');

        // Use a valid UUID format (version 4) - the group schema validates UUID format
        const validGroupId = '12345678-1234-4234-8234-123456789012';

        // Mock token request
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
        } as Response);

        // Mock DELETE response (no content)
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: async () => '',
        } as Response);

        const result = await handleDeleteOrgGroup({ groupId: validGroupId });

        // Verify the operation succeeded
        expect(result.isError).toBe(false);

        // Check that the API call was made to the correct endpoint
        const apiCall = mockFetch.mock.calls[1];
        expect(apiCall![0]).toBe(
          `https://api.bitwarden.test/public/groups/${validGroupId}`,
        );
        expect((apiCall![1] as RequestInit).method).toBe('DELETE');
      });
    });
  });

  describe('Policies Handlers', () => {
    describe('handleListOrgPolicies', () => {
      it('should call correct endpoint', async () => {
        const { handleListOrgPolicies } = await import(
          '../src/handlers/api.js'
        );

        mockTokenAndApiResponse({ data: [] });

        await handleListOrgPolicies({});

        expect(mockFetch.mock.calls[1]![0]).toBe(
          'https://api.bitwarden.test/public/policies',
        );
      });
    });

    describe('handleGetOrgPolicy', () => {
      it('should call correct endpoint with policyType', async () => {
        const { handleGetOrgPolicy } = await import('../src/handlers/api.js');

        mockTokenAndApiResponse({ type: 0, enabled: true });

        await handleGetOrgPolicy({ policyType: 0 });

        expect(mockFetch.mock.calls[1]![0]).toBe(
          'https://api.bitwarden.test/public/policies/0',
        );
      });
    });
  });

  describe('Events Handlers', () => {
    describe('handleGetOrgEvents', () => {
      it('should call correct endpoint with required date params', async () => {
        const { handleGetOrgEvents } = await import('../src/handlers/api.js');

        mockTokenAndApiResponse({ data: [] });

        // start and end are required parameters
        await handleGetOrgEvents({
          start: '2024-01-01',
          end: '2024-01-31',
        });

        expect(mockFetch.mock.calls[1]![0]).toContain(
          'https://api.bitwarden.test/public/events',
        );
      });

      it('should include date filters in query params', async () => {
        const { handleGetOrgEvents } = await import('../src/handlers/api.js');

        mockTokenAndApiResponse({ data: [] });

        await handleGetOrgEvents({
          start: '2024-01-01',
          end: '2024-01-31',
        });

        const url = mockFetch.mock.calls[1]![0] as string;
        expect(url).toContain('start=2024-01-01');
        expect(url).toContain('end=2024-01-31');
      });

      it('should return validation error when start date is missing', async () => {
        const { handleGetOrgEvents } = await import('../src/handlers/api.js');

        const result = await handleGetOrgEvents({ end: '2024-01-31' } as never);

        expect(result.isError).toBe(true);
        // Zod reports "expected string, received undefined" for missing required string fields
        expect(result.content[0]!.text).toContain('Validation error');
      });
    });
  });

  describe('Billing Handlers', () => {
    describe('handleGetOrgSubscription', () => {
      it('should call correct endpoint', async () => {
        const { handleGetOrgSubscription } = await import(
          '../src/handlers/api.js'
        );

        mockTokenAndApiResponse({ passwordManager: { seats: 10 } });

        await handleGetOrgSubscription({});

        expect(mockFetch.mock.calls[1]![0]).toBe(
          'https://api.bitwarden.test/public/organization/subscription',
        );
      });
    });
  });

  describe('Import Handlers', () => {
    describe('handleImportOrgUsersAndGroups', () => {
      it('should call correct endpoint with POST method', async () => {
        const { handleImportOrgUsersAndGroups } = await import(
          '../src/handlers/api.js'
        );

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
        } as Response);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: async () => '',
        } as Response);

        await handleImportOrgUsersAndGroups({
          groups: [],
          members: [],
          overwriteExisting: false,
          largeImport: false,
        });

        const apiCall = mockFetch.mock.calls[1];
        expect(apiCall![0]).toBe(
          'https://api.bitwarden.test/public/organization/import',
        );
        expect((apiCall![1] as RequestInit).method).toBe('POST');
      });
    });
  });

  describe('Validation Errors', () => {
    it('should return validation error for missing required fields', async () => {
      const { handleUpdateOrgCollection } = await import(
        '../src/handlers/api.js'
      );

      // Missing required collectionId
      const result = await handleUpdateOrgCollection({} as never);

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('Validation error');
    });
  });
});
