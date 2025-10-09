import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { validateInput } from '../src/utils/validation.js';
import { validateFilePath } from '../src/utils/security.js';

describe('CLI Commands', () => {
  // Test schemas used in the application
  const listSchema = z.object({
    type: z.enum(['items', 'folders', 'collections', 'organizations']),
    search: z.string().optional(),
    url: z.string().optional(),
    folderid: z.string().optional(),
    collectionid: z.string().optional(),
    trash: z.boolean().optional(),
  });

  const getSchema = z
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
        'fingerprint',
      ]),
      id: z.string().min(1, 'ID or search term is required'),
      itemid: z.string().optional(),
      output: z
        .string()
        .optional()
        .refine((path) => !path || validateFilePath(path), {
          message:
            'Invalid output path: path traversal patterns are not allowed',
        }),
    })
    .refine(
      (data) => {
        // attachment requires itemid
        if (data.object === 'attachment' && !data.itemid) {
          return false;
        }
        return true;
      },
      {
        message: 'itemid is required for attachment',
      },
    );

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

    it('should validate list command with url filter', () => {
      const validInput = {
        type: 'items' as const,
        url: 'https://example.com',
      };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate list command with folderid filter', () => {
      const validInput = {
        type: 'items' as const,
        folderid: 'folder-123',
      };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate list command with null folderid', () => {
      const validInput = {
        type: 'items' as const,
        folderid: 'null',
      };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate list command with notnull folderid', () => {
      const validInput = {
        type: 'items' as const,
        folderid: 'notnull',
      };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate list command with collectionid filter', () => {
      const validInput = {
        type: 'items' as const,
        collectionid: 'collection-456',
      };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate list command with trash filter', () => {
      const validInput = {
        type: 'items' as const,
        trash: true,
      };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate list command with multiple filters', () => {
      const validInput = {
        type: 'items' as const,
        url: 'https://github.com',
        folderid: 'folder-123',
      };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate list command with search and filters (AND operation)', () => {
      const validInput = {
        type: 'items' as const,
        search: 'github',
        folderid: 'folder-123',
        url: 'https://github.com',
      };
      const [isValid, result] = validateInput(listSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
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

    it('should validate get fingerprint with user id', () => {
      const validInput = {
        object: 'fingerprint' as const,
        id: '00000000-0000-0000-0000-000000000000',
      };
      const [isValid, result] = validateInput(getSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate get fingerprint with "me"', () => {
      const validInput = {
        object: 'fingerprint' as const,
        id: 'me',
      };
      const [isValid, result] = validateInput(getSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate get attachment with itemid', () => {
      const validInput = {
        object: 'attachment' as const,
        id: 'photo.png',
        itemid: 'item-123-uuid',
      };
      const [isValid, result] = validateInput(getSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate get attachment with output path', () => {
      const validInput = {
        object: 'attachment' as const,
        id: 'document.pdf',
        itemid: 'item-456-uuid',
        output: '/home/user/downloads/',
      };
      const [isValid, result] = validateInput(getSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject get attachment without itemid', () => {
      const invalidInput = {
        object: 'attachment' as const,
        id: 'photo.png',
      };
      const [isValid, result] = validateInput(getSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'itemid is required for attachment',
        );
      }
    });

    it('should reject get attachment with path traversal in output', () => {
      const invalidInput = {
        object: 'attachment' as const,
        id: 'photo.png',
        itemid: 'item-123-uuid',
        output: '../../../etc/',
      };
      const [isValid, result] = validateInput(getSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'path traversal patterns are not allowed',
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

  describe('device approval commands validation', () => {
    const deviceApprovalListSchema = z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
    });

    const deviceApprovalApproveSchema = z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
      requestId: z.string().min(1, 'Request ID is required'),
    });

    const deviceApprovalApproveAllSchema = z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
    });

    const deviceApprovalDenySchema = z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
      requestId: z.string().min(1, 'Request ID is required'),
    });

    const deviceApprovalDenyAllSchema = z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
    });

    describe('device-approval list', () => {
      it('should pass validation with valid organizationId', () => {
        const validInput = {
          organizationId: 'org-123',
        };

        const [isValid, result] = validateInput(
          deviceApprovalListSchema,
          validInput,
        );

        expect(isValid).toBe(true);
        if (isValid) {
          expect(result).toEqual(validInput);
        }
      });

      it('should fail validation without organizationId', () => {
        const invalidInput = {};

        const [isValid, result] = validateInput(
          deviceApprovalListSchema,
          invalidInput,
        );

        expect(isValid).toBe(false);
        if (!isValid) {
          expect(result.content[0].text).toContain('Validation error');
        }
      });
    });

    describe('device-approval approve', () => {
      it('should pass validation with valid parameters', () => {
        const validInput = {
          organizationId: 'org-123',
          requestId: 'req-456',
        };

        const [isValid, result] = validateInput(
          deviceApprovalApproveSchema,
          validInput,
        );

        expect(isValid).toBe(true);
        if (isValid) {
          expect(result).toEqual(validInput);
        }
      });

      it('should fail validation without organizationId', () => {
        const invalidInput = {
          requestId: 'req-456',
        };

        const [isValid, result] = validateInput(
          deviceApprovalApproveSchema,
          invalidInput,
        );

        expect(isValid).toBe(false);
        if (!isValid) {
          expect(result.content[0].text).toContain('Validation error');
        }
      });

      it('should fail validation without requestId', () => {
        const invalidInput = {
          organizationId: 'org-123',
        };

        const [isValid, result] = validateInput(
          deviceApprovalApproveSchema,
          invalidInput,
        );

        expect(isValid).toBe(false);
        if (!isValid) {
          expect(result.content[0].text).toContain('Validation error');
        }
      });
    });

    describe('device-approval approve-all', () => {
      it('should pass validation with valid organizationId', () => {
        const validInput = {
          organizationId: 'org-123',
        };

        const [isValid, result] = validateInput(
          deviceApprovalApproveAllSchema,
          validInput,
        );

        expect(isValid).toBe(true);
        if (isValid) {
          expect(result).toEqual(validInput);
        }
      });

      it('should fail validation without organizationId', () => {
        const invalidInput = {};

        const [isValid, result] = validateInput(
          deviceApprovalApproveAllSchema,
          invalidInput,
        );

        expect(isValid).toBe(false);
        if (!isValid) {
          expect(result.content[0].text).toContain('Validation error');
        }
      });
    });

    describe('device-approval deny', () => {
      it('should pass validation with valid parameters', () => {
        const validInput = {
          organizationId: 'org-123',
          requestId: 'req-456',
        };

        const [isValid, result] = validateInput(
          deviceApprovalDenySchema,
          validInput,
        );

        expect(isValid).toBe(true);
        if (isValid) {
          expect(result).toEqual(validInput);
        }
      });

      it('should fail validation without organizationId', () => {
        const invalidInput = {
          requestId: 'req-456',
        };

        const [isValid, result] = validateInput(
          deviceApprovalDenySchema,
          invalidInput,
        );

        expect(isValid).toBe(false);
        if (!isValid) {
          expect(result.content[0].text).toContain('Validation error');
        }
      });

      it('should fail validation without requestId', () => {
        const invalidInput = {
          organizationId: 'org-123',
        };

        const [isValid, result] = validateInput(
          deviceApprovalDenySchema,
          invalidInput,
        );

        expect(isValid).toBe(false);
        if (!isValid) {
          expect(result.content[0].text).toContain('Validation error');
        }
      });
    });

    describe('device-approval deny-all', () => {
      it('should pass validation with valid organizationId', () => {
        const validInput = {
          organizationId: 'org-123',
        };

        const [isValid, result] = validateInput(
          deviceApprovalDenyAllSchema,
          validInput,
        );

        expect(isValid).toBe(true);
        if (isValid) {
          expect(result).toEqual(validInput);
        }
      });

      it('should fail validation without organizationId', () => {
        const invalidInput = {};

        const [isValid, result] = validateInput(
          deviceApprovalDenyAllSchema,
          invalidInput,
        );

        expect(isValid).toBe(false);
        if (!isValid) {
          expect(result.content[0].text).toContain('Validation error');
        }
      });
    });
  });

  describe('restore command validation', () => {
    const restoreSchema = z.object({
      object: z.enum(['item']),
      id: z.string().min(1, 'Object ID is required'),
    });

    it('should pass validation with valid object and id', () => {
      const validInput = {
        object: 'item' as const,
        id: 'item-123',
      };

      const [isValid, result] = validateInput(restoreSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should fail validation without object', () => {
      const invalidInput = {
        id: 'item-123',
      };

      const [isValid, result] = validateInput(restoreSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should fail validation without id', () => {
      const invalidInput = {
        object: 'item' as const,
      };

      const [isValid, result] = validateInput(restoreSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should fail validation with empty id', () => {
      const invalidInput = {
        object: 'item' as const,
        id: '',
      };

      const [isValid, result] = validateInput(restoreSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Object ID is required');
      }
    });

    it('should fail validation with invalid object type', () => {
      const invalidInput = {
        object: 'folder',
        id: 'item-123',
      };

      const [isValid, result] = validateInput(restoreSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });
  });

  describe('create item validation', () => {
    // Simplified URI schema for testing
    const uriSchema = z.object({
      uri: z.string().url('Must be a valid URL'),
      match: z
        .union([
          z.literal(0),
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
        ])
        .optional(),
    });

    const loginSchema = z.object({
      username: z.string().optional(),
      password: z.string().optional(),
      uris: z.array(uriSchema).optional(),
      totp: z.string().optional(),
    });

    const cardSchema = z.object({
      cardholderName: z.string().optional(),
      number: z.string().optional(),
      brand: z.string().optional(),
      expMonth: z
        .string()
        .regex(/^\d{2}$/, 'Expiration month must be exactly 2 digits (MM)')
        .optional(),
      expYear: z
        .string()
        .regex(/^\d{4}$/, 'Expiration year must be exactly 4 digits (YYYY)')
        .optional(),
      code: z.string().optional(),
    });

    const identitySchema = z.object({
      title: z.string().optional(),
      firstName: z.string().optional(),
      middleName: z.string().optional(),
      lastName: z.string().optional(),
      address1: z.string().optional(),
      address2: z.string().optional(),
      address3: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      company: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      ssn: z.string().optional(),
      username: z.string().optional(),
      passportNumber: z.string().optional(),
      licenseNumber: z.string().optional(),
    });

    const secureNoteSchema = z.object({
      type: z.literal(0).optional(),
    });

    const createItemSchema = z
      .object({
        name: z.string().min(1, 'Name is required'),
        type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        notes: z.string().optional(),
        login: loginSchema.optional(),
        card: cardSchema.optional(),
        identity: identitySchema.optional(),
        secureNote: secureNoteSchema.optional(),
        folderId: z.string().optional(),
      })
      .refine(
        (data) => {
          if (data.type === 1 && !data.login) return false;
          if (data.type === 2 && !data.secureNote) return false;
          if (data.type === 3 && !data.card) return false;
          if (data.type === 4 && !data.identity) return false;
          return true;
        },
        {
          message:
            'Type-specific data is required: login for type 1, secureNote for type 2, card for type 3, identity for type 4',
        },
      );

    it('should validate create login item with all fields', () => {
      const validInput = {
        name: 'Test Login',
        type: 1 as const,
        notes: 'Test notes',
        login: {
          username: 'user@example.com',
          password: 'password123',
          uris: [{ uri: 'https://example.com', match: 0 as const }],
          totp: 'JBSWY3DPEHPK3PXP',
        },
        folderId: 'folder-123',
      };

      const [isValid, result] = validateInput(createItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate create login item with minimal fields', () => {
      const validInput = {
        name: 'Test Login',
        type: 1 as const,
        login: {},
      };

      const [isValid, result] = validateInput(createItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate create secure note item', () => {
      const validInput = {
        name: 'Test Secure Note',
        type: 2 as const,
        notes: 'This is a secure note',
        secureNote: { type: 0 as const },
      };

      const [isValid, result] = validateInput(createItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate create card item with all fields', () => {
      const validInput = {
        name: 'Test Card',
        type: 3 as const,
        card: {
          cardholderName: 'John Doe',
          number: '4111111111111111',
          brand: 'Visa',
          expMonth: '12',
          expYear: '2025',
          code: '123',
        },
      };

      const [isValid, result] = validateInput(createItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate create identity item with all fields', () => {
      const validInput = {
        name: 'Test Identity',
        type: 4 as const,
        identity: {
          title: 'Mr',
          firstName: 'John',
          middleName: 'M',
          lastName: 'Doe',
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'USA',
          email: 'john@example.com',
          phone: '555-1234',
          ssn: '123-45-6789',
        },
      };

      const [isValid, result] = validateInput(createItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject create item without name', () => {
      const invalidInput = {
        type: 1 as const,
        login: { username: 'test' },
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject create item without type', () => {
      const invalidInput = {
        name: 'Test Item',
        login: { username: 'test' },
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject create login item without login data', () => {
      const invalidInput = {
        name: 'Test Login',
        type: 1 as const,
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Type-specific data is required',
        );
      }
    });

    it('should reject create secure note without secureNote data', () => {
      const invalidInput = {
        name: 'Test Note',
        type: 2 as const,
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Type-specific data is required',
        );
      }
    });

    it('should reject create card without card data', () => {
      const invalidInput = {
        name: 'Test Card',
        type: 3 as const,
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Type-specific data is required',
        );
      }
    });

    it('should reject create identity without identity data', () => {
      const invalidInput = {
        name: 'Test Identity',
        type: 4 as const,
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Type-specific data is required',
        );
      }
    });

    it('should reject create item with invalid URI', () => {
      const invalidInput = {
        name: 'Test Login',
        type: 1 as const,
        login: {
          uris: [{ uri: 'not-a-url' }],
        },
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Must be a valid URL');
      }
    });

    it('should reject create card with invalid expiration month format (1 digit)', () => {
      const invalidInput = {
        name: 'Test Card',
        type: 3 as const,
        card: {
          expMonth: '5',
          expYear: '2025',
        },
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Expiration month must be exactly 2 digits',
        );
      }
    });

    it('should reject create card with invalid expiration month format (3 digits)', () => {
      const invalidInput = {
        name: 'Test Card',
        type: 3 as const,
        card: {
          expMonth: '123',
          expYear: '2025',
        },
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Expiration month must be exactly 2 digits',
        );
      }
    });

    it('should reject create card with non-numeric expiration month', () => {
      const invalidInput = {
        name: 'Test Card',
        type: 3 as const,
        card: {
          expMonth: 'AB',
          expYear: '2025',
        },
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Expiration month must be exactly 2 digits',
        );
      }
    });

    it('should reject create card with invalid expiration year format (2 digits)', () => {
      const invalidInput = {
        name: 'Test Card',
        type: 3 as const,
        card: {
          expMonth: '12',
          expYear: '25',
        },
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Expiration year must be exactly 4 digits',
        );
      }
    });

    it('should reject create card with invalid expiration year format (5 digits)', () => {
      const invalidInput = {
        name: 'Test Card',
        type: 3 as const,
        card: {
          expMonth: '12',
          expYear: '20255',
        },
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Expiration year must be exactly 4 digits',
        );
      }
    });

    it('should reject create card with non-numeric expiration year', () => {
      const invalidInput = {
        name: 'Test Card',
        type: 3 as const,
        card: {
          expMonth: '12',
          expYear: 'ABCD',
        },
      };

      const [isValid, result] = validateInput(createItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Expiration year must be exactly 4 digits',
        );
      }
    });

    it('should accept create card with valid 2-digit month and 4-digit year', () => {
      const validInput = {
        name: 'Test Card',
        type: 3 as const,
        card: {
          cardholderName: 'John Doe',
          expMonth: '01',
          expYear: '2025',
        },
      };

      const [isValid, result] = validateInput(createItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });
  });

  describe('edit item validation', () => {
    const uriSchema = z.object({
      uri: z.string().url('Must be a valid URL'),
      match: z
        .union([
          z.literal(0),
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
        ])
        .optional(),
    });

    const editLoginSchema = z.object({
      username: z.string().optional(),
      password: z.string().optional(),
      uris: z.array(uriSchema).optional(),
      totp: z.string().optional(),
    });

    const editCardSchema = z.object({
      cardholderName: z.string().optional(),
      number: z.string().optional(),
      brand: z.string().optional(),
      expMonth: z
        .string()
        .regex(/^\d{2}$/, 'Expiration month must be exactly 2 digits (MM)')
        .optional(),
      expYear: z
        .string()
        .regex(/^\d{4}$/, 'Expiration year must be exactly 4 digits (YYYY)')
        .optional(),
      code: z.string().optional(),
    });

    const editIdentitySchema = z.object({
      title: z.string().optional(),
      firstName: z.string().optional(),
      middleName: z.string().optional(),
      lastName: z.string().optional(),
      address1: z.string().optional(),
      address2: z.string().optional(),
      address3: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      company: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      ssn: z.string().optional(),
      username: z.string().optional(),
      passportNumber: z.string().optional(),
      licenseNumber: z.string().optional(),
    });

    const editSecureNoteSchema = z.object({
      type: z.literal(0).optional(),
    });

    const editItemSchema = z.object({
      id: z.string().min(1, 'ID is required'),
      name: z.string().optional(),
      notes: z.string().optional(),
      login: editLoginSchema.optional(),
      card: editCardSchema.optional(),
      identity: editIdentitySchema.optional(),
      secureNote: editSecureNoteSchema.optional(),
      folderId: z.string().optional(),
    });

    it('should validate edit item with id only', () => {
      const validInput = {
        id: 'item-123',
      };

      const [isValid, result] = validateInput(editItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate edit login item with all fields', () => {
      const validInput = {
        id: 'item-123',
        name: 'Updated Login',
        notes: 'Updated notes',
        login: {
          username: 'newuser@example.com',
          password: 'newpassword',
          uris: [{ uri: 'https://newsite.com' }],
          totp: 'NEWTOTP',
        },
        folderId: 'folder-456',
      };

      const [isValid, result] = validateInput(editItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate edit card item', () => {
      const validInput = {
        id: 'item-123',
        card: {
          cardholderName: 'Jane Doe',
          expMonth: '06',
          expYear: '2026',
        },
      };

      const [isValid, result] = validateInput(editItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate edit identity item', () => {
      const validInput = {
        id: 'item-123',
        identity: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        },
      };

      const [isValid, result] = validateInput(editItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate edit secure note', () => {
      const validInput = {
        id: 'item-123',
        notes: 'Updated secure note content',
        secureNote: { type: 0 as const },
      };

      const [isValid, result] = validateInput(editItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject edit item without id', () => {
      const invalidInput = {
        name: 'Updated Item',
      };

      const [isValid, result] = validateInput(editItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject edit item with empty id', () => {
      const invalidInput = {
        id: '',
        name: 'Updated Item',
      };

      const [isValid, result] = validateInput(editItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('ID is required');
      }
    });

    it('should reject edit item with invalid URI', () => {
      const invalidInput = {
        id: 'item-123',
        login: {
          uris: [{ uri: 'invalid-url' }],
        },
      };

      const [isValid, result] = validateInput(editItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Must be a valid URL');
      }
    });

    it('should reject edit card with invalid expiration month format', () => {
      const invalidInput = {
        id: 'item-123',
        card: {
          expMonth: '5',
        },
      };

      const [isValid, result] = validateInput(editItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Expiration month must be exactly 2 digits',
        );
      }
    });

    it('should reject edit card with invalid expiration year format', () => {
      const invalidInput = {
        id: 'item-123',
        card: {
          expYear: '25',
        },
      };

      const [isValid, result] = validateInput(editItemSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'Expiration year must be exactly 4 digits',
        );
      }
    });

    it('should accept edit card with valid expiration month and year', () => {
      const validInput = {
        id: 'item-123',
        card: {
          expMonth: '06',
          expYear: '2026',
        },
      };

      const [isValid, result] = validateInput(editItemSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });
  });

  describe('create folder validation', () => {
    const createFolderSchema = z.object({
      name: z.string().min(1, 'Name is required'),
    });

    it('should validate create folder with name', () => {
      const validInput = {
        name: 'Test Folder',
      };

      const [isValid, result] = validateInput(createFolderSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject create folder without name', () => {
      const invalidInput = {};

      const [isValid, result] = validateInput(createFolderSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject create folder with empty name', () => {
      const invalidInput = {
        name: '',
      };

      const [isValid, result] = validateInput(createFolderSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Name is required');
      }
    });
  });

  describe('edit folder validation', () => {
    const editFolderSchema = z.object({
      id: z.string().min(1, 'ID is required'),
      name: z.string().min(1, 'Name is required'),
    });

    it('should validate edit folder with id and name', () => {
      const validInput = {
        id: 'folder-123',
        name: 'Updated Folder',
      };

      const [isValid, result] = validateInput(editFolderSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject edit folder without id', () => {
      const invalidInput = {
        name: 'Updated Folder',
      };

      const [isValid, result] = validateInput(editFolderSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject edit folder without name', () => {
      const invalidInput = {
        id: 'folder-123',
      };

      const [isValid, result] = validateInput(editFolderSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject edit folder with empty id', () => {
      const invalidInput = {
        id: '',
        name: 'Updated Folder',
      };

      const [isValid, result] = validateInput(editFolderSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('ID is required');
      }
    });

    it('should reject edit folder with empty name', () => {
      const invalidInput = {
        id: 'folder-123',
        name: '',
      };

      const [isValid, result] = validateInput(editFolderSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Name is required');
      }
    });
  });

  describe('create text send validation', () => {
    const createTextSendSchema = z
      .object({
        name: z.string().min(1, 'Name is required'),
        text: z.string().min(1, 'Text content is required'),
        hidden: z.boolean().optional(),
        notes: z.string().optional(),
        password: z.string().optional(),
        maxAccessCount: z.number().int().positive().optional(),
        expirationDate: z.string().optional(),
        deletionDate: z.string().optional(),
        disabled: z.boolean().default(false),
      })
      .transform((data) => ({
        ...data,
        deletionDate:
          data.deletionDate ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

    it('should validate create text send with required fields', () => {
      const validInput = {
        name: 'My Secret Message',
        text: 'This is the secret content',
        deletionDate: '2026-01-07T23:59:59Z',
      };

      const [isValid, result] = validateInput(createTextSendSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result.name).toBe(validInput.name);
        expect(result.text).toBe(validInput.text);
        expect(result.deletionDate).toBe(validInput.deletionDate);
        expect(result.disabled).toBe(false);
      }
    });

    it('should validate create text send with all optional fields', () => {
      const validInput = {
        name: 'My Secret Message',
        text: 'This is the secret content',
        hidden: true,
        notes: 'Private note',
        password: 'access123',
        maxAccessCount: 5,
        expirationDate: '2025-12-31T23:59:59Z',
        deletionDate: '2026-01-07T23:59:59Z',
      };

      const [isValid, result] = validateInput(createTextSendSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual({ ...validInput, disabled: false });
      }
    });

    it('should reject create text send without name', () => {
      const invalidInput = {
        text: 'Content',
      };

      const [isValid, result] = validateInput(
        createTextSendSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject create text send without text', () => {
      const invalidInput = {
        name: 'My Send',
        deletionDate: '2026-01-07T23:59:59Z',
      };

      const [isValid, result] = validateInput(
        createTextSendSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject create text send with invalid maxAccessCount', () => {
      const invalidInput = {
        name: 'My Send',
        text: 'Content',
        deletionDate: '2026-01-07T23:59:59Z',
        maxAccessCount: -1,
      };

      const [isValid, result] = validateInput(
        createTextSendSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('expected number to be >0');
      }
    });

    it('should apply default deletionDate when not provided', () => {
      const validInput = {
        name: 'My Send',
        text: 'Content',
      };

      const [isValid, result] = validateInput(createTextSendSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result.deletionDate).toBeDefined();
        expect(result.disabled).toBe(false);
        // Check that the deletion date is approximately 7 days in the future
        const deletionDate = new Date(result.deletionDate);
        const expectedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const timeDiff = Math.abs(
          deletionDate.getTime() - expectedDate.getTime(),
        );
        expect(timeDiff).toBeLessThan(1000); // Within 1 second
      }
    });
  });

  describe('create file send validation', () => {
    const createFileSendSchema = z
      .object({
        name: z.string().min(1, 'Name is required'),
        filePath: z
          .string()
          .min(1, 'File path is required')
          .refine((path) => validateFilePath(path), {
            message:
              'Invalid file path: path traversal patterns are not allowed',
          }),
        notes: z.string().optional(),
        password: z.string().optional(),
        maxAccessCount: z.number().int().positive().optional(),
        expirationDate: z.string().optional(),
        deletionDate: z.string().optional(),
        disabled: z.boolean().default(false),
      })
      .transform((data) => ({
        ...data,
        deletionDate:
          data.deletionDate ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

    it('should validate create file send with required fields', () => {
      const validInput = {
        name: 'Confidential Document',
        filePath: '/path/to/document.pdf',
        deletionDate: '2026-01-07T23:59:59Z',
      };

      const [isValid, result] = validateInput(createFileSendSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result.name).toBe(validInput.name);
        expect(result.filePath).toBe(validInput.filePath);
        expect(result.deletionDate).toBe(validInput.deletionDate);
        expect(result.disabled).toBe(false);
      }
    });

    it('should validate create file send with all fields', () => {
      const validInput = {
        name: 'Confidential Document',
        filePath: '/path/to/document.pdf',
        notes: 'Internal use only',
        password: 'secure123',
        maxAccessCount: 3,
        expirationDate: '2025-12-31T23:59:59Z',
        deletionDate: '2026-01-07T23:59:59Z',
      };

      const [isValid, result] = validateInput(createFileSendSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual({ ...validInput, disabled: false });
      }
    });

    it('should reject create file send without filePath', () => {
      const invalidInput = {
        name: 'Document',
        deletionDate: '2026-01-07T23:59:59Z',
      };

      const [isValid, result] = validateInput(
        createFileSendSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should apply default deletionDate when not provided', () => {
      const validInput = {
        name: 'Document',
        filePath: '/path/to/document.pdf',
      };

      const [isValid, result] = validateInput(createFileSendSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result.deletionDate).toBeDefined();
        expect(result.disabled).toBe(false);
        // Check that the deletion date is approximately 7 days in the future
        const deletionDate = new Date(result.deletionDate);
        const expectedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const timeDiff = Math.abs(
          deletionDate.getTime() - expectedDate.getTime(),
        );
        expect(timeDiff).toBeLessThan(1000); // Within 1 second
      }
    });

    it('should reject file send with path traversal patterns', () => {
      const maliciousPaths = [
        '../etc/passwd',
        '../../sensitive-file',
        'files/../../../system/config',
        '..\\windows\\system32',
        'folder\\..\\..\\system',
      ];

      maliciousPaths.forEach((maliciousPath) => {
        const invalidInput = {
          name: 'Malicious Document',
          filePath: maliciousPath,
        };

        const [isValid, result] = validateInput(
          createFileSendSchema,
          invalidInput,
        );

        expect(isValid).toBe(false);
        if (!isValid) {
          expect(result.content[0].text).toContain(
            'path traversal patterns are not allowed',
          );
        }
      });
    });

    it('should reject file send with UNC paths', () => {
      const invalidInput = {
        name: 'Network File',
        filePath: '\\\\server\\share\\file.txt',
      };

      const [isValid, result] = validateInput(
        createFileSendSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'path traversal patterns are not allowed',
        );
      }
    });

    it('should accept file send with valid file paths', () => {
      const validPaths = [
        // Relative paths
        'document.pdf',
        './local-file.txt',
        'folder/subfolder/file.txt',
        // Unix/Linux absolute paths
        '/home/user/document.pdf',
        '/tmp/export.json',
        // Windows absolute paths
        'C:\\Users\\Documents\\file.pdf',
        'D:\\Backup\\archive.zip',
      ];

      validPaths.forEach((validPath) => {
        const validInput = {
          name: 'Valid Document',
          filePath: validPath,
        };

        const [isValid] = validateInput(createFileSendSchema, validInput);
        expect(isValid).toBe(true);
      });
    });
  });

  describe('attachment validation', () => {
    const createAttachmentSchema = z.object({
      filePath: z
        .string()
        .min(1, 'File path is required')
        .refine((path) => validateFilePath(path), {
          message: 'Invalid file path: path traversal patterns are not allowed',
        }),
      itemId: z.string().min(1, 'Item ID is required'),
    });

    it('should validate create attachment with valid parameters', () => {
      const validInput = {
        filePath: '/path/to/document.pdf',
        itemId: 'item-123',
      };

      const [isValid, result] = validateInput(
        createAttachmentSchema,
        validInput,
      );

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject create attachment without filePath', () => {
      const invalidInput = {
        itemId: 'item-123',
      };

      const [isValid, result] = validateInput(
        createAttachmentSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject create attachment without itemId', () => {
      const invalidInput = {
        filePath: '/path/to/document.pdf',
      };

      const [isValid, result] = validateInput(
        createAttachmentSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject create attachment with path traversal', () => {
      const invalidInput = {
        filePath: '../../../etc/passwd',
        itemId: 'item-123',
      };

      const [isValid, result] = validateInput(
        createAttachmentSchema,
        invalidInput,
      );

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain(
          'path traversal patterns are not allowed',
        );
      }
    });

    it('should accept valid file paths', () => {
      const validPaths = [
        '/home/user/document.pdf',
        'C:\\Users\\Documents\\file.pdf',
        './local-file.txt',
        'folder/file.txt',
      ];

      validPaths.forEach((filePath) => {
        const validInput = {
          filePath,
          itemId: 'item-123',
        };

        const [isValid] = validateInput(createAttachmentSchema, validInput);
        expect(isValid).toBe(true);
      });
    });
  });

  describe('send operations validation', () => {
    const getSendSchema = z.object({
      id: z.string().min(1, 'Send ID is required'),
    });

    const editSendSchema = z.object({
      id: z.string().min(1, 'Send ID is required'),
      name: z.string().optional(),
      notes: z.string().optional(),
      password: z.string().optional(),
      maxAccessCount: z.number().int().positive().optional(),
      expirationDate: z.string().optional(),
      deletionDate: z.string().optional(),
      disabled: z.boolean().default(false),
    });

    const deleteSendSchema = z.object({
      id: z.string().min(1, 'Send ID is required'),
    });

    it('should validate get send with id', () => {
      const validInput = {
        id: 'send-123',
      };

      const [isValid, result] = validateInput(getSendSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should validate edit send with id only', () => {
      const validInput = {
        id: 'send-123',
      };

      const [isValid, result] = validateInput(editSendSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual({ id: 'send-123', disabled: false });
      }
    });

    it('should validate edit send with multiple fields', () => {
      const validInput = {
        id: 'send-123',
        name: 'Updated Send',
        password: 'newpass',
        disabled: true,
      };

      const [isValid, result] = validateInput(editSendSchema, validInput);

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual(validInput);
      }
    });

    it('should reject get send without id', () => {
      const invalidInput = {};

      const [isValid, result] = validateInput(getSendSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should reject delete send with empty id', () => {
      const invalidInput = {
        id: '',
      };

      const [isValid, result] = validateInput(deleteSendSchema, invalidInput);

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Send ID is required');
      }
    });
  });
});
