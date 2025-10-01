import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { validateInput } from '../src/utils/validation.js';
import {
  validateApiEndpoint,
  sanitizeApiParameters,
} from '../src/utils/security.js';

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
