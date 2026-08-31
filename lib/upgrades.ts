import source from '../data/upgrades.json';
import type { Character, Catalog, Entry, Roster } from './model.ts';
export const UPGRADES = source.records;
export const UPGRADE_SOURCE = source.source;
export const NAMED = [
  'SEIGEN',
  'THAROS',
  'ANARI',
  'NARA',
  'CHANRE',
  'KOGETSU',
  'CHIYOHIME',
  'TOMOE',
];
export function upgradeOptions(id: string, c: Character, d: Catalog): string[] {
  if (['TOME', 'SHAPER'].includes(id))
    return c.spellcrafts.map((s) => s.schoolId);
  if (id === 'LINEAGE') return ['FIRE', 'WATER', 'EARTH', 'AIR'];
  if (id === 'CATALYST')
    return c.traits
      .flatMap((t) => t.elements)
      .flatMap((e) =>
        ['FIRE', 'WATER', 'EARTH', 'AIR'].map((n) => `${e}>${n}`),
      );
  if (id === 'WEIGHT')
    return [
      'ARMOR',
      ...c.items
        .filter((i) =>
          ['WEAPON', 'SHIELD'].includes(
            String(d.items.find((x) => x.id === i.itemId)?.category),
          ),
        )
        .map((i) => i.itemId),
    ];
  return [];
}
export function upgradeCost(
  id: string,
  c: Character,
  e: Entry,
  r?: Roster,
  d?: Catalog,
) {
  let cost = (d?.upgrades ?? UPGRADES).find((u) => u.id === id)?.cost ?? 0;
  if (id === 'YARI' && c.items[0]?.itemId === 'SPEAR') cost = 1;
  if (id === 'DAIKYUU' && c.items[0]?.itemId === 'SHORT_BOW') cost = 2;
  const discounts =
    (r?.entries ?? [e])
      .flatMap((e) => e.upgrades)
      .filter((u) => u.id === 'PAIMON').length - (id === 'PAIMON' ? 1 : 0);
  if (discounts > 0) cost = Math.max(1, cost - discounts);
  return cost;
}
export function upgraded(c: Character, e: Entry, d: Catalog): Character {
  const out = structuredClone(c);
  // Guild Hall special rule: the displayed affinities are alternatives, not cumulative.
  if (c.id === 'DJINNBORN_MARZBAN') {
    out.traits = out.traits.map((t) =>
      t.traitId === 'traits-29'
        ? { ...t, elements: e.element ? [e.element] : [] }
        : t.traitId === 'traits-38'
          ? { ...t, value: e.element ?? 'X' }
          : t,
    );
  }
  const add = (k: string, n: number) => {
    if (out.stats[k]) out.stats[k].value = Number(out.stats[k].value) + n;
  };
  for (const u of e.upgrades) {
    if (['TOME', 'SHAPER'].includes(u.id)) {
      const s = out.spellcrafts.find((s) => s.schoolId === u.choice);
      if (s) s.level++;
    }
    if (u.id === 'LINEAGE')
      out.traits.push({
        traitId: 'traits-29',
        value: null,
        elements: [u.choice],
      });
    if (u.id === 'CATALYST') {
      const [old, n] = u.choice.split('>');
      out.traits = out.traits.map((t) => ({
        ...t,
        elements: t.elements.map((x) => (x === old ? n : x)),
      }));
    }
    if (u.id === 'POUCH') out.inventorySpace += 2;
    if (u.id === 'PROTECTION') {
      add('ARM', 2);
      add('AG', -2);
    }
    if (['LONGEVITY', 'PAIMON'].includes(u.id)) add('INT', 1);
    if (u.id === 'TIAMAT') {
      add('T', 1);
      if (c.classes.some((x) => ['WARRIOR', 'ROGUE'].includes(x)))
        add('OFF', 1);
    }
    if (u.id === 'ANRAS')
      add(
        'DEF',
        c.traits.some((t) =>
          d.traits
            .find((x) => x.id === t.traitId)
            ?.name__?.startsWith('Duelist'),
        )
          ? 2
          : 1,
      );
    if (u.id === 'WEIGHT' && u.choice === 'ARMOR') {
      add('AG', 1);
      add('SPD', 1);
    }
  }
  return out;
}
export function upgradeErrors(
  e: Entry,
  c: Character,
  r: Roster,
  d: Catalog,
): string[] {
  const errors: string[] = [],
    byName = (s: string) =>
      c.traits.some((t) =>
        d.traits.find((x) => x.id === t.traitId)?.name__?.startsWith(s),
      );
  if (e.upgrades.length && NAMED.includes(c.id))
    errors.push(
      'Named Characters cannot receive upgrades (errata April 2026, p. 3).',
    );
  const resourceful = Math.max(
    0,
    ...c.traits.map((t) => {
      const x = d.traits.find((x) => x.id === t.traitId);
      return x?.name__?.startsWith('Resourceful') ? Number(x.level) : 0;
    }),
  );
  const slots =
    1 +
    Math.max(
      resourceful,
      e.upgrades.some((u) => u.id === 'JOURNEYMAN') ? 2 : 0,
    ) +
    (e.upgrades.some((u) => u.id === 'POUCH') ? 1 : 0);
  if (e.upgrades.length > slots)
    errors.push(`Upgrade slots exceeded: ${e.upgrades.length}/${slots}.`);
  if (new Set(e.upgrades.map((u) => u.id)).size !== e.upgrades.length)
    errors.push('Duplicate upgrade on one model.');
  for (const u of e.upgrades) {
    const spec = (d.upgrades ?? UPGRADES).find((s) => s.id === u.id);
    if (!spec) {
      errors.push('Unknown upgrade.');
      continue;
    }
    if (!spec.factions.some((f) => [r.factionId, 'NEUTRAL'].includes(f)))
      errors.push(`${spec.name}: wrong faction.`);
    if (
      spec.limit &&
      r.entries.flatMap((e) => e.upgrades).filter((x) => x.id === u.id).length >
        spec.limit
    )
      errors.push(`${spec.name}: party limit ${spec.limit}.`);
    if (
      ['YARI', 'NAGAMAKI', 'DAIKYUU', 'KANABOU', 'DUELIST'].includes(u.id) &&
      !c.classes.includes('WARRIOR')
    )
      errors.push(`${spec.name}: Warrior required.`);
    if (u.id === 'HAIRON' && !c.classes.includes('SOLDIER'))
      errors.push('Companion of Hairon: Soldier required.');
    if (['TIAMAT', 'ANRAS', 'PAIMON'].includes(u.id) && byName('Demon'))
      errors.push(`${spec.name}: cannot assign to a Demon.`);
    if (
      u.id === 'CARPET' &&
      !['Tiny', 'Small', 'Medium'].includes(c.size ?? '')
    )
      errors.push('Flying Carpet: Medium or smaller.');
    const options = upgradeOptions(u.id, c, d);
    if (
      ['TOME', 'SHAPER', 'LINEAGE', 'CATALYST', 'WEIGHT'].includes(u.id) &&
      !options.includes(u.choice)
    )
      errors.push(`${spec.name}: select a valid option.`);
  }
  return errors;
}
