import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as h from '../src/handlers/cli.js';
import { _resetBwInvocationCacheForTests } from '../src/utils/bw-cli.js';

const org = 'b4d3a1c2-0000-4000-8000-000000000001';
const ok = 'b4d3a1c2-0000-4000-8000-000000000002';
const bad = '--quiet';

type Handler = (a: unknown) => Promise<{ isError?: boolean }>;
const cases: [string, Handler, object][] = [
  ['get id', h.handleGet, { object: 'item', id: bad }],
  ['edit item id', h.handleEditItem, { id: bad }],
  ['edit folder id', h.handleEditFolder, { id: bad, name: 'n' }],
  ['delete id', h.handleDelete, { object: 'item', id: bad }],
  ['confirm memberId', h.handleConfirm, { organizationId: org, memberId: bad }],
  [
    'confirm organizationId',
    h.handleConfirm,
    { organizationId: bad, memberId: ok },
  ],
  [
    'edit org-collection collectionId',
    h.handleEditOrgCollection,
    { organizationId: org, collectionId: bad },
  ],
  [
    'edit org-collection organizationId',
    h.handleEditOrgCollection,
    { organizationId: bad, collectionId: ok },
  ],
  [
    'edit item-collections itemId',
    h.handleEditItemCollections,
    { itemId: bad, organizationId: org, collectionIds: [] },
  ],
  [
    'edit item-collections organizationId',
    h.handleEditItemCollections,
    { itemId: ok, organizationId: bad, collectionIds: [] },
  ],
  [
    'move itemId',
    h.handleMove,
    { itemId: '--raw', organizationId: org, collectionIds: [] },
  ],
  [
    'move organizationId',
    h.handleMove,
    { itemId: ok, organizationId: bad, collectionIds: [] },
  ],
  [
    'device-approval list organizationId',
    h.handleDeviceApprovalList,
    { organizationId: bad },
  ],
  [
    'device-approval approve requestId',
    h.handleDeviceApprovalApprove,
    { organizationId: org, requestId: bad },
  ],
  [
    'device-approval approve organizationId',
    h.handleDeviceApprovalApprove,
    { organizationId: bad, requestId: ok },
  ],
  [
    'device-approval approve-all organizationId',
    h.handleDeviceApprovalApproveAll,
    { organizationId: bad },
  ],
  [
    'device-approval deny requestId',
    h.handleDeviceApprovalDeny,
    { organizationId: org, requestId: bad },
  ],
  [
    'device-approval deny organizationId',
    h.handleDeviceApprovalDeny,
    { organizationId: bad, requestId: ok },
  ],
  [
    'device-approval deny-all organizationId',
    h.handleDeviceApprovalDenyAll,
    { organizationId: bad },
  ],
  ['restore id', h.handleRestore, { object: 'item', id: bad }],
  ['send get id', h.handleGetSend, { id: bad }],
  ['send edit id', h.handleEditSend, { id: bad }],
  ['send delete id', h.handleDeleteSend, { id: bad }],
  ['send remove-password id', h.handleRemoveSendPassword, { id: bad }],
  [
    'create attachment itemId',
    h.handleCreateAttachment,
    { filePath: '/tmp/x', itemId: bad },
  ],
];

describe('positional IDs starting with "-" never reach bw', () => {
  let dir: string;
  let marker: string;
  const saved = process.env['BW_CLI_PATH'];

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-bw-'));
    marker = path.join(dir, 'spawned');
    const file = path.join(dir, 'fake-bw.js');
    fs.writeFileSync(
      file,
      `require('fs').appendFileSync(${JSON.stringify(marker)}, process.argv.slice(2).join(' ') + '\\n');process.stdout.write('{}');`,
    );
    process.env['BW_CLI_PATH'] = file;
    _resetBwInvocationCacheForTests();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env['BW_CLI_PATH'];
    else process.env['BW_CLI_PATH'] = saved;
    _resetBwInvocationCacheForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it.each(cases)('%s', async (_name, handler, args) => {
    const res = await handler(args);
    expect(res.isError).toBe(true);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('control: a well-formed ID reaches bw', async () => {
    const res = await h.handleDeleteSend({ id: ok });
    expect(res.isError).toBe(false);
    expect(fs.readFileSync(marker, 'utf8')).toContain(`send delete ${ok}`);
  });
});
