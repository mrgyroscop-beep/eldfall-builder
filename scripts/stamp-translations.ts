import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sourceFingerprint } from '../lib/translation-review';
import type { Catalog } from '../lib/model';
// Authoring baseline only. Never run automatically during data import/build.
const destination = 'data/ru/review.json';
if (existsSync(destination))
  throw Error(
    'Review baseline exists. Review changed records individually; do not blindly overwrite.',
  );
const d: Catalog = JSON.parse(readFileSync('data/current.json', 'utf8'));
const records: Record<
  string,
  { status: string; fingerprint: string; sourceVersion: string }
> = {};
const add = (key: string, value: unknown) => {
  records[key] = {
    status: 'draft',
    fingerprint: sourceFingerprint(value),
    sourceVersion: d.version,
  };
};
for (const x of [
  ...d.classes,
  ...d.traits,
  ...d.skills,
  ...d.combatArts,
  ...d.stratagems,
  ...d.items,
  ...d.schools.flatMap((s) => s.spells),
])
  add(`rule:${x.id}`, x);
for (const x of d.upgrades ?? []) add(`upgrade:${x.id}`, x);
for (const x of d.characters.filter((c) => c.notes))
  add(`notes:${x.id}`, x.notes);
writeFileSync(destination, JSON.stringify(records, null, 2) + '\n');
