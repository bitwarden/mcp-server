/**
 * CLI command execution utilities
 */

import { spawn } from 'child_process';
import { resolveBwInvocation } from './bw-cli.js';
import { buildBwChildEnv } from './bw-env.js';
import { buildSafeCommand, isValidBitwardenCommand } from './security.js';
import type { CliResponse } from './types.js';

/** Default lifetime bound for a bw child. */
const DEFAULT_TIMEOUT_MS = 120_000;
/** Longer bound for subcommands that transfer data. */
const LONG_TIMEOUT_MS = 300_000;
const LONG_RUNNING_COMMANDS: ReadonlySet<string> = new Set([
  'sync',
  'export',
  'import',
  'create',
  'get',
  'send',
]);
/** Grace between SIGTERM and SIGKILL when the bound expires. */
const KILL_GRACE_MS = 2_000;

const overrides: {
  timeoutMs?: number | undefined;
  killGraceMs?: number | undefined;
} = {};

/** Test-only hooks to shorten the lifetime bound. */
export const __testable = {
  setTimeoutMs(ms: number | undefined): void {
    overrides.timeoutMs = ms;
  },
  setKillGraceMs(ms: number | undefined): void {
    overrides.killGraceMs = ms;
  },
};

function lifetimeBoundMs(command: string): number {
  return (
    overrides.timeoutMs ??
    (LONG_RUNNING_COMMANDS.has(command) ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)
  );
}

/**
 * Executes a Bitwarden CLI command safely using spawn() to prevent command injection
 * Internally calls buildSafeCommand() to validate and sanitize inputs
 * @param baseCommand - The base Bitwarden command (e.g., 'list', 'get', 'create')
 * @param parameters - Array of command parameters (will be validated)
 * @returns Promise resolving to CLI response with output or error
 */
export async function executeCliCommand(
  baseCommand: string,
  parameters: readonly string[] = [],
): Promise<CliResponse> {
  try {
    // Build safe command array (validates and sanitizes inputs)
    const [command, ...args] = buildSafeCommand(baseCommand, parameters);

    // Validate the base command against allowlist
    if (!isValidBitwardenCommand(command)) {
      return {
        errorOutput:
          'Invalid or unsafe command. Only Bitwarden CLI commands are allowed.',
      } as const;
    }

    // Build a filtered child env. `bw` only needs PATH/HOME/APPDATA-style
    // vars plus BW_SESSION when set — it must not inherit the API client
    // credentials or any other host env the operator set on the MCP
    // server process. See bw-env.ts for the full rationale.
    // BW_NOINTERACTION makes a locked vault fail fast instead of prompting.
    const childEnv = buildBwChildEnv({
      BW_NOINTERACTION: 'true',
      ...(process.env['BW_SESSION']
        ? { BW_SESSION: process.env['BW_SESSION'] }
        : {}),
    });

    // Resolve how to invoke `bw` (handles the Windows npm-shim case where
    // a bare `bw` is not directly spawnable). See bw-cli.ts.
    const { command: bwExecutable, prefixArgs } = resolveBwInvocation();

    // Use spawn with array of arguments to avoid shell interpretation
    return new Promise<CliResponse>((resolve) => {
      const child = spawn(bwExecutable, [...prefixArgs, command, ...args], {
        env: childEnv,
        shell: false, // Explicitly disable shell to prevent injection
        stdio: ['ignore', 'pipe', 'pipe'], // stdin closed at spawn
      });

      let settled = false;
      const finish = (response: CliResponse): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(response);
      };

      const boundMs = lifetimeBoundMs(command);
      let timedOut = false;
      let killTimer: NodeJS.Timeout | undefined;
      const timer = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        child.kill('SIGTERM');
        killTimer = setTimeout(() => {
          child.kill('SIGKILL');
        }, overrides.killGraceMs ?? KILL_GRACE_MS);
      }, boundMs);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        finish({
          errorOutput: `Failed to execute command: ${error.message}`,
        });
      });

      child.on('close', (code: number) => {
        clearTimeout(killTimer);
        if (timedOut) {
          finish({
            errorOutput: `bw ${command} timed out after ${boundMs / 1000}s and was terminated`,
          });
          return;
        }
        const result: CliResponse = {};
        if (stdout) result.output = stdout.trim();
        if (stderr || code !== 0)
          result.errorOutput =
            stderr.trim() || `Command exited with code ${code}`;
        finish(result);
      });
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      errorOutput: errorMessage,
    } as const;
  }
}
