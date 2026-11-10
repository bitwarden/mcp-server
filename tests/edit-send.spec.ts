import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const executeCliCommandMock =
  jest.fn<
    (
      command: string,
      parameters: string[],
    ) => Promise<{ output?: string; errorOutput?: string }>
  >();

jest.mock('../src/utils/cli.js', () => ({
  executeCliCommand: (command: string, parameters: string[]) =>
    executeCliCommandMock(command, parameters),
}));

import { handleEditSend } from '../src/handlers/cli.js';
import { editSendTool } from '../src/tools/cli.js';

const id = '11111111-1111-4111-8111-111111111111';

function mockGet(send: Record<string, unknown>) {
  executeCliCommandMock.mockImplementation(async (_command, params) => {
    if (params[0] === 'get') return { output: JSON.stringify(send) };
    return { output: '{"ok":true}' };
  });
}

function editPayload(): Record<string, unknown> {
  const call = executeCliCommandMock.mock.calls.find((c) => c[1][0] === 'edit');
  expect(call).toBeDefined();
  return JSON.parse(Buffer.from(call![1][1]!, 'base64').toString('utf8'));
}

describe('handleEditSend password handling', () => {
  beforeEach(() => {
    executeCliCommandMock.mockReset();
  });

  it('refuses to edit a password-protected Send without a password', async () => {
    mockGet({ id, name: 'old', passwordSet: true });
    const result = await handleEditSend({ id, name: 'new' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('remove_send_password');
    expect(executeCliCommandMock).toHaveBeenCalledTimes(1);
    expect(executeCliCommandMock.mock.calls[0]?.[1][0]).toBe('get');
    expect(
      executeCliCommandMock.mock.calls.some((c) => c[1][0] === 'edit'),
    ).toBe(false);
  });

  it.each(['', '   '])(
    'refuses a blank password (%j) on a password-protected Send',
    async (blank) => {
      mockGet({ id, name: 'old', passwordSet: true });
      const result = await handleEditSend({ id, name: 'x', password: blank });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('remove_send_password');
      expect(
        executeCliCommandMock.mock.calls.some((c) => c[1][0] === 'edit'),
      ).toBe(false);
    },
  );

  it('sets the password when one is supplied', async () => {
    mockGet({ id, name: 'old', passwordSet: true });
    const result = await handleEditSend({ id, password: 'new-pass' });

    expect(result.isError).toBe(false);
    expect(editPayload()['password']).toBe('new-pass');
  });

  it('edits a Send without a password as before', async () => {
    mockGet({ id, name: 'old', passwordSet: false });
    const result = await handleEditSend({ id, name: 'renamed' });

    expect(result.isError).toBe(false);
    const payload = editPayload();
    expect(payload['name']).toBe('renamed');
    expect(payload['password']).toBeUndefined();
  });

  it('documents the password-protected behavior in the tool description', () => {
    expect(editSendTool.description).toContain('password protected');
    expect(editSendTool.description).toContain('remove_send_password');
  });
});
