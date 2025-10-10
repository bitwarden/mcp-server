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
 * Validates a parameter to ensure it doesn't contain dangerous patterns
 * Used as an additional safety check before passing to spawn()
 */
export function validateParameter(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  // Reject parameters with null bytes
  if (value.includes('\0')) {
    return false;
  }

  // Reject parameters with newlines/carriage returns
  if (/[\r\n]/.test(value)) {
    return false;
  }

  return true;
}

/**
 * Builds a safe Bitwarden CLI command array for use with spawn()
 * Returns an array of [baseCommand, ...parameters] for safe execution
 */
export function buildSafeCommand(
  baseCommand: string,
  parameters: readonly string[] = [],
): readonly [string, ...string[]] {
  const sanitizedBase = sanitizeInput(baseCommand);

  // Validate all parameters
  for (const param of parameters) {
    if (!validateParameter(param)) {
      throw new Error(`Invalid parameter detected: ${param}`);
    }
  }

  return [sanitizedBase, ...parameters] as const;
}

/**
 * Validates that a command is safe and contains only allowed Bitwarden CLI commands
 */
export function isValidBitwardenCommand(command: string): boolean {
  const allowedCommands = [
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
    'send',
    'restore',
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
    // Collections API
    /^\/public\/collections$/, // GET (list), POST (not supported)
    /^\/public\/collections\/[a-f0-9-]{36}$/, // GET, PUT, DELETE

    // Members API
    /^\/public\/members$/, // GET (list), POST (invite)
    /^\/public\/members\/[a-f0-9-]{36}$/, // GET, PUT, DELETE
    /^\/public\/members\/[a-f0-9-]{36}\/group-ids$/, // GET (member's group IDs)
    /^\/public\/members\/[a-f0-9-]{36}\/reinvite$/, // POST (reinvite member)

    // Groups API
    /^\/public\/groups$/, // GET (list), POST (create)
    /^\/public\/groups\/[a-f0-9-]{36}$/, // GET, PUT, DELETE
    /^\/public\/groups\/[a-f0-9-]{36}\/member-ids$/, // GET, PUT (group members)

    // Policies API
    /^\/public\/policies$/, // GET (list)
    /^\/public\/policies\/\d+$/, // GET, PUT (policy by type integer 0-15)

    // Events API
    /^\/public\/events$/, // GET (list events)
    /^\/public\/events\?.*$/, // GET with query parameters

    // Organization Billing API
    /^\/public\/organization\/subscription$/, // GET, PUT (organization subscription)
    // Organization Import API
    /^\/public\/organization\/import$/, // POST (import members and groups)
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

/**
 * Validates file paths to prevent path traversal attacks
 * Checks for common path traversal patterns and suspicious characters
 */
export function validateFilePath(filePath: string): boolean {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return false;
  }

  // Reject paths with null bytes
  if (filePath.includes('\0')) {
    return false;
  }

  // Reject paths with path traversal sequences
  const dangerousPatterns = [
    /\.\.\//, // ../
    /\.\.\\/, // ..\
    /\.\.$/, // .. at end
    /^\.\.$/, // exactly ..
    /\/\.\./, // /..
    /\\\.\./, // \..
  ];

  if (dangerousPatterns.some((pattern) => pattern.test(filePath))) {
    return false;
  }

  // Reject UNC paths (network shares like \\server\share)
  // Allow both Unix absolute paths (/path/to/file) and Windows absolute paths (C:\path\to\file)
  if (filePath.startsWith('\\\\')) {
    return false;
  }

  return true;
}
