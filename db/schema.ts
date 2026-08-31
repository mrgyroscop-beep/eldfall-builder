import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
export const datasets = sqliteTable('datasets', {
  id: text().primaryKey(),
  payload: text().notNull(),
});
export const rosters = sqliteTable(
  'rosters',
  {
    id: text().primaryKey(),
    owner: text().notNull(),
    payload: text().notNull(),
    revision: integer().notNull(),
    updated: text().notNull(),
    read_hash: text().notNull(),
    edit_hash: text().notNull(),
  },
  (t) => [index('roster_owner').on(t.owner, t.updated)],
);
export const matches = sqliteTable(
  'matches',
  {
    id: text().primaryKey(),
    owner: text().notNull(),
    guest: text(),
    payload: text().notNull(),
    revision: integer().notNull(),
    updated: text().notNull(),
    read_hash: text().notNull(),
    edit_hash: text().notNull(),
  },
  (t) => [
    index('match_owner').on(t.owner, t.updated),
    index('match_guest').on(t.guest, t.updated),
  ],
);
export const matchEvents = sqliteTable(
  'match_events',
  {
    match_id: text().notNull(),
    seq: integer().notNull(),
    payload: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.match_id, t.seq] })],
);
export const rosterVersions = sqliteTable(
  'roster_versions',
  {
    roster_id: text().notNull(),
    revision: integer().notNull(),
    payload: text().notNull(),
    updated: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.roster_id, t.revision] })],
);
export const matchInviteCodes = sqliteTable('match_invite_codes', {
  code_hash: text().primaryKey(),
  match_id: text().notNull().unique(),
  invite_hash: text().notNull(),
  expires: integer().notNull(),
});
export const matchInviteGrants = sqliteTable(
  'match_invite_grants',
  {
    match_id: text().notNull(),
    actor: text().notNull(),
    invite_hash: text().notNull(),
    expires: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.match_id, t.actor] })],
);
export const inviteAttempts = sqliteTable('invite_attempts', {
  actor: text().primaryKey(),
  window_start: integer().notNull(),
  attempts: integer().notNull(),
});
