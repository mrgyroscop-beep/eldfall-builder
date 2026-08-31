'use client';
import type { Catalog, Character, Entry, Lang } from '@/lib/model';
import { itemGrant } from '@/lib/inventory';
import { term, upgradeName, upgradeText } from '@/lib/i18n';
import { UPGRADES, UPGRADE_SOURCE } from '@/lib/upgrades';
import { InventoryView } from './inventory';
import { UpgradeArtwork } from './upgrade-artwork';

/** Read only: always use this player's saved match snapshot, never the builder draft. */
export function MatchEquipment({
  c,
  entry,
  d,
  factionId,
  ui,
  lang,
}: {
  c: Character;
  entry: Entry;
  d: Catalog;
  factionId: string;
  ui: Lang;
  lang: Lang;
}) {
  const t = (ru: string, en: string) => (ui === 'ru' ? ru : en);
  // Item-granting cards already appear with their artwork in the inventory.
  const upgrades = entry.upgrades
    .map((selection, index) => ({
      selection,
      index,
      card: (d.upgrades ?? UPGRADES).find((x) => x.id === selection.id),
    }))
    .filter(({ card }) => !card || !itemGrant(card));
  return (
    <div className="match-equipment">
      <InventoryView
        c={c}
        entry={entry}
        d={d}
        ui={ui}
        lang={lang}
        compact
        acquiredFirst
      />
      {upgrades.length > 0 && (
        <section aria-label={t('Улучшения модели', 'Model upgrades')}>
          <h4>{t('Улучшения модели', 'Model upgrades')}</h4>
          <ul className="inventory-list">
            {upgrades.map(({ selection, index, card }) => (
              <li key={`${selection.id}:${index}`}>
                {card && (
                  <UpgradeArtwork
                    upgrade={card}
                    factionId={factionId}
                    label={upgradeName(card, lang)}
                    ui={ui}
                  />
                )}
                <div className="inventory-item-main">
                  <strong>
                    {card ? upgradeName(card, lang) : selection.id}
                  </strong>
                  {selection.choice && (
                    <small>
                      {t('Выбрано', 'Selected')}: {term(selection.choice, lang)}
                    </small>
                  )}
                  {card ? (
                    <details>
                      <summary>
                        {t('Эффект улучшения', 'Upgrade effect')}
                      </summary>
                      <p className="rule-text">{upgradeText(card, lang)}</p>
                      <a
                        href={`${UPGRADE_SOURCE}#page=${card.page}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('Карточка улучшения', 'Upgrade card')} ·{' '}
                        {t('с.', 'p.')} {card.page} ↗
                      </a>
                    </details>
                  ) : (
                    <p className="source-note">
                      {t(
                        'Карточка отсутствует в данных этого матча.',
                        'Card not found in this match’s data.',
                      )}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
