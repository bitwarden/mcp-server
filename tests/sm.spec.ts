import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from '@jest/globals';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

import {
  __testable,
  executeSmCommand,
  formatBwsError,
  generateSecretValue,
  isValidSmCommand,
  MISSING_ACCESS_TOKEN_ERROR,
  redactSecretValues,
  validateSmParameter,
} from '../src/utils/sm.js';
import {
  createSmSecretSchema,
  editSmSecretSchema,
  exportSmSecretsSchema,
  getSmSecretSchema,
} from '../src/schemas/sm.js';
import {
  handleCreateSmSecret,
  handleDeleteSmSecret,
  handleEditSmProject,
  handleEditSmSecret,
  handleExportSmSecrets,
  handleGetSmSecret,
  handleImportSmSecrets,
  handleListSmSecrets,
} from '../src/handlers/sm.js';
import { validateInput } from '../src/utils/validation.js';

const PROJECT_ID = '0782bbaf-7992-47f8-a4fd-b4fc008f1b7d';
const OTHER_PROJECT_ID = 'cd1063fd-4f8b-4d7f-9516-b4fc008f1b8d';
const SECRET_ID = 'fcde468d-7e31-4cb2-b68f-b4fc008e9036';

interface BwsResult {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly code?: number;
}

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
}

const originalSpawn = __testable.spawn;
const originalEnv = { ...process.env };
let calls: SpawnCall[] = [];

type BwsAnswer = BwsResult | ((args: readonly string[]) => BwsResult);

/**
 * Replaces spawn with a fake `bws` that answers each call with the next
 * result in order.
 */
function mockBws(...answers: BwsAnswer[]): void {
  const queue = [...answers];
  __testable.spawn = ((
    command: string,
    args: readonly string[],
    options: { env: NodeJS.ProcessEnv },
  ) => {
    calls.push({ command, args, env: options.env });
    const answer = queue.shift() ?? { stdout: '' };
    const result = typeof answer === 'function' ? answer(args) : answer;
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      if (result.stdout) child.stdout.emit('data', Buffer.from(result.stdout));
      if (result.stderr) child.stderr.emit('data', Buffer.from(result.stderr));
      child.emit('close', result.code ?? 0);
    });
    return child;
  }) as unknown as typeof __testable.spawn;
}

function secret(id: string, key: string, value: string) {
  return {
    object: 'secret',
    id,
    organizationId: PROJECT_ID,
    projectId: PROJECT_ID,
    key,
    value,
    note: '',
    creationDate: '2026-11-08T00:00:00Z',
    revisionDate: '2026-11-08T00:00:00Z',
  };
}

function textOf(result: { content: readonly { text: string }[] }): string {
  return result.content[0]!.text;
}

beforeEach(() => {
  process.env = { ...originalEnv, BWS_ACCESS_TOKEN: 'mock-access-token' };
  delete process.env['BWS_SERVER_URL'];
  delete process.env['BWS_CLI_PATH'];
  calls = [];
});

afterEach(() => {
  __testable.spawn = originalSpawn;
  process.env = { ...originalEnv };
});

