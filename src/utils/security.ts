/**
 * Security utilities for input sanitization and validation
 */

import fs from 'fs';
import path from 'path';

// Upper bound on symlinks followed while canonicalizing, mirroring the
// kernel's SYMLOOP_MAX so link cycles terminate.
const MAX_SYMLINK_HOPS = 40;

/**
 * Whether a path is a Windows UNC or device path (`\\host\share`, `\\?\...`,
 * `\\.\...`), in either slash spelling. Opening such a path makes Windows
 * contact the named host and send the user's NetNTLM credentials.
 */
function isUncOrDevicePath(filePath: string): boolean {
  return /^[\\/]{2}/.test(filePath);
}

/**
 * Canonicalize a filesystem path by resolving symbolic links.
 *
 * Uses fs.realpathSync.native() when the path resolves. Otherwise each
 * missing component is judged individually: a component that is absent keeps
 * its name (e.g. a not-yet-created download target), while a component that
 * exists as a symlink is replaced by its target, because writing through a
 * dangling link creates the file at the target rather than at the link.
 * Anything else that cannot be resolved throws, so the caller rejects it.
 *
 * `budget` is shared across the whole resolution so the total number of
 * links followed is bounded, as the kernel bounds it per lookup.
 */
function canonicalizePath(
  filePath: string,
  budget = { hops: MAX_SYMLINK_HOPS },
): string {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    // Resolved component by component below.
  }

  const parent = path.dirname(filePath);
  if (parent === filePath) {
    return filePath;
  }

  const linkDir = canonicalizePath(parent, budget);
  const candidate = path.join(linkDir, path.basename(filePath));

  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return candidate;
    }
    throw error;
  }

  if (!stats.isSymbolicLink()) {
    throw new Error('Path exists but could not be resolved');
  }
  if (budget.hops <= 0) {
    throw new Error('Too many levels of symbolic links');
  }
  budget.hops -= 1;

  return resolveLinkTarget(linkDir, fs.readlinkSync(candidate), budget);
}

/**
 * Canonicalize the raw text of a symlink found in the canonical directory
 * `linkDir`.
 *
 * The kernel resolves `..` in a link target physically, against whatever the
 * preceding components resolve to. A lexical join would collapse `sub/..`
 * without following `sub`, so with `sub` a link elsewhere the result would
 * name a different directory than the one a write through the link reaches.
 * Each `..` is therefore applied to the canonical form of the prefix before it.
 */
function resolveLinkTarget(
  linkDir: string,
  target: string,
  budget: { hops: number },
): string {
  if (isUncOrDevicePath(path.resolve(linkDir, target))) {
    throw new Error('Symlink targets a UNC or device path');
  }

  const { root } = path.parse(target);
  if (root !== '' && !path.isAbsolute(target)) {
    // A Windows drive-relative target such as `C:foo`.
    throw new Error('Symlink target is drive-relative');
  }

  const separators = path.sep === '\\' ? /[\\/]+/ : /\/+/;
  let current = root === '' ? linkDir : path.resolve(root);
  for (const part of target.slice(root.length).split(separators)) {
    if (part === '' || part === '.') {
      continue;
    }
    current =
      part === '..'
        ? path.dirname(canonicalizePath(current, budget))
        : path.join(current, part);
  }
  return canonicalizePath(current, budget);
}

/**
 * Whether `candidate` is `dir` itself or lies beneath it. Both arguments must
 * already be absolute and resolved in the same way.
 */
function isWithinDirectory(candidate: string, dir: string): boolean {
  const normalizedDir = dir.endsWith(path.sep) ? dir : dir + path.sep;
  const normalizedCandidate = candidate + path.sep;

  // On Windows, paths are case-insensitive
  if (process.platform === 'win32') {
    return normalizedCandidate
      .toLowerCase()
      .startsWith(normalizedDir.toLowerCase());
  }

  return normalizedCandidate.startsWith(normalizedDir);
}

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
 * - Rejection of UNC and device paths in any slash spelling
 * - Lexical allowlist check before any filesystem call on the path
 * - Path resolution to canonical form (with symlink resolution via realpath,
 *   judging dangling symlinks by their target)
 * - Allowlist-based directory validation
 * - Protection against all known bypass techniques
 *
 * Configuration:
 * Set BW_ALLOWED_DIRECTORIES environment variable to a comma-separated list
 * of allowed directories. If not set (or empty), file operations are
 * rejected — explicit opt-in is required.
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

    // The raw string (not the decoded form) is what reaches the filesystem, and
    // the filesystem does not URL-decode or normalize. If the forms differ, the
    // checks below would validate a different path than the one used, so reject.
    if (normalizedPath !== filePath) {
      return false;
    }

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

    // Step 8: Reject UNC and device paths after lexical resolution. Windows
    // accepts forward slashes as separators, so //host/share, /\host\share and
    // //?/UNC/host/share all resolve to \\host\share. Windows semantics are
    // applied on every platform so the check does not depend on where the
    // server runs, and no filesystem call has been made on the path yet.
    if (isUncOrDevicePath(path.win32.resolve(normalizedPath))) {
      return false;
    }

    // Step 9: Get allowed directories from environment variable
    // Fail closed: if BW_ALLOWED_DIRECTORIES is unset, reject all file operations.
    // Defaulting to a world-writable location (e.g. /tmp on Linux/macOS) would
    // allow other local users or services to stage files for the AI agent to
    // read or send, so explicit opt-in is required.
    const allowedDirsEnv = process.env['BW_ALLOWED_DIRECTORIES'];
    if (!allowedDirsEnv || !allowedDirsEnv.trim()) {
      return false;
    }

    // Allowed directories are canonicalized too, so that a symlinked allow-list
    // entry (e.g. /tmp on macOS -> /private/tmp) compares consistently with
    // candidates that have been canonicalized through the symlink.
    const allowedDirectories = allowedDirsEnv
      .split(',')
      .map((dir) => dir.trim())
      .filter((dir) => dir.length > 0)
      .map((dir) => {
        const lexical = path.resolve(dir);
        return { lexical, canonical: canonicalizePath(lexical) };
      });

    if (allowedDirectories.length === 0) {
      return false;
    }

    // Step 10: The candidate must lie lexically under an allowed directory,
    // spelled either as configured or in its canonical form, before any
    // filesystem call is made on it.
    const lexicalPath = path.resolve(normalizedPath);
    const isLexicallyAllowed = allowedDirectories.some(
      ({ lexical, canonical }) =>
        isWithinDirectory(lexicalPath, lexical) ||
        isWithinDirectory(lexicalPath, canonical),
    );
    if (!isLexicallyAllowed) {
      return false;
    }

    // Step 11: Resolve symlinks and verify the canonical path is still under
    // a canonical allowed directory. Lexical resolution alone does not follow
    // symlinks, so a link inside an allowed directory could otherwise point
    // outside it.
    const resolvedPath = canonicalizePath(lexicalPath);
    return allowedDirectories.some(({ canonical }) =>
      isWithinDirectory(resolvedPath, canonical),
    );
  } catch {
    // Any error in validation should result in rejection
    return false;
  }
}
