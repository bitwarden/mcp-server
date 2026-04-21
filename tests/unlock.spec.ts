import { describe, it, expect, afterEach, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { scrubUnlockStderr, isLinuxHeadless } from '../src/utils/unlock.js';
import { unlockSchema } from '../src/schemas/cli.js';
import { handleLock } from '../src/handlers/cli.js';
import { validateInput } from '../src/utils/validation.js';

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