describe('Secrets Manager CLI execution', () => {
  it('refuses to run without BWS_ACCESS_TOKEN', async () => {
    delete process.env['BWS_ACCESS_TOKEN'];
    mockBws();
    const result = await executeSmCommand('project', 'list');
    expect(result.errorOutput).toBe(MISSING_ACCESS_TOKEN_ERROR);
    expect(calls).toHaveLength(0);
  });

  it('puts options before -- and positionals after it', async () => {
    mockBws({ stdout: '{}' });
    await executeSmCommand(
      'secret',
      'create',
      ['--note=a note'],
      ['KEY', '-starts-with-dash', PROJECT_ID],
    );
    expect(calls[0]!.command).toBe('bws');
    expect(calls[0]!.args).toEqual([
      'secret',
      'create',
      '--note=a note',
      '--output',
      'json',
      '--color',
      'no',
      '--',
      'KEY',
      '-starts-with-dash',
      PROJECT_ID,
    ]);
  });

  it('passes only the access token and server URL to the child env', async () => {
    process.env['BW_SESSION'] = 'session';
    process.env['BW_CLIENT_SECRET'] = 'client-secret';
    process.env['BWS_SERVER_URL'] = 'https://vault.bitwarden.eu';
    mockBws({ stdout: '[]' });
    await executeSmCommand('project', 'list');
    const env = calls[0]!.env;
    expect(env['BWS_ACCESS_TOKEN']).toBe('mock-access-token');
    expect(env['BWS_SERVER_URL']).toBe('https://vault.bitwarden.eu');
    expect(env['BW_SESSION']).toBeUndefined();
    expect(env['BW_CLIENT_SECRET']).toBeUndefined();
  });

  it('uses BWS_CLI_PATH when set', async () => {
    process.env['BWS_CLI_PATH'] = '/opt/bws/bws';
    mockBws({ stdout: '[]' });
    await executeSmCommand('project', 'list');
    expect(calls[0]!.command).toBe('/opt/bws/bws');
  });

  it('treats a zero exit code as success even with stderr output', async () => {
    mockBws({ stdout: '[]', stderr: 'warning: something', code: 0 });
    const result = await executeSmCommand('project', 'list');
    expect(result).toEqual({ output: '[]' });
  });

  it('returns stderr when bws fails', async () => {
    mockBws({ stderr: 'Error: Access token is not valid\n', code: 1 });
    const result = await executeSmCommand('project', 'list');
    expect(result.errorOutput).toBe('Error: Access token is not valid');
  });

  it('shortens bws error reports to their messages', async () => {
    mockBws({
      stderr:
        "Error: \n   0: Doesn't contain a decryption key\n\nLocation:\n   crates/bws/src/main.rs:67\n\nBacktrace omitted. Run with RUST_BACKTRACE=1 environment variable to display it.\n",
      code: 1,
    });
    const result = await executeSmCommand('project', 'list');
    expect(result.errorOutput).toBe("Error: Doesn't contain a decryption key");
  });

  it('joins chained bws error causes', () => {
    expect(
      formatBwsError(
        'Error: \n   0: Request failed\n   1: 401 Unauthorized\n\nLocation:\n   x.rs:1\n',
      ),
    ).toBe('Error: Request failed: 401 Unauthorized');
  });

  it('reports a spawn error', async () => {
    __testable.spawn = (() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      setImmediate(() => child.emit('error', new Error('spawn bws ENOENT')));
      return child;
    }) as unknown as typeof __testable.spawn;
    const result = await executeSmCommand('project', 'list');
    expect(result.errorOutput).toBe('Failed to execute bws: spawn bws ENOENT');
  });

  it('rejects null bytes without spawning, but accepts newlines', async () => {
    mockBws({ stdout: '{}' });
    const rejected = await executeSmCommand('secret', 'get', [], ['a\0b']);
    expect(rejected.errorOutput).toBe('Invalid parameter detected.');
    expect(calls).toHaveLength(0);
    expect(validateSmParameter('line1\nline2')).toBe(true);
  });

  it('only allows project and secret commands', () => {
    expect(isValidSmCommand('secret', 'list')).toBe(true);
    expect(isValidSmCommand('project', 'delete')).toBe(true);
    expect(isValidSmCommand('run', 'list')).toBe(false);
    expect(isValidSmCommand('secret', 'run')).toBe(false);
  });
});

describe('redactSecretValues', () => {
  it('removes values from a list and from a single secret', () => {
    const list = JSON.parse(
      redactSecretValues(JSON.stringify([secret(SECRET_ID, 'A', 'v1')])),
    );
    expect(list[0]).not.toHaveProperty('value');
    expect(list[0].key).toBe('A');
    const single = JSON.parse(
      redactSecretValues(JSON.stringify(secret(SECRET_ID, 'A', 'v1'))),
    );
    expect(single).not.toHaveProperty('value');
  });

  it('does not echo output it cannot parse', () => {
    expect(redactSecretValues('KEY=hunter2')).not.toContain('hunter2');
  });
});

