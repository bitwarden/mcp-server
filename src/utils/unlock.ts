/**
 * Out-of-band unlock flow for the Bitwarden MCP server.
 *
 * The `unlock` tool takes no input parameters. The master password is
 * collected through a native OS dialog and is never exposed to the MCP
 * protocol, the LLM, or process argv. `bw unlock --raw` receives the
 * password via `--passwordenv` and a filtered child environment.
 */

import { spawn } from 'child_process';
import crypto from 'crypto';

/**
 * Module-local indirection for `child_process.spawn` so tests can
 * substitute a mock without depending on `jest.unstable_mockModule`,
 * which is unreliable under ts-jest ESM.
 *
 * Production code MUST use `__testable.spawn(...)` instead of calling
 * the imported `spawn` directly.
 *
 * @internal
 */
export const __testable: { spawn: typeof spawn } = { spawn };

export type UnlockResult =
  | { readonly success: true; readonly message: string }
  | { readonly success: false; readonly error: string };

// Module-level serialization so no other unlock attempt can run at the
// same time. Also tracks consecutive failures to blunt dialog-spam /
// brute-force attempts from a misbehaving LLM.
let unlockInProgress = false;
let lastAttemptAt = 0;
let consecutiveFailures = 0;
let cooldownUntil = 0;

const MIN_ATTEMPT_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_FAILURES = 5;
const COOLDOWN_AFTER_MAX_FAILURES_MS = 60_000;
const DIALOG_TIMEOUT_MS = 60_000;
const BW_COMMAND_TIMEOUT_MS = 30_000;
const BW_STATUS_TIMEOUT_MS = 5_000;
const COMMAND_PROBE_TIMEOUT_MS = 2_000;

// Dialog prompt text MUST remain compile-time constants. The AppleScript
// / PowerShell string contexts below are code-execution surfaces; a
// future maintainer replacing these with a dynamic value would
// introduce injection. The runtime guard further down throws at module
// load if anyone ever changes these to contain quote / escape / dollar
// characters.
const DIALOG_TITLE = 'Bitwarden MCP';
const DIALOG_PROMPT = 'Enter your Bitwarden master password';

const FORBIDDEN_DIALOG_CHARS = /["'\\`$\n\r\t]/;
for (const [name, value] of [
  ['DIALOG_TITLE', DIALOG_TITLE],
  ['DIALOG_PROMPT', DIALOG_PROMPT],
] as const) {
  if (FORBIDDEN_DIALOG_CHARS.test(value)) {
    throw new Error(
      `unlock.ts: ${name} contains a forbidden character. It must be a ` +
        `plain string with no quotes, backslashes, backticks, dollar signs, ` +
        `or newlines so the macOS/Windows dialog scripts stay safe.`,
    );
  }
}

const HEADLESS_ERROR =
  'Interactive unlock is not supported in this environment. ' +
  'Run "bw unlock --raw" manually and set BW_SESSION.';

/**
 * Env vars inherited by every `bw` child process we spawn. `bw` needs
 * HOME/APPDATA/etc. to locate its data directory; without them it would
 * read/write the wrong files or fail. The password env var is added
 * per-invocation on top of this allowlist — no other `process.env`
 * entries are passed to the child.
 */
function buildBwChildEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  const passthrough = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'BITWARDENCLI_APPDATA_DIR',
  ] as const;
  for (const key of passthrough) {
    const v = process.env[key];
    if (v !== undefined) env[key] = v;
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) env[k] = v;
    }
  }
  return env;
}

export function isLinuxHeadless(): boolean {
  return !process.env['DISPLAY'] && !process.env['WAYLAND_DISPLAY'];
}

type PasswordResult =
  | { readonly ok: true; readonly password: string }
  | { readonly ok: false; readonly error: string };

