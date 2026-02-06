import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';
import { validateInput, withValidation } from '../../src/utils/validation.js';

describe('Validation Utilities', () => {
  describe('validateInput', () => {
    it('should return validated data on success', () => {
      const schema = z.object({
        name: z.string(),
        count: z.number(),
      });

      const [success, result] = validateInput(schema, {
        name: 'test',
        count: 42,
      });

      expect(success).toBe(true);
      if (success) {
        expect(result).toEqual({ name: 'test', count: 42 });
      }
    });

    it('should return error response on validation failure', () => {
      const schema = z.object({
        name: z.string().min(3, 'Name must be at least 3 characters'),
      });

      const [success, result] = validateInput(schema, { name: 'ab' });

      expect(success).toBe(false);
      if (!success) {
        expect(result.isError).toBe(true);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain(
          'Name must be at least 3 characters',
        );
      }
    });

    it('should handle undefined input', () => {
      const schema = z.object({
        optional: z.string().optional(),
      });

      const [success, result] = validateInput(schema, undefined);

      expect(success).toBe(true);
      if (success) {
        expect(result).toEqual({});
      }
    });

    it('should handle null input by treating as empty object', () => {
      const schema = z.object({
        optional: z.string().optional(),
      });

      const [success, result] = validateInput(schema, null);

      expect(success).toBe(true);
      if (success) {
        expect(result).toEqual({});
      }
    });

    it('should combine multiple validation errors', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email'),
      });

      const [success, result] = validateInput(schema, {
        name: '',
        email: 'bad',
      });

      expect(success).toBe(false);
      if (!success) {
        expect(result.content[0].text).toContain('Name is required');
        expect(result.content[0].text).toContain('Invalid email');
      }
    });

    it('should re-throw non-ZodError exceptions', () => {
      const schema = z.object({
        value: z.string(),
      });

      // Mock parse to throw non-Zod error
      const originalParse = schema.parse;
      schema.parse = () => {
        throw new Error('Unexpected error');
      };

      expect(() => validateInput(schema, { value: 'test' })).toThrow(
        'Unexpected error',
      );

      schema.parse = originalParse;
    });

    it('should validate nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            age: z.number().min(0),
          }),
        }),
      });

      const [success, result] = validateInput(schema, {
        user: {
          name: 'John',
          profile: {
            age: 25,
          },
        },
      });

      expect(success).toBe(true);
      if (success) {
        expect(result.user.name).toBe('John');
        expect(result.user.profile.age).toBe(25);
      }
    });

    it('should validate arrays', () => {
      const schema = z.object({
        items: z.array(z.string().min(1)),
      });

      const [success, result] = validateInput(schema, {
        items: ['a', 'b', 'c'],
      });

      expect(success).toBe(true);
      if (success) {
        expect(result.items).toEqual(['a', 'b', 'c']);
      }
    });

    it('should fail on array with invalid items', () => {
      const schema = z.object({
        items: z.array(z.string().min(1, 'Item cannot be empty')),
      });

      const [success, result] = validateInput(schema, {
        items: ['valid', ''],
      });

      expect(success).toBe(false);
      if (!success) {
        expect(result.content[0].text).toContain('Item cannot be empty');
      }
    });
  });

  describe('withValidation', () => {
    it('should call handler with validated args on success', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const mockHandler = jest
        .fn<(args: { name: string }) => Promise<{ success: boolean }>>()
        .mockResolvedValue({ success: true });
      const wrappedHandler = withValidation(schema, mockHandler);

      await wrappedHandler({ name: 'test' });

      expect(mockHandler).toHaveBeenCalledWith({ name: 'test' });
    });

    it('should return error response on validation failure', async () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
      });

      const mockHandler = jest
        .fn<(args: { name: string }) => Promise<{ success: boolean }>>()
        .mockResolvedValue({ success: true });
      const wrappedHandler = withValidation(schema, mockHandler);

      const result = await wrappedHandler({ name: '' });

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'Validation error: Name is required' }],
      });
    });

    it('should preserve handler return type', async () => {
      const schema = z.object({
        id: z.string(),
      });

      interface MyResponse {
        data: string;
        count: number;
      }

      const handler = async (args: { id: string }): Promise<MyResponse> => ({
        data: `Item ${args.id}`,
        count: 1,
      });

      const wrappedHandler = withValidation(schema, handler);
      const result = await wrappedHandler({ id: '123' });

      expect(result).toEqual({ data: 'Item 123', count: 1 });
    });

    it('should handle async handler errors', async () => {
      const schema = z.object({
        value: z.string(),
      });

      const handler = async () => {
        throw new Error('Handler error');
      };

      const wrappedHandler = withValidation(schema, handler);

      await expect(wrappedHandler({ value: 'test' })).rejects.toThrow(
        'Handler error',
      );
    });

    it('should work with complex schemas', async () => {
      const schema = z.object({
        type: z.enum(['login', 'note', 'card']),
        data: z.object({
          name: z.string(),
          fields: z.array(z.string()).optional(),
        }),
      });

      type SchemaType = z.infer<typeof schema>;
      const mockHandler = jest
        .fn<(args: SchemaType) => Promise<{ created: boolean }>>()
        .mockResolvedValue({ created: true });
      const wrappedHandler = withValidation(schema, mockHandler);

      await wrappedHandler({
        type: 'login',
        data: {
          name: 'My Login',
          fields: ['username', 'password'],
        },
      });

      expect(mockHandler).toHaveBeenCalledWith({
        type: 'login',
        data: {
          name: 'My Login',
          fields: ['username', 'password'],
        },
      });
    });

    it('should work with schema transforms', async () => {
      const schema = z
        .object({
          value: z.string(),
        })
        .transform((data) => ({
          ...data,
          transformed: true as const,
        }));

      type SchemaType = z.infer<typeof schema>;
      const mockHandler = jest
        .fn<(args: SchemaType) => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true });
      const wrappedHandler = withValidation(schema, mockHandler);

      await wrappedHandler({ value: 'test' });

      expect(mockHandler).toHaveBeenCalledWith({
        value: 'test',
        transformed: true,
      });
    });

    it('should work with schema refinements', async () => {
      const schema = z
        .object({
          password: z.string(),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'Passwords do not match',
        });

      type SchemaType = z.infer<typeof schema>;
      const mockHandler = jest
        .fn<(args: SchemaType) => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true });
      const wrappedHandler = withValidation(schema, mockHandler);

      const result = await wrappedHandler({
        password: 'abc',
        confirmPassword: 'xyz',
      });

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        isError: true,
      });
    });

    it('should work with optional fields', async () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      type SchemaType = z.infer<typeof schema>;
      const mockHandler = jest
        .fn<(args: SchemaType) => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true });
      const wrappedHandler = withValidation(schema, mockHandler);

      await wrappedHandler({ required: 'value' });

      expect(mockHandler).toHaveBeenCalledWith({
        required: 'value',
      });
    });

    it('should work with default values', async () => {
      const schema = z.object({
        value: z.string(),
        count: z.number().default(10),
      });

      type SchemaType = z.infer<typeof schema>;
      const mockHandler = jest
        .fn<(args: SchemaType) => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true });
      const wrappedHandler = withValidation(schema, mockHandler);

      await wrappedHandler({ value: 'test' });

      expect(mockHandler).toHaveBeenCalledWith({
        value: 'test',
        count: 10,
      });
    });

    it('should handle empty object schema', async () => {
      const schema = z.object({});

      type SchemaType = z.infer<typeof schema>;
      const mockHandler = jest
        .fn<(args: SchemaType) => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true });
      const wrappedHandler = withValidation(schema, mockHandler);

      await wrappedHandler({});

      expect(mockHandler).toHaveBeenCalledWith({});
    });

    it('should handle undefined input', async () => {
      const schema = z.object({
        optional: z.string().optional(),
      });

      type SchemaType = z.infer<typeof schema>;
      const mockHandler = jest
        .fn<(args: SchemaType) => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true });
      const wrappedHandler = withValidation(schema, mockHandler);

      await wrappedHandler(undefined);

      expect(mockHandler).toHaveBeenCalledWith({});
    });
  });
});
