/**
 * CLI command execution utilities
 */

import { spawn } from 'child_process';
import { buildSafeCommand, isValidBitwardenCommand } from './security.js';
import type { CliResponse } from './types.js';

/**
 * Checks whether the vault is unlocked before running a vault-dependent
 * command. Calling `bw status` is fast and always succeeds regardless of
 * vault state, so we use it as a pre-flight check to fail immediately with
 * a clear, actionable message rather than letting the actual command time-out
 * or return a cryptic CLI error.
 *
 * Returns null when the vault is unlocked and safe to proceed.
 * Returns a CliResponse with errorOutput when the vault is locked or the
 * user is not authenticated.
 */
export async function ensureVaultUnlocked(): Promise<CliResponse | null> {
  const statusResponse = await executeCliCommand('status', []);
  if (!statusResponse.output) {
    // Cannot determine status — proceed and let the real command surface the error.
    return null;
  }
  try {
    const { status } = JSON.parse(statusResponse.output) as { status: string };
    if (status === 'locked') {
      return {
        errorOutput:
          'Vault is locked. Call the "unlock" tool with your master password to unlock it, then retry.',
      };
    }
    if (status === 'unauthenticated') {
      return {
        errorOutput:
          'Not logged in to Bitwarden. Use "bw login" to authenticate first, then retry.',
      };
    }
  } catch {
    // JSON parse failed — proceed and let the vault command surface the real error.
  }
  return null;
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
  extraEnv?: Record<string, string>,
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

    // Use spawn with array of arguments to avoid shell interpretation
    return new Promise<CliResponse>((resolve) => {
      const child = spawn('bw', [command, ...args], {
        env: { ...process.env, ...extraEnv },
        shell: false, // Explicitly disable shell to prevent injection
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        resolve({
          errorOutput: `Failed to execute command: ${error.message}`,
        });
      });

      child.on('close', (code: number) => {
        const result: CliResponse = {};
        if (stdout) result.output = stdout.trim();
        if (stderr || code !== 0)
          result.errorOutput =
            stderr.trim() || `Command exited with code ${code}`;
        resolve(result);
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
