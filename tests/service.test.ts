import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  digest,
  initialize,
  issueInviteCode,
  newInviteCode,
  service,
} from '../lib/service.ts';
import data from '../data/current.json';
import type { Catalog, PublicMatch, SavedRoster } from '../lib/model.ts';
import { freshRoster } from '../lib/game.ts';
import { inventoryFor, itemPurchase } from '../lib/inventory';
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
    // Exercise the same additive migrations as deployment, then the idempotent runtime initializer.
    for (const file of readdirSync('drizzle')
      .filter((x) => x.endsWith('.sql'))
      .sort())
      await db.batch(
        readFileSync(`drizzle/${file}`, 'utf8')
          .split('--> statement-breakpoint')
          .filter((sql) => sql.trim())
          .map((sql) => db.prepare(sql)),
      );
    await initialize(db);
    const call = async <T>(
      actor: string,
      action: string,
      payload: Record<string, unknown> = {},
    ) => (await service(db, actor, { action, ...payload }, d)) as T;
    type Created = SavedRoster & { readToken: string; editToken: string };
    await t.test(
      'item upgrades persist through D1 and immutable match snapshots',
      async () => {
        const r = roster();
        const c = d.characters.find((x) => x.id === 'CLAN_CHAMPION')!;
        r.entries[0].characterId = c.id;
        r.entries[0] = itemPurchase(r.entries[0], c, r, d, 'YARI').entry;
        const saved = await call<Created>('equipment-owner', 'roster.save', {
          roster: r,
        });
        const loaded = await call<SavedRoster>(
          'equipment-owner',
          'roster.get',
          { id: saved.id },
        );
        assert.ok(
          inventoryFor(c, loaded.roster.entries[0], loaded.catalog).lines.some(
            (x) => x.upgrade?.id === 'YARI',
          ),
        );
        const created = await call<{ match: PublicMatch }>(
          'equipment-owner',
          'match.create',
          { rosterId: saved.id },
        );
        r.entries[0].upgrades = [];
        await call('equipment-owner', 'roster.save', {
          id: saved.id,
          revision: saved.revision,
          roster: r,
        });
        const snapshot = created.match.players[0];
        assert.ok(
          inventoryFor(
            c,
            snapshot.roster.entries[0],
            snapshot.catalog,
          ).lines.some((x) => x.upgrade?.id === 'YARI'),
        );
      },
    );
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
      inviteCode: string;
      viewToken: string;
    }>('alice', 'match.create', { rosterId: a.id, name: 'Alice' });
    let m = created.match;
    await t.test(
      'short codes retry collisions, store hashes and expire without breaking long links',
      async () => {
        const other = await call<typeof created>('alice', 'match.create', {
          rosterId: a.id,
        });
        const occupied = created.inviteCode;
        const fresh = newInviteCode();
        let attempts = 0;
        const issued = await issueInviteCode(
          db,
          other.match.id,
          await digest(other.inviteToken),
          () => (++attempts === 1 ? occupied : fresh),
        );
        assert.equal(issued, fresh);
        assert.equal(attempts, 2);
        const stored = await db
          .prepare('SELECT * FROM match_invite_codes WHERE match_id=?')
          .bind(other.match.id)
          .first<{ code_hash: string; expires: number }>();
        assert.equal(stored!.code_hash, await digest(fresh));
        assert.ok(stored!.expires > Date.now());
        assert.ok(!JSON.stringify(stored).includes(fresh));
        assert.equal(
          (
            await call<{ id: string }>('collision-guest', 'match.find', {
              token: fresh,
            })
          ).id,
          other.match.id,
        );
        await db
          .prepare('UPDATE match_invite_codes SET expires=0 WHERE match_id=?')
          .bind(other.match.id)
          .run();
        await assert.rejects(
          call('expired-guest', 'match.find', { token: fresh }),
          /NOT_FOUND/,
        );
        assert.equal(
          (
            await call<{ canJoin: boolean }>('long-link-guest', 'match.get', {
              id: other.match.id,
              token: other.inviteToken,
            })
          ).canJoin,
          true,
        );
        await assert.rejects(
          call('raw-code-guest', 'match.get', {
            id: other.match.id,
            token: fresh,
          }),
          /FORBIDDEN/,
        );
      },
    );
    await t.test(
      'rotation revokes codes and account grants; legacy 16-character URL tokens still work',
      async () => {
        const other = await call<typeof created>('alice', 'match.create', {
          rosterId: a.id,
        });
        await call('rotation-guest', 'match.find', { token: other.inviteCode });
        const keys = await call<{
          inviteCode: string;
          inviteToken: string;
          viewToken: string;
        }>('alice', 'match.links', { id: other.match.id, revision: 1 });
        assert.match(keys.inviteCode, /^[A-HJ-NP-Z2-9]{6}$/);
        await assert.rejects(
          call('rotation-guest', 'match.get', { id: other.match.id }),
          /FORBIDDEN/,
        );
        await assert.rejects(
          call('rotation-guest', 'match.find', { token: other.inviteCode }),
          /NOT_FOUND/,
        );
        await assert.rejects(
          call('rotation-guest', 'match.get', {
            id: other.match.id,
            token: other.inviteToken,
          }),
          /FORBIDDEN/,
        );
        await assert.rejects(
          call('rotation-guest', 'match.get', {
            id: other.match.id,
            token: other.viewToken,
          }),
          /FORBIDDEN/,
        );
        await call('rotation-guest', 'match.find', { token: keys.inviteCode });
        assert.equal(
          (
            await call<{ canJoin: boolean }>('rotation-guest', 'match.get', {
              id: other.match.id,
            })
          ).canJoin,
          true,
        );
        await db
          .prepare(
            'UPDATE match_invite_grants SET expires=0 WHERE match_id=? AND actor=?',
          )
          .bind(other.match.id, 'rotation-guest')
          .run();
        await assert.rejects(
          call('rotation-guest', 'match.get', { id: other.match.id }),
          /FORBIDDEN/,
        );
        const legacyToken = crypto
          .randomUUID()
          .replaceAll('-', '')
          .slice(0, 16);
        const legacyHash = await digest(legacyToken);
        await db
          .prepare(
            "UPDATE matches SET edit_hash=?,payload=json_set(payload,'$.inviteHash',?) WHERE id=?",
          )
          .bind(legacyHash, legacyHash, other.match.id)
          .run();
        assert.equal(
          (
            await call<{ canJoin: boolean }>('legacy-guest', 'match.get', {
              id: other.match.id,
              token: legacyToken,
            })
          ).canJoin,
          true,
        );
      },
    );
    await t.test(
      'parallel guesses are limited per authenticated account and reset after a minute',
      async () => {
        const guesses = await Promise.allSettled(
          Array.from({ length: 7 }, () =>
            call('guesser', 'match.find', { token: '!' }),
          ),
        );
        assert.equal(
          guesses.filter(
            (x) => x.status === 'rejected' && x.reason.status === 404,
          ).length,
          5,
        );
        assert.equal(
          guesses.filter(
            (x) => x.status === 'rejected' && x.reason.status === 429,
          ).length,
          2,
        );
        await assert.rejects(
          call('guesser', 'match.find', { token: created.inviteCode }),
          /TOO_MANY_INVITE_ATTEMPTS/,
        );
        await db
          .prepare('UPDATE invite_attempts SET window_start=0 WHERE actor=?')
          .bind('guesser')
          .run();
        assert.equal(
          (
            await call<{ id: string }>('guesser', 'match.find', {
              token: created.inviteCode,
            })
          ).id,
          m.id,
        );
        await assert.rejects(
          call('different-account', 'match.get', { id: m.id }),
          /FORBIDDEN/,
        );
        await assert.rejects(
          call('guesser', 'match.history', { id: m.id }),
          /FORBIDDEN/,
        );
      },
    );
    await t.test(
      'invite code resolves and third parties cannot join without invitation',
      async () => {
        const found = await call<{ id: string }>('bob', 'match.find', {
          token: created.inviteCode.toLowerCase(),
        });
        assert.equal(found.id, m.id);
        assert.match(created.inviteCode, /^[A-HJ-NP-Z2-9]{6}$/);
        assert.equal(created.inviteToken.length, 32);
        assert.equal(
          (await call<{ canJoin: boolean }>('bob', 'match.get', { id: m.id }))
            .canJoin,
          true,
        );
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
          rosterId: b.id,
          name: 'Bob',
        })
      ).match;
      assert.equal(m.status, 'confirming');
      await assert.rejects(
        call('guesser', 'match.get', { id: m.id }),
        /FORBIDDEN/,
      );
      await assert.rejects(
        call('late-arrival', 'match.find', { token: created.inviteCode }),
        /NOT_FOUND/,
      );
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