describe('generateSecretValue', () => {
  it('defaults to 32 characters with every character set', () => {
    const value = generateSecretValue();
    expect(value).toHaveLength(32);
    expect(value).toMatch(/[A-Z]/);
    expect(value).toMatch(/[a-z]/);
    expect(value).toMatch(/[0-9]/);
    expect(value).toMatch(/[!@#$%^&*]/);
  });

  it('respects the length and disabled character sets', () => {
    const value = generateSecretValue({ length: 12, special: false });
    expect(value).toHaveLength(12);
    expect(value).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('throws when every character set is disabled', () => {
    expect(() =>
      generateSecretValue({
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
      }),
    ).toThrow();
  });
});

describe('Secrets Manager schemas', () => {
  it('requires exactly one of value or generate to create a secret', () => {
    const base = { key: 'A', projectId: PROJECT_ID };
    expect(validateInput(createSmSecretSchema, base)[0]).toBe(false);
    expect(
      validateInput(createSmSecretSchema, {
        ...base,
        value: 'x',
        generate: {},
      })[0],
    ).toBe(false);
    expect(validateInput(createSmSecretSchema, { ...base, value: '' })[0]).toBe(
      true,
    );
    expect(
      validateInput(createSmSecretSchema, { ...base, generate: {} })[0],
    ).toBe(true);
  });

  it('rejects a generate option with every character set disabled', () => {
    const [isValid] = validateInput(createSmSecretSchema, {
      key: 'A',
      projectId: PROJECT_ID,
      generate: {
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
      },
    });
    expect(isValid).toBe(false);
  });

  it('requires at least one field to edit a secret', () => {
    expect(validateInput(editSmSecretSchema, { secretId: SECRET_ID })[0]).toBe(
      false,
    );
    expect(
      validateInput(editSmSecretSchema, { secretId: SECRET_ID, note: '' })[0],
    ).toBe(true);
  });

  it('rejects IDs that are not UUIDs', () => {
    expect(validateInput(getSmSecretSchema, { secretId: 'abc' })[0]).toBe(
      false,
    );
  });

  it('rejects files outside BW_ALLOWED_DIRECTORIES', () => {
    const [isValid] = validateInput(exportSmSecretsSchema, {
      filePath: '/etc/secrets.env',
      projectId: PROJECT_ID,
    });
    expect(isValid).toBe(false);
  });
});

describe('Secrets Manager handlers', () => {
  it('lists secrets without their values', async () => {
    mockBws({ stdout: JSON.stringify([secret(SECRET_ID, 'A', 'hunter2')]) });
    const result = await handleListSmSecrets({ projectId: PROJECT_ID });
    expect(result.isError).toBe(false);
    expect(textOf(result)).not.toContain('hunter2');
    expect(textOf(result)).toContain('"key": "A"');
    expect(calls[0]!.args.slice(-2)).toEqual(['--', PROJECT_ID]);
  });

  it('returns the value from get_sm_secret', async () => {
    mockBws({ stdout: JSON.stringify(secret(SECRET_ID, 'A', 'hunter2')) });
    const result = await handleGetSmSecret({ secretId: SECRET_ID });
    expect(textOf(result)).toContain('hunter2');
  });

  it('creates a secret with a generated value it never returns', async () => {
    // bws echoes the created secret back, value included.
    mockBws((args) => ({
      stdout: JSON.stringify(
        secret(SECRET_ID, 'DB_PASSWORD', args[args.length - 2]!),
      ),
    }));

    const result = await handleCreateSmSecret({
      key: 'DB_PASSWORD',
      projectId: PROJECT_ID,
      generate: { length: 40 },
      note: 'prod',
    });

    const args = calls[0]!.args;
    const generated = args[args.length - 2]!;
    expect(generated).toHaveLength(40);
    expect(args).toContain('--note=prod');
    expect(args.slice(-4)).toEqual([
      '--',
      'DB_PASSWORD',
      generated,
      PROJECT_ID,
    ]);
    expect(result.isError).toBe(false);
    expect(textOf(result)).toContain('DB_PASSWORD');
    expect(textOf(result)).not.toContain(generated);
  });

  it('builds edit options in the --name=value form', async () => {
    mockBws({ stdout: JSON.stringify(secret(SECRET_ID, 'B', '-x')) });
    const result = await handleEditSmSecret({
      secretId: SECRET_ID,
      key: 'B',
      value: '-x',
      note: 'n',
      projectId: OTHER_PROJECT_ID,
    });
    expect(calls[0]!.args).toEqual([
      'secret',
      'edit',
      '--key=B',
      '--value=-x',
      '--note=n',
      `--project-id=${OTHER_PROJECT_ID}`,
      '--output',
      'json',
      '--color',
      'no',
      '--',
      SECRET_ID,
    ]);
    expect(textOf(result)).not.toContain('"value"');
  });

  it('renames a project', async () => {
    mockBws({ stdout: '{}' });
    await handleEditSmProject({ projectId: PROJECT_ID, name: 'prod' });
    expect(calls[0]!.args.slice(0, 3)).toEqual([
      'project',
      'edit',
      '--name=prod',
    ]);
    expect(calls[0]!.args.slice(-1)).toEqual([PROJECT_ID]);
  });

  it('deletes a secret by ID', async () => {
    mockBws({ stdout: '1 secret deleted successfully.' });
    const result = await handleDeleteSmSecret({ secretId: SECRET_ID });
    expect(result.isError).toBe(false);
    expect(calls[0]!.args.slice(0, 2)).toEqual(['secret', 'delete']);
    expect(calls[0]!.args.slice(-1)).toEqual([SECRET_ID]);
  });

  it('surfaces bws errors', async () => {
    mockBws({ stderr: 'Error: Secret not found', code: 1 });
    const result = await handleGetSmSecret({ secretId: SECRET_ID });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('Error: Secret not found');
  });
});

describe('Secrets Manager import and export', () => {
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-sm-test-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates new keys and skips existing ones without overwrite', async () => {
    const filePath = path.join(tmpDir, 'import.env');
    fs.writeFileSync(filePath, 'NEW_KEY=new-value\nOLD_KEY=changed-value\n');
    mockBws(
      { stdout: JSON.stringify([secret(SECRET_ID, 'OLD_KEY', 'old-value')]) },
      {
        stdout: JSON.stringify(
          secret(OTHER_PROJECT_ID, 'NEW_KEY', 'new-value'),
        ),
      },
    );

    const result = await handleImportSmSecrets({
      filePath,
      projectId: PROJECT_ID,
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(textOf(result))).toEqual({
      created: ['NEW_KEY'],
      updated: [],
      skipped: [
        {
          key: 'OLD_KEY',
          reason: 'already exists (pass overwrite: true to replace it)',
        },
      ],
      failed: [],
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.args.slice(-4)).toEqual([
      '--',
      'NEW_KEY',
      'new-value',
      PROJECT_ID,
    ]);
    expect(textOf(result)).not.toContain('new-value');
  });

  it('updates existing keys with overwrite and reports failures', async () => {
    const filePath = path.join(tmpDir, 'overwrite.env');
    fs.writeFileSync(filePath, 'OLD_KEY=changed-value\nBAD_KEY=x\n');
    mockBws(
      { stdout: JSON.stringify([secret(SECRET_ID, 'OLD_KEY', 'old-value')]) },
      { stdout: '{}' },
      { stderr: 'Error: rate limited', code: 1 },
    );

    const result = await handleImportSmSecrets({
      filePath,
      projectId: PROJECT_ID,
      overwrite: true,
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(textOf(result))).toEqual({
      created: [],
      updated: ['OLD_KEY'],
      skipped: [],
      failed: [{ key: 'BAD_KEY', error: 'Error: rate limited' }],
    });
    expect(calls[1]!.args).toContain('--value=changed-value');
    expect(calls[1]!.args.slice(-1)).toEqual([SECRET_ID]);
    expect(textOf(result)).not.toContain('changed-value');
  });

  it('changes nothing when the file has invalid lines', async () => {
    const filePath = path.join(tmpDir, 'invalid.env');
    fs.writeFileSync(filePath, 'A=1\nnot valid hunter2\n');
    mockBws();
    const result = await handleImportSmSecrets({
      filePath,
      projectId: PROJECT_ID,
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('lines 2');
    expect(textOf(result)).not.toContain('hunter2');
    expect(calls).toHaveLength(0);
  });

  it('exports secrets to an owner-only dotenv file', async () => {
    const filePath = path.join(tmpDir, 'export.env');
    mockBws({
      stdout: JSON.stringify([
        secret(SECRET_ID, 'A', 'v"1'),
        secret(OTHER_PROJECT_ID, 'My Secret', 'skip-me'),
        secret('11111111-1111-4111-8111-111111111111', 'DUP', 'd1'),
        secret('22222222-2222-4222-8222-222222222222', 'DUP', 'd2'),
      ]),
    });

    const result = await handleExportSmSecrets({
      filePath,
      projectId: PROJECT_ID,
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(textOf(result))).toEqual({
      filePath,
      exported: ['A'],
      skipped: [
        {
          key: 'My Secret',
          reason: 'the key is not a valid dotenv variable name',
        },
        { key: 'DUP', reason: 'several secrets in the project use this key' },
      ],
    });
    expect(textOf(result)).not.toContain('v"1');
    expect(fs.readFileSync(filePath, 'utf8')).toBe("A='v\"1'\n");
    if (process.platform !== 'win32') {
      expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
    }
  });

  it('refuses to replace an existing file without overwrite', async () => {
    const filePath = path.join(tmpDir, 'existing.env');
    fs.writeFileSync(filePath, 'KEEP=1\n');
    mockBws({ stdout: JSON.stringify([secret(SECRET_ID, 'A', 'v1')]) });
    const result = await handleExportSmSecrets({
      filePath,
      projectId: PROJECT_ID,
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('already exists');
    expect(fs.readFileSync(filePath, 'utf8')).toBe('KEEP=1\n');
  });
});
