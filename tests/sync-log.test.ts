import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSyncLog, readSyncLog } from '../lib/sync-log';
import type { SyncEvent } from '../lib/sync-log';
void test('sync diagnostics survive reload without recording secrets or invalid payloads', () => {
  const row: SyncEvent = {
    at: '2026-08-31T14:00:00Z',
    matchId: 'match',
    kind: 'offline',
  };
  assert.deepEqual(
    readSyncLog(
      JSON.stringify([
        { ...row, token: 'must-not-persist' },
        null,
        {},
        { kind: 'unknown' },
      ]),
    ),
    [row],
  );
  assert.deepEqual(readSyncLog('broken JSON'), []);
  assert.deepEqual(readSyncLog(null), []);
});
void test('sync log bounds retention, avoids repeated outages, and records recovery/conflicts', () => {
  const row: SyncEvent = {
    at: '2026-08-31T14:00:00Z',
    matchId: 'match',
    kind: 'offline',
  };
  let rows = appendSyncLog([], row);
  assert.equal(appendSyncLog(rows, row), rows);
  rows = appendSyncLog(rows, { ...row, kind: 'restored' });
  assert.deepEqual(
    rows.map((x) => x.kind),
    ['offline', 'restored'],
  );
  for (let i = 0; i < 120; i++)
    rows = appendSyncLog(rows, { ...row, kind: 'conflict' });
  assert.equal(rows.length, 100);
  assert.equal(readSyncLog(JSON.stringify(rows)).length, 100);
});
