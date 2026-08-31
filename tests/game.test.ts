import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/current.json';
import type { Catalog, Roster, Character } from '../lib/model.ts';
import {
  freshRoster,
  validate,
  available,
  total,
  spellsFor,
} from '../lib/game.ts';
import { parseRoster, validateCatalog } from '../lib/validation.ts';
import { UPGRADES, upgradeCost, upgraded } from '../lib/upgrades.ts';
const d = data as Catalog;
void test('Djinnborn selects one affinity and resistance; spell reference respects it', () => {
  const c = d.characters.find((c) => c.id === 'DJINNBORN_MARZBAN')!;
  const r = {
    ...freshRoster(d),
    factionId: 'SAND_KINGDOMS',
    leaderId: 'djinn',
    entries: [
      {
        id: 'djinn',
        characterId: c.id,
        notes: '',
        spells: [],
        upgrades: [],
        element: '',
      },
    ],
  };
  assert.ok(validate(r, d).some((x) => x.code === 'ELEMENT'));
  assert.equal(spellsFor(upgraded(c, r.entries[0], d), d).length, 0);
  r.entries[0].element = 'FIRE';
  assert.deepEqual(validate(r, d), []);
  assert.ok(
    spellsFor(upgraded(c, r.entries[0], d), d).every(
      (x) => x.element === 'FIRE',
    ),
  );
  assert.equal(
    parseRoster(JSON.parse(JSON.stringify(r))).entries[0].element,
    'FIRE',
  );
});
export function legalRoster(): Roster {
  const r = freshRoster(d);
  r.name = 'Test expedition';
  const c = d.characters.find(
    (c) => c.factions.includes(r.factionId) && c.limit > 0,
  )!;
  r.entries = [
    { id: 'hero', characterId: c.id, notes: '', spells: [], upgrades: [] },
  ];
  r.leaderId = 'hero';
  return r;
}
void test('complete catalog has stable, valid references', () => {
  assert.equal(validateCatalog(d), d);
  assert.equal(d.characters.length, 63);
  assert.ok(UPGRADES.length > 40);
});
void test('legal roster passes, can round-trip portable format', () => {
  const r = legalRoster();
  assert.deepEqual(validate(r, d), []);
  assert.deepEqual(parseRoster(JSON.parse(JSON.stringify(r))), r);
});
void test('empty, over budget, missing leader and unknown models are errors', () => {
  assert.ok(validate(freshRoster(d), d).some((e) => e.code === 'EMPTY'));
  const r = legalRoster();
  r.pointsLimit = 1;
  r.leaderId = null;
  assert.ok(validate(r, d).some((e) => e.code === 'OVER_BUDGET'));
  assert.ok(validate(r, d).some((e) => e.code === 'LEADER'));
  r.entries[0].characterId = 'fake';
  assert.ok(validate(r, d).some((e) => e.code === 'UNKNOWN'));
});
void test('10 model cap and per-profile limit are enforced', () => {
  const r = legalRoster();
  r.entries = Array.from({ length: 11 }, (_, i) => ({
    ...r.entries[0],
    id: String(i),
  }));
  assert.ok(validate(r, d).some((e) => e.code === 'SIZE'));
  assert.ok(validate(r, d).some((e) => e.code === 'LIMIT'));
});
void test('neutral faction is legal, selected faction requires an affiliated model', () => {
  const r = legalRoster(),
    c = d.characters.find(
      (c) => c.factions.includes('NEUTRAL') && c.limit > 0,
    )!;
  r.entries[0].characterId = c.id;
  r.factionId = 'NEUTRAL';
  assert.deepEqual(validate(r, d), []);
  r.factionId = 'SAND_KINGDOMS';
  if (!c.factions.includes(r.factionId))
    assert.ok(validate(r, d).some((e) => e.code === 'NATIVE'));
});
void test('monster faction cannot hire neutral models (April 2026 errata)', () => {
  const c = d.characters.find(
    (c) => c.factions.includes('NEUTRAL') && !c.factions.includes('ONI_CLANS'),
  )!;
  assert.equal(available(c, 'ONI_CLANS'), false);
  assert.equal(available(c, 'GOBLIN_WARTRIBES'), false);
});
void test('neutral limit uses explicit override and otherwise profile limit', () => {
  const c = {
    ...d.characters[0],
    id: 'fixture',
    cost: 1,
    factions: ['NEUTRAL'],
    limit: 3,
    neutralLimit: 1,
  } as Character;
  const x = { ...d, characters: [...d.characters, c] };
  const r = legalRoster();
  r.entries.push(
    { id: 'n1', characterId: c.id, notes: '', spells: [], upgrades: [] },
    { id: 'n2', characterId: c.id, notes: '', spells: [], upgrades: [] },
  );
  assert.ok(validate(r, x).some((e) => e.code === 'LIMIT'));
  c.neutralLimit = null;
  assert.ok(!validate(r, x).some((e) => e.code === 'LIMIT'));
});
void test('upgrade costs and selected options survive export; named models reject upgrades', () => {
  const r = legalRoster(),
    c = d.characters.find((c) => c.id === r.entries[0].characterId)!;
  r.entries[0].upgrades = [{ id: 'PROTECTION', choice: '' }];
  assert.equal(total(r, d), c.cost + 2);
  assert.equal(upgradeCost('PROTECTION', c, r.entries[0], r), 2);
  const n = d.characters.find((c) => c.id === 'SEIGEN')!;
  r.entries[0].characterId = n.id;
  assert.ok(validate(r, d).some((e) => e.message.includes('Named Characters')));
});
void test('malformed and stale rosters cannot validate', () => {
  assert.throws(() => parseRoster({ entries: [] }));
  const r = legalRoster();
  r.dataVersion = 'old';
  assert.ok(validate(r, d).some((e) => e.code === 'VERSION'));
  r.entries[0].spells = ['fake'];
  assert.ok(validate(r, d).some((e) => e.code === 'SPELL'));
});
void test('spell school and element prerequisites are respected', () => {
  for (const c of d.characters)
    for (const s of spellsFor(c, d)) {
      assert.ok(c.traits.some((t) => t.elements.includes(s.element)));
      assert.ok(
        c.spellcrafts.some(
          (x) => x.schoolId === s.schoolId && x.level >= s.level,
        ),
      );
    }
});
