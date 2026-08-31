import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import data from '../data/current.json';
import type { Catalog, Entry } from '../lib/model';
import {
  inventoryFor,
  ITEM_GRANTS,
  itemGrant,
  itemPurchase,
} from '../lib/inventory';
import { freshRoster, total, validate } from '../lib/game';
import { parseRoster } from '../lib/validation';
import { EquipmentPanel, InventoryView } from '../components/inventory';
import { ProfileBody } from '../components/profile';
const d = data as Catalog;
const c = d.characters.find((x) => x.id === 'CLAN_CHAMPION')!;
const entry: Entry = {
  id: 'hero',
  characterId: c.id,
  notes: '',
  spells: [],
  upgrades: [],
};
const roster = () => ({
  ...freshRoster(d),
  entries: [structuredClone(entry)],
  leaderId: 'hero',
});
void test('all purchasable item mappings resolve to exact official upgrade cards', () => {
  assert.equal(Object.keys(ITEM_GRANTS).length, 12);
  for (const id of Object.keys(ITEM_GRANTS))
    assert.ok(itemGrant(d.upgrades!.find((x) => x.id === id)!));
  const changed = { ...d.upgrades![0], description: 'Changed rules' };
  assert.equal(itemGrant(changed), undefined);
});
void test('item purchase uses an existing upgrade slot and charges exactly once', () => {
  const r = roster();
  const before = structuredClone(c);
  const next = itemPurchase(r.entries[0], c, r, d, 'YARI');
  assert.deepEqual(next.errors, []);
  r.entries[0] = next.entry;
  assert.equal(total(r, d), c.cost + 1);
  assert.deepEqual(validate(r, d), []);
  const inventory = inventoryFor(c, next.entry, d);
  assert.equal(
    inventory.lines.filter((x) => x.upgrade?.id === 'YARI').length,
    1,
  );
  assert.equal(
    inventory.lines.some((x) => x.itemId === 'SPEAR'),
    false,
  );
  assert.ok(inventory.lines.some((x) => x.itemId === 'SWORD'));
  assert.deepEqual(c, before);
  assert.equal(itemPurchase(next.entry, c, r, d, 'YARI').entry, next.entry);
  assert.ok(itemPurchase(next.entry, c, r, d, 'YARI').errors.length);
  assert.deepEqual(
    inventoryFor(c, entry, d).lines.map((x) => x.itemId),
    c.items.map((x) => x.itemId),
  );
});
void test('faction, named-character and party limits cannot be bypassed by the item picker', () => {
  const r = roster();
  assert.ok(itemPurchase(entry, c, r, d, 'CARPET').errors.length);
  const named = d.characters.find((x) => x.id === 'SEIGEN')!;
  assert.ok(
    itemPurchase({ ...entry, characterId: named.id }, named, r, d, 'SPEAR')
      .errors.length,
  );
  r.entries.push({
    ...entry,
    id: 'other',
    upgrades: [{ id: 'CROSSBOW', choice: '' }],
  });
  assert.ok(itemPurchase(entry, c, r, d, 'CROSSBOW').errors.length);
  assert.ok(itemPurchase(entry, c, r, d, 'UNKNOWN').errors.length);
});
void test('additional equipment, zero-weight items and Pouch affect inventory without altering base items', () => {
  const custom = { ...c, inventorySpace: 1, items: [] };
  const e = { ...entry, upgrades: [{ id: 'UTILITY', choice: '' }] };
  assert.deepEqual(
    [inventoryFor(custom, e, d).quantity, inventoryFor(custom, e, d).weight],
    [1, 1],
  );
  const full = { ...e, upgrades: [...e.upgrades, { id: 'SPEAR', choice: '' }] };
  assert.equal(inventoryFor(custom, full, d).overEncumbered, true);
  const pouch = {
    ...full,
    upgrades: [...full.upgrades, { id: 'POUCH', choice: '' }],
  };
  assert.equal(inventoryFor(custom, pouch, d).capacity, 3);
  assert.equal(inventoryFor(custom, pouch, d).overEncumbered, false);
  assert.equal(
    inventoryFor(
      { ...c, items: [{ itemId: 'BITE', quantity: null }] },
      entry,
      d,
    ).weight,
    0,
  );
  assert.equal(
    inventoryFor({ ...c, items: [{ itemId: 'BITE', quantity: 1 }] }, entry, d)
      .unknownWeight,
    true,
  );
});
void test('items survive JSON export/import and removed upgrades restore base inventory', () => {
  const r = roster();
  r.entries[0] = itemPurchase(entry, c, r, d, 'CROSSBOW').entry;
  const loaded = parseRoster(JSON.parse(JSON.stringify(r)));
  assert.ok(
    inventoryFor(c, loaded.entries[0], d).lines.some(
      (x) => x.upgrade?.id === 'CROSSBOW',
    ),
  );
  loaded.entries[0].upgrades = [];
  assert.equal(
    inventoryFor(c, loaded.entries[0], d).lines.length,
    c.items.length,
  );
  assert.equal(total(loaded, d), c.cost);
});
void test('inventory and picker render both languages, restrictions and read-only profiles', () => {
  const r = roster();
  const next = itemPurchase(entry, c, r, d, 'CROSSBOW').entry;
  const html = renderToString(
    <EquipmentPanel
      c={c}
      entry={entry}
      r={r}
      d={d}
      ui="ru"
      lang="ru"
      readOnly={false}
      add={() => {}}
      remove={() => {}}
    />,
  );
  assert.match(html, /Добавить предмет/);
  assert.match(html, /Дымовая бомба/);
  const english = renderToString(
    <InventoryView c={c} entry={next} d={d} ui="en" lang="en" />,
  );
  assert.match(english, /Crossbow/);
  assert.ok(!english.includes('Remove item and upgrade'));
  const profile = renderToString(
    <ProfileBody c={c} entry={next} d={d} ui="ru" lang="ru" />,
  );
  assert.match(profile, /Арбалет/);
  const readonly = renderToString(
    <EquipmentPanel
      c={c}
      entry={next}
      r={r}
      d={d}
      ui="ru"
      lang="ru"
      readOnly
      add={() => {}}
      remove={() => {}}
    />,
  );
  assert.ok(!readonly.includes('Снять предмет и улучшение'));
});
