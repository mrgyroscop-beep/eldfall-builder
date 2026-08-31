import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { upgradeArtwork } from '../lib/artwork';
import { UpgradeArtwork } from '../components/upgrade-artwork';
import { EquipmentPanel, InventoryView } from '../components/inventory';
import { UPGRADES } from '../lib/upgrades';
import { freshRoster } from '../lib/game';
import type { Catalog } from '../lib/model';
import data from '../data/current.json';
import source from '../data/upgrade-artwork.json';

void test('official artwork maps to known upgrades without modifying versioned game data', () => {
  assert.equal(new Set(source.images.map((x) => x.upgradeId)).size, 43);
  assert.deepEqual(source.missing, ['AMPLIFIER']);
  for (const image of source.images) {
    assert.equal(
      UPGRADES.find((x) => x.id === image.upgradeId)?.name,
      image.upgradeName,
    );
    for (const url of [image.url, image.thumbnailUrl]) {
      assert.equal(
        new URL(url).origin,
        'https://guildhall-backend.eldfall-chronicles.com',
      );
      assert.ok(new URL(url).pathname.startsWith('/uploads/'));
    }
    assert.ok(image.width > 0 && image.height > 0);
  }
  const seasoned = UPGRADES.find((x) => x.id === 'SEASONED')!;
  assert.notEqual(
    upgradeArtwork(seasoned, 'EMPIRE_OF_SOGA')?.url,
    upgradeArtwork(seasoned, 'HELIAN_LEAGUE')?.url,
  );
  assert.equal(
    upgradeArtwork({ ...seasoned, name: 'Different upgrade' }),
    undefined,
  );
});
void test('thumbnail is lazy, labelled, dimensioned and opens the official original; missing art has no broken image', () => {
  const yari = UPGRADES.find((x) => x.id === 'YARI')!;
  const art = upgradeArtwork(yari)!;
  const html = renderToString(
    <UpgradeArtwork upgrade={yari} label="Пика" ui="ru" />,
  );
  assert.ok(html.includes(`src="${art.thumbnailUrl}"`));
  assert.ok(html.includes(`href="${art.url}"`));
  assert.match(html, /loading="lazy"/);
  assert.match(html, /width="400" height="400"/);
  assert.match(html, /alt="Пика"/);
  assert.match(html, /rel="noreferrer"/);
  const missing = renderToString(
    <UpgradeArtwork
      upgrade={UPGRADES.find((x) => x.id === 'AMPLIFIER')!}
      label="Casting Amplifier"
      ui="en"
    />,
  );
  assert.match(missing, /Image unavailable/);
  assert.ok(!missing.includes('<img'));
});
void test('purchasable and assigned equipment display matching artwork in both languages', () => {
  const d = data as Catalog;
  const c = d.characters.find((x) => x.id === 'CLAN_CHAMPION')!;
  const entry = {
    id: 'hero',
    characterId: c.id,
    notes: '',
    spells: [],
    upgrades: [{ id: 'CROSSBOW', choice: '' }],
  };
  const r = { ...freshRoster(d), entries: [entry] };
  const image = upgradeArtwork(UPGRADES.find((x) => x.id === 'CROSSBOW')!)!;
  for (const lang of ['ru', 'en'] as const) {
    const picker = renderToString(
      <EquipmentPanel
        c={c}
        entry={entry}
        r={r}
        d={d}
        ui={lang}
        lang={lang}
        readOnly={false}
        add={() => {}}
        remove={() => {}}
      />,
    );
    assert.ok(picker.includes(image.thumbnailUrl));
    const inventory = renderToString(
      <InventoryView c={c} entry={entry} d={d} ui={lang} lang={lang} compact />,
    );
    assert.ok(inventory.includes(image.thumbnailUrl));
    assert.ok(
      inventory.includes(`alt="${lang === 'ru' ? 'Арбалет' : 'Crossbow'}"`),
    );
  }
});
