import raw from '../data/localization.json';
import classes from '../data/ru/classes.json';
import traits from '../data/ru/traits.json';
import skills from '../data/ru/skills.json';
import arts from '../data/ru/arts.json';
import stratagems from '../data/ru/stratagems.json';
import items from '../data/ru/items.json';
import spells from '../data/ru/spells.json';
import upgrades from '../data/ru/upgrades.json';
import notes from '../data/ru/notes.json';
import terms from '../data/ru/terms.json';
import review from '../data/ru/review.json';
import { sourceFingerprint } from './translation-review';
import type { Character, Lang, RuleRecord, Upgrade } from './model';
export const ruleTranslations: Record<string, string[]> = {
  ...classes,
  ...traits,
  ...skills,
  ...arts,
  ...stratagems,
  ...items,
  ...spells,
};
export const upgradeTranslations: Record<string, string[]> = upgrades;
export const noteTranslations: Record<string, string> = notes;
export const translations: Record<string, string> = {
  ...raw.names,
  ...terms,
  ...Object.fromEntries(
    Object.entries(ruleTranslations).map(([id, value]) => [id, value[0]]),
  ),
};
export function name(id: string, original: string, lang: Lang) {
  return lang === 'ru' ? (translations[id] ?? original) : original;
}
export function term(value: string, lang: Lang): string {
  if (lang === 'ru' && value.includes('April 2026 errata'))
    return value.replace('April 2026 errata', 'исправления апреля 2026');
  if (value.includes(','))
    return value
      .split(',')
      .map((x) => term(x.trim(), lang))
      .join(', ');
  if (value.includes('>'))
    return value
      .split('>')
      .map((x) => term(x, lang))
      .join(' → ');
  return name(value, value.replaceAll('_', ' '), lang);
}
export function ruleName(x: RuleRecord, lang: Lang = 'en') {
  return name(x.id, x.name ?? x.name__ ?? x.id, lang);
}
export function plain(text: unknown): string {
  if (Array.isArray(text)) return text.map(plain).filter(Boolean).join('\n');
  if (text && typeof text === 'object') {
    const x = text as Record<string, unknown>;
    return plain(x.text ?? x.children ?? x.description);
  }
  return typeof text === 'string'
    ? text
        .replace(/\(([^)]+)\)\[[^\]]+\]/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    : '';
}

export function sourceRuleText(x: RuleRecord): string {
  const direct = plain(x.description ?? x.effect);
  if (direct) return direct;
  for (const [key, value] of Object.entries(x)) {
    if (!key.endsWith('_group') || !value || typeof value !== 'object')
      continue;
    const group = value as {
      data?: { attributes?: { description?: unknown } };
    };
    const text = plain(group.data?.attributes?.description);
    if (text) return text;
  }
  return '';
}
export function ruleText(x: RuleRecord, lang: Lang) {
  return lang === 'ru' && translationCurrent(`rule:${x.id}`, x)
    ? (ruleTranslations[x.id]?.[1] ?? sourceRuleText(x))
    : sourceRuleText(x);
}
export function upgradeName(x: Pick<Upgrade, 'id' | 'name'>, lang: Lang) {
  return lang === 'ru' ? (upgradeTranslations[x.id]?.[0] ?? x.name) : x.name;
}
export function upgradeText(x: Upgrade, lang: Lang) {
  return lang === 'ru' && translationCurrent(`upgrade:${x.id}`, x)
    ? (upgradeTranslations[x.id]?.[1] ?? x.description)
    : x.description;
}
export function characterNotes(c: Character, lang: Lang) {
  return lang === 'ru' && translationCurrent(`notes:${c.id}`, c.notes)
    ? (noteTranslations[c.id] ?? plain(c.notes))
    : plain(c.notes);
}
export function translationCurrent(key: string, source: unknown): boolean {
  return (
    (review as Record<string, { fingerprint: string }>)[key]?.fingerprint ===
    sourceFingerprint(source)
  );
}
export const stateNames = raw.states as Record<string, string>;
export const statNames = raw.stats as Record<string, string>;
export const translationStatus = (id: string) =>
  translations[id] ? 'draft' : 'missing';
