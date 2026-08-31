import source from '../data/upgrade-artwork.json';
import type { Upgrade } from './model';

// Artwork is presentation metadata, separate from versioned game rules and roster snapshots.
export function upgradeArtwork(upgrade: Upgrade, factionId?: string) {
  const choices = source.images.filter(
    (image) =>
      image.upgradeId === upgrade.id && image.upgradeName === upgrade.name,
  );
  return choices.find((image) => image.factionId === factionId) ?? choices[0];
}
