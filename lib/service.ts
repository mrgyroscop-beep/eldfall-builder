import type { Catalog, Match, PublicMatch } from './model.ts';
import { parseRoster } from './validation.ts';
import { initialPlay, reduceMatch, validate } from './game.ts';
import type { MatchAction } from './game.ts';

export class Problem extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type Row = {
  id: string;
  owner: string;
  guest?: string;
  payload: string;
  revision: number;
  updated: string;
  read_hash: string;
  edit_hash: string;
};
export const migrations = [
  'CREATE TABLE IF NOT EXISTS datasets (id TEXT PRIMARY KEY, payload TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS rosters (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL, updated TEXT NOT NULL, read_hash TEXT NOT NULL, edit_hash TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS roster_owner ON rosters(owner,updated)',
  'CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, owner TEXT NOT NULL, guest TEXT, payload TEXT NOT NULL, revision INTEGER NOT NULL, updated TEXT NOT NULL, read_hash TEXT NOT NULL, edit_hash TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS match_owner ON matches(owner,updated)',
  'CREATE INDEX IF NOT EXISTS match_guest ON matches(guest,updated)',
  'CREATE TABLE IF NOT EXISTS match_events (match_id TEXT NOT NULL, seq INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(match_id,seq))',
  'CREATE TABLE IF NOT EXISTS roster_versions (roster_id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(roster_id,revision))',
  'CREATE TABLE IF NOT EXISTS match_invite_codes (code_hash TEXT PRIMARY KEY, match_id TEXT NOT NULL UNIQUE, invite_hash TEXT NOT NULL, expires INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS match_invite_grants (match_id TEXT NOT NULL, actor TEXT NOT NULL, invite_hash TEXT NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY(match_id,actor))',
  'CREATE TABLE IF NOT EXISTS invite_attempts (actor TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL)',
];
export async function initialize(db: D1Database) {
  await db.batch(migrations.map((sql) => db.prepare(sql)));
}
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
const token = () => crypto.randomUUID().replaceAll('-', '');
export const newInviteCode = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32],
  ).join('');
