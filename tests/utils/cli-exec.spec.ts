import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { executeCliCommand, __testable } from '../../src/utils/cli.js';
import { _resetBwInvocationCacheForTests } from '../../src/utils/bw-cli.js';

describe('executeCliCommand child lifecycle', () => {
  let dir: string;
  const saved = process.env['BW_CLI_PATH'];

  function fakeBw(body: string): void {
    const file = path.join(dir, 'fake-bw.js');
    fs.writeFileSync(file, body);
    process.env['BW_CLI_PATH'] = file;
    _resetBwInvocationCacheForTests();
  }

  const pidFile = (): string => path.join(dir, 'pid');
  const recordPid = (): string =>
    `require('fs').writeFileSync(${JSON.stringify(pidFile())}, String(process.pid));`;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-bw-'));
  });

  afterEach(() => {
    __testable.setTimeoutMs(undefined);
    __testable.setKillGraceMs(undefined);
    if (saved === undefined) delete process.env['BW_CLI_PATH'];
    else process.env['BW_CLI_PATH'] = saved;
    _resetBwInvocationCacheForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('sets BW_NOINTERACTION=true in the child env', async () => {
    fakeBw(`process.stdout.write(String(process.env.BW_NOINTERACTION));`);
    const res = await executeCliCommand('status', []);
    expect(res.output).toBe('true');
  });

  it('ends stdin at spawn so a child reading to EOF returns', async () => {
    fakeBw(
      `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('eof'));`,
    );
    __testable.setTimeoutMs(10_000);
    const res = await executeCliCommand('status', []);
    expect(res.output).toBe('eof');
    expect(res.errorOutput).toBeUndefined();
  });

  it('kills a child that never exits and reports the bound', async () => {
    fakeBw(`${recordPid()}setInterval(()=>{},1000);`);
    __testable.setTimeoutMs(500);
    const res = await executeCliCommand('sync', []);
    expect(res.errorOutput).toBe(
      'bw sync timed out after 0.5s and was terminated',
    );
    expect(res.errorOutput).not.toMatch(/exited with code/);
    const pid = Number(fs.readFileSync(pidFile(), 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it('escalates to SIGKILL when the child ignores SIGTERM', async () => {
    fakeBw(
      `process.on('SIGTERM',()=>{});${recordPid()}setInterval(()=>{},1000);`,
    );
    __testable.setTimeoutMs(500);
    __testable.setKillGraceMs(200);
    const res = await executeCliCommand('status', []);
    expect(res.errorOutput).toContain('bw status timed out');
    const pid = Number(fs.readFileSync(pidFile(), 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
