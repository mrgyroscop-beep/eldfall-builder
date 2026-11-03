'use client';
import type { Catalog, Lang, RuleRecord } from '@/lib/model';
import { ruleName, ruleText, sourceRuleText } from '@/lib/i18n';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
export function RulePopup({
  record,
  lang,
  ui,
  suffix = '',
}: {
  record: RuleRecord;
  lang: Lang;
  ui: Lang;
  suffix?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger className="rule-link">
        {ruleName(record, lang)}
        {suffix}
      </DialogTrigger>
      <DialogContent closeLabel={ui === 'ru' ? 'Закрыть' : 'Close'}>
        <DialogTitle>
          {ruleName(record, lang)}
          {suffix}
        </DialogTitle>
        <DialogDescription className="rule-text">
          {ruleText(record, lang)}
        </DialogDescription>
        {lang === 'ru' && (
          <details>
            <summary>Оригинал (EN)</summary>
            <p lang="en">{sourceRuleText(record)}</p>
          </details>
        )}
      </DialogContent>
    </Dialog>
  );
}
// Core rulebook, pp. 68, 70–71; weapon traits absent from Guild Hall model catalog.
const weaponRules: Record<string, string> = {
  ARMOR_PIERCING:
    'When making a DMG roll for a Hit with this Trait, subtract only half the target’s ARM value.',
  STAGGER:
    'A model that suffers a Hit with this Trait loses 1 AP (until the end of the turn). This Trait does not affect models two or more Sizes larger than the attacker.',
  'SWEEP.1':
    'On a successful Attack roll, all models within this model’s LoS and Melee RCH suffer a Hit.',
  'SWEEP.2':
    'On a successful Attack roll, this model’s Front arc becomes 360° for the remainder of the Activation Sequence. All models within this model’s Melee RCH and LoS suffer a Hit.',
};
export function ItemTraits({
  record,
  d,
  lang,
  ui,
}: {
  record: RuleRecord;
  d: Catalog;
  lang: Lang;
  ui: Lang;
}) {
  const raw = String(record.effect ?? record.description ?? '');
  const refs = [...raw.matchAll(/\(([^)]*)\)\[trait\.([^\]]+)\]/g)];
  return (
    <div className="rule-links">
      {refs.map((ref, i) => {
        const [code, level] = ref[2].split('.');
        const rule = d.traits.find((x) => {
          const group = x.trait_group as
            | { data?: { attributes?: { code?: string } } }
            | undefined;
          return (
            x.id === ref[2] ||
            (group?.data?.attributes?.code === code &&
              (!level || x.level === Number(level)))
          );
        });
        return rule ? (
          <RulePopup key={i} record={rule} lang={lang} ui={ui} />
        ) : (
          <RulePopup
            key={i}
            record={{
              id: ref[2],
              name: ref[1],
              description:
                weaponRules[ref[2]] ??
                (ui === 'ru'
                  ? 'Описание этого свойства отсутствует в справочнике матча. Сверьтесь с официальными правилами.'
                  : 'This trait description is missing from the match catalog. Consult the official rules.'),
            }}
            lang={lang}
            ui={ui}
          />
        );
      })}
    </div>
  );
}
