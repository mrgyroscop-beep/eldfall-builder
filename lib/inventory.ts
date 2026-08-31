import type {
  Catalog,
  Character,
  Entry,
  Roster,
  RuleRecord,
  Upgrade,
} from './model';
import { UPGRADES, upgraded, upgradeErrors } from './upgrades';

// Upgrade Cards v1.6, pp. 1–4, 15, 24, 27, 47–51.
// Do not treat the Guild Hall item catalogue as a shop: item purchases use upgrade cards.
export const ITEM_GRANTS: Record<
  string,
  {
    name: string;
    ru: string;
    category: string;
    weight: number;
    replace?: boolean;
  }
> = {
  YARI: {
    name: 'Lance',
    ru: 'Пика',
    category: 'WEAPON',
    weight: 2,
    replace: true,
  },
  NAGAMAKI: {
    name: 'Longhilted Sword',
    ru: 'Меч с длинной рукоятью',
    category: 'WEAPON',
    weight: 2,
    replace: true,
  },
  DAIKYUU: {
    name: 'War Bow',
    ru: 'Боевой лук',
    category: 'WEAPON',
    weight: 2,
    replace: true,
  },
  KANABOU: {
    name: 'Heavy Bludgeon',
    ru: 'Тяжёлая дубина',
    category: 'WEAPON',
    weight: 3,
    replace: true,
  },
  FANGS: {
    name: 'War Darts',
    ru: 'Боевые дротики',
    category: 'CONSUMABLE',
    weight: 1,
  },
  AMPLIFIER: {
    name: 'Casting Amplifier',
    ru: 'Усилитель заклинаний',
    category: 'ACCESSORY',
    weight: 0,
  },
  CARPET: {
    name: 'Flying Carpet',
    ru: 'Ковёр-самолёт',
    category: 'ACCESSORY',
    weight: 0,
  },
  IMPORTED_AMPLIFIER: {
    name: 'Casting Amplifier',
    ru: 'Усилитель заклинаний',
    category: 'ACCESSORY',
    weight: 0,
  },
  CROSSBOW: { name: 'Crossbow', ru: 'Арбалет', category: 'WEAPON', weight: 2 },
  UTILITY: { name: 'Dagger', ru: 'Кинжал', category: 'WEAPON', weight: 0 },
  SMOKESCREEN: {
    name: 'Haze Bomb',
    ru: 'Дымовая бомба',
    category: 'CONSUMABLE',
    weight: 0,
  },
  SPEAR: { name: 'Spear', ru: 'Копьё', category: 'WEAPON', weight: 2 },
};
export function itemGrant(upgrade: Upgrade) {
  // An archived or newly imported card may have different mechanics; never apply a current mapping silently.
  return upgrade.description ===
    UPGRADES.find((u) => u.id === upgrade.id)?.description
    ? ITEM_GRANTS[upgrade.id]
    : undefined;
}
export type InventoryLine = {
  key: string;
  name: string;
  ru?: string;
  itemId?: string;
  record?: RuleRecord;
  upgrade?: Upgrade;
  upgradeIndex?: number;
  replaces?: string;
  category: string;
  quantity: number | null;
  weight: number | null;
};
export function inventoryFor(
  c: Character,
  entry: Entry | undefined,
  d: Catalog,
) {
  const lines: InventoryLine[] = c.items.map((x, i) => {
    const record = d.items.find((r) => r.id === x.itemId);
    return {
      key: `base:${i}`,
      itemId: x.itemId,
      record,
      name: record?.name ?? x.itemId,
      category: typeof record?.category === 'string' ? record.category : '',
      quantity: x.quantity,
      weight: typeof record?.WGT === 'number' ? record.WGT : null,
    };
  });
  const unknown: Upgrade[] = [];
  for (const [i, u] of (entry?.upgrades ?? []).entries()) {
    const spec = (d.upgrades ?? UPGRADES).find((x) => x.id === u.id);
    if (!spec || !ITEM_GRANTS[spec.id]) continue;
    const grant = itemGrant(spec);
    if (!grant) {
      unknown.push(spec);
      continue;
    }
    const line: InventoryLine = {
      key: `upgrade:${i}`,
      name: grant.name,
      ru: grant.ru,
      category: grant.category,
      quantity: 1,
      weight: grant.weight,
      upgrade: spec,
      upgradeIndex: i,
    };
    const primary = grant.replace
      ? lines.findIndex((x) => x.category === 'WEAPON')
      : -1;
    if (primary >= 0) {
      line.replaces = lines[primary].name;
      // Replace one primary weapon, preserving any other copies and their inventory cost.
      if ((lines[primary].quantity ?? 0) > 1) {
        const remainder = {
          ...lines[primary],
          quantity: lines[primary].quantity! - 1,
        };
        lines.splice(primary, 1, line, remainder);
      } else lines.splice(primary, 1, line);
    } else lines.push(line);
  }
  for (const u of entry?.upgrades ?? [])
    if (u.id === 'WEIGHT' && u.choice !== 'ARMOR') {
      const line = lines.find((x) => x.itemId === u.choice);
      if (line?.weight !== null && line?.weight !== undefined)
        line.weight = Math.max(0, line.weight - 1);
    }
  const capacity = entry
    ? upgraded(c, entry, d).inventorySpace
    : c.inventorySpace;
  // Core Rules v1.6 p.13: '/' items take no space. Zero-weight items still count by quantity.
  const quantity = lines.reduce((n, x) => n + (x.quantity ?? 0), 0);
  const weight = lines.reduce(
    (n, x) =>
      n + (x.weight === null ? 0 : (x.quantity ?? 0) * Math.max(1, x.weight)),
    0,
  );
  const unknownWeight = lines.some(
    (x) => x.weight === null && (x.quantity ?? 0) > 0,
  );
  return {
    lines,
    quantity,
    weight,
    capacity,
    overEncumbered: quantity > capacity || weight > capacity,
    unknown,
    unknownWeight,
  };
}
export function itemPurchase(
  entry: Entry,
  c: Character,
  r: Roster,
  d: Catalog,
  upgradeId: string,
) {
  const spec = (d.upgrades ?? UPGRADES).find((x) => x.id === upgradeId);
  if (!spec || !itemGrant(spec))
    return { entry, errors: ['Unknown item upgrade.'] };
  const next = {
    ...entry,
    upgrades: [...entry.upgrades, { id: upgradeId, choice: '' }],
  };
  const roster = {
    ...r,
    entries: r.entries.map((e) => (e.id === entry.id ? next : e)),
  };
  const errors = upgradeErrors(next, c, roster, d);
  return { entry: errors.length ? entry : next, errors };
}
