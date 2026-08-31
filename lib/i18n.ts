import raw from '../data/localization.json';
import type { Lang, RuleRecord } from './model';
export const translations = raw.names as Record<string, string>;
export function name(id: string, original: string, lang: Lang) {
  return lang === 'ru' ? (translations[id] ?? original) : original;
}
export function ruleName(x: RuleRecord) {
  return x.name ?? x.name__ ?? x.id;
}
export function plain(text: unknown) {
  return typeof text === 'string'
    ? text
        .replace(/\(([^)]+)\)\[[^\]]+\]/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    : '';
}
export const stateNames = raw.states as Record<string, string>;
export const statNames = raw.stats as Record<string, string>;
export const translationStatus = (id: string) =>
  (raw.review as Record<string, { status: string }>)[id]?.status ?? 'missing';
