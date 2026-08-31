import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/current.json';
import type { Catalog } from '../lib/model';
import { freshRoster } from '../lib/game';
import { affordableModels, recruitmentBudget } from '../lib/recruitment';

const catalog = data as Catalog;
void test('recruitment hides models over the remaining budget, retaining exact-price models', () => {
  const c = catalog.characters[0];
  const models = [0, 1, 2, 3, 35].map((cost) => ({
    ...c,
    id: `cost-${cost}`,
    cost,
  }));
  assert.deepEqual(
    affordableModels(models, 2).map((x) => x.cost),
    [0, 1, 2],
  );
  assert.deepEqual(
    affordableModels(models, 0).map((x) => x.cost),
    [0],
  );
  assert.deepEqual(affordableModels(models, -1), []);
  assert.equal(models.length, 5);
});
void test('budget recalculates after upgrades, removing models and changing the points limit', () => {
  const roster = freshRoster(catalog);
  const c = catalog.characters.find((x) => x.id === 'CLAN_CHAMPION')!;
  roster.pointsLimit = c.cost + 2;
  roster.entries = [
    { id: 'hero', characterId: c.id, notes: '', spells: [], upgrades: [] },
  ];
  assert.equal(recruitmentBudget(roster, catalog), 2);
  roster.entries[0].upgrades.push({ id: 'YARI', choice: '' });
  assert.equal(recruitmentBudget(roster, catalog), 1);
  roster.entries[0].upgrades = [];
  assert.equal(recruitmentBudget(roster, catalog), 2);
  roster.pointsLimit += 10;
  assert.equal(recruitmentBudget(roster, catalog), 12);
  roster.entries = [];
  assert.equal(recruitmentBudget(roster, catalog), roster.pointsLimit);
});
void test('83 / 85 roster hides unaffordable purchases without mutating the full catalogue', () => {
  const roster = freshRoster(catalog);
  roster.pointsLimit = 85;
  const red = catalog.characters.find((x) => x.name === 'Red Rasetsu')!;
  const oni = catalog.characters.find((x) => x.name === 'Oni Marauder')!;
  assert.ok(red && oni);
  roster.entries = [red, oni, oni].map((c, i) => ({
    id: String(i),
    characterId: c.id,
    notes: '',
    spells: [],
    upgrades: [],
  }));
  const remaining = recruitmentBudget(roster, catalog);
  assert.equal(remaining, 2);
  const visible = affordableModels(catalog.characters, remaining);
  assert.ok(visible.every((c) => c.cost <= 2));
  assert.ok(!visible.includes(red));
  assert.ok(!visible.includes(oni));
  assert.ok(catalog.characters.includes(red));
});
