import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { MatchEquipment } from '../components/match-equipment';
import { upgradeArtwork } from '../lib/artwork';
import { upgradeName } from '../lib/i18n';
import { UPGRADES } from '../lib/upgrades';
import type { Catalog, Entry } from '../lib/model';
import data from '../data/current.json';

const d = data as Catalog;
const c = d.characters.find((x) => x.id === 'CLAN_CHAMPION')!;
const entry: Entry = {
  id: 'hero',
  characterId: c.id,
  notes: '',
  spells: [],
  upgrades: [
    { id: 'YARI', choice: '' },
    { id: 'POUCH', choice: '' },
  ],
};

void test('match equipment exposes purchased items and non-item upgrades without opening a disclosure, in RU and EN', () => {
  for (const lang of ['ru', 'en'] as const) {
    const html = renderToString(
      <MatchEquipment
        c={c}
        entry={entry}
        d={d}
        factionId="EMPIRE_OF_SOGA"
        ui={lang}
        lang={lang}
      />,
    );
    for (const id of ['YARI', 'POUCH']) {
      const card = UPGRADES.find((x) => x.id === id)!;
      const url = upgradeArtwork(card)!.thumbnailUrl;
      assert.equal(
        html.split(`src="${url}"`).length - 1,
        1,
        'each acquired card is shown exactly once',
      );
      const beforeImage = html.slice(0, html.indexOf(`src="${url}"`));
      assert.equal(
        (beforeImage.match(/<details[ >]/g) ?? []).length,
        (beforeImage.match(/<\/details>/g) ?? []).length,
        'artwork is not inside a collapsed details element',
      );
      assert.ok(html.includes(upgradeName(card, lang)));
    }
    assert.ok(html.includes(`alt="${lang === 'ru' ? 'Пика' : 'Lance'}"`));
    assert.ok(
      html.indexOf('alt=') <
        html.indexOf(lang === 'ru' ? 'Базовый предмет' : 'Base item'),
      'purchased item precedes base inventory',
    );
    assert.ok(!html.includes('<button'), 'match equipment is read-only');
  }
});

void test('match equipment renders choices and missing archived cards instead of silently omitting them', () => {
  const archived = {
    ...d,
    upgrades: UPGRADES.filter((x) => x.id === 'WEIGHT'),
  };
  const selected = {
    ...entry,
    upgrades: [
      { id: 'WEIGHT', choice: 'ARMOR' },
      { id: 'ARCHIVED_CARD', choice: '' },
    ],
  };
  const html = renderToString(
    <MatchEquipment
      c={c}
      entry={selected}
      d={archived}
      factionId="EMPIRE_OF_SOGA"
      ui="en"
      lang="en"
    />,
  );
  assert.match(html.replaceAll('<!-- -->', ''), /Selected: ARMOR/);
  assert.match(html, /ARCHIVED_CARD/);
  assert.match(html, /Card not found in this match/);
  assert.ok(!html.includes('alt="Lance"'));
});

void test('base-only models keep visible inventory and do not display an empty upgrades section', () => {
  const html = renderToString(
    <MatchEquipment
      c={c}
      entry={{ ...entry, upgrades: [] }}
      d={d}
      factionId="EMPIRE_OF_SOGA"
      ui="en"
      lang="en"
    />,
  );
  assert.match(html, /Model inventory/);
  assert.match(html, /Base item/);
  assert.ok(!html.includes('Model upgrades'));
});
