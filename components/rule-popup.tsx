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
  text,
  original,
  label,
}: {
  record: RuleRecord;
  lang: Lang;
  ui: Lang;
  suffix?: string;
  text?: string;
  original?: string;
  label?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger className="rule-link">
        {label ?? ruleName(record, lang)}
        {suffix}
      </DialogTrigger>
      <DialogContent closeLabel={ui === 'ru' ? 'Закрыть' : 'Close'}>
        <DialogTitle>
          {label ?? ruleName(record, lang)}
          {suffix}
        </DialogTitle>
        <DialogDescription className="rule-text">
          {text ?? ruleText(record, lang)}
        </DialogDescription>
        {lang === 'ru' && (
          <details>
            <summary>Оригинал (EN)</summary>
            <p lang="en">{original ?? sourceRuleText(record)}</p>
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
const weaponRulesRu: Record<string, [string, string]> = {
  ARMOR_PIERCING: [
    'Бронебойное',
    'При броске урона (DMG) за попадание с этим свойством вычитайте только половину значения брони (ARM) цели.',
  ],
  STAGGER: [
    'Пошатывание',
    'Модель, получившая попадание с этим свойством, теряет 1 AP до конца хода. Свойство не действует на модели, которые на две или более категории размера крупнее атакующего.',
  ],
  'SWEEP.1': [
    'Размах I',
    'При успешном броске атаки все модели в линии видимости (LoS) и в пределах досягаемости ближнего боя (Melee RCH) этой модели получают попадание.',
  ],
  'SWEEP.2': [
    'Размах II',
    'При успешном броске атаки передняя дуга этой модели становится равной 360° до конца последовательности активации. Все модели в пределах её досягаемости ближнего боя (Melee RCH) и линии видимости (LoS) получают попадание.',
  ],
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
            label={lang === 'ru' ? weaponRulesRu[ref[2]]?.[0] : undefined}
            text={lang === 'ru' ? weaponRulesRu[ref[2]]?.[1] : undefined}
            original={weaponRules[ref[2]]}
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
