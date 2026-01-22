import { describe, it, expect } from '@jest/globals';
import {
  buildSafeCommand,
  isValidBitwardenCommand,
  sanitizeInput,
  validateParameter,
} from '../../src/utils/security.js';

describe('CLI Utilities - Security Layer', () => {
  describe('sanitizeInput', () => {
    it('should remove semicolons', () => {
      expect(sanitizeInput('test;rm')).toBe('testrm');
    });

    it('should remove ampersands', () => {
      expect(sanitizeInput('test&rm')).toBe('testrm');
    });

    it('should remove pipes', () => {
      expect(sanitizeInput('test|cat')).toBe('testcat');
    });

    it('should remove backticks', () => {
      expect(sanitizeInput('test`whoami`')).toBe('testwhoami');
    });

    it('should remove dollar signs', () => {
      expect(sanitizeInput('test$HOME')).toBe('testHOME');
    });

    it('should remove parentheses', () => {
      expect(sanitizeInput('test()')).toBe('test');
    });

    it('should remove curly braces', () => {
      expect(sanitizeInput('test{}')).toBe('test');
    });

    it('should remove square brackets', () => {
      expect(sanitizeInput('test[]')).toBe('test');
    });

    it('should remove angle brackets', () => {
      expect(sanitizeInput('test<>')).toBe('test');
    });

    it('should remove quotes', () => {
      expect(sanitizeInput('test\'value"')).toBe('testvalue');
    });

    it('should remove escape sequences (backslash + next char)', () => {
      // The regex \\. removes backslash and the following character
      expect(sanitizeInput('test\\n')).toBe('test');
      expect(sanitizeInput('test\\x')).toBe('test');
    });

    it('should handle multiple dangerous characters', () => {
      // Removes dangerous chars, collapses spaces, and trims
      expect(sanitizeInput('; rm -rf / && cat /etc/passwd')).toBe(
        'rm -rf / cat /etc/passwd',
      );
    });

    it('should preserve safe alphanumeric characters', () => {
      expect(sanitizeInput('abc123')).toBe('abc123');
    });

    it('should preserve hyphens and underscores', () => {
      expect(sanitizeInput('test-value_name')).toBe('test-value_name');
    });

    it('should preserve dots and spaces', () => {
      expect(sanitizeInput('test.value name')).toBe('test.value name');
    });
  });

  describe('validateParameter', () => {
    it('should accept normal strings', () => {
      expect(validateParameter('test-value')).toBe(true);
    });

    it('should accept strings with special characters (except null bytes and newlines)', () => {
      // These are passed as array elements to spawn(), so they're safe
      expect(validateParameter('; rm -rf /')).toBe(true);
    });

    it('should reject null bytes', () => {
      expect(validateParameter('test\0value')).toBe(false);
    });

    it('should reject newline characters', () => {
      expect(validateParameter('test\nvalue')).toBe(false);
    });

    it('should reject carriage return characters', () => {
      expect(validateParameter('test\rvalue')).toBe(false);
    });

    it('should accept empty strings', () => {
      expect(validateParameter('')).toBe(true);
    });

    it('should accept UUIDs', () => {
      expect(validateParameter('12345678-1234-4234-8234-123456789012')).toBe(
        true,
      );
    });

    it('should accept base64 encoded data', () => {
      const base64 = Buffer.from('{"name":"test"}').toString('base64');
      expect(validateParameter(base64)).toBe(true);
    });
  });

  describe('isValidBitwardenCommand', () => {
    it('should accept "lock" command', () => {
      expect(isValidBitwardenCommand('lock')).toBe(true);
    });

    it('should accept "login" command', () => {
      expect(isValidBitwardenCommand('login')).toBe(true);
    });

    it('should accept "logout" command', () => {
      expect(isValidBitwardenCommand('logout')).toBe(true);
    });

    it('should accept "sync" command', () => {
      expect(isValidBitwardenCommand('sync')).toBe(true);
    });

    it('should accept "status" command', () => {
      expect(isValidBitwardenCommand('status')).toBe(true);
    });

    it('should accept "list" command', () => {
      expect(isValidBitwardenCommand('list')).toBe(true);
    });

    it('should accept "get" command', () => {
      expect(isValidBitwardenCommand('get')).toBe(true);
    });

    it('should accept "create" command', () => {
      expect(isValidBitwardenCommand('create')).toBe(true);
    });

    it('should accept "edit" command', () => {
      expect(isValidBitwardenCommand('edit')).toBe(true);
    });

    it('should accept "delete" command', () => {
      expect(isValidBitwardenCommand('delete')).toBe(true);
    });

    it('should accept "generate" command', () => {
      expect(isValidBitwardenCommand('generate')).toBe(true);
    });

    it('should accept "confirm" command', () => {
      expect(isValidBitwardenCommand('confirm')).toBe(true);
    });

    it('should accept "move" command', () => {
      expect(isValidBitwardenCommand('move')).toBe(true);
    });

    it('should accept "device-approval" command', () => {
      expect(isValidBitwardenCommand('device-approval')).toBe(true);
    });

    it('should accept "restore" command', () => {
      expect(isValidBitwardenCommand('restore')).toBe(true);
    });

    it('should accept "send" command', () => {
      expect(isValidBitwardenCommand('send')).toBe(true);
    });

    it('should reject "rm" command', () => {
      expect(isValidBitwardenCommand('rm')).toBe(false);
    });

    it('should reject "cat" command', () => {
      expect(isValidBitwardenCommand('cat')).toBe(false);
    });

    it('should reject "exec" command', () => {
      expect(isValidBitwardenCommand('exec')).toBe(false);
    });

    it('should reject "bash" command', () => {
      expect(isValidBitwardenCommand('bash')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidBitwardenCommand('')).toBe(false);
    });

    it('should reject case variations', () => {
      // Assuming case-sensitive validation
      expect(isValidBitwardenCommand('LIST')).toBe(false);
      expect(isValidBitwardenCommand('List')).toBe(false);
    });
  });

  describe('buildSafeCommand', () => {
    it('should return command and args array', () => {
      const result = buildSafeCommand('list', ['items']);
      expect(result).toEqual(['list', 'items']);
    });

    it('should sanitize the base command', () => {
      const result = buildSafeCommand('list;rm', []);
      // Dangerous characters removed from base command
      expect(result[0]).toBe('listrm');
    });

    it('should handle multiple parameters', () => {
      const result = buildSafeCommand('list', ['items', '--search', 'test']);
      expect(result).toEqual(['list', 'items', '--search', 'test']);
    });

    it('should handle empty parameters array', () => {
      const result = buildSafeCommand('sync', []);
      expect(result).toEqual(['sync']);
    });

    it('should throw on parameters with null bytes', () => {
      expect(() => {
        buildSafeCommand('get', ['item', 'test\0id']);
      }).toThrow('Invalid parameter detected');
    });

    it('should throw on parameters with newlines', () => {
      expect(() => {
        buildSafeCommand('get', ['item', 'test\nid']);
      }).toThrow('Invalid parameter detected');
    });

    it('should preserve special characters in parameters as literals', () => {
      // These characters are safe when passed as array elements to spawn()
      const result = buildSafeCommand('get', ['item', '; rm -rf /']);
      expect(result).toEqual(['get', 'item', '; rm -rf /']);
    });

    it('should handle base64 encoded JSON', () => {
      const encoded = Buffer.from('{"name":"test"}').toString('base64');
      const result = buildSafeCommand('create', ['item', encoded]);
      expect(result).toEqual(['create', 'item', encoded]);
    });

    it('should handle flags with values', () => {
      const result = buildSafeCommand('list', [
        'items',
        '--folderid',
        'null',
        '--search',
        'my item',
      ]);
      expect(result).toEqual([
        'list',
        'items',
        '--folderid',
        'null',
        '--search',
        'my item',
      ]);
    });

    it('should handle boolean flags', () => {
      const result = buildSafeCommand('delete', [
        'item',
        'id123',
        '--permanent',
      ]);
      expect(result).toEqual(['delete', 'item', 'id123', '--permanent']);
    });
  });
});

