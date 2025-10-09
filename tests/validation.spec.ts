import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { validateInput } from '../src/utils/validation.js';

describe('Validation', () => {
  describe('validateInput function', () => {
    it('should validate correct input', () => {
      const schema = z.object({
        name: z.string(),
      });

      const [isValid, result] = validateInput(schema, { name: 'test' });

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result.name).toBe('test');
      }
    });

    it('should return error for invalid input', () => {
      const schema = z.object({
        name: z.string(),
      });

      const [isValid, result] = validateInput(schema, { name: 123 });

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.isError).toBe(true);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should handle empty input gracefully', () => {
      const schema = z.object({
        optional: z.string().optional(),
      });

      const [isValid, result] = validateInput(schema, {});

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual({});
      }
    });

    it('should validate list schema', () => {
      const listSchema = z.object({
        type: z.enum(['items', 'folders', 'collections', 'organizations']),
        search: z.string().optional(),
      });

      const [isValid, result] = validateInput(listSchema, {
        type: 'items',
        search: 'test',
      });

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result.type).toBe('items');
        expect(result.search).toBe('test');
      }
    });

    it('should reject invalid list type', () => {
      const listSchema = z.object({
        type: z.enum(['items', 'folders', 'collections', 'organizations']),
      });

      const [isValid, result] = validateInput(listSchema, {
        type: 'invalid',
      });

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should validate create schema for secure note', () => {
      const createSchema = z.object({
        name: z.string().min(1, 'Name is required'),
        type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        notes: z.string().optional(),
      });

      const [isValid, result] = validateInput(createSchema, {
        name: 'Test Note',
        type: 2,
        notes: 'This is a test note',
      });

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result.name).toBe('Test Note');
        expect(result.type).toBe(2);
        expect(result.notes).toBe('This is a test note');
      }
    });

    it('should reject create schema with invalid type', () => {
      const createSchema = z.object({
        name: z.string().min(1, 'Name is required'),
        type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      });

      const [isValid, result] = validateInput(createSchema, {
        name: 'Test',
        type: 99,
      });

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });

    it('should validate restore schema with valid input', () => {
      const restoreSchema = z.object({
        object: z.enum(['item']),
        id: z.string().min(1, 'Object ID is required'),
      });

      const [isValid, result] = validateInput(restoreSchema, {
        object: 'item',
        id: 'abc123',
      });

      expect(isValid).toBe(true);
      if (isValid) {
        expect(result.object).toBe('item');
        expect(result.id).toBe('abc123');
      }
    });

    it('should reject restore schema with empty id', () => {
      const restoreSchema = z.object({
        object: z.enum(['item']),
        id: z.string().min(1, 'Object ID is required'),
      });

      const [isValid, result] = validateInput(restoreSchema, {
        object: 'item',
        id: '',
      });

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Object ID is required');
      }
    });

    it('should reject restore schema with invalid object type', () => {
      const restoreSchema = z.object({
        object: z.enum(['item']),
        id: z.string().min(1, 'Object ID is required'),
      });

      const [isValid, result] = validateInput(restoreSchema, {
        object: 'folder',
        id: 'abc123',
      });

      expect(isValid).toBe(false);
      if (!isValid) {
        expect(result.content[0].text).toContain('Validation error');
      }
    });
  });
});