export async function runUnlockFlow(): Promise<UnlockResult> {
  if (unlockInProgress) {
    return {
      success: false,
      error: 'Another unlock attempt is already in progress.',
    };
  }

  const now = Date.now();
  if (now < cooldownUntil) {
    return {
      success: false,
      error: 'Too many failed unlock attempts. Please wait before retrying.',
    };
  }
  if (now - lastAttemptAt < MIN_ATTEMPT_INTERVAL_MS) {
    return {
      success: false,
      error: 'Please wait a moment before retrying unlock.',
    };
  }
  lastAttemptAt = now;

  unlockInProgress = true;
  try {
    if (await checkAlreadyUnlocked()) {
      consecutiveFailures = 0;
      return { success: true, message: 'Vault is already unlocked.' };
    }

    const passwordResult = await collectPasswordViaDialog();
    if (!passwordResult.ok) {
      recordFailure();
      return { success: false, error: passwordResult.error };
    }

    const unlockResult = await executeBwUnlock(passwordResult.password);
    if (unlockResult.success) {
      consecutiveFailures = 0;
    } else {
      recordFailure();
    }
    return unlockResult;
  } catch {
    recordFailure();
    return { success: false, error: 'Unlock failed.' };
  } finally {
    unlockInProgress = false;
  }
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    cooldownUntil = Date.now() + COOLDOWN_AFTER_MAX_FAILURES_MS;
    consecutiveFailures = 0;
  }
}

function checkAlreadyUnlocked(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const env = buildBwChildEnv(
      process.env['BW_SESSION']
        ? { BW_SESSION: process.env['BW_SESSION'] }
        : undefined,
    );

    const child = __testable.spawn('bw', ['status'], { shell: false, env });

    let stdout = '';
    let settled = false;

    // Fail-open on a hung `bw status`: a hang must not wedge the
    // module-level mutex and block all future unlock attempts.
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      resolve(false);
    }, BW_STATUS_TIMEOUT_MS);

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', () => {
      // Swallow stderr — we only care about stdout status JSON.
    });
    child.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(false);
    });
    child.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        const parsed = JSON.parse(stdout) as { status?: string };
        resolve(parsed?.status === 'unlocked');
      } catch {
        resolve(false);
      }
    });
  });
}

function collectPasswordViaDialog(): Promise<PasswordResult> {
  switch (process.platform) {
    case 'darwin':
      return collectPasswordMacOS();
    case 'linux':
      return collectPasswordLinux();
    case 'win32':
      return collectPasswordWindows();
    default:
      return Promise.resolve({ ok: false, error: HEADLESS_ERROR });
  }
}

function collectPasswordMacOS(): Promise<PasswordResult> {
  return spawnDialog('osascript', [
    '-e',
    `display dialog "${DIALOG_PROMPT}" with hidden answer default answer "" with title "${DIALOG_TITLE}" buttons {"Cancel", "Unlock"} default button "Unlock" cancel button "Cancel"`,
    '-e',
    'text returned of result',
  ]);
}

async function collectPasswordLinux(): Promise<PasswordResult> {
  if (isLinuxHeadless()) {
    return { ok: false, error: HEADLESS_ERROR };
  }

  if (await isCommandAvailable('zenity')) {
    return spawnDialog('zenity', ['--password', `--title=${DIALOG_TITLE}`]);
  }
  if (await isCommandAvailable('kdialog')) {
    return spawnDialog('kdialog', ['--password', DIALOG_PROMPT]);
  }
  return {
    ok: false,
    error:
      'No graphical password prompt available (zenity or kdialog required). ' +
      'Run "bw unlock --raw" manually and set BW_SESSION.',
  };
}