describe('CLI Command Security Integration', () => {
  it('should sanitize dangerous characters from base command', () => {
    // Dangerous characters are removed from base command
    const result = buildSafeCommand('list; rm -rf /', []);
    // Semicolon removed, spaces collapsed, result trimmed
    expect(result[0]).toBe('list rm -rf /');
    // Note: isValidBitwardenCommand checks first word after splitting on spaces,
    // so 'list rm -rf /' still has 'list' as valid first word.
    // The security comes from executeCliCommand which validates BEFORE execution.
  });

  it('should reject completely invalid commands', () => {
    const sanitized = sanitizeInput('rm;echo');
    // 'rmecho' is not a valid Bitwarden command
    expect(isValidBitwardenCommand(sanitized)).toBe(false);
  });

  it('should allow special characters in parameters (spawn handles them safely)', () => {
    // Parameters with shell metacharacters are safe because:
    // 1. spawn() is called with shell: false
    // 2. Arguments are passed as array elements, not string interpolation
    const result = buildSafeCommand('get', ['item', '$(whoami)']);
    expect(result).toEqual(['get', 'item', '$(whoami)']);
    // The command is valid, and $(whoami) is just a literal string
    expect(isValidBitwardenCommand('get')).toBe(true);
  });

  it('should block null byte injection in parameters', () => {
    // Null bytes could be used to truncate strings in some contexts
    expect(() => {
      buildSafeCommand('get', ['item\0', 'malicious']);
    }).toThrow('Invalid parameter detected');
  });

  it('should block newline injection in parameters', () => {
    // Newlines could be used for log injection or argument manipulation
    expect(() => {
      buildSafeCommand('list', ['items\n--dangerous-flag']);
    }).toThrow('Invalid parameter detected');
  });

  it('should require valid Bitwarden command after sanitization', () => {
    // Test the full validation pipeline
    const sanitized = sanitizeInput('exec');
    const isValid = isValidBitwardenCommand(sanitized);
    expect(isValid).toBe(false);
  });
});
