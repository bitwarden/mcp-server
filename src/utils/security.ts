/**
 * Security utilities for input sanitization and validation
 */

import path from 'path';
import os from 'os';

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
    /^\/public\/members\/[a-f0-9-]{36}\/revoke$/, // POST (revoke member)
    /^\/public\/members\/[a-f0-9-]{36}\/restore$/, // POST (restore member)

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
 * Uses allowlist-based validation with comprehensive security checks
 *
 * Security measures:
 * - URL decoding (iterative to handle double encoding)
 * - Unicode normalization (NFC form)
 * - Path resolution to canonical form
 * - Allowlist-based directory validation
 * - Protection against all known bypass techniques
 *
 * Configuration:
 * Set BW_ALLOWED_DIRECTORIES environment variable to a comma-separated list
 * of allowed directories. If not set, defaults to system temp directory.
 *
 * Example: BW_ALLOWED_DIRECTORIES=/tmp/bitwarden,/home/user/downloads
 */
export function validateFilePath(filePath: string): boolean {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return false;
  }

  try {
    // Step 1: Reject null bytes immediately
    if (filePath.includes('\0')) {
      return false;
    }

    // Step 2: Reject URL protocols (file://, http://, etc.)
    // But allow Windows drive letters (C:, D:, etc.) which are single letters
    if (
      /^[a-zA-Z][a-zA-Z0-9+.-]+:/.test(filePath) &&
      !/^[a-zA-Z]:[\\/]/.test(filePath)
    ) {
      return false;
    }

    // Step 3: Reject UNC paths (both \\ and single \ at start on Windows)
    if (filePath.startsWith('\\\\') || /^\\[^\\]/.test(filePath)) {
      return false;
    }

    // Step 4: Iterative URL decoding to handle double/triple encoding
    let decodedPath = filePath;
    let previousPath = '';
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops

    while (decodedPath !== previousPath && iterations < maxIterations) {
      previousPath = decodedPath;
      try {
        decodedPath = decodeURIComponent(decodedPath);
      } catch {
        // Invalid encoding, reject
        return false;
      }
      iterations++;
    }

    // Step 5: Unicode normalization to canonical form (NFC)
    // This converts fullwidth characters and other Unicode variants to standard form
    const normalizedPath = decodedPath.normalize('NFC');

    // Step 6: Check for dangerous patterns after decoding/normalization
    // This catches encoded traversal sequences like %2e%2e%2f
    const dangerousPatterns = [
      /\.\.\//, // ../
      /\.\.\\/, // ..\
      /\.\.$/, // .. at end
      /^\.\.$/, // exactly ..
      /\/\.\./, // /..
      /\\\.\./, // \..
      /\.\s+\./, // . . (spaces between dots)
    ];

    if (dangerousPatterns.some((pattern) => pattern.test(normalizedPath))) {
      return false;
    }

    // Step 7: Check for Unicode lookalikes and alternative slashes
    // Reject fullwidth characters and alternative slash characters
    const unicodeLookalikes = [
      '\uFF0E', // FULLWIDTH FULL STOP (．)
      '\u2215', // DIVISION SLASH (∕)
      '\u2216', // SET MINUS (∖)
      '\u2044', // FRACTION SLASH (⁄)
      '\u29F8', // BIG SOLIDUS (⧸)
      '\uFF0F', // FULLWIDTH SOLIDUS (／)
      '\uFF3C', // FULLWIDTH REVERSE SOLIDUS (＼)
    ];

    if (unicodeLookalikes.some((char) => normalizedPath.includes(char))) {
      return false;
    }

    // Step 8: Resolve to absolute canonical path
    const resolvedPath = path.resolve(normalizedPath);

    // Step 9: Get allowed directories from environment variable
    const allowedDirsEnv = process.env['BW_ALLOWED_DIRECTORIES'];

    let allowedDirectories: string[];
    if (allowedDirsEnv && allowedDirsEnv.trim()) {
      // Parse comma-separated list and resolve each to absolute path
      allowedDirectories = allowedDirsEnv
        .split(',')
        .map((dir) => dir.trim())
        .filter((dir) => dir.length > 0)
        .map((dir) => path.resolve(dir));
    } else {
      // Default to system temp directory if no whitelist configured
      const defaultDir = path.join(os.tmpdir(), 'bitwarden-files');
      allowedDirectories = [defaultDir];
    }

    // Step 10: Verify resolved path starts with one of the allowed directories
    const isAllowed = allowedDirectories.some((allowedDir) => {
      // Ensure both paths end with separator for accurate comparison
      const normalizedAllowedDir = allowedDir.endsWith(path.sep)
        ? allowedDir
        : allowedDir + path.sep;
      const normalizedResolvedPath = resolvedPath + path.sep;

      // On Windows, paths are case-insensitive
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        return normalizedResolvedPath
          .toLowerCase()
          .startsWith(normalizedAllowedDir.toLowerCase());
      }

      return normalizedResolvedPath.startsWith(normalizedAllowedDir);
    });

    return isAllowed;
  } catch {
    // Any error in validation should result in rejection
    return false;
  }
}
