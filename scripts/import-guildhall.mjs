import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateCatalog } from '../lib/validation.ts';
const root = process.cwd();
const fetchText = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw Error(`${r.status}: ${url}`);
  return r.text();
};
const html = await fetchText('https://guildhall.eldfall-chronicles.com/');
const raw = JSON.parse(
  html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
  )?.[1] ?? 'null',
);
if (!raw?.props?.pageProps?.characterList?.data?.length)
  throw Error('Guild Hall schema changed');
const upgrades = JSON.parse(await fs.readFile('data/upgrades.json', 'utf8'));
const date = new Date().toISOString().slice(0, 10),
  hash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        source: raw.props.pageProps,
        upgrades,
        normalization: 2,
        rules: '1.6-apr2026',
      }),
    )
    .digest('hex')
    .slice(0, 12);
const version = `${date}-${hash}`;
await fs.mkdir(path.join(root, 'data/raw'), { recursive: true });
await fs.mkdir(path.join(root, 'data/versions'), { recursive: true });
await fs
  .writeFile(
    path.join(root, `data/raw/${version}.json`),
    JSON.stringify(raw, null, 2),
    { flag: 'wx' },
  )
  .catch((e) => {
    if (e.code !== 'EEXIST') throw e;
  });
const source = raw.props.pageProps;
const attrs = (x) => x?.attributes ?? x;
const refs = (x) => (x?.data ?? []).map(attrs);
const tables = {
  classes: {},
  items: {},
  traits: {},
  skills: {},
  combatArts: {},
  stratagems: {},
};
const register = (table, record) => {
  const v = attrs(record);
  const id = v.code ?? `${table}-${record.id}`;
  tables[table][id] = { ...v, id, sourceId: record.id };
  return id;
};
const characters = source.characterList.data.map(({ id, attributes: a }) => ({
  id: a.code,
  sourceId: id,
  name: a.name,
  cost: a.recruitment_cost,
  limit: a.limit,
  neutralLimit: a.limit_if_recruited_neutral,
  updatedAt: a.updatedAt,
  factions: refs(a.factions).map((f) => f.code),
  stats: Object.fromEntries(
    Object.entries(a.attributes)
      .filter(([k]) => k !== 'id')
      .map(([k, v]) => [k, { value: v.value, prefix: v.prefix }]),
  ),
  size: a.size_info?.size,
  classes: (a.classes?.data ?? []).map((x) => register('classes', x)),
  items: (a.inventory?.items ?? []).map((x) => ({
    itemId: register('items', x.item.data),
    quantity: x.QTY,
  })),
  inventorySpace: a.inventory?.space,
  skills: (a.skills?.data ?? []).map((x) => register('skills', x)),
  combatArts: (a.combat_arts?.data ?? []).map((x) => register('combatArts', x)),
  traits: (a.traits ?? []).map((x) => ({
    traitId: register('traits', x.trait.data),
    value: x.dynamic_value,
    elements: refs(x.dynamic_elements).map((e) => e.code),
  })),
  stratagems: (a.stratagems?.data ?? []).map((x) => register('stratagems', x)),
  spellcrafts: (a.spellcrafts ?? []).map((x) => ({
    schoolId: x.spell_group?.data?.attributes?.code,
    level: x.level,
  })),
  imagePath: a.image?.data?.attributes?.url ?? null,
  mount: a.mount_character?.data?.attributes?.code ?? null,
  tags: a.tag_list,
  hostileBehavior: a.hostile_behavior,
  notes: a.abilities_additional_info,
}));
if (new Set(characters.map((c) => c.id)).size !== characters.length)
  throw Error('Duplicate character codes');
const factions = source.factionList.data.map((x) => ({
  id: x.attributes.code,
  name: x.attributes.name,
}));
const schools = source.spellGroupList.data.map((x) => ({
  id: x.attributes.code,
  name: x.attributes.name,
  spells: x.attributes.spells.data.map((s) => ({
    ...s.attributes,
    id: `spell-${s.id}`,
    sourceId: s.id,
    schoolId: x.attributes.code,
    element: attrs(s.attributes.element?.data)?.code,
  })),
}));
const appScript = [...html.matchAll(/src="([^"]+\.js)"/g)]
  .map((x) => x[1])
  .find((x) => x.includes('pages/_app'));
let mediaOrigin = null;
if (appScript) {
  const js = await fetchText(
    new URL(appScript, 'https://guildhall.eldfall-chronicles.com/'),
  );
  const origins = [...new Set(js.match(/https:\/\/[a-zA-Z0-9._:-]+/g))];
  mediaOrigin =
    origins.find((x) =>
      x.endsWith('guildhall-backend.eldfall-chronicles.com'),
    ) ?? null;
}
const data = {
  schemaVersion: 1,
  version,
  date,
  sourceUrl: 'https://guildhall.eldfall-chronicles.com/',
  rulesVersion: '1.6 + April 2026 errata',
  upgrades: upgrades.records,
  upgradesVersion: upgrades.version,
  mediaOrigin,
  characters,
  factions,
  schools,
  ...Object.fromEntries(
    Object.entries(tables).map(([k, v]) => [k, Object.values(v)]),
  ),
};
validateCatalog(data);
for (const key of ['characterList', 'factionList', 'spellGroupList'])
  if (source[key].meta.pagination.pageCount !== 1)
    throw Error('Source paginated; refuse incomplete import');
let previous = null;
try {
  previous = JSON.parse(await fs.readFile('data/current.json', 'utf8'));
} catch {}
const delta = {
  version,
  previous: previous?.version,
  entities: Object.fromEntries(
    [
      'characters',
      'factions',
      'schools',
      'upgrades',
      ...Object.keys(tables),
    ].map((key) => {
      const next = data[key],
        old = previous?.[key] ?? [];
      return [
        key,
        {
          added: next
            .filter((c) => !old.some((p) => p.id === c.id))
            .map((c) => c.id),
          removed: old
            .filter((c) => !next.some((p) => p.id === c.id))
            .map((c) => c.id),
          changed: next
            .filter((c) =>
              old.some(
                (p) => p.id === c.id && JSON.stringify(p) !== JSON.stringify(c),
              ),
            )
            .map((c) => c.id),
        },
      ];
    }),
  ),
};
const serialized = JSON.stringify(data, null, 2),
  versionPath = `data/versions/${version}.json`;
try {
  await fs.writeFile(versionPath, serialized, { flag: 'wx' });
} catch (e) {
  if (
    e.code !== 'EEXIST' ||
    (await fs.readFile(versionPath, 'utf8')) !== serialized
  )
    throw e;
}
await fs.writeFile(
  `data/versions/${version}.diff.json`,
  JSON.stringify(delta, null, 2),
);
if (process.argv.includes('--publish')) {
  await fs.writeFile('data/current.pending.json', serialized);
  await fs.rename('data/current.pending.json', 'data/current.json');
}
console.log(
  JSON.stringify({
    version,
    characters: characters.length,
    schools: schools.length,
    published: process.argv.includes('--publish'),
    delta,
  }),
);
