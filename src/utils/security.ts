/**
 * Security utilities for input sanitization and validation
 */

/**
 * Sanitizes a string to prevent command injection by removing dangerous characters
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string');
  }

  return (
    input
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove command separators and operators
      .replace(/[;&|`$(){}[\]<>'"]/g, '')
      // Remove escape sequences and control characters
      .replace(/\\./g, '')
      // Remove newlines and carriage returns
      .replace(/[\r\n]/g, '')
      // Remove tab characters
      .replace(/\t/g, ' ')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      // Trim whitespace
      .trim()
  );
}

/**
 * Safely escapes a parameter value for use in shell commands
 */
export function escapeShellParameter(value: string): string {
  if (typeof value !== 'string') {
    throw new TypeError('Parameter must be a string');
  }

  // Replace single quotes with '\'' (end quote, escaped quote, start quote)
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Builds a safe Bitwarden CLI command with properly escaped parameters
 */
export function buildSafeCommand(
  baseCommand: string,
  parameters: readonly string[] = [],
): string {
  const sanitizedBase = sanitizeInput(baseCommand);
  const escapedParams = parameters.map((param) => escapeShellParameter(param));

  return [sanitizedBase, ...escapedParams].join(' ');
}

/**
 * Validates that a command is safe and contains only allowed Bitwarden CLI commands
 */
export function isValidBitwardenCommand(command: string): boolean {
  const allowedCommands = [
    'lock',
    'unlock',
    'sync',
    'status',
    'list',
    'get',
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
  ] as const;

  const parts = command.trim().split(/\s+/);

  if (parts.length === 0) {
    return false;
  }

  const baseCommand = parts[0];
  return allowedCommands.includes(
    baseCommand as (typeof allowedCommands)[number],
  );
}

/**
 * Validates that an API endpoint path is safe and matches allowed patterns
 */
export function validateApiEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== 'string') {
    return false;
  }

  // Allowed API endpoint patterns for Bitwarden Public API
  const allowedPatterns = [
    /^\/public\/collections$/,
    /^\/public\/collections\/[a-f0-9-]{36}$/,
    /^\/public\/members$/,
    /^\/public\/members\/[a-f0-9-]{36}$/,
    /^\/public\/members\/[a-f0-9-]{36}\/group-ids$/,
    /^\/public\/members\/[a-f0-9-]{36}\/reinvite$/,
    /^\/public\/groups$/,
    /^\/public\/groups\/[a-f0-9-]{36}$/,
    /^\/public\/groups\/[a-f0-9-]{36}\/member-ids$/,
    /^\/public\/policies$/,
    /^\/public\/policies\/[0-9]+$/,
    /^\/public\/events$/,
    /^\/public\/events\?.*$/,
    /^\/public\/organization$/,
    /^\/public\/organization\/billing$/,
    /^\/public\/organization\/subscription$/,
    /^\/public\/organization\/import$/,
  ] as const;

  return allowedPatterns.some((pattern) => pattern.test(endpoint));
}

/**
 * Sanitizes API parameters to prevent injection attacks
 */
export function sanitizeApiParameters(params: unknown): unknown {
  if (params === null || params === undefined) {
    return params;
  }

  if (typeof params === 'string') {
    // Remove potentially dangerous characters from strings
    return params.replace(/[<>"'&]/g, '');
  }

  if (Array.isArray(params)) {
    return params.map(sanitizeApiParameters);
  }

  if (typeof params === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      // Sanitize both keys and values
      const sanitizedKey = key.replace(/[<>"'&]/g, '');
      sanitized[sanitizedKey] = sanitizeApiParameters(value);
    }
    return sanitized;
  }

  return params;
}
