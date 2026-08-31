'use client';
/* eslint-disable next/no-img-element -- Official thumbnails are already resized; preserve source artwork without an image proxy. */
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { upgradeArtwork } from '@/lib/artwork';
import type { Lang, Upgrade } from '@/lib/model';

export function UpgradeArtwork({
  upgrade,
  label,
  ui,
  factionId,
}: {
  upgrade: Upgrade;
  label: string;
  ui: Lang;
  factionId?: string;
}) {
  const artwork = upgradeArtwork(upgrade, factionId);
  const [failed, setFailed] = useState<string | null>(null);
  if (!artwork || failed === artwork.thumbnailUrl)
    return (
      <span
        className="upgrade-artwork artwork-missing"
        title={ui === 'ru' ? 'Изображение недоступно' : 'Image unavailable'}
      >
        <ImageOff size={20} aria-hidden="true" />
        <span className="sr-only">
          {ui === 'ru' ? 'Изображение недоступно' : 'Image unavailable'}
        </span>
      </span>
    );
  return (
    <a
      className="upgrade-artwork"
      href={artwork.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${ui === 'ru' ? 'Открыть изображение (новая вкладка)' : 'Open image (new tab)'}: ${label}`}
      title={
        ui === 'ru' ? 'Открыть оригинал изображения' : 'Open original image'
      }
    >
      <img
        src={artwork.thumbnailUrl}
        alt={label}
        width={artwork.width}
        height={artwork.height}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(artwork.thumbnailUrl)}
      />
    </a>
  );
}
