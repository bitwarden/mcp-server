/**
 * Bitwarden Secrets Manager CLI (`bws`) execution utilities
 */

import { spawn } from 'child_process';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { buildBwChildEnv } from './bw-env.js';
import type { CliResponse } from './types.js';

/**
 * Indirection so tests can stub process creation without mocking the
 * `child_process` module. Production code MUST use `__testable.spawn(...)`.
 *
 * @internal
 */
export const __testable: { spawn: typeof spawn } = { spawn };

const SM_NOUNS = ['project', 'secret'] as const;
const SM_VERBS = ['list', 'get', 'create', 'edit', 'delete'] as const;

export type SmNoun = (typeof SM_NOUNS)[number];
export type SmVerb = (typeof SM_VERBS)[number];

export const MISSING_ACCESS_TOKEN_ERROR =
  'BWS_ACCESS_TOKEN is not set. The Secrets Manager tools need the access token of a machine account.';

/**
 * Validates a `bws` command against the allowlist of supported commands
 */
export function isValidSmCommand(noun: string, verb: string): boolean {
  return (
    (SM_NOUNS as readonly string[]).includes(noun) &&
    (SM_VERBS as readonly string[]).includes(verb)
  );
}

/**
 * Validates a `bws` parameter. Unlike `validateParameter`, newlines are
 * accepted: `bws` is a native executable spawned without a shell on every
 * platform (there is no npm shim), so they reach it literally, and
 * multi-line secret values such as PEM keys need them.
 */
export function validateSmParameter(value: string): boolean {
  return typeof value === 'string' && !value.includes('\0');
}

/**
 * Executes a Bitwarden Secrets Manager CLI command with spawn() and no shell.
 *
 * Options go before a `--` separator and positionals after it, so a value
 * that starts with `-` is never read as an option. Options that carry a
 * user-provided value must use the `--name=value` form for the same reason.
 *
 * Success is decided by the exit code alone: `bws` may write warnings to
 * stderr on success.
 */
export async function executeSmCommand(
  noun: SmNoun,
  verb: SmVerb,
  options: readonly string[] = [],
  positionals: readonly string[] = [],
): Promise<CliResponse> {
  if (!isValidSmCommand(noun, verb)) {
    return { errorOutput: 'Invalid or unsafe Secrets Manager command.' };
  }

  const accessToken = process.env['BWS_ACCESS_TOKEN'];
  if (!accessToken) {
    return { errorOutput: MISSING_ACCESS_TOKEN_ERROR };
  }

  for (const param of [...options, ...positionals]) {
    if (!validateSmParameter(param)) {
      return { errorOutput: 'Invalid parameter detected.' };
    }
  }

  // Only the access token (and the server URL, when set) is added to the
  // filtered env: `bws` must not inherit BW_SESSION or the API client
  // credentials.
  const serverUrl = process.env['BWS_SERVER_URL'];
  const env = buildBwChildEnv({
    BWS_ACCESS_TOKEN: accessToken,
    ...(serverUrl ? { BWS_SERVER_URL: serverUrl } : {}),
  });

  const bwsExecutable = process.env['BWS_CLI_PATH']?.trim() || 'bws';
  const args = [
    noun,
    verb,
    ...options,
    '--output',
    'json',
    '--color',
    'no',
    ...(positionals.length > 0 ? ['--', ...positionals] : []),
  ];

  return new Promise<CliResponse>((resolve) => {
    const child = __testable.spawn(bwsExecutable, args, {
      env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error: Error) => {
      resolve({ errorOutput: `Failed to execute bws: ${error.message}` });
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ output: stdout.trim() });
        return;
      }
      resolve({
        errorOutput: stderr.trim() || `bws exited with code ${code}`,
      });
    });
  });
}

// Shape of a secret in `bws` JSON output. Only the fields the handlers read
// are checked; the rest pass through.
const smSecretOutputSchema = z.looseObject({
  id: z.string(),
  key: z.string(),
  value: z.string(),
});

export type SmSecretOutput = z.infer<typeof smSecretOutputSchema>;

/**
 * Parses the JSON output of `bws secret list`. Returns undefined when the
 * output does not have the expected shape.
 */
export function parseSmSecretList(
  output: string | undefined,
): SmSecretOutput[] | undefined {
  try {
    const result = z
      .array(smSecretOutputSchema)
      .safeParse(JSON.parse(output ?? ''));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

const UNPARSABLE_OUTPUT_MESSAGE =
  'The operation completed, but the bws output could not be parsed, so it is not shown: it may contain secret values.';

/**
 * Removes the `value` field from the secrets in a `bws` JSON output, so the
 * result can be returned to the client without exposing secret values.
 */
export function redactSecretValues(output: string | undefined): string {
  const redact = (entry: unknown): unknown => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const copy = { ...(entry as Record<string, unknown>) };
      delete copy['value'];
      return copy;
    }
    return entry;
  };

  try {
    const parsed: unknown = JSON.parse(output ?? '');
    const redacted = Array.isArray(parsed)
      ? parsed.map(redact)
      : redact(parsed);
    return JSON.stringify(redacted, null, 2);
  } catch {
    return UNPARSABLE_OUTPUT_MESSAGE;
  }
}

export interface SecretGenerationOptions {
  readonly length?: number | undefined;
  readonly uppercase?: boolean | undefined;
  readonly lowercase?: boolean | undefined;
  readonly number?: boolean | undefined;
  readonly special?: boolean | undefined;
}

const CHARACTER_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  number: '0123456789',
  special: '!@#$%^&*',
} as const;

const DEFAULT_SECRET_LENGTH = 32;

/**
 * Generates a random secret value with a CSPRNG. Every character set is
 * included unless disabled, and the value has at least one character of
 * each included set.
 */
export function generateSecretValue(
  options: SecretGenerationOptions = {},
): string {
  const length = options.length ?? DEFAULT_SECRET_LENGTH;
  const sets = (Object.keys(CHARACTER_SETS) as (keyof typeof CHARACTER_SETS)[])
    .filter((name) => options[name] !== false)
    .map((name) => CHARACTER_SETS[name]);

  if (sets.length === 0) {
    throw new Error('At least one character set must be enabled.');
  }
  if (length < sets.length) {
    throw new Error(
      'The length must be at least the number of enabled character sets.',
    );
  }

  const pick = (chars: string): string => chars[randomInt(chars.length)]!;
  const all = sets.join('');
  const chars = sets.map(pick);
  while (chars.length < length) {
    chars.push(pick(all));
  }

  // Fisher-Yates shuffle, so the guaranteed characters are not at the start.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
