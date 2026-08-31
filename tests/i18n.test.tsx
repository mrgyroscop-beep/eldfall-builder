import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import data from '../data/current.json';
import type { Catalog } from '../lib/model';
import {
  characterNotes,
  name,
  plain,
  ruleText,
  sourceRuleText,
  translationCurrent,
  ruleTranslations,
  translations,
  upgradeText,
  upgradeName,
  term,
} from '../lib/i18n';
import { errorMessages, errorText, issueText } from '../lib/messages';
import { Rule, ProfileBody } from '../components/profile';
import GuildApp from '../components/guild-app';
import { STATES, validate, freshRoster } from '../lib/game';
import { stateNames } from '../lib/i18n';
import { readFileSync } from 'node:fs';
const d = data as Catalog;
const rules = [
  ...d.classes,
  ...d.traits,
  ...d.skills,
  ...d.combatArts,
  ...d.items,
  ...d.stratagems,
  ...d.schools.flatMap((s) => s.spells),
];
void test('every current character, faction, school, rule, upgrade and special note has Russian coverage', () => {
  for (const x of [...d.characters, ...d.factions, ...d.schools])
    assert.match(name(x.id, x.name, 'ru'), /[а-яё]/i, x.id);
  for (const x of rules) {
    assert.ok(ruleTranslations[x.id]?.[0], x.id);
    assert.ok(translationCurrent(`rule:${x.id}`, x), `stale ${x.id}`);
    assert.match(ruleText(x, 'ru'), /[а-яё]/i, x.id);
    assert.equal(ruleText(x, 'en'), sourceRuleText(x), x.id);
  }
  for (const u of d.upgrades ?? []) {
    assert.match(upgradeName(u, 'ru'), /[а-яё]/i, u.id);
    assert.match(upgradeText(u, 'ru'), /[а-яё]/i, u.id);
    assert.equal(upgradeText(u, 'en'), u.description);
  }
  for (const c of d.characters.filter((x) => x.notes)) {
    assert.match(characterNotes(c, 'ru'), /[а-яё]/i, c.id);
    assert.ok(characterNotes(c, 'en').length > 10, c.id);
  }
  for (const s of STATES) assert.ok(stateNames[s], s);
  for (const c of d.characters)
    for (const trait of c.traits)
      if (trait.value)
        assert.match(term(trait.value, 'ru'), /[а-яё]/i, trait.value);
});
void test('source drift falls back to original, never silently reuses a stale translation', () => {
  const x = { ...d.classes[0], description: 'New authoritative wording.' };
  assert.equal(translationCurrent(`rule:${x.id}`, x), false);
  assert.equal(ruleText(x, 'ru'), 'New authoritative wording.');
  assert.match(
    renderToString(<Rule record={x} lang="ru" />),
    /Источник изменился/,
  );
});
void test('rich text and group descriptions remain visible', () => {
  assert.equal(
    plain({
      description: [
        { children: [{ text: 'One.' }] },
        { children: [{ text: 'Two.' }] },
      ],
    }),
    'One.\nTwo.',
  );
  for (const id of ['traits-35', 'traits-75', 'skills-47'])
    assert.ok(sourceRuleText(rules.find((x) => x.id === id)!).length > 20, id);
});
void test('rule and profile rendering supports independent interface and game languages', () => {
  const x = d.classes[0];
  const ru = renderToString(<Rule record={x} lang="ru" />);
  assert.ok(ru.includes(ruleTranslations[x.id][0]));
  assert.match(ru, /Оригинал \(EN\)/);
  const c = d.characters.find((x) => x.id === 'CHIYOHIME')!;
  const body = renderToString(<ProfileBody c={c} d={d} lang="ru" ui="en" />);
  assert.match(body, /Special rules/);
  assert.match(body, /Может нанимать/);
  assert.ok(!body.includes('[object Object]'));
  const en = renderToString(
    <GuildApp catalog={d} initialUi="en" initialLang="en" />,
  );
  assert.match(en, /Interface/);
  assert.match(en, /Available models/);
  const russian = renderToString(<GuildApp catalog={d} />);
  assert.match(russian, /Интерфейс/);
  assert.match(russian, /Игровые тексты/);
  assert.ok(!russian.includes('THE MUSTER ROLL'));
});
void test('states, match events and all API error codes have Russian labels', () => {
  const files = ['lib/service.ts', 'lib/game.ts', 'app/api/guild/route.ts'];
  for (const file of files) {
    const codes = [
      ...readFileSync(file, 'utf8').matchAll(
        /(?:Error\(|Problem\(\d+, )'([A-Z_]+)'/g,
      ),
    ].map((x) => x[1]);
    for (const code of codes)
      assert.ok(errorMessages[code], `${file}: ${code}`);
  }
  for (const code of Object.keys(errorMessages))
    assert.match(errorText(code, 'ru'), /[а-яё]/i);
  for (const value of [
    'waiting',
    'confirming',
    'active',
    'paused',
    'finished',
    'ready',
    'pause',
    'resume',
    'finish',
    'unit',
    'round',
    'initiative',
    'score',
    'undo',
  ])
    assert.match(term(value, 'ru'), /[а-яё]/i);
  for (const issue of validate(freshRoster(d), d)) {
    assert.match(issueText(issue, 'ru', d), /[а-яё]/i);
    assert.ok(!/[а-яё]/i.test(issueText(issue, 'en', d)));
  }
  assert.ok(translations.AIR);
});
