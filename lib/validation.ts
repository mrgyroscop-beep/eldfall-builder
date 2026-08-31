import type { Roster, Catalog } from './model.ts';
const obj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown, max = 200): x is string =>
  typeof x === 'string' && x.length <= max;
export function parseRoster(x: unknown): Roster {
  if (
    !obj(x) ||
    !str(x.name, 120) ||
    !str(x.factionId) ||
    !str(x.dataVersion) ||
    !str(x.rulesVersion) ||
    !Number.isInteger(x.pointsLimit) ||
    Number(x.pointsLimit) < 1 ||
    Number(x.pointsLimit) > 1000 ||
    !str(x.notes, 5000) ||
    !(x.leaderId === null || str(x.leaderId)) ||
    !Array.isArray(x.entries) ||
    x.entries.length > 30
  )
    throw Error('BAD_ROSTER');
  for (const e of x.entries) {
    if (
      !obj(e) ||
      !str(e.id, 80) ||
      !e.id ||
      !str(e.characterId) ||
      !str(e.notes, 2000) ||
      !Array.isArray(e.spells) ||
      e.spells.length > 100 ||
      !e.spells.every((s) => str(s)) ||
      !Array.isArray(e.upgrades) ||
      e.upgrades.length > 8 ||
      !e.upgrades.every((u) => obj(u) && str(u.id) && str(u.choice))
    )
      throw Error('BAD_ROSTER');
  }
  return structuredClone(x) as Roster;
}
export function validateCatalog(d: Catalog) {
  if (d.schemaVersion !== 1 || !d.version || !d.characters.length)
    throw Error('BAD_CATALOG');
  for (const list of [
    d.characters,
    d.factions,
    d.classes,
    d.items,
    d.traits,
    d.skills,
    d.combatArts,
    d.stratagems,
    d.schools,
  ])
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw Error('DUPLICATE_CATALOG_ID');
  for (const c of d.characters) {
    if (
      !c.id ||
      !c.name ||
      !Number.isFinite(c.cost) ||
      c.cost < 0 ||
      !Number.isInteger(c.limit) ||
      c.limit < 0
    )
      throw Error('BAD_CHARACTER');
    for (const [ids, table] of [
      [c.factions, d.factions],
      [c.classes, d.classes],
      [c.skills, d.skills],
      [c.combatArts, d.combatArts],
      [c.stratagems, d.stratagems],
      [c.traits.map((x) => x.traitId), d.traits],
      [c.items.map((x) => x.itemId), d.items],
      [c.spellcrafts.map((x) => x.schoolId), d.schools],
    ] as [string[], { id: string }[]][]) {
      if (ids.some((id) => !table.some((t) => t.id === id)))
        throw Error(`BROKEN_REFERENCE:${c.id}`);
    }
  }
  return d;
}
