import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { validateInput } from '../src/utils/validation.js';

describe('CLI Commands', () => {
  // Test schemas used in the application
  const unlockSchema = z.object({
    password: z.string().min(1, 'Password is required'),
  });

  const listSchema = z.object({
    type: z.enum(['items', 'folders', 'collections', 'organizations']),
    search: z.string().optional(),
  });

  const getSchema = z.object({
    object: z.enum([
      'item',
      'username',
      'password',
      'uri',
      'totp',
      'notes',
      'exposed',
      'attachment',
      'folder',
      'collection',
      'organization',
    ]),
    id: z.string().min(1, 'ID or search term is required'),
  });

  describe('unlock command validation', () => {
    it('should validate unlock command with password', () => {
      const validInput = { password: 'master-password' };
      const [isValid, result] = validateInput(unlockSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject unlock command without password', () => {
      const invalidInput = {};
      const [isValid, result] = validateInput(unlockSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject unlock command with empty password', () => {
      const invalidInput = { password: '' };
      const [isValid, result] = validateInput(unlockSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Password is required');
      }
    });
  });

  describe('list command validation', () => {
    it('should validate list command with valid type', () => {
      const validInput = { type: 'items' as const };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate list command with type and search', () => {
      const validInput = { type: 'items' as const, search: 'test' };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject list command with invalid type', () => {
      const invalidInput = { type: 'invalid' };
      const [isValid, result] = validateInput(listSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });
  });

  describe('get command validation', () => {
    it('should validate get command with valid object and id', () => {
      const validInput = { object: 'item' as const, id: 'test-id' };
      const [isValid, result] = validateInput(getSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject get command without id', () => {
      const invalidInput = { object: 'item' as const };
      const [isValid, result] = validateInput(getSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject get command with empty id', () => {
      const invalidInput = { object: 'item' as const, id: '' };
      const [isValid, result] = validateInput(getSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'ID or search term is required',
        );
      }
    });
  });

  describe('list org-members and org-collections validation', () => {
    const extendedListSchema = z
      .object({
        type: z.enum([
          'items',
          'folders',
          'collections',
          'organizations',
          'org-collections',
          'org-members',
        ]),
        search: z.string().optional(),
        organizationid: z.string().optional(),
      })
      .refine(
        (data) => {
          // org-collections and org-members require organizationid
          if (
            (data.type === 'org-collections' || data.type === 'org-members') &&
            !data.organizationid
          ) {
            return false;
          }
          return true;
        },
        {
          message:
            'organizationid is required when listing org-collections or org-members',
        },
      );

    it('should validate list org-members with organizationid', () => {
      const validInput = {
        type: 'org-members' as const,
        organizationid: 'org-123',
      };
      const [isValid, result] = validateInput(extendedListSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate list org-collections with organizationid', () => {
      const validInput = {
        type: 'org-collections' as const,
        organizationid: 'org-456',
      };
      const [isValid, result] = validateInput(extendedListSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject list org-members without organizationid', () => {
      const invalidInput = { type: 'org-members' as const };
      const [isValid, result] = validateInput(extendedListSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('organizationid is required');
      }
    });

    it('should reject list org-collections without organizationid', () => {
      const invalidInput = { type: 'org-collections' as const };
      const [isValid, result] = validateInput(extendedListSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('organizationid is required');
      }
    });
  });

  describe('confirm command validation', () => {
    const confirmSchema = z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
      memberId: z.string().min(1, 'Member ID is required'),
    });

    it('should validate confirm command with valid organizationId and memberId', () => {
      const validInput = {
        organizationId: 'org-123',
        memberId: 'member-456',
      };
      const [isValid, result] = validateInput(confirmSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject confirm command without organizationId', () => {
      const invalidInput = { memberId: 'member-456' };
      const [isValid, result] = validateInput(confirmSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject confirm command without memberId', () => {
      const invalidInput = { organizationId: 'org-123' };
      const [isValid, result] = validateInput(confirmSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject confirm command with empty organizationId', () => {
      const invalidInput = { organizationId: '', memberId: 'member-456' };
      const [isValid, result] = validateInput(confirmSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Organization ID is required');
      }
    });

    it('should reject confirm command with empty memberId', () => {
      const invalidInput = { organizationId: 'org-123', memberId: '' };
      const [isValid, result] = validateInput(confirmSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Member ID is required');
      }
    });
  });

  describe('get org-collection validation', () => {
    const extendedGetSchema = z
      .object({
        object: z.enum([
          'item',
          'username',
          'password',
          'uri',
          'totp',
          'notes',
          'exposed',
          'attachment',
          'folder',
          'collection',
          'organization',
          'org-collection',
        ]),
        id: z.string().min(1, 'ID or search term is required'),
        organizationid: z.string().optional(),
      })
      .refine(
        (data) => {
          if (data.object === 'org-collection' && !data.organizationid) {
            return false;
          }
          return true;
        },
        {
          message: 'organizationid is required when getting org-collection',
        },
      );

    it('should validate get org-collection with organizationid', () => {
      const validInput = {
        object: 'org-collection' as const,
        id: 'collection-123',
        organizationid: 'org-456',
      };
      const [isValid, result] = validateInput(extendedGetSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject get org-collection without organizationid', () => {
      const invalidInput = {
        object: 'org-collection' as const,
        id: 'collection-123',
      };
      const [isValid, result] = validateInput(extendedGetSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('organizationid is required');
      }
    });
  });

  describe('create org-collection validation', () => {
    const createOrgCollectionSchema = z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
      name: z.string().min(1, 'Collection name is required'),
      externalId: z.string().optional(),
      groups: z
        .array(
          z.object({
            id: z.string().min(1, 'Group ID is required'),
            readOnly: z.boolean().optional(),
            hidePasswords: z.boolean().optional(),
          }),
        )
        .optional(),
    });

    it('should validate create org-collection with required fields', () => {
      const validInput = {
        organizationId: 'org-123',
        name: 'Test Collection',
      };
      const [isValid, result] = validateInput(
        createOrgCollectionSchema,
        validInput,
      );

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate create org-collection with all fields', () => {
      const validInput = {
        organizationId: 'org-123',
        name: 'Test Collection',
        externalId: 'ext-456',
        groups: [
          { id: 'group-1', readOnly: true, hidePasswords: false },
          { id: 'group-2' },
        ],
      };
      const [isValid, result] = validateInput(
        createOrgCollectionSchema,
        validInput,
      );

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject create org-collection without organizationId', () => {
      const invalidInput = { name: 'Test Collection' };
      const [isValid, result] = validateInput(
        createOrgCollectionSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject create org-collection without name', () => {
      const invalidInput = { organizationId: 'org-123' };
      const [isValid, result] = validateInput(
        createOrgCollectionSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });
  });

  describe('edit org-collection validation', () => {
    const editOrgCollectionSchema = z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
      collectionId: z.string().min(1, 'Collection ID is required'),
      name: z.string().optional(),
      externalId: z.string().optional(),
      groups: z
        .array(
          z.object({
            id: z.string().min(1, 'Group ID is required'),
            readOnly: z.boolean().optional(),
            hidePasswords: z.boolean().optional(),
          }),
        )
        .optional(),
    });

    it('should validate edit org-collection with required fields only', () => {
      const validInput = {
        organizationId: 'org-123',
        collectionId: 'collection-456',
      };
      const [isValid, result] = validateInput(
        editOrgCollectionSchema,
        validInput,
      );

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate edit org-collection with name update', () => {
      const validInput = {
        organizationId: 'org-123',
        collectionId: 'collection-456',
        name: 'Updated Collection',
      };
      const [isValid, result] = validateInput(
        editOrgCollectionSchema,
        validInput,
      );

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject edit org-collection without organizationId', () => {
      const invalidInput = { collectionId: 'collection-456' };
      const [isValid, result] = validateInput(
        editOrgCollectionSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject edit org-collection without collectionId', () => {
      const invalidInput = { organizationId: 'org-123' };
      const [isValid, result] = validateInput(
        editOrgCollectionSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });
  });

  describe('edit item-collections validation', () => {
    const editItemCollectionsSchema = z.object({
      itemId: z.string().min(1, 'Item ID is required'),
      organizationId: z.string().min(1, 'Organization ID is required'),
      collectionIds: z.array(
        z.string().min(1, 'Collection ID cannot be empty'),
      ),
    });

    it('should validate edit item-collections with valid parameters', () => {
      const validInput = {
        itemId: 'item-123',
        organizationId: 'org-456',
        collectionIds: ['col-1', 'col-2', 'col-3'],
      };
      const [isValid, result] = validateInput(
        editItemCollectionsSchema,
        validInput,
      );

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate edit item-collections with empty collection array', () => {
      const validInput = {
        itemId: 'item-123',
        organizationId: 'org-456',
        collectionIds: [],
      };
      const [isValid, result] = validateInput(
        editItemCollectionsSchema,
        validInput,
      );

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject edit item-collections without itemId', () => {
      const invalidInput = {
        organizationId: 'org-456',
        collectionIds: ['col-1'],
      };
      const [isValid, result] = validateInput(
        editItemCollectionsSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject edit item-collections without organizationId', () => {
      const invalidInput = {
        itemId: 'item-123',
        collectionIds: ['col-1'],
      };
      const [isValid, result] = validateInput(
        editItemCollectionsSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject edit item-collections without collectionIds', () => {
      const invalidInput = {
        itemId: 'item-123',
        organizationId: 'org-456',
      };
      const [isValid, result] = validateInput(
        editItemCollectionsSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject edit item-collections with empty collection ID', () => {
      const invalidInput = {
        itemId: 'item-123',
        organizationId: 'org-456',
        collectionIds: ['col-1', '', 'col-3'],
      };
      const [isValid, result] = validateInput(
        editItemCollectionsSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Collection ID cannot be empty',
        );
      }
    });
  });

  describe('move command validation', () => {
    const moveSchema = z.object({
      itemId: z.string().min(1, 'Item ID is required'),
      organizationId: z.string().min(1, 'Organization ID is required'),
      collectionIds: z.array(
        z.string().min(1, 'Collection ID cannot be empty'),
      ),
    });

    it('should pass validation with valid parameters', () => {
      const validInput = {
        itemId: 'item-123',
        organizationId: 'org-456',
        collectionIds: ['col-789', 'col-012'],
      };

      const [isValid, result] = validateInput(moveSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should fail validation without itemId', () => {
      const invalidInput = {
        organizationId: 'org-456',
        collectionIds: ['col-789'],
      };

      const [isValid, result] = validateInput(moveSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should fail validation without organizationId', () => {
      const invalidInput = {
        itemId: 'item-123',
        collectionIds: ['col-789'],
      };

      const [isValid, result] = validateInput(moveSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should fail validation without collectionIds', () => {
      const invalidInput = {
        itemId: 'item-123',
        organizationId: 'org-456',
      };

      const [isValid, result] = validateInput(moveSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should pass validation with empty collectionIds array', () => {
      const validInput = {
        itemId: 'item-123',
        organizationId: 'org-456',
        collectionIds: [],
      };

      const [isValid] = validateInput(moveSchema, validInput);

      // Empty array is valid - item moved to org but not assigned to any collections
      expect(isValid).toBe(true);
    });

    it('should fail validation with empty string in collectionIds', () => {
      const invalidInput = {
        itemId: 'item-123',
        organizationId: 'org-456',
        collectionIds: ['col-789', ''],
      };

      const [isValid, result] = validateInput(moveSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Collection ID cannot be empty',
        );
      }
    });
  });
});
