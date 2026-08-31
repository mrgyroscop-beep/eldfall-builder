import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { initialize, service } from '../lib/service.ts';
import data from '../data/current.json';
import type { Catalog, PublicMatch, SavedRoster } from '../lib/model.ts';
import { freshRoster } from '../lib/game.ts';
const d = data as Catalog;
function roster() {
  const r = freshRoster(d);
  r.name = 'Test party';
  const c = d.characters.find(
    (c) => c.factions.includes(r.factionId) && c.limit > 0,
  )!;
  r.entries = [
    { id: 'hero', characterId: c.id, notes: '', spells: [], upgrades: [] },
  ];
  r.leaderId = 'hero';
  return r;
}
void test('D1 integration: permissions, concurrent writes, snapshots and recovery', async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'test',
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      compatibilityDate: '2026-05-22',
      d1Databases: { DB: 'calad-tests' },
    }),
  );
  try {
    const db = (await mf.getD1Database('DB')) as unknown as D1Database;
    await initialize(db);
    const call = async <T>(
      actor: string,
      action: string,
      payload: Record<string, unknown> = {},
    ) => (await service(db, actor, { action, ...payload }, d)) as T;
    type Created = SavedRoster & { readToken: string; editToken: string };
    const a = await call<Created>('alice', 'roster.save', { roster: roster() }),
      b = await call<Created>('bob', 'roster.save', { roster: roster() });
    await t.test(
      'owner isolation and capability view/edit separation',
      async () => {
        await assert.rejects(
          call('eve', 'roster.get', { id: a.id }),
          /FORBIDDEN/,
        );
        const view = await call<SavedRoster>('eve', 'roster.get', {
          id: a.id,
          token: a.readToken,
        });
        assert.equal(view.canEdit, false);
        await assert.rejects(
          call('eve', 'roster.save', {
            id: a.id,
            token: a.readToken,
            revision: 1,
            roster: roster(),
          }),
          /FORBIDDEN/,
        );
        const edit = await call<SavedRoster>('eve', 'roster.get', {
          id: a.id,
          token: a.editToken,
        });
        assert.equal(edit.canEdit, true);
        await assert.rejects(call('', 'bootstrap'), /SIGN_IN_REQUIRED/);
      },
    );
    await t.test(
      'concurrent roster writes cannot overwrite and are backed up',
      async () => {
        const payload = { id: a.id, revision: 1, roster: roster() };
        const attempts = await Promise.allSettled([
          call('alice', 'roster.save', payload),
          call('alice', 'roster.save', payload),
        ]);
        assert.equal(
          attempts.filter((x) => x.status === 'fulfilled').length,
          1,
        );
        assert.equal(attempts.filter((x) => x.status === 'rejected').length, 1);
        const history = await call<{ payload: string }[]>(
          'alice',
          'roster.history',
          { id: a.id },
        );
        assert.equal(history.length, 2);
        const restored = await call<SavedRoster>('alice', 'roster.save', {
          roster: JSON.parse(history[1].payload),
        });
        assert.notEqual(restored.id, a.id);
      },
    );
    const created = await call<{
      match: PublicMatch;
      inviteToken: string;
      viewToken: string;
    }>('alice', 'match.create', { rosterId: a.id, name: 'Alice' });
    let m = created.match;
    await t.test(
      'invite code resolves and third parties cannot join without invitation',
      async () => {
        const found = await call<{ id: string }>('bob', 'match.find', {
          token: created.inviteToken,
        });
        assert.equal(found.id, m.id);
        await assert.rejects(
          call('eve', 'match.get', { id: m.id }),
          /FORBIDDEN/,
        );
        const view = await call<{ match: PublicMatch; canJoin: boolean }>(
          'eve',
          'match.get',
          { id: m.id, token: created.viewToken },
        );
        assert.equal(view.canJoin, false);
        assert.equal('inviteHash' in view.match, false);
        await assert.rejects(
          call('alice', 'match.join', {
            id: m.id,
            revision: 1,
            token: created.inviteToken,
            rosterId: a.id,
          }),
          /ALREADY_JOINED/,
        );
      },
    );
    await t.test('join requires own, legal and compatible roster', async () => {
      await assert.rejects(
        call('bob', 'match.join', {
          id: m.id,
          revision: 1,
          token: created.inviteToken,
          rosterId: a.id,
        }),
        /OWN_ROSTER_REQUIRED/,
      );
      const wrong = roster();
      wrong.pointsLimit = 65;
      const s = await call<SavedRoster>('bob', 'roster.save', {
        roster: wrong,
      });
      await assert.rejects(
        call('bob', 'match.join', {
          id: m.id,
          revision: 1,
          token: created.inviteToken,
          rosterId: s.id,
        }),
        /FORMAT_MISMATCH/,
      );
      m = (
        await call<{ match: PublicMatch }>('bob', 'match.join', {
          id: m.id,
          revision: 1,
          token: created.inviteToken,
          rosterId: b.id,
          name: 'Bob',
        })
      ).match;
      assert.equal(m.status, 'confirming');
      await assert.rejects(
        call('eve', 'match.join', {
          id: m.id,
          revision: m.revision,
          token: created.inviteToken,
          rosterId: b.id,
        }),
        /MATCH_FULL/,
      );
    });
    const act = async (actor: string, change: Record<string, unknown>) => {
      m = (
        await call<{ match: PublicMatch }>(actor, 'match.act', {
          id: m.id,
          revision: m.revision,
          change,
        })
      ).match;
    };
    await t.test(
      'two confirmations and withdrawal, immutable snapshot',
      async () => {
        await act('alice', { type: 'ready' });
        assert.equal(m.status, 'confirming');
        await act('alice', { type: 'ready' });
        assert.equal(m.players[0].ready, false);
        await act('alice', { type: 'ready' });
        await act('bob', { type: 'ready' });
        assert.equal(m.status, 'active');
        const changed = roster();
        changed.name = 'Changed source';
        await call('alice', 'roster.save', {
          id: a.id,
          revision: 2,
          roster: changed,
        });
        assert.equal(m.players[0].roster.name, 'Test party');
      },
    );
    await t.test(
      'opponent, observer and malformed clients cannot mutate resources',
      async () => {
        await assert.rejects(
          act('alice', { type: 'unit', key: '1:hero', field: 'hp', value: 0 }),
          /FORBIDDEN/,
        );
        await assert.rejects(
          call('eve', 'match.act', {
            id: m.id,
            revision: m.revision,
            token: created.viewToken,
            change: { type: 'round' },
          }),
          /FORBIDDEN/,
        );
        await assert.rejects(
          act('alice', { type: 'unit', key: '0:hero', field: 'hp', value: -1 }),
          /RANGE/,
        );
        await assert.rejects(
          act('alice', {
            type: 'unit',
            key: '0:hero',
            field: 'states',
            value: ['made-up'],
          }),
          /BAD_STATE/,
        );
        await assert.rejects(act('bob', { type: 'round' }), /NOT_ACTIVE_SIDE/);
      },
    );
    await t.test(
      'simultaneous match writes return one conflict; reconnect gets winner',
      async () => {
        const p = { id: m.id, revision: m.revision };
        const res = await Promise.allSettled([
          call('alice', 'match.act', {
            ...p,
            change: { type: 'unit', key: '0:hero', field: 'hp', value: 0 },
          }),
          call('bob', 'match.act', {
            ...p,
            change: { type: 'unit', key: '1:hero', field: 'hp', value: 0 },
          }),
        ]);
        assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1);
        const fresh = await call<{ match: PublicMatch }>('alice', 'match.get', {
          id: m.id,
        });
        assert.equal(fresh.match.revision, m.revision + 1);
        m = fresh.match;
        const events = await call<{ seq: number; play: unknown }[]>(
          'alice',
          'match.history',
          { id: m.id },
        );
        assert.equal(new Set(events.map((x) => x.seq)).size, events.length);
        assert.deepEqual(events.at(-1)!.play, m.play);
      },
    );
    await t.test(
      'undo permissions, pause and resume from another device',
      async () => {
        await act('alice', { type: 'score', value: -1 });
        await assert.rejects(act('bob', { type: 'undo' }), /NO_UNDO/);
        await act('alice', { type: 'undo' });
        assert.equal(m.play.score[0], 0);
        await act('alice', {
          type: 'unit',
          key: '0:hero',
          field: 'states',
          value: ['Poisoned'],
        });
        await act('alice', { type: 'pause' });
        await assert.rejects(
          act('bob', { type: 'score', value: 5 }),
          /NOT_ACTIVE/,
        );
        const reconnect = await call<{ match: PublicMatch }>(
          'bob',
          'match.get',
          { id: m.id },
        );
        assert.equal(reconnect.match.status, 'paused');
        assert.deepEqual(reconnect.match.play, m.play);
        m = reconnect.match;
        await act('bob', { type: 'resume' });
      },
    );
    await t.test(
      'completed match is immutable and listed in history',
      async () => {
        await act('alice', { type: 'finish', result: 'Alice wins; 3–2' });
        assert.equal(m.status, 'finished');
        await assert.rejects(
          act('bob', { type: 'unit', key: '1:hero', field: 'hp', value: 1 }),
          /FINISHED/,
        );
        const b = await call<{ matches: { id: string; status: string }[] }>(
          'bob',
          'bootstrap',
        );
        assert.equal(b.matches.find((x) => x.id === m.id)?.status, 'finished');
      },
    );
  } finally {
    await mf.dispose();
  }
});
