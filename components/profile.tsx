'use client';
import type { Catalog, Character, Lang, RuleRecord } from '@/lib/model';
import {
  name,
  plain,
  ruleName,
  statNames,
  translationStatus,
} from '@/lib/i18n';
import { SOURCES, spellsFor } from '@/lib/game';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
export function Rule({ record }: { record: RuleRecord }) {
  return (
    <details className="rule">
      <summary>{ruleName(record)}</summary>
      <p className="rule-text">{plain(record.description ?? record.effect)}</p>
      {['PW', 'RCH', 'STK', 'WGT'].some((k) => record[k] !== undefined) && (
        <p className="mono">
          {['PW', 'RCH', 'STK', 'WGT']
            .filter((k) => record[k] !== undefined)
            .map(
              (k) =>
                `${k} ${typeof record[k] === 'number' || typeof record[k] === 'string' ? record[k] : '—'}`,
            )
            .join(' · ')}
        </p>
      )}
    </details>
  );
}
export function Stats({ character: c }: { character: Character }) {
  return (
    <dl className="stats">
      {Object.entries(c.stats).map(([key, s]) => (
        <div key={key}>
          <dt title={statNames[key]}>{key}</dt>
          <dd>
            {s.prefix}
            {s.value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function ProfileBody({
  c,
  d,
  lang,
}: {
  c: Character;
  d: Catalog;
  lang: Lang;
}) {
  const refs = (ids: string[], table: RuleRecord[]) =>
    ids
      .map((id) => table.find((x) => x.id === id))
      .filter(Boolean) as RuleRecord[];
  const sections: [string, RuleRecord[]][] = [
    ['Classes', refs(c.classes, d.classes)],
    [
      'Inventory',
      refs(
        c.items.map((x) => x.itemId),
        d.items,
      ),
    ],
    ['Skills', refs(c.skills, d.skills)],
    ['Combat arts', refs(c.combatArts, d.combatArts)],
    [
      'Traits',
      refs(
        c.traits.map((x) => x.traitId),
        d.traits,
      ),
    ],
    ['Stratagems', refs(c.stratagems, d.stratagems)],
    ['Available spells', spellsFor(c, d)],
  ];
  return (
    <>
      <div className="profile-summary">
        <p>
          {c.factions
            .map((id) =>
              name(id, d.factions.find((f) => f.id === id)?.name ?? id, lang),
            )
            .join(' / ')}{' '}
          · {c.cost} RP · Limit {c.limit}
          {c.neutralLimit !== null ? ` / Neutral ${c.neutralLimit}` : ''}
        </p>
        <p>
          {c.size} · Inventory {c.inventorySpace}
          {c.mount ? ` · Mount: ${c.mount}` : ''}
        </p>
      </div>
      <Stats character={c} />
      {c.traits.some((t) => t.value || t.elements.length > 0) && (
        <p className="muted">
          {c.traits
            .filter((t) => t.value || t.elements.length > 0)
            .map(
              (t) =>
                `${ruleName(d.traits.find((x) => x.id === t.traitId)!)}: ${t.value ?? t.elements.join(', ')}`,
            )
            .join(' · ')}
        </p>
      )}
      {sections
        .filter(([, v]) => v.length)
        .map(([title, records]) => (
          <section key={title}>
            <h3>{title}</h3>
            {records.map((r, i) => (
              <Rule key={`${r.id}-${i}`} record={r} />
            ))}
          </section>
        ))}
      {c.notes && <p className="rule-text">{plain(c.notes)}</p>}
      <p className="source-note">
        Guild Hall · {d.version} ·{' '}
        <a href={SOURCES.profiles} target="_blank" rel="noreferrer">
          Original source ↗
        </a>
      </p>
    </>
  );
}
export function Profile({
  c,
  d,
  lang,
  close,
}: {
  c: Character | null;
  d: Catalog;
  lang: Lang;
  close: () => void;
}) {
  return (
    <Dialog
      open={!!c}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="profile-dialog">
        {c && (
          <>
            <DialogTitle>{name(c.id, c.name, lang)}</DialogTitle>
            <DialogDescription>
              {c.name} ·{' '}
              {lang === 'ru'
                ? `Перевод: ${translationStatus(c.id) === 'draft' ? 'черновик' : 'отсутствует'}`
                : 'Official English data'}
            </DialogDescription>
            <ProfileBody c={c} d={d} lang={lang} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