function collectPasswordWindows(): Promise<PasswordResult> {
  // Literal PowerShell script. Encoded as UTF-16LE + Base64 and passed
  // via -EncodedCommand so no quoting / escaping is possible across
  // the shell boundary.
  const script = [
    `$ErrorActionPreference = 'Stop'`,
    `$cred = $host.UI.PromptForCredential('${DIALOG_TITLE}', '${DIALOG_PROMPT}', 'bitwarden', '')`,
    `if (-not $cred) { exit 1 }`,
    `$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password)`,
    `try { [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }`,
    `finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }`,
  ].join('; ');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return spawnDialog('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
    encoded,
  ]);
}

function isCommandAvailable(command: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const child = __testable.spawn(command, ['--version'], { shell: false });
    let settled = false;

    // Fail-closed on a hung probe: a hang here would wedge the unlock
    // mutex because this is called from inside `runUnlockFlow`'s
    // `unlockInProgress = true` region. `--version` normally exits in
    // milliseconds; anything slower is broken enough that we should
    // treat the tool as unavailable.
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      resolve(false);
    }, COMMAND_PROBE_TIMEOUT_MS);

    child.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(false);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(code === 0);
    });
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});
  });
}

function spawnDialog(
  command: string,
  args: readonly string[],
): Promise<PasswordResult> {
  return new Promise<PasswordResult>((resolve) => {
    let settled = false;
    let stdout = '';
    const child = __testable.spawn(command, [...args], { shell: false });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      resolve({ ok: false, error: 'Password prompt timed out.' });
    }, DIALOG_TIMEOUT_MS);

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    // Never surface dialog stderr — it can contain OS error text that
    // is not safe to return to the LLM.
    child.stderr.on('data', () => {});

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (err.code === 'ENOENT') {
        resolve({ ok: false, error: HEADLESS_ERROR });
      } else {
        resolve({ ok: false, error: 'Failed to launch password dialog.' });
      }
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({ ok: false, error: 'Unlock cancelled.' });
        return;
      }
      // Strip exactly one trailing newline that dialog tools append.
      const password = stdout.replace(/\r?\n$/, '');
      if (password.length === 0) {
        resolve({ ok: false, error: 'No password entered.' });
        return;
      }
      resolve({ ok: true, password });
    });
  });
}

function executeBwUnlock(password: string): Promise<UnlockResult> {
  return new Promise<UnlockResult>((resolve) => {
    const envVarName = `BW_MCP_PW_${crypto
      .randomBytes(16)
      .toString('hex')
      .toUpperCase()}`;

    const childEnv = buildBwChildEnv({ [envVarName]: password });

    let settled = false;
    let stdout = '';
    let stderr = '';
    const child = __testable.spawn(
      'bw',
      ['unlock', '--raw', '--passwordenv', envVarName],
      { shell: false, env: childEnv },
    );

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
      resolve({ success: false, error: 'Unlock command timed out.' });
    }, BW_COMMAND_TIMEOUT_MS);

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ success: false, error: 'Failed to execute bw unlock.' });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (code === 0) {
        const token = stdout.trim();
        if (token.length === 0) {
          resolve({ success: false, error: 'Unlock failed.' });
          return;
        }
        process.env['BW_SESSION'] = token;
        resolve({ success: true, message: 'Vault unlocked successfully.' });
        return;
      }
      resolve({ success: false, error: scrubUnlockStderr(stderr) });
    });
  });
}

export function scrubUnlockStderr(stderr: string): string {
  if (/invalid master password/i.test(stderr)) {
    return 'Invalid master password.';
  }
  if (/not logged in/i.test(stderr)) {
    return 'You are not logged in. Run "bw login" first.';
  }
  return 'Unlock failed.';
}

/**
 * Resets the module-level mutex, rate-limit, and cooldown state.
 * Exported for tests only — do not call from production code. The
 * mutex is released in a `finally` by `runUnlockFlow`, and the rate-
 * limit / cooldown counters are only resettable via a successful
 * unlock in normal operation.
 */
export function _resetUnlockStateForTests(): void {
  unlockInProgress = false;
  lastAttemptAt = 0;
  consecutiveFailures = 0;
  cooldownUntil = 0;
}
