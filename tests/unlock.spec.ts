import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from '@jest/globals';
import { z } from 'zod';
import { EventEmitter } from 'events';

import {
  runUnlockFlow,
  scrubUnlockStderr,
  isLinuxHeadless,
  _resetUnlockStateForTests,
  __testable,
} from '../src/utils/unlock.js';
import { unlockSchema } from '../src/schemas/cli.js';
import { handleLock, handleUnlock } from '../src/handlers/cli.js';
import { validateInput } from '../src/utils/validation.js';

// ---------------------------------------------------------------------
// Pure / unmocked tests
// ---------------------------------------------------------------------

describe('unlock helper', () => {
  describe('scrubUnlockStderr', () => {
    it('maps "Invalid master password" errors to a fixed message', () => {
      expect(scrubUnlockStderr('Invalid master password.')).toBe(
        'Invalid master password.',
      );
      expect(scrubUnlockStderr('Error: invalid master password\n')).toBe(
        'Invalid master password.',
      );
    });

    it('maps "not logged in" errors to a fixed login hint', () => {
      expect(scrubUnlockStderr('You are not logged in.')).toBe(
        'You are not logged in. Run "bw login" first.',
      );
    });

    it('returns a generic message for anything else', () => {
      expect(scrubUnlockStderr('Some other error from bw CLI')).toBe(
        'Unlock failed.',
      );
      expect(scrubUnlockStderr('')).toBe('Unlock failed.');
    });

    it('does not leak raw stderr contents into the returned message', () => {
      const secretish = 'password=hunter2 token=abc123';
      expect(scrubUnlockStderr(secretish)).toBe('Unlock failed.');
    });
  });

  describe('unlockSchema', () => {
    it('accepts an empty object', () => {
      const [isValid, result] = validateInput(unlockSchema, {});
      expect(isValid).toBe(true);
      if (isValid) {
        expect(result).toEqual({});
      }
    });

    it('accepts undefined input (treated as empty by validateInput)', () => {
      const [isValid] = validateInput(unlockSchema, undefined);
      expect(isValid).toBe(true);
    });

    it('is exactly the empty Zod object so the password cannot be smuggled in as a parameter', () => {
      expect(unlockSchema).toBeInstanceOf(z.ZodObject);
      expect(Object.keys(unlockSchema.shape)).toEqual([]);
    });
  });

  describe('isLinuxHeadless', () => {
    const originalDisplay = process.env['DISPLAY'];
    const originalWayland = process.env['WAYLAND_DISPLAY'];

    afterEach(() => {
      if (originalDisplay !== undefined) {
        process.env['DISPLAY'] = originalDisplay;
      } else {
        delete process.env['DISPLAY'];
      }
      if (originalWayland !== undefined) {
        process.env['WAYLAND_DISPLAY'] = originalWayland;
      } else {
        delete process.env['WAYLAND_DISPLAY'];
      }
    });

    it('is true when neither DISPLAY nor WAYLAND_DISPLAY is set', () => {
      delete process.env['DISPLAY'];
      delete process.env['WAYLAND_DISPLAY'];
      expect(isLinuxHeadless()).toBe(true);
    });

    it('is false when DISPLAY is set', () => {
      process.env['DISPLAY'] = ':0';
      delete process.env['WAYLAND_DISPLAY'];
      expect(isLinuxHeadless()).toBe(false);
    });

    it('is false when WAYLAND_DISPLAY is set', () => {
      delete process.env['DISPLAY'];
      process.env['WAYLAND_DISPLAY'] = 'wayland-0';
      expect(isLinuxHeadless()).toBe(false);
    });
  });
});

