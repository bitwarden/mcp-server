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
});