export async function issueInviteCode(
  db: D1Database,
  matchId: string,
  inviteHash: string,
  generate = newInviteCode,
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generate();
    const codeHash = await digest(code);
    // Both uniqueness and invitation generation are checked in the same write.
    const result = await db
      .prepare(`
      INSERT INTO match_invite_codes(code_hash,match_id,invite_hash,expires)
      SELECT ?,id,edit_hash,? FROM matches WHERE id=? AND edit_hash=?
      AND NOT EXISTS (SELECT 1 FROM match_invite_codes WHERE code_hash=?)
      ON CONFLICT(match_id) DO UPDATE SET code_hash=excluded.code_hash,
        invite_hash=excluded.invite_hash,expires=excluded.expires
    `)
      .bind(codeHash, Date.now() + 86400000, matchId, inviteHash, codeHash)
      .run();
    if (result.meta.changes) return code;
  }
  throw new Problem(503, 'INVITE_CODE_UNAVAILABLE');
}
const publicMatch = (m: Match): PublicMatch => {
  const { inviteHash: _i, viewHash: _v, ...safe } = m;
  return safe;
};
const packet = (r: Row) => ({
  id: r.id,
  revision: r.revision,
  roster: JSON.parse(r.payload),
  updatedAt: r.updated,
});
const bounded = (x: unknown) => {
  const s = JSON.stringify(x);
  if (new TextEncoder().encode(s).length > 1500000)
    throw new Problem(413, 'RECORD_TOO_LARGE');
  return s;
};
export async function service(
  db: D1Database,
  actor: string,
  body: Record<string, unknown>,
  current: Catalog,
  inviteRateActor = actor,
) {
  if (!actor) throw new Problem(401, 'SIGN_IN_REQUIRED');
  const string = (key: string, fallback = '') => {
    const value = body[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || value.length > 1000)
      throw new Problem(400, 'BAD_INPUT');
    return value;
  };
  const action = string('action'),
    id = string('id'),
    cap = string('token');
  const hash = cap ? await digest(cap) : '';
  const row = async (table: 'rosters' | 'matches') => {
    const r = await db
      .prepare(`SELECT * FROM ${table} WHERE id=?`)
      .bind(id)
      .first<Row>();
    if (!r) throw new Problem(404, 'NOT_FOUND');
    return r;
  };
  const data = async (version: string) => {
    if (version === current.version) return current;
    const r = await db
      .prepare('SELECT payload FROM datasets WHERE id=?')
      .bind(version)
      .first<{ payload: string }>();
    if (!r) throw new Problem(422, 'DATA_VERSION_UNAVAILABLE');
    return JSON.parse(r.payload) as Catalog;
  };
  const remember = async (d: Catalog) => {
    await db
      .prepare('INSERT OR IGNORE INTO datasets(id,payload) VALUES(?,?)')
      .bind(d.version, JSON.stringify(d))
      .run();
  };
  const readable = (r: Row) =>
    r.owner === actor ||
    r.guest === actor ||
    (!!hash && (hash === r.read_hash || hash === r.edit_hash));
  const editable = (r: Row) =>
    r.owner === actor || (!!hash && hash === r.edit_hash);
  const revision = (r: Row) => {
    if (!Number.isInteger(body.revision) || body.revision !== r.revision)
      throw new Problem(409, 'CONFLICT');
  };
  if (action === 'catalog.get') return data(string('version'));
  if (action === 'bootstrap') {
    const [rs, ms] = await Promise.all([
      db
        .prepare(
          'SELECT id,payload,revision,updated FROM rosters WHERE owner=? ORDER BY updated DESC',
        )
        .bind(actor)
        .all<Row>(),
      db
        .prepare(
          'SELECT id,payload,revision,updated FROM matches WHERE owner=? OR guest=? ORDER BY updated DESC',
        )
        .bind(actor, actor)
        .all<Row>(),
    ]);
    return {
      userId: actor,
      rosters: rs.results.map(packet),
      matches: ms.results.map((r) => {
        const m = JSON.parse(r.payload) as Match;
        return {
          id: m.id,
          status: m.status,
          updatedAt: m.updatedAt,
          result: m.result,
          players: m.players.map((p) => ({
            name: p.name,
            rosterName: p.roster.name,
          })),
          revision: m.revision,
        };
      }),
    };
  }
  if (action === 'roster.get') {
    const r = await row('rosters');
    if (!readable(r)) throw new Problem(403, 'FORBIDDEN');
    const p = packet(r);
    return {
      ...p,
      catalog: await data(p.roster.dataVersion),
      canEdit: editable(r),
    };
  }
  if (action === 'roster.save') {
    const roster = parseRoster(body.roster);
    const d = await data(roster.dataVersion);
    if (roster.rulesVersion !== d.rulesVersion)
      throw new Problem(422, 'RULES_VERSION_MISMATCH');
    await remember(d);
    const now = new Date().toISOString(),
      payload = bounded(roster);
    if (!id) {
      const newId = crypto.randomUUID(),
        read = token(),
        edit = token();
      await db.batch([
        db
          .prepare('INSERT INTO rosters VALUES(?,?,?,?,?,?,?)')
          .bind(
            newId,
            actor,
            payload,
            1,
            now,
            await digest(read),
            await digest(edit),
          ),
        db
          .prepare('INSERT INTO roster_versions VALUES(?,?,?,?)')
          .bind(newId, 1, payload, now),
      ]);
      return {
        id: newId,
        revision: 1,
        roster,
        catalog: d,
        updatedAt: now,
        canEdit: true,
        readToken: read,
        editToken: edit,
      };
    }
    const r = await row('rosters');
    if (!editable(r)) throw new Problem(403, 'FORBIDDEN');
    revision(r);
    const result = await db.batch([
      db
        .prepare(
          'UPDATE rosters SET payload=?,revision=revision+1,updated=? WHERE id=? AND revision=?',
        )
        .bind(payload, now, id, r.revision),
      db
        .prepare(
          'INSERT OR IGNORE INTO roster_versions SELECT id,revision,payload,updated FROM rosters WHERE id=? AND changes()=1',
        )
        .bind(id),
    ]);
    if (!result[0].meta.changes) throw new Problem(409, 'CONFLICT');
    return {
      id,
      revision: r.revision + 1,
      roster,
      catalog: d,
      updatedAt: now,
      canEdit: true,
    };
  }
  if (action === 'roster.links') {
    const r = await row('rosters');
    if (r.owner !== actor) throw new Problem(403, 'OWNER_ONLY');
    const read = token(),
      edit = token();
    await db
      .prepare('UPDATE rosters SET read_hash=?,edit_hash=? WHERE id=?')
      .bind(await digest(read), await digest(edit), id)
      .run();
    return { readToken: read, editToken: edit };
  }
  if (action === 'roster.history') {
    const r = await row('rosters');
    if (r.owner !== actor) throw new Problem(403, 'OWNER_ONLY');
    return (
      await db
        .prepare(
          'SELECT revision,payload,updated FROM roster_versions WHERE roster_id=? ORDER BY revision DESC LIMIT 100',
        )
        .bind(id)
        .all()
    ).results;
  }
  const ownRoster = async () => {
    const r = await db
      .prepare('SELECT * FROM rosters WHERE id=? AND owner=?')
      .bind(string('rosterId'), actor)
      .first<Row>();
    if (!r) throw new Problem(403, 'OWN_ROSTER_REQUIRED');
    const roster = parseRoster(JSON.parse(r.payload)),
      d = await data(roster.dataVersion);
    const errors = validate(roster, d).filter((x) => x.severity === 'error');
    if (errors.length)
      throw new Problem(
        422,
        `INVALID_ROSTER: ${errors.map((e) => e.message).join(' ')}`,
      );
    return {
      userId: actor,
      name: string('name', 'Player').trim().slice(0, 80) || 'Player',
      roster,
      catalog: {
        ...d,
        characters: d.characters.filter((c) =>
          roster.entries.some((e) => e.characterId === c.id),
        ),
      },
      ready: false,
    };
  };
  if (action === 'match.create') {
    const p = await ownRoster(),
      newId = crypto.randomUUID(),
      invite = token(),
      view = token(),
      now = new Date().toISOString();
    const m: Match = {
      id: newId,
      revision: 1,
      status: 'waiting',
      players: [p],
      play: initialPlay([p]),
      events: [],
      result: '',
      notes: '',
      createdAt: now,
      updatedAt: now,
      undo: null,
      inviteHash: await digest(invite),
      viewHash: await digest(view),
    };
    await db
      .prepare('INSERT INTO matches VALUES(?,?,?,?,?,?,?,?)')
      .bind(newId, actor, null, bounded(m), 1, now, m.viewHash, m.inviteHash)
      .run();
    const inviteCode = await issueInviteCode(db, newId, m.inviteHash);
    return {
      match: publicMatch(m),
      inviteCode,
      inviteToken: invite,
      viewToken: view,
    };
  }
  if (action === 'match.find') {
    const now = Date.now();
    // Persistent, atomic per-account limit; malformed guesses count as attempts too.
    const limit = await db
      .prepare(`
      INSERT INTO invite_attempts(actor,window_start,attempts) VALUES(?,?,1)
      ON CONFLICT(actor) DO UPDATE SET
        attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END,
        window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END
      RETURNING attempts
    `)
      .bind(inviteRateActor, now, now - 60000, now - 60000)
      .first<{ attempts: number }>();
    if (!limit || limit.attempts > 5)
      throw new Problem(429, 'TOO_MANY_INVITE_ATTEMPTS');
    const code = cap.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Problem(404, 'NOT_FOUND');
    const r = await db
      .prepare(`SELECT m.id,m.edit_hash FROM match_invite_codes c JOIN matches m ON m.id=c.match_id
        WHERE c.code_hash=? AND c.expires>? AND c.invite_hash=m.edit_hash
        AND m.guest IS NULL AND json_extract(m.payload,'$.status')='waiting'`)
      .bind(await digest(code), now)
      .first<{ id: string; edit_hash: string }>();
    if (!r) throw new Problem(404, 'NOT_FOUND');
    // Redeem into an account-bound, short-lived permission, never a reusable URL secret.
    await db
      .prepare(`INSERT INTO match_invite_grants(match_id,actor,invite_hash,expires) VALUES(?,?,?,?)
      ON CONFLICT(match_id,actor) DO UPDATE SET invite_hash=excluded.invite_hash,expires=excluded.expires`)
      .bind(r.id, actor, r.edit_hash, now + 1800000)
      .run();
    return { id: r.id };
  }
  if (action === 'match.links') {
    const rowData = await row('matches');
    if (rowData.owner !== actor) throw new Problem(403, 'OWNER_ONLY');
    revision(rowData);
    const currentMatch = JSON.parse(rowData.payload) as Match;
    const invite = token(),
      view = token();
    currentMatch.inviteHash = await digest(invite);
    currentMatch.viewHash = await digest(view);
    const result = await db
      .prepare(
        'UPDATE matches SET payload=?,read_hash=?,edit_hash=? WHERE id=? AND revision=? AND edit_hash=?',
      )
      .bind(
        bounded(currentMatch),
        currentMatch.viewHash,
        currentMatch.inviteHash,
        id,
        rowData.revision,
        rowData.edit_hash,
      )
      .run();
    if (!result.meta.changes) throw new Problem(409, 'CONFLICT');
    const inviteCode = await issueInviteCode(db, id, currentMatch.inviteHash);
    return { inviteCode, inviteToken: invite, viewToken: view };
  }
  if (action.startsWith('match.')) {
    const r = await row('matches');
    let m = JSON.parse(r.payload) as Match;
    const granted =
      m.status === 'waiting' &&
      !r.guest &&
      !!(await db
        .prepare(
          'SELECT 1 FROM match_invite_grants WHERE match_id=? AND actor=? AND invite_hash=? AND expires>?',
        )
        .bind(id, actor, r.edit_hash, Date.now())
        .first());
    if (!readable(r) && !granted) throw new Problem(403, 'FORBIDDEN');
    if (action === 'match.get') {
      const events = await db
        .prepare(
          'SELECT payload FROM match_events WHERE match_id=? ORDER BY seq DESC LIMIT 100',
        )
        .bind(id)
        .all<{ payload: string }>();
      m.events = events.results.map((e) => JSON.parse(e.payload)).reverse();
      return {
        match: publicMatch(m),
        canJoin:
          m.status === 'waiting' &&
          m.players[0].userId !== actor &&
          (hash === r.edit_hash || granted),
      };
    }
    if (action === 'match.history') {
      if (!m.players.some((p) => p.userId === actor) && hash !== r.read_hash)
        throw new Problem(403, 'FORBIDDEN');
      return (
        await db
          .prepare(
            'SELECT payload FROM match_events WHERE match_id=? AND seq>? ORDER BY seq LIMIT 1000',
          )
          .bind(id, Number(body.after) || 0)
          .all<{ payload: string }>()
      ).results.map((e) => JSON.parse(e.payload));
    }
    revision(r);
    if (action === 'match.join') {
      if (m.players.some((p) => p.userId === actor))
        throw new Problem(409, 'ALREADY_JOINED');
      if (m.status !== 'waiting' || m.players.length !== 1)
        throw new Problem(409, 'MATCH_FULL');
      if (hash !== r.edit_hash && !granted)
        throw new Problem(403, 'INVITE_REQUIRED');
      const p = await ownRoster(),
        a = m.players[0].roster,
        b = p.roster;
      if (
        a.dataVersion !== b.dataVersion ||
        a.rulesVersion !== b.rulesVersion ||
        a.pointsLimit !== b.pointsLimit
      )
        throw new Problem(422, 'FORMAT_MISMATCH');
      m.players.push(p);
      m.status = 'confirming';
      m.revision++;
      m.updatedAt = new Date().toISOString();
      m.play = initialPlay(m.players);
      m.events.push({
        seq: m.revision,
        actor,
        action: 'join',
        at: m.updatedAt,
        play: m.play,
        status: m.status,
      });
    } else if (action === 'match.act') {
      if (!body.change || typeof body.change !== 'object')
        throw new Problem(400, 'BAD_ACTION');
      m = reduceMatch(m, actor, body.change as MatchAction);
    } else throw new Problem(400, 'BAD_ACTION');
    const event = m.events.at(-1)!;
    m.events = [];
    const result = await db.batch([
      db
        .prepare(
          'UPDATE matches SET guest=?,payload=?,revision=?,updated=? WHERE id=? AND revision=? AND edit_hash=?',
        )
        .bind(
          m.players[1]?.userId ?? null,
          bounded(m),
          m.revision,
          m.updatedAt,
          id,
          r.revision,
          r.edit_hash,
        ),
      db
        .prepare(
          'INSERT OR IGNORE INTO match_events SELECT id,revision,? FROM matches WHERE id=? AND changes()=1',
        )
        .bind(JSON.stringify(event), id),
    ]);
    if (!result[0].meta.changes) throw new Problem(409, 'CONFLICT');
    m.events = [event];
    return { match: publicMatch(m) };
  }
  throw new Problem(400, 'BAD_ACTION');
}
