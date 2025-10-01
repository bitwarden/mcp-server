/**
 * CLI command execution utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { sanitizeInput, isValidBitwardenCommand } from './security.js';
import type { CliResponse } from './types.js';

const execPromise = promisify(exec);

/**
 * Executes a Bitwarden CLI command safely with input sanitization and validation
 */
export async function executeCliCommand(command: string): Promise<CliResponse> {
  try {
    const sanitizedCommand = sanitizeInput(command);

    if (!isValidBitwardenCommand(sanitizedCommand)) {
      return {
        errorOutput:
          'Invalid or unsafe command. Only Bitwarden CLI commands are allowed.',
      } as const;
    }

    // Pass environment variables to child process so BW_SESSION is available
    const { stdout, stderr } = await execPromise(`bw ${sanitizedCommand}`, {
      env: { ...process.env },
    });
    const result: CliResponse = {};
    if (stdout) result.output = stdout;
    if (stderr) result.errorOutput = stderr;
    return result;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      errorOutput: errorMessage,
    } as const;
  }
}