describe('handleLock', () => {
  const originalSession = process.env['BW_SESSION'];

  beforeEach(() => {
    process.env['BW_SESSION'] = 'test-session-token';
  });

  afterEach(() => {
    if (originalSession !== undefined) {
      process.env['BW_SESSION'] = originalSession;
    } else {
      delete process.env['BW_SESSION'];
    }
  });

  it('clears BW_SESSION from process.env regardless of bw lock exit status', async () => {
    // handleLock deletes BW_SESSION before invoking `bw lock`, so the
    // in-memory session is cleared whether or not the CLI is available
    // in the test environment.
    await handleLock({});
    expect(process.env['BW_SESSION']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------
// Spawn-injected tests — drive the unlock flow without invoking real
// `bw`, `osascript`, `zenity`, `kdialog`, or `powershell.exe`.
// ---------------------------------------------------------------------

describe('unlock flow (spawn-injected)', () => {
  const realSpawn = __testable.spawn;
  const spawnMock = jest.fn();

  interface FakeChild extends EventEmitter {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: jest.Mock;
  }

  function fakeChild(): FakeChild {
    const child = new EventEmitter() as FakeChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = jest.fn();
    return child;
  }

  type Scenario = (child: FakeChild) => void;

  function dialogCommand(): string {
    switch (process.platform) {
      case 'darwin':
        return 'osascript';
      case 'linux':
        return 'zenity';
      case 'win32':
        return 'powershell.exe';
      default:
        return '';
    }
  }

  /**
   * Routes spawn calls to scenario handlers. Unmatched calls emit
   * ENOENT so tests fail loudly rather than silently hanging.
   *
   * Linux note: `collectPasswordLinux` probes `zenity --version` (and
   * falls back to `kdialog --version`) before invoking the actual
   * password dialog. We short-circuit those probes to "available" so
   * the `dialog` scenario is reached; tests that specifically exercise
   * the "neither tool is available" path set their own inline mock.
   */
  function route(scenarios: {
    status?: Scenario;
    dialog?: Scenario;
    unlock?: Scenario;
  }): void {
    const dialogCmd = dialogCommand();
    spawnMock.mockImplementation(((...mockArgs: unknown[]) => {
      const command = mockArgs[0] as string;
      const args = (mockArgs[1] as readonly string[]) ?? [];
      const child = fakeChild();

      // Linux availability probes — always succeed.
      if (
        (command === 'zenity' || command === 'kdialog') &&
        args[0] === '--version'
      ) {
        process.nextTick(() => child.emit('close', 0));
        return child;
      }

      let handler: Scenario | undefined;
      if (command === 'bw' && args[0] === 'status') handler = scenarios.status;
      else if (command === 'bw' && args[0] === 'unlock')
        handler = scenarios.unlock;
      else if (command === dialogCmd) handler = scenarios.dialog;

      if (!handler) {
        process.nextTick(() => {
          child.emit(
            'error',
            Object.assign(new Error(`No scenario for '${command}'`), {
              code: 'ENOENT',
            }),
          );
        });
        return child;
      }

      process.nextTick(() => handler!(child));
      return child;
    }) as never);
  }

  const statusUnlocked: Scenario = (child) => {
    child.stdout.emit(
      'data',
      Buffer.from(JSON.stringify({ status: 'unlocked' })),
    );
    child.emit('close', 0);
  };

  const statusLocked: Scenario = (child) => {
    child.stdout.emit(
      'data',
      Buffer.from(JSON.stringify({ status: 'locked' })),
    );
    child.emit('close', 0);
  };

  function dialogReturns(password: string): Scenario {
    return (child) => {
      child.stdout.emit('data', Buffer.from(`${password}\n`));
      child.emit('close', 0);
    };
  }

  const dialogCancelled: Scenario = (child) => {
    child.emit('close', 1);
  };

  const dialogEnoent: Scenario = (child) => {
    child.emit(
      'error',
      Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }),
    );
  };

  function bwUnlockReturns(token: string): Scenario {
    return (child) => {
      child.stdout.emit('data', Buffer.from(`${token}\n`));
      child.emit('close', 0);
    };
  }

  function bwUnlockFails(stderr: string, code = 1): Scenario {
    return (child) => {
      child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', code);
    };
  }

  async function flushAsync(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  const originalSession = process.env['BW_SESSION'];
  const originalDisplay = process.env['DISPLAY'];

  beforeEach(() => {
    __testable.spawn = spawnMock as unknown as typeof realSpawn;
    _resetUnlockStateForTests();
    spawnMock.mockReset();
    delete process.env['BW_SESSION'];
    // zenity/kdialog availability checks on Linux require DISPLAY.
    if (process.platform === 'linux') {
      process.env['DISPLAY'] = ':0';
    }
  });

  afterEach(() => {
    __testable.spawn = realSpawn;
    if (originalDisplay !== undefined) {
      process.env['DISPLAY'] = originalDisplay;
    } else {
      delete process.env['DISPLAY'];
    }
  });

  afterAll(() => {
    if (originalSession !== undefined) {
      process.env['BW_SESSION'] = originalSession;
    } else {
      delete process.env['BW_SESSION'];
    }
  });

  describe('runUnlockFlow — happy paths', () => {
    it('returns early when bw status reports unlocked (no dialog shown)', async () => {
      route({ status: statusUnlocked });

      const result = await runUnlockFlow();

      expect(result.success).toBe(true);
      expect(spawnMock).toHaveBeenCalledTimes(1);
      const firstCall = spawnMock.mock.calls[0] as [string, string[]];
      expect(firstCall[0]).toBe('bw');
      expect(firstCall[1][0]).toBe('status');
      expect(process.env['BW_SESSION']).toBeUndefined();
    });

    it('collects password via dialog and sets BW_SESSION on unlock success', async () => {
      route({
        status: statusLocked,
        dialog: dialogReturns('hunter2'),
        unlock: bwUnlockReturns('the-session-token'),
      });

      const result = await runUnlockFlow();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.message).toBe('Vault unlocked successfully.');
      }
      expect(process.env['BW_SESSION']).toBe('the-session-token');

      // Verify `bw unlock` used `--passwordenv` (password off argv) and
      // a per-invocation random env var name scoped to the child's env.
      const unlockCall = spawnMock.mock.calls.find(
        (c) => c[0] === 'bw' && (c[1] as string[])[0] === 'unlock',
      );
      expect(unlockCall).toBeDefined();
      const unlockArgs = unlockCall?.[1] as string[];
      expect(unlockArgs).toContain('--raw');
      expect(unlockArgs).toContain('--passwordenv');
      expect(unlockArgs).not.toContain('hunter2');

      const envVarName = unlockArgs[
        unlockArgs.indexOf('--passwordenv') + 1
      ] as string;
      expect(envVarName).toMatch(/^BW_MCP_PW_[0-9A-F]{32}$/);
      expect(process.env[envVarName]).toBeUndefined();

      const unlockEnv = (unlockCall?.[2] as { env: Record<string, string> })
        ?.env;
      expect(unlockEnv?.[envVarName]).toBe('hunter2');
    });
  });

  describe('runUnlockFlow — failure classification', () => {
    it('reports invalid master password with a sanitized message', async () => {
      route({
        status: statusLocked,
        dialog: dialogReturns('wrong'),
        unlock: bwUnlockFails('Invalid master password.\n'),
      });

      const result = await runUnlockFlow();

      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error).toBe('Invalid master password.');
      expect(process.env['BW_SESSION']).toBeUndefined();
    });

    it('reports "not logged in" with a login hint', async () => {
      route({
        status: statusLocked,
        dialog: dialogReturns('pw'),
        unlock: bwUnlockFails('You are not logged in.\n'),
      });

      const result = await runUnlockFlow();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not logged in');
        expect(result.error).toContain('bw login');
      }
    });

    it('returns a generic failure for other stderr without leaking it', async () => {
      route({
        status: statusLocked,
        dialog: dialogReturns('pw'),
        unlock: bwUnlockFails('some internal bw diagnostic with token=abc'),
      });

      const result = await runUnlockFlow();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unlock failed.');
        expect(result.error).not.toContain('abc');
      }
    });

    it('reports cancellation when the dialog exits non-zero', async () => {
      route({ status: statusLocked, dialog: dialogCancelled });

      const result = await runUnlockFlow();

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('Unlock cancelled.');
    });

    it('reports "No password entered" when the dialog closes with empty stdout', async () => {
      route({
        status: statusLocked,
        dialog: (child) => {
          child.emit('close', 0);
        },
      });

      const result = await runUnlockFlow();

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain('No password');
    });

    it('returns headless error when the dialog command is missing (ENOENT)', async () => {
      route({ status: statusLocked, dialog: dialogEnoent });

      const result = await runUnlockFlow();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Interactive unlock is not supported');
      }
    });
  });

  describe('runUnlockFlow — serialization and rate limits', () => {
    it('rejects a concurrent call while another is already in progress', async () => {
      const dialogCmd = dialogCommand();
      spawnMock.mockImplementation(((...mockArgs: unknown[]) => {
        const command = mockArgs[0] as string;
        const args = (mockArgs[1] as readonly string[]) ?? [];
        const child = fakeChild();

        if (command === 'bw' && args[0] === 'status') {
          process.nextTick(() => statusLocked(child));
        } else if (command === dialogCmd) {
          // Hold the dialog open so the second call observes the mutex.
          setTimeout(() => {
            child.stdout.emit('data', Buffer.from('pw\n'));
            child.emit('close', 0);
          }, 0);
        } else if (command === 'bw' && args[0] === 'unlock') {
          process.nextTick(() => bwUnlockReturns('tok')(child));
        } else {
          process.nextTick(() =>
            child.emit(
              'error',
              Object.assign(new Error('enoent'), { code: 'ENOENT' }),
            ),
          );
        }
        return child;
      }) as never);

      const p1 = runUnlockFlow();
      await flushAsync();
      const p2Result = await runUnlockFlow();

      expect(p2Result.success).toBe(false);
      if (!p2Result.success) {
        expect(p2Result.error).toContain('already in progress');
      }

      const p1Result = await p1;
      expect(p1Result.success).toBe(true);
    });

    it('rate-limits a second attempt within the minimum interval', async () => {
      route({ status: statusLocked, dialog: dialogCancelled });

      const first = await runUnlockFlow();
      expect(first.success).toBe(false);

      const second = await runUnlockFlow();
      expect(second.success).toBe(false);
      if (!second.success) expect(second.error.toLowerCase()).toContain('wait');
    });

    it('enters a cooldown after MAX_CONSECUTIVE_FAILURES consecutive failures', async () => {
      route({ status: statusLocked, dialog: dialogCancelled });

      const dateSpy = jest.spyOn(Date, 'now');
      let fakeNow = 0;
      dateSpy.mockImplementation(() => fakeNow);

      try {
        for (let i = 0; i < 5; i++) {
          fakeNow += 3000; // past the 2s rate-limit window
          const r = await runUnlockFlow();
          expect(r.success).toBe(false);
        }

        fakeNow += 3000;
        const cooled = await runUnlockFlow();
        expect(cooled.success).toBe(false);
        if (!cooled.success) expect(cooled.error).toContain('Too many failed');
      } finally {
        dateSpy.mockRestore();
      }
    });
  });

  describe('runUnlockFlow — filtered child environment', () => {
    it('does NOT inherit arbitrary process.env entries into the bw unlock child', async () => {
      process.env['SOME_OTHER_SECRET'] = 'shhhh';

      try {
        route({
          status: statusLocked,
          dialog: dialogReturns('pw'),
          unlock: bwUnlockReturns('tok'),
        });

        await runUnlockFlow();

        const unlockCall = spawnMock.mock.calls.find(
          (c) => c[0] === 'bw' && (c[1] as string[])[0] === 'unlock',
        );
        const env = (unlockCall?.[2] as { env: Record<string, string> })?.env;
        expect(env).toBeDefined();
        expect(env?.['SOME_OTHER_SECRET']).toBeUndefined();
        expect(env?.['PATH']).toBeDefined();
      } finally {
        delete process.env['SOME_OTHER_SECRET'];
      }
    });
  });

  describe('runUnlockFlow — platform-specific dialog paths', () => {
    const originalPlatform = process.platform;
    const originalWayland = process.env['WAYLAND_DISPLAY'];

    function setPlatform(platform: NodeJS.Platform): void {
      Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true,
      });
    }

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
      if (originalWayland !== undefined) {
        process.env['WAYLAND_DISPLAY'] = originalWayland;
      } else {
        delete process.env['WAYLAND_DISPLAY'];
      }
    });

    it('Linux: spawns zenity when DISPLAY is set and zenity is available', async () => {
      setPlatform('linux');
      process.env['DISPLAY'] = ':0';

      spawnMock.mockImplementation(((...mockArgs: unknown[]) => {
        const command = mockArgs[0] as string;
        const args = (mockArgs[1] as readonly string[]) ?? [];
        const child = fakeChild();
        if (command === 'bw' && args[0] === 'status') {
          process.nextTick(() => statusLocked(child));
        } else if (command === 'zenity' && args[0] === '--version') {
          process.nextTick(() => child.emit('close', 0));
        } else if (command === 'zenity' && args[0] === '--password') {
          process.nextTick(() => dialogReturns('pw')(child));
        } else if (command === 'bw' && args[0] === 'unlock') {
          process.nextTick(() => bwUnlockReturns('tok')(child));
        } else {
          process.nextTick(() =>
            child.emit(
              'error',
              Object.assign(new Error('enoent'), { code: 'ENOENT' }),
            ),
          );
        }
        return child;
      }) as never);

      const result = await runUnlockFlow();
      expect(result.success).toBe(true);

      const zenityCall = spawnMock.mock.calls.find((c) => c[0] === 'zenity');
      expect(zenityCall).toBeDefined();
    });

    it('Linux: falls back to kdialog when zenity is not available', async () => {
      setPlatform('linux');
      process.env['DISPLAY'] = ':0';

      spawnMock.mockImplementation(((...mockArgs: unknown[]) => {
        const command = mockArgs[0] as string;
        const args = (mockArgs[1] as readonly string[]) ?? [];
        const child = fakeChild();
        if (command === 'bw' && args[0] === 'status') {
          process.nextTick(() => statusLocked(child));
        } else if (command === 'zenity' && args[0] === '--version') {
          process.nextTick(() =>
            child.emit(
              'error',
              Object.assign(new Error('enoent'), { code: 'ENOENT' }),
            ),
          );
        } else if (command === 'kdialog' && args[0] === '--version') {
          process.nextTick(() => child.emit('close', 0));
        } else if (command === 'kdialog' && args[0] === '--password') {
          process.nextTick(() => dialogReturns('pw')(child));
        } else if (command === 'bw' && args[0] === 'unlock') {
          process.nextTick(() => bwUnlockReturns('tok')(child));
        } else {
          process.nextTick(() =>
            child.emit(
              'error',
              Object.assign(new Error('enoent'), { code: 'ENOENT' }),
            ),
          );
        }
        return child;
      }) as never);

      const result = await runUnlockFlow();
      expect(result.success).toBe(true);

      const kdialogCall = spawnMock.mock.calls.find(
        (c) => c[0] === 'kdialog' && (c[1] as string[])[0] === '--password',
      );
      expect(kdialogCall).toBeDefined();
    });

    it('Linux: returns a fixed error when neither zenity nor kdialog is available', async () => {
      setPlatform('linux');
      process.env['DISPLAY'] = ':0';

      spawnMock.mockImplementation(((...mockArgs: unknown[]) => {
        const command = mockArgs[0] as string;
        const args = (mockArgs[1] as readonly string[]) ?? [];
        const child = fakeChild();
        if (command === 'bw' && args[0] === 'status') {
          process.nextTick(() => statusLocked(child));
        } else {
          // Every tool --version check returns ENOENT.
          process.nextTick(() =>
            child.emit(
              'error',
              Object.assign(new Error('enoent'), { code: 'ENOENT' }),
            ),
          );
        }
        return child;
      }) as never);

      const result = await runUnlockFlow();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('zenity or kdialog');
      }
    });

    it('Linux: isCommandAvailable probe times out and treats the tool as unavailable when zenity --version hangs', async () => {
      setPlatform('linux');
      process.env['DISPLAY'] = ':0';

      // Start fake `Date.now()` at a non-zero value so `runUnlockFlow`'s
      // 2-second rate-limit check doesn't immediately short-circuit.
      jest.useFakeTimers({
        doNotFake: ['nextTick', 'queueMicrotask'],
        now: 100_000,
      });

      const hungChildren: FakeChild[] = [];
      spawnMock.mockImplementation(((...mockArgs: unknown[]) => {
        const command = mockArgs[0] as string;
        const args = (mockArgs[1] as readonly string[]) ?? [];
        const child = fakeChild();
        if (command === 'bw' && args[0] === 'status') {
          process.nextTick(() => statusLocked(child));
        } else if (
          (command === 'zenity' || command === 'kdialog') &&
          args[0] === '--version'
        ) {
          // Hang — never emit close or error. isCommandAvailable must
          // time out rather than wedge the unlock mutex.
          hungChildren.push(child);
        } else {
          process.nextTick(() =>
            child.emit(
              'error',
              Object.assign(new Error('enoent'), { code: 'ENOENT' }),
            ),
          );
        }
        return child;
      }) as never);

      try {
        const promise = runUnlockFlow();

        // Advance past both probe timeouts (zenity, then kdialog).
        // `advanceTimersByTimeAsync` yields microtasks between each
        // fake-timer tick so awaited chains can progress.
        await jest.advanceTimersByTimeAsync(2_100);
        await jest.advanceTimersByTimeAsync(2_100);

        const result = await promise;

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('zenity or kdialog');
        }

        // Both hung children must have been SIGTERMed on timeout so
        // they can't linger after the probe gives up.
        expect(hungChildren.length).toBeGreaterThanOrEqual(1);
        for (const c of hungChildren) {
          expect(c.kill).toHaveBeenCalledWith('SIGTERM');
        }
      } finally {
        jest.useRealTimers();
      }
    });

    it('Linux: refuses when DISPLAY and WAYLAND_DISPLAY are both unset (headless)', async () => {
      setPlatform('linux');
      delete process.env['DISPLAY'];
      delete process.env['WAYLAND_DISPLAY'];

      spawnMock.mockImplementation(((...mockArgs: unknown[]) => {
        const command = mockArgs[0] as string;
        const args = (mockArgs[1] as readonly string[]) ?? [];
        const child = fakeChild();
        if (command === 'bw' && args[0] === 'status') {
          process.nextTick(() => statusLocked(child));
        } else {
          process.nextTick(() =>
            child.emit(
              'error',
              Object.assign(new Error('enoent'), { code: 'ENOENT' }),
            ),
          );
        }
        return child;
      }) as never);

      const result = await runUnlockFlow();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Interactive unlock is not supported');
      }
      // zenity must not have been probed when already known to be headless.
      expect(
        spawnMock.mock.calls.find((c) => c[0] === 'zenity'),
      ).toBeUndefined();
    });

    it('Windows: invokes powershell.exe with -EncodedCommand', async () => {
      setPlatform('win32');

      spawnMock.mockImplementation(((...mockArgs: unknown[]) => {
        const command = mockArgs[0] as string;
        const args = (mockArgs[1] as readonly string[]) ?? [];
        const child = fakeChild();
        if (command === 'bw' && args[0] === 'status') {
          process.nextTick(() => statusLocked(child));
        } else if (command === 'powershell.exe') {
          process.nextTick(() => dialogReturns('pw')(child));
        } else if (command === 'bw' && args[0] === 'unlock') {
          process.nextTick(() => bwUnlockReturns('tok')(child));
        } else {
          process.nextTick(() =>
            child.emit(
              'error',
              Object.assign(new Error('enoent'), { code: 'ENOENT' }),
            ),
          );
        }
        return child;
      }) as never);

      const result = await runUnlockFlow();
      expect(result.success).toBe(true);

      const psCall = spawnMock.mock.calls.find(
        (c) => c[0] === 'powershell.exe',
      );
      expect(psCall).toBeDefined();
      const psArgs = psCall?.[1] as string[];
      expect(psArgs).toContain('-NoProfile');
      expect(psArgs).toContain('-EncodedCommand');
      // The encoded command must be base64 of the UTF-16LE script, not
      // plaintext — verify it doesn't contain the prompt in UTF-8.
      const encoded = psArgs[psArgs.indexOf('-EncodedCommand') + 1] as string;
      expect(encoded).not.toContain('Enter your Bitwarden');
    });

    it('Unsupported platform: returns the fixed headless error', async () => {
      setPlatform('freebsd' as NodeJS.Platform);

      route({ status: statusLocked });

      const result = await runUnlockFlow();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Interactive unlock is not supported');
      }
    });
  });

  describe('runUnlockFlow — miscellaneous error paths', () => {
    it('returns "Failed to launch password dialog" on non-ENOENT spawn error', async () => {
      route({
        status: statusLocked,
        dialog: (child) => {
          child.emit(
            'error',
            Object.assign(new Error('EACCES'), { code: 'EACCES' }),
          );
        },
      });

      const result = await runUnlockFlow();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to launch password dialog.');
      }
    });

    it('checkAlreadyUnlocked returns false when bw status JSON is malformed', async () => {
      // Malformed status JSON → check returns false, flow proceeds to
      // dialog. We cancel the dialog to keep the test short.
      route({
        status: (child) => {
          child.stdout.emit('data', Buffer.from('not-json'));
          child.emit('close', 0);
        },
        dialog: dialogCancelled,
      });

      const result = await runUnlockFlow();
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('Unlock cancelled.');
      // Both status and dialog were invoked — the malformed JSON path
      // fell through to the dialog.
      expect(
        spawnMock.mock.calls.some(
          (c) => c[0] === 'bw' && (c[1] as string[])[0] === 'status',
        ),
      ).toBe(true);
    });

    it('checkAlreadyUnlocked returns false when bw status errors (ENOENT)', async () => {
      route({
        status: (child) => {
          child.emit(
            'error',
            Object.assign(new Error('enoent'), { code: 'ENOENT' }),
          );
        },
        dialog: dialogCancelled,
      });

      const result = await runUnlockFlow();
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('Unlock cancelled.');
    });

    it('executeBwUnlock returns a generic error when the bw unlock child fails to spawn', async () => {
      route({
        status: statusLocked,
        dialog: dialogReturns('pw'),
        unlock: (child) => {
          child.emit(
            'error',
            Object.assign(new Error('spawn failed'), { code: 'EACCES' }),
          );
        },
      });

      const result = await runUnlockFlow();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to execute bw unlock.');
      }
    });

    it('executeBwUnlock returns a failure when bw unlock exits 0 with no token', async () => {
      route({
        status: statusLocked,
        dialog: dialogReturns('pw'),
        unlock: (child) => {
          // Exit 0 with empty stdout — defensive branch.
          child.emit('close', 0);
        },
      });

      const result = await runUnlockFlow();
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('Unlock failed.');
      expect(process.env['BW_SESSION']).toBeUndefined();
    });

    it('runUnlockFlow top-level catch maps unexpected throws to "Unlock failed."', async () => {
      // Force the very first spawn (bw status) to throw synchronously;
      // the Promise constructor converts the throw to a rejection, which
      // the outer try/catch in runUnlockFlow converts to "Unlock failed.".
      spawnMock.mockImplementation((() => {
        throw new Error('unexpected');
      }) as never);

      const result = await runUnlockFlow();
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('Unlock failed.');
    });
  });

  describe('handleUnlock — MCP response formatting', () => {
    it('returns a non-error MCP response on success', async () => {
      route({ status: statusUnlocked });

      const result = await handleUnlock({});

      expect(result.isError).toBe(false);
      const first = result.content[0] as { type: string; text: string };
      expect(first.type).toBe('text');
      expect(first.text).toMatch(/already unlocked|unlocked successfully/i);
    });

    it('returns an error MCP response when the unlock flow fails', async () => {
      route({ status: statusLocked, dialog: dialogCancelled });

      const result = await handleUnlock({});

      expect(result.isError).toBe(true);
      const first = result.content[0] as { text: string };
      expect(first.text).toBe('Unlock cancelled.');
    });
  });
});
