import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { EventEmitter } from 'events';
import { __testable, executeCliCommand } from '../../src/utils/cli.js';
import { _resetBwInvocationCacheForTests } from '../../src/utils/bw-cli.js';

interface FakeChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
}

function successfulChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  process.nextTick(() => {
    child.stdout.emit('data', Buffer.from('{}'));
    child.emit('close', 0);
  });
  return child;
}

describe('executeCliCommand', () => {
  const realSpawn = __testable.spawn;
  const originalCliPath = process.env['BW_CLI_PATH'];
  const spawnMock = jest.fn((...args: unknown[]) => {
    void args;
    return successfulChild();
  });

  beforeEach(() => {
    delete process.env['BW_CLI_PATH'];
    _resetBwInvocationCacheForTests();
    __testable.spawn = spawnMock as unknown as typeof realSpawn;
    spawnMock.mockClear();
  });

  afterEach(() => {
    __testable.spawn = realSpawn;
    if (originalCliPath === undefined) {
      delete process.env['BW_CLI_PATH'];
    } else {
      process.env['BW_CLI_PATH'] = originalCliPath;
    }
    _resetBwInvocationCacheForTests();
  });

  it('passes --nointeraction before the command', async () => {
    process.env['BW_CLI_PATH'] = '/usr/local/bin/bw';
    _resetBwInvocationCacheForTests();

    await executeCliCommand('list', ['items']);

    expect(spawnMock).toHaveBeenCalledWith(
      '/usr/local/bin/bw',
      ['--nointeraction', 'list', 'items'],
      expect.objectContaining({ shell: false }),
    );
  });

  it('places --nointeraction after JavaScript entry-point prefix arguments', async () => {
    process.env['BW_CLI_PATH'] = '/opt/bitwarden/bw.js';
    _resetBwInvocationCacheForTests();

    await executeCliCommand('status');

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      ['/opt/bitwarden/bw.js', '--nointeraction', 'status'],
      expect.objectContaining({ shell: false }),
    );
  });
});
