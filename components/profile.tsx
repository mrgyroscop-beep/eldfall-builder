'use client';
import type { Catalog, Character, Entry, Lang, RuleRecord } from '@/lib/model';
import { InventoryView } from './inventory';
import { upgraded } from '@/lib/upgrades';
import {
  name,
  plain,
  ruleName,
  statNames,
  translationStatus,
  ruleText,
  sourceRuleText,
  characterNotes,
  term,
  translationCurrent,
} from '@/lib/i18n';
import { SOURCES, spellsFor } from '@/lib/game';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
export function Rule({
  record,
  lang = 'en',
  ui = lang,
}: {
  record: RuleRecord;
  lang?: Lang;
  ui?: Lang;
}) {
  return (
    <details className="rule">
      <summary>{ruleName(record, lang)}</summary>
      {lang === 'ru' && !translationCurrent(`rule:${record.id}`, record) && (
        <p className="warning">
          {ui === 'ru'
            ? 'Источник изменился: показан английский оригинал до проверки перевода.'
            : 'Source changed: showing English until the translation is reviewed.'}
        </p>
      )}
      <p
        className="rule-text"
        lang={
          lang === 'ru' && translationCurrent(`rule:${record.id}`, record)
            ? 'ru'
            : 'en'
        }
      >
        {ruleText(record, lang)}
      </p>
      {lang === 'ru' && (
        <details className="original-source">
          <summary>
            {ui === 'ru' ? 'Оригинал (EN)' : 'English original'}
          </summary>
          <p lang="en">
            {ruleName(record)} — {sourceRuleText(record)}
          </p>
        </details>
      )}
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
export function Stats({
  character: c,
  lang = 'ru',
}: {
  character: Character;
  lang?: Lang;
}) {
  return (
    <dl className="stats">
      {Object.entries(c.stats).map(([key, s]) => (
        <div key={key}>
          <dt title={lang === 'ru' ? statNames[key] : key}>{key}</dt>
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
  ui = lang,
  entry,
}: {
  c: Character;
  d: Catalog;
  lang: Lang;
  ui?: Lang;
  entry?: Entry;
}) {
  const effective = entry ? upgraded(c, entry, d) : c;
  const refs = (ids: string[], table: RuleRecord[]) =>
    ids
      .map((id) => table.find((x) => x.id === id))
      .filter(Boolean) as RuleRecord[];
  const sections: [string, RuleRecord[]][] = [
    ['Classes', refs(c.classes, d.classes)],
    ['Skills', refs(c.skills, d.skills)],
    ['Combat arts', refs(c.combatArts, d.combatArts)],
    [
      'Traits',
      refs(
        effective.traits.map((x) => x.traitId),
        d.traits,
      ),
    ],
    ['Stratagems', refs(c.stratagems, d.stratagems)],
    ['Available spells', spellsFor(effective, d)],
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
          · {c.cost} RP · {ui === 'ru' ? 'Лимит' : 'Limit'} {c.limit}
          {c.neutralLimit !== null
            ? ` / ${ui === 'ru' ? 'Нейтральный' : 'Neutral'} ${c.neutralLimit}`
            : ''}
        </p>
        <p>
          {term(c.size ?? '', lang)} · {ui === 'ru' ? 'Инвентарь' : 'Inventory'}{' '}
          {effective.inventorySpace}
          {c.mount
            ? ` · ${ui === 'ru' ? 'Верховое животное' : 'Mount'}: ${term(c.mount, lang)}`
            : ''}
        </p>
      </div>
      <Stats character={effective} lang={ui} />
      <InventoryView c={c} entry={entry} d={d} lang={lang} ui={ui} />
      <details className="stat-legend">
        <summary>
          {ui === 'ru' ? 'Обозначения характеристик' : 'Attribute key'}
        </summary>
        <p>
          {ui === 'ru'
            ? 'STA — выносливость; SPD — скорость; OFF — атака; DEF — защита; ACC — точность; INT — интеллект; AG — ловкость; T — стойкость; ARM — броня; HP — здоровье; M — мораль; PW — мощь; RCH — дальность; STK — число ударов; WGT — вес; RP — очки набора.'
            : 'STA — stamina; SPD — speed; OFF — offense; DEF — defense; ACC — accuracy; INT — intellect; AG — agility; T — toughness; ARM — armor; HP — health; M — morale; PW — power; RCH — reach; STK — strikes; WGT — weight; RP — recruitment points.'}
        </p>
      </details>
      {effective.traits.some((t) => t.value || t.elements.length > 0) && (
        <p className="muted">
          {effective.traits
            .filter((t) => t.value || t.elements.length > 0)
            .map(
              (t) =>
                `${ruleName(
                  d.traits.find((x) => x.id === t.traitId)!,
                  lang,
                )}: ${t.value ? term(t.value, lang) : t.elements.map((x) => term(x, lang)).join(', ')}`,
            )
            .join(' · ')}
        </p>
      )}
      {sections
        .filter(([, v]) => v.length)
        .map(([title, records]) => (
          <section key={title}>
            <h3>{term(title, ui)}</h3>
            {records.map((r, i) => (
              <Rule key={`${r.id}-${i}`} record={r} lang={lang} ui={ui} />
            ))}
          </section>
        ))}
      {c.notes && (
        <section>
          <h3>{ui === 'ru' ? 'Особые правила' : 'Special rules'}</h3>
          {lang === 'ru' && !translationCurrent(`notes:${c.id}`, c.notes) && (
            <p className="warning">
              {ui === 'ru'
                ? 'Источник изменился: особые правила показаны на английском до проверки перевода.'
                : 'Source changed: special rules are shown in English pending review.'}
            </p>
          )}
          <p
            className="rule-text"
            lang={
              lang === 'ru' && translationCurrent(`notes:${c.id}`, c.notes)
                ? 'ru'
                : 'en'
            }
          >
            {characterNotes(c, lang)}
          </p>
          {lang === 'ru' && (
            <details>
              <summary>
                {ui === 'ru' ? 'Оригинал (EN)' : 'English original'}
              </summary>
              <p lang="en">{plain(c.notes)}</p>
            </details>
          )}
        </section>
      )}
      <p className="source-note">
        Guild Hall · {d.version} ·{' '}
        <a href={SOURCES.profiles} target="_blank" rel="noreferrer">
          {ui === 'ru' ? 'Официальный источник' : 'Original source'} ↗
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
  ui = lang,
  entry,
}: {
  c: Character | null;
  d: Catalog;
  lang: Lang;
  close: () => void;
  ui?: Lang;
  entry?: Entry;
}) {
  return (
    <Dialog
      open={!!c}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="profile-dialog"
        closeLabel={ui === 'ru' ? 'Закрыть' : 'Close'}
      >
        {c && (
          <>
            <DialogTitle>{name(c.id, c.name, lang)}</DialogTitle>
            <DialogDescription>
              {c.name} ·{' '}
              {lang === 'ru'
                ? `Перевод: ${translationStatus(c.id) === 'draft' ? 'черновик' : 'отсутствует'}`
                : ui === 'ru'
                  ? 'Официальные данные на английском'
                  : 'Official English data'}
            </DialogDescription>
            <ProfileBody c={c} d={d} lang={lang} ui={ui} entry={entry} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
