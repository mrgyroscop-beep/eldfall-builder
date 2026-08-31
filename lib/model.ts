export type Lang = 'ru' | 'en';
export type RuleRecord = {
  id: string;
  name?: string;
  name__?: string;
  description?: string | null;
  effect?: string | null;
  level?: number;
  code?: string;
  [key: string]: unknown;
};
export type Character = {
  id: string;
  sourceId: number;
  name: string;
  cost: number;
  limit: number;
  neutralLimit: number | null;
  factions: string[];
  stats: Record<
    string,
    { value: number | string | null; prefix: string | null }
  >;
  size?: string;
  classes: string[];
  items: { itemId: string; quantity: number }[];
  inventorySpace: number;
  skills: string[];
  combatArts: string[];
  traits: { traitId: string; value: string | null; elements: string[] }[];
  stratagems: string[];
  spellcrafts: { schoolId: string; level: number }[];
  imagePath: string | null;
  mount: string | null;
  notes:
    | string
    | { description: unknown; title?: string | null; id?: number }
    | null;
  updatedAt: string;
};
export type Spell = RuleRecord & {
  schoolId: string;
  element: string;
  level: number;
};
export type Upgrade = {
  id: string;
  name: string;
  page: number;
  factions: string[];
  cost: number;
  limit: number | null;
  description: string;
};
export type Catalog = {
  schemaVersion: number;
  version: string;
  date: string;
  rulesVersion: string;
  sourceUrl: string;
  mediaOrigin: string | null;
  characters: Character[];
  factions: { id: string; name: string }[];
  schools: { id: string; name: string; spells: Spell[] }[];
  classes: RuleRecord[];
  items: RuleRecord[];
  traits: RuleRecord[];
  skills: RuleRecord[];
  combatArts: RuleRecord[];
  stratagems: RuleRecord[];
  upgrades?: Upgrade[];
  upgradesVersion?: string;
};
export type Entry = {
  id: string;
  element?: string;
  characterId: string;
  notes: string;
  spells: string[];
  upgrades: { id: string; choice: string }[];
};
export type Roster = {
  name: string;
  factionId: string;
  pointsLimit: number;
  dataVersion: string;
  rulesVersion: string;
  entries: Entry[];
  leaderId: string | null;
  notes: string;
};
export type Issue = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  entryId?: string;
  source: string;
};
export type SavedRoster = {
  id: string;
  revision: number;
  roster: Roster;
  catalog: Catalog;
  updatedAt: string;
  canEdit: boolean;
};
export type UnitState = {
  hp: number;
  ap: number;
  mana: number;
  states: string[];
};
export type Play = {
  round: number;
  activeSide: number;
  score: number[];
  units: Record<string, UnitState>;
};
export type Participant = {
  userId: string;
  name: string;
  roster: Roster;
  catalog: Catalog;
  ready: boolean;
};
export type MatchEvent = {
  seq: number;
  actor: string;
  action: string;
  at: string;
  play: Play;
  status: Match['status'];
};
export type Match = {
  id: string;
  revision: number;
  status: 'waiting' | 'confirming' | 'active' | 'paused' | 'finished';
  players: Participant[];
  play: Play;
  events: MatchEvent[];
  result: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  undo: null | { actor: string; play: Play };
  inviteHash: string;
  viewHash: string;
};
export type PublicMatch = Omit<Match, 'inviteHash' | 'viewHash'>;
