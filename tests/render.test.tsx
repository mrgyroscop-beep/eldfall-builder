import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import GuildApp from '../components/guild-app';
import data from '../data/current.json';
import type { Catalog } from '../lib/model';
import { readFileSync } from 'node:fs';
void test('initial server-rendered page includes catalogue, labels and export sheet', () => {
  const html = renderToString(<GuildApp catalog={data as Catalog} />);
  assert.ok(html.includes('CALAD GUILD'));
  assert.ok(html.includes('CLAN_CHAMPION') || html.includes('Чемпион клана'));
  assert.ok(html.includes('print-sheet'));
  assert.ok(html.includes('ui-language'));
  assert.ok(!html.includes('[object Object]'));
});
void test('responsive and print layouts keep key controls accessible', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(css, /@media print/);
  assert.match(css, /size: A4/);
  assert.match(css, /max-width: 640px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /min-height: 44px/);
});
