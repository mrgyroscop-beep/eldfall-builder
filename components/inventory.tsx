'use client';
import { useState } from 'react';
import { Plus, Trash2, Backpack } from 'lucide-react';
import type { Catalog, Character, Entry, Lang, Roster } from '@/lib/model';
import { inventoryFor, itemGrant, itemPurchase } from '@/lib/inventory';
import { name, plain, ruleText, upgradeName, upgradeText } from '@/lib/i18n';
import { issueText } from '@/lib/messages';
import { UPGRADES, UPGRADE_SOURCE, upgradeCost } from '@/lib/upgrades';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UpgradeArtwork } from './upgrade-artwork';
const categoryNames: Record<string, string> = {
  WEAPON: 'Оружие',
  SHIELD: 'Щит',
  ACCESSORY: 'Аксессуар',
  CONSUMABLE: 'Расходуемый предмет',
};
export function InventoryView({
  c,
  entry,
  d,
  ui,
  lang,
  remove,
  compact = false,
}: {
  c: Character;
  entry?: Entry;
  d: Catalog;
  ui: Lang;
  lang: Lang;
  remove?: (index: number) => void;
  compact?: boolean;
}) {
  const inventory = inventoryFor(c, entry, d);
  const t = (ru: string, en: string) => (ui === 'ru' ? ru : en);
  return (
    <section className={`inventory ${compact ? 'inventory-compact' : ''}`}>
      <div className="inventory-heading">
        <h3>
          <Backpack size={18} aria-hidden="true" />{' '}
          {t('Предметы модели', 'Model inventory')}
        </h3>
        <span>
          {t('Вместимость', 'Capacity')}: {inventory.capacity}
        </span>
      </div>
      <p className="muted">
        {t('Количество', 'Quantity')}: {inventory.quantity} ·{' '}
        {t('Нагрузка', 'Load')}: {inventory.unknownWeight ? '≥' : ''}
        {inventory.weight} / {inventory.capacity}
      </p>
      {inventory.unknownWeight && (
        <p className="source-note">
          {t(
            'У некоторых предметов источник не указывает вес при заданном количестве. Показана известная нагрузка; проверьте карточку.',
            'Some items have a quantity but no source weight. Known load is shown; check the profile card.',
          )}
        </p>
      )}
      {inventory.overEncumbered && (
        <p className="warning" aria-live="polite">
          {t(
            'Перегруз: модель не может выполнять перемещения и особые действия. Это ограничение на поле, а не запрет сохранить ростер (правила, с. 13).',
            'Over-encumbered: no Movement or Special Actions. This is a battlefield restriction, not a roster-save restriction (rules p.13).',
          )}
        </p>
      )}
      {inventory.unknown.length > 0 && (
        <p className="warning">
          {t(
            'Текст карточки изменился: проверьте её предметы и нагрузку вручную.',
            'Card wording has changed: check its items and load manually.',
          )}
        </p>
      )}
      {!inventory.lines.length && (
        <p className="muted">
          {t(
            'В исходном профиле нет предметов.',
            'No items in the base profile.',
          )}
        </p>
      )}
      <ul className="inventory-list">
        {inventory.lines.map((line) => (
          <li key={line.key}>
            {line.upgrade && (
              <UpgradeArtwork
                upgrade={line.upgrade}
                label={lang === 'ru' ? (line.ru ?? line.name) : line.name}
                ui={ui}
              />
            )}
            <div className="inventory-item-main">
              <details>
                <summary>
                  {line.itemId
                    ? name(line.itemId, line.name, lang)
                    : lang === 'ru'
                      ? line.ru
                      : line.name}{' '}
                  <span>×{line.quantity || '—'}</span>
                </summary>
                <p className="rule-text">
                  {line.upgrade
                    ? upgradeText(line.upgrade, lang)
                    : line.record
                      ? ruleText(line.record, lang)
                      : ''}
                </p>
                {line.record && (
                  <p className="mono">
                    {['PW', 'RCH', 'STK']
                      .filter((k) => line.record![k] !== undefined)
                      .map((k) => {
                        const value = line.record![k];
                        return `${k} ${typeof value === 'number' || typeof value === 'string' ? value : '—'}`;
                      })
                      .join(' · ')}
                  </p>
                )}
                {lang === 'ru' && (
                  <details>
                    <summary>{t('Оригинал (EN)', 'English original')}</summary>
                    <p lang="en">
                      {line.name}:{' '}
                      {line.upgrade?.description ??
                        plain(line.record?.effect ?? line.record?.description)}
                    </p>
                  </details>
                )}
                {line.upgrade && (
                  <a
                    href={`${UPGRADE_SOURCE}#page=${line.upgrade.page}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('Карточка улучшения', 'Upgrade card')} · {t('с.', 'p.')}{' '}
                    {line.upgrade.page} ↗
                  </a>
                )}
              </details>
              <small>
                {ui === 'ru'
                  ? categoryNames[line.category]
                  : line.category.toLowerCase()}{' '}
                · WGT {line.weight ?? '—'} ·{' '}
                {line.upgrade
                  ? upgradeName(line.upgrade, lang)
                  : t('Базовый предмет', 'Base item')}
              </small>
              {line.replaces && (
                <small>
                  {t('Вместо основного оружия', 'Replaces primary weapon')}
                </small>
              )}
            </div>
            {remove && line.upgradeIndex !== undefined && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t('Снять предмет и улучшение', 'Remove item and upgrade')}: ${lang === 'ru' ? line.ru : line.name}`}
                onClick={() => remove(line.upgradeIndex!)}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function EquipmentPanel({
  c,
  entry,
  r,
  d,
  ui,
  lang,
  readOnly,
  add,
  remove,
}: {
  c: Character;
  entry: Entry;
  r: Roster;
  d: Catalog;
  ui: Lang;
  lang: Lang;
  readOnly: boolean;
  add: (id: string) => void;
  remove: (index: number) => void;
}) {
  const [query, setQuery] = useState('');
  const t = (ru: string, en: string) => (ui === 'ru' ? ru : en);
  const options = (d.upgrades ?? UPGRADES)
    .filter(
      (u) =>
        itemGrant(u) &&
        u.factions.some((f) => f === r.factionId || f === 'NEUTRAL'),
    )
    .filter((u) => {
      const grant = itemGrant(u)!;
      return `${grant.name} ${grant.ru} ${u.name} ${upgradeName(u, 'ru')}`
        .toLowerCase()
        .includes(query.toLowerCase().trim());
    });
  return (
    <div className="equipment-panel">
      <InventoryView
        c={c}
        entry={entry}
        d={d}
        ui={ui}
        lang={lang}
        remove={readOnly ? undefined : remove}
      />
      <section>
        <h3>{t('Добавить предмет', 'Add an item')}</h3>
        <p className="source-note">
          {t(
            'Предмет приобретается вместе с выдающим его улучшением. Цена и слот учитываются один раз; базовые предметы уже включены в профиль.',
            'An item is purchased through its upgrade card. Cost and slot are counted once; base items are already included in the profile.',
          )}
        </p>
        <label>
          {t('Поиск предмета RU / EN', 'Find an item RU / EN')}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              'Копьё, арбалет, дымовая бомба…',
              'Spear, crossbow, haze bomb…',
            )}
          />
        </label>
        <div className="equipment-options">
          {options.map((u) => {
            const grant = itemGrant(u)!;
            const errors = itemPurchase(entry, c, r, d, u.id).errors;
            const itemName = lang === 'ru' ? grant.ru : grant.name;
            const already = entry.upgrades.some((x) => x.id === u.id);
            return (
              <article className="equipment-option" key={u.id}>
                <UpgradeArtwork
                  upgrade={u}
                  label={itemName}
                  ui={ui}
                  factionId={r.factionId}
                />
                <div>
                  <h4>{itemName}</h4>
                  <small>
                    {upgradeName(u, lang)} ·{' '}
                    {grant.replace
                      ? t('Заменяет основное оружие', 'Replaces primary weapon')
                      : t('Добавляется в инвентарь', 'Added to inventory')}
                  </small>
                  <details>
                    <summary>
                      {t('Эффект и условия', 'Effect and requirements')}
                    </summary>
                    <p className="rule-text">{upgradeText(u, lang)}</p>
                  </details>
                </div>
                <Button
                  variant="outline"
                  disabled={readOnly || errors.length > 0}
                  aria-label={`${t('Добавить', 'Add')} ${itemName}`}
                  onClick={() => add(u.id)}
                >
                  <Plus size={16} />
                  {already
                    ? t('Добавлено', 'Added')
                    : `${upgradeCost(u.id, c, entry, r, d)} RP`}
                </Button>
                {errors.length > 0 && (
                  <p className="equipment-reason">
                    {errors
                      .map((message) =>
                        issueText(
                          {
                            code: 'UPGRADE',
                            severity: 'error',
                            message,
                            source: UPGRADE_SOURCE,
                          },
                          ui,
                          d,
                        ),
                      )
                      .join(' ')}
                  </p>
                )}
              </article>
            );
          })}
        </div>
        {!options.length && (
          <p className="muted">
            {t(
              'Подходящих предметов не найдено. Измените поиск.',
              'No matching items. Try another search.',
            )}
          </p>
        )}
      </section>
    </div>
  );
}
