import type {
  Catalog,
  Character,
  Roster,
  Issue,
  Match,
  Play,
} from './model.ts';
import {
  upgradeCost,
  upgradeErrors,
  upgraded,
  UPGRADE_SOURCE,
} from './upgrades.ts';
export const SOURCES = {
  core: 'https://drive.google.com/file/d/1ep86Q4VB2FCyg4O3lFyWW7dQtB-hmB-e/view',
  errata:
    'https://drive.google.com/file/d/1OLMfCG6Dn8RFA1DmQfta9BuwamPZWF_L/view',
  profiles: 'https://guildhall.eldfall-chronicles.com/',
};
export const MONSTERS = ['ONI_CLANS', 'GOBLIN_WARTRIBES'];
export function stat(c: Character, key: string) {
  const n = Number(c.stats[key]?.value);
  return Number.isFinite(n) ? n : 0;
}
export function isNeutral(c: Character, faction: string) {
  return !c.factions.includes(faction) && c.factions.includes('NEUTRAL');
}
export function available(c: Character, faction: string) {
  return (
    c.limit > 0 &&
    (c.factions.includes(faction) ||
      (!MONSTERS.includes(faction) && c.factions.includes('NEUTRAL')))
  );
}
export function total(r: Roster, d: Catalog) {
  return r.entries.reduce((n, e) => {
    const c = d.characters.find((c) => c.id === e.characterId);
    return (
      n +
      (c
        ? c.cost +
          e.upgrades.reduce((s, u) => s + upgradeCost(u.id, c, e, r, d), 0)
        : 0)
    );
  }, 0);
}
export function spellsFor(c: Character, d: Catalog) {
  const affinities = c.traits.flatMap((t) => t.elements);
  return d.schools
    .flatMap((s) => s.spells)
    .filter(
      (s) =>
        c.spellcrafts.some(
          (a) => a.schoolId === s.schoolId && a.level >= s.level,
        ) && affinities.includes(s.element),
    );
}
export function freshRoster(d: Catalog): Roster {
  return {
    name: 'Новая экспедиция',
    factionId: 'EMPIRE_OF_SOGA',
    pointsLimit: 85,
    dataVersion: d.version,
    rulesVersion: d.rulesVersion,
    entries: [],
    leaderId: null,
    notes: '',
  };
}
export function validate(r: Roster, d: Catalog): Issue[] {
  const issues: Issue[] = [];
  const add = (
    code: string,
    message: string,
    entryId?: string,
    source = SOURCES.core,
    severity: 'error' | 'warning' = 'error',
  ) => issues.push({ code, message, entryId, source, severity });
  if (!r.name.trim() || r.name.length > 120)
    add('NAME', 'Название: от 1 до 120 символов.');
  if (
    !Number.isInteger(r.pointsLimit) ||
    r.pointsLimit < 1 ||
    r.pointsLimit > 1000
  )
    add('POINTS', 'Лимит должен быть целым числом от 1 до 1000.');
  if (r.entries.length === 0) add('EMPTY', 'Добавьте хотя бы одну модель.');
  if (r.entries.length > 10)
    add('SIZE', 'В отряде не может быть более 10 моделей (правила, с. 33).');
  if (!d.factions.some((f) => f.id === r.factionId))
    add('FACTION', 'Выберите игровую фракцию.');
  if (
    r.entries.length &&
    !r.entries.some((e) =>
      d.characters
        .find((c) => c.id === e.characterId)
        ?.factions.includes(r.factionId),
    )
  )
    add('NATIVE', 'Нужна хотя бы одна модель выбранной фракции (с. 33).');
  if (r.dataVersion !== d.version || r.rulesVersion !== d.rulesVersion)
    add('VERSION', 'Нужна точная версия справочника этого ростера.');
  if (new Set(r.entries.map((e) => e.id)).size !== r.entries.length)
    add('DUPLICATE', 'Идентификаторы экземпляров моделей должны различаться.');
  const counts = new Map<string, number>();
  for (const e of r.entries) {
    const c = d.characters.find((c) => c.id === e.characterId);
    if (!c) {
      add('UNKNOWN', 'Неизвестный профиль модели.', e.id);
      continue;
    }
    if (!available(c, r.factionId))
      add(
        'UNAVAILABLE',
        `${c.name}: недоступен для этой фракции.`,
        e.id,
        MONSTERS.includes(r.factionId) ? SOURCES.errata : SOURCES.profiles,
      );
    counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    const limit = isNeutral(c, r.factionId)
      ? (c.neutralLimit ?? c.limit)
      : c.limit;
    if ((counts.get(c.id) ?? 0) > limit)
      add(
        'LIMIT',
        `${c.name}: превышен лимит ${limit}.`,
        e.id,
        SOURCES.profiles,
      );
    for (const msg of upgradeErrors(e, c, r, d))
      add('UPGRADE', msg, e.id, UPGRADE_SOURCE);
    if (
      c.id === 'DJINNBORN_MARZBAN' &&
      !['FIRE', 'AIR', 'EARTH', 'WATER', 'ELDER'].includes(e.element ?? '')
    )
      add('ELEMENT', 'Выберите одну стихию Мерзбана.', e.id, SOURCES.profiles);
    const allowed = spellsFor(upgraded(c, e, d), d).map((s) => s.id);
    if (e.spells.some((id) => !allowed.includes(id)))
      add(
        'SPELL',
        'Заклинание недоступно по школе, уровню или стихии.',
        e.id,
        SOURCES.profiles,
      );
  }
  if (total(r, d) > r.pointsLimit)
    add('OVER_BUDGET', `Превышен лимит на ${total(r, d) - r.pointsLimit} очк.`);
  if (!r.entries.some((e) => e.id === r.leaderId))
    add('LEADER', 'Назначьте лидера отряда.');
  return issues;
}
export function initialPlay(players: Match['players']): Play {
  return {
    round: 1,
    activeSide: 0,
    score: [0, 0],
    units: Object.fromEntries(
      players.flatMap((p, side) =>
        p.roster.entries.map((e) => {
          const c = p.catalog.characters.find((c) => c.id === e.characterId)!;
          return [
            `${side}:${e.id}`,
            { hp: stat(c, 'HP'), ap: stat(c, 'STA'), mana: 0, states: [] },
          ];
        }),
      ),
    ),
  };
}
export const STATES = [
  'Bleeding',
  'Blinded',
  'Confused',
  'Crippled',
  'Crouched',
  'Dead',
  'Engaged',
  'Flying',
  'Fatigued',
  'Immobilized',
  'Incapacitated',
  'Panicked',
  'Petrified',
  'Poisoned',
  'Shrouded',
  'Slowed',
  'Weakened',
];
export type MatchAction = {
  type:
    | 'ready'
    | 'pause'
    | 'resume'
    | 'finish'
    | 'unit'
    | 'round'
    | 'initiative'
    | 'score'
    | 'undo';
  key?: string;
  field?: string;
  value?: unknown;
  result?: string;
};
export function reduceMatch(
  m: Match,
  actor: string,
  a: MatchAction,
  now = new Date().toISOString(),
): Match {
  if (
    typeof a.type !== 'string' ||
    (a.key !== undefined && typeof a.key !== 'string') ||
    (a.field !== undefined && typeof a.field !== 'string') ||
    (a.result !== undefined && typeof a.result !== 'string')
  )
    throw Error('BAD_ACTION');
  const next = structuredClone(m),
    side = next.players.findIndex((p) => p.userId === actor);
  if (side < 0) throw Error('FORBIDDEN');
  if (next.status === 'finished') throw Error('FINISHED');
  if (a.type === 'ready') {
    if (next.status !== 'confirming' || next.players.length !== 2)
      throw Error('NOT_READY');
    next.players[side].ready = !next.players[side].ready;
    if (next.players.every((p) => p.ready)) {
      next.status = 'active';
      next.play = initialPlay(next.players);
    }
  } else if (a.type === 'pause') {
    if (next.status !== 'active') throw Error('NOT_ACTIVE');
    next.status = 'paused';
    next.undo = null;
  } else if (a.type === 'resume') {
    if (next.status !== 'paused') throw Error('NOT_PAUSED');
    next.status = 'active';
    next.undo = null;
  } else if (a.type === 'finish') {
    if (!['active', 'paused'].includes(next.status)) throw Error('NOT_ACTIVE');
    next.status = 'finished';
    next.result = (a.result ?? '').trim().slice(0, 500);
    if (!next.result) throw Error('RESULT_REQUIRED');
    next.undo = null;
  } else {
    if (next.status !== 'active') throw Error('NOT_ACTIVE');
    if (a.type === 'undo') {
      if (next.undo?.actor !== actor) throw Error('NO_UNDO');
      next.play = next.undo.play;
      next.undo = null;
    } else {
      next.undo = { actor, play: structuredClone(next.play) };
      if (a.type === 'unit') {
        if (!a.key?.startsWith(`${side}:`) || !next.play.units[a.key])
          throw Error('FORBIDDEN');
        const u = next.play.units[a.key];
        if (a.field === 'states') {
          if (
            !Array.isArray(a.value) ||
            a.value.some((s) => !STATES.includes(s)) ||
            new Set(a.value).size !== a.value.length
          )
            throw Error('BAD_STATE');
          u.states = a.value;
        } else if (['hp', 'ap', 'mana'].includes(a.field ?? '')) {
          if (
            !Number.isInteger(a.value) ||
            Number(a.value) < 0 ||
            Number(a.value) > 100
          )
            throw Error('RANGE');
          u[a.field as 'hp' | 'ap' | 'mana'] = Number(a.value);
        } else throw Error('BAD_FIELD');
      } else if (a.type === 'round') {
        if (next.play.activeSide !== side) throw Error('NOT_ACTIVE_SIDE');
        if (next.play.round >= 100) throw Error('RANGE');
        next.play.round++;
      } else if (a.type === 'initiative') {
        if (a.value !== 0 && a.value !== 1) throw Error('RANGE');
        next.play.activeSide = a.value;
      } else if (a.type === 'score') {
        if (
          !Number.isInteger(a.value) ||
          Number(a.value) < -1000 ||
          Number(a.value) > 1000
        )
          throw Error('RANGE');
        next.play.score[side] = Number(a.value);
      } else throw Error('BAD_ACTION');
    }
  }
  next.revision++;
  next.updatedAt = now;
  next.events.push({
    seq: next.revision,
    actor,
    action: a.type,
    at: now,
    play: structuredClone(next.play),
    status: next.status,
  });
  if (next.events.length > 1000) throw Error('EVENT_LIMIT');
  return next;
}
