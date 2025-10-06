import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';
import { validateInput } from '../src/utils/validation.js';

describe('Password Generation Schema', () => {
  const generateSchema = z.object({
    length: z.number().int().min(5).optional(),
    uppercase: z.boolean().optional(),
    lowercase: z.boolean().optional(),
    number: z.boolean().optional(),
    special: z.boolean().optional(),
    passphrase: z.boolean().optional(),
    words: z.number().int().min(1).optional(),
    separator: z.string().optional(),
    capitalize: z.boolean().optional(),
  });

  it('should validate password generation with length', () => {
    const validInput = { length: 16, uppercase: true, lowercase: true };
    const [isValid, result] = validateInput(generateSchema, validInput);

    expect(isValid).toBe(true);
    if (isValid) {
      expect(result).toEqual(validInput);
    }
  });

  it('should validate passphrase generation', () => {
    const validInput = { passphrase: true, words: 5, separator: '-' };
    const [isValid, result] = validateInput(generateSchema, validInput);

    expect(isValid).toBe(true);
    if (isValid) {
      expect(result).toEqual(validInput);
    }
  });

  it('should reject password generation with length less than 5', () => {
    const invalidInput = { length: 3 };
    const [isValid, result] = validateInput(generateSchema, invalidInput);

    expect(isValid).toBe(false);
    if (!isValid) {
      expect(result.content[0].text).toContain('Validation error');
    }
  });
});

describe('Create Item Schema', () => {
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

  const createSchema = z
    .object({
      name: z.string().min(1, 'Name is required'),
      type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      notes: z.string().optional(),
      login: loginSchema.optional(),
    })
    .refine(
      (data) => {
        if (data.type === 1) {
          return !!data.login;
        }
        return true;
      },
      {
        message: 'Login details are required for login items',
      },
    );

  it('should validate secure note creation', () => {
    const validInput = { name: 'Test Note', type: 2 as const };
    const [isValid, result] = validateInput(createSchema, validInput);

    expect(isValid).toBe(true);
    if (isValid) {
      expect(result).toEqual(validInput);
    }
  });

  it('should validate login item creation with login details', () => {
    const validInput = {
      name: 'Test Login',
      type: 1 as const,
      login: {
        username: 'testuser',
        password: 'testpass',
        uris: [{ uri: 'https://example.com' }],
      },
    };
    const [isValid, result] = validateInput(createSchema, validInput);

    expect(isValid).toBe(true);
    if (isValid) {
      expect(result).toEqual(validInput);
    }
  });

  it('should reject login item creation without login details', () => {
    const invalidInput = { name: 'Test Login', type: 1 as const };
    const [isValid, result] = validateInput(createSchema, invalidInput);

    expect(isValid).toBe(false);
    if (!isValid) {
      expect(result.content[0].text).toContain(
        'Login details are required for login items',
      );
    }
  });

  it('should reject creation with invalid URI', () => {
    const invalidInput = {
      name: 'Test Login',
      type: 1 as const,
      login: {
        username: 'testuser',
        uris: [{ uri: 'not-a-url' }],
      },
    };
    const [isValid, result] = validateInput(createSchema, invalidInput);

    expect(isValid).toBe(false);
    if (!isValid) {
      expect(result.content[0].text).toContain('Must be a valid URL');
    }
  });
});

describe('Edit and Delete Schemas', () => {
  const editSchema = z.object({
    id: z.string().min(1, 'Item ID is required'),
    name: z.string().optional(),
    notes: z.string().optional(),
    login: z
      .object({
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .optional(),
  });

  const deleteSchema = z.object({
    object: z.enum(['item', 'attachment', 'folder', 'org-collection']),
    id: z.string().min(1, 'Object ID is required'),
    permanent: z.boolean().optional(),
  });

  it('should validate edit command with id only', () => {
    const validInput = { id: 'test-id' };
    const [isValid, result] = validateInput(editSchema, validInput);

    expect(isValid).toBe(true);
    if (isValid) {
      expect(result).toEqual(validInput);
    }
  });

  it('should validate edit command with all fields', () => {
    const validInput = {
      id: 'test-id',
      name: 'New Name',
      notes: 'New notes',
      login: { username: 'newuser', password: 'newpass' },
    };
    const [isValid, result] = validateInput(editSchema, validInput);

    expect(isValid).toBe(true);
    if (isValid) {
      expect(result).toEqual(validInput);
    }
  });

  it('should validate delete command', () => {
    const validInput = {
      object: 'item' as const,
      id: 'test-id',
      permanent: true,
    };
    const [isValid, result] = validateInput(deleteSchema, validInput);

    expect(isValid).toBe(true);
    if (isValid) {
      expect(result).toEqual(validInput);
    }
  });

  it('should reject delete command with invalid object type', () => {
    const invalidInput = { object: 'invalid', id: 'test-id' };
    const [isValid, result] = validateInput(deleteSchema, invalidInput);

    expect(isValid).toBe(false);
    if (!isValid) {
      expect(result.content[0].text).toContain('Validation error');
    }
  });

  it('should validate restore command with valid parameters', () => {
    const restoreSchema = z.object({
      object: z.enum(['item']),
      id: z.string().min(1, 'Object ID is required'),
    });

    const validInput = {
      object: 'item' as const,
      id: 'restored-item-id',
    };
    const [isValid, result] = validateInput(restoreSchema, validInput);

    expect(isValid).toBe(true);
    if (isValid) {
      expect(result).toEqual(validInput);
    }
  });

  it('should reject restore command with invalid object type', () => {
    const restoreSchema = z.object({
      object: z.enum(['item']),
      id: z.string().min(1, 'Object ID is required'),
    });

    const invalidInput = { object: 'attachment', id: 'test-id' };
    const [isValid, result] = validateInput(restoreSchema, invalidInput);

    expect(isValid).toBe(false);
    if (!isValid) {
      expect(result.content[0].text).toContain('Validation error');
    }
  });
});

describe('Error Handling', () => {
  it('should handle non-Zod errors by re-throwing them', () => {
    const schema = z.object({
      name: z.string(),
    });

    // Mock the schema.parse to throw a non-ZodError
    const originalParse = schema.parse;
    const mockParse = jest.fn(() => {
      throw new Error('Non-Zod error');
    });
    schema.parse = mockParse;

    expect(() => validateInput(schema, { name: 'test' })).toThrow(
      'Non-Zod error',
    );

    // Restore original parse
    schema.parse = originalParse;
  });
});
