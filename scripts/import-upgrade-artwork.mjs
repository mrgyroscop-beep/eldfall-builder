// Read-only importer: emits a reviewable artwork manifest, never changes game rules or prices.
import { readFile } from 'node:fs/promises';
const sourceUrl = 'https://guildhall.eldfall-chronicles.com/army';
const mediaOrigin = 'https://guildhall-backend.eldfall-chronicles.com';
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw Error(`Guild Hall: ${response.status}`);
const html = await response.text();
const source = JSON.parse(
  html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
  )?.[1] ?? 'null',
);
const records = source?.props?.pageProps?.upgradeList?.data;
if (!Array.isArray(records) || !records.length)
  throw Error('Upgrade artwork source schema changed');
const { records: upgrades } = JSON.parse(
  await readFile(new URL('../data/upgrades.json', import.meta.url), 'utf8'),
);
const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const url = (path) => {
  const value = new URL(path, mediaOrigin);
  if (value.origin !== mediaOrigin || !value.pathname.startsWith('/uploads/'))
    throw Error('Unexpected media origin');
  return value.href;
};
const images = [];
const missing = [];
for (const upgrade of upgrades) {
  const matches = records.filter(
    (r) => normalize(r.attributes.name) === normalize(upgrade.name),
  );
  let count = 0;
  for (const record of matches) {
    const image = record.attributes.image?.data?.attributes;
    if (!image?.url) continue;
    if (!(image.width > 0 && image.height > 0))
      throw Error('Invalid artwork dimensions');
    images.push({
      upgradeId: upgrade.id,
      upgradeName: upgrade.name,
      sourceId: record.id,
      sourceCode: record.attributes.code,
      factionId: record.attributes.faction?.data?.attributes?.code ?? null,
      url: url(image.url),
      thumbnailUrl: url(image.formats?.thumbnail?.url ?? image.url),
      width: image.width,
      height: image.height,
    });
    count++;
  }
  if (!count) missing.push(upgrade.id);
}
console.log(
  JSON.stringify(
    { sourceUrl, fetchedAt: new Date().toISOString(), images, missing },
    null,
    2,
  ),
);
