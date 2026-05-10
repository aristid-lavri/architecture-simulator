'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { resolveDocText } from '@/lib/doc-text';
import type { DocScreenshot as DocScreenshotData } from '@/data/docs-types';
import { ScreenshotLightbox } from './ScreenshotLightbox';

export interface DocScreenshotProps {
  /** Le screenshot à afficher (PNG ou GIF). */
  screenshot: DocScreenshotData;
  /**
   * Liste sœur pour activer la navigation prev/next dans le lightbox.
   * Si non fournie, le clic ouvre le screenshot seul.
   */
  siblings?: DocScreenshotData[];
  /** Largeur affichée en miniature (px). Défaut : 480. */
  width?: number;
  /** Hauteur affichée en miniature (px). Défaut : 270. */
  height?: number;
  /** Classes CSS additionnelles. */
  className?: string;
}

/**
 * Rendu d'une capture d'écran de documentation utilisateur.
 *
 * - PNG → `next/image` (lazy loading, optimisation auto).
 * - GIF → `<img>` natif (next/image gère mal les GIF animés).
 * - Clic → ouvre `ScreenshotLightbox` plein écran. Si `siblings` est fournie,
 *   le lightbox supporte la navigation prev/next.
 *
 * Le texte `alt` et `caption` accepte indifféremment un texte brut ou une clé
 * i18n (résolu via `resolveDocText`).
 */
export function DocScreenshot({
  screenshot,
  siblings,
  width = 480,
  height = 270,
  className,
}: DocScreenshotProps) {
  const { t } = useTranslation();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const alt = resolveDocText(screenshot.alt, t);
  const caption = resolveDocText(screenshot.caption, t);
  const isGif = screenshot.kind === 'gif';

  // Liste utilisée par le lightbox — siblings si fournie, sinon ce screenshot seul.
  const lightboxList = siblings && siblings.length > 0 ? siblings : [screenshot];
  const indexInList = siblings ? siblings.indexOf(screenshot) : 0;

  function openLightbox() {
    setOpenIdx(indexInList >= 0 ? indexInList : 0);
  }

  // Si l'asset est manquant (404), on rend un placeholder discret avec le caption
  // — utile pendant la phase de bootstrap d'une entrée doc avant que les vrais
  // assets ne soient fournis.
  if (loadFailed) {
    return (
      <figure className={cn('flex flex-col items-start gap-2', className)}>
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-[10px] text-muted-foreground/70"
          style={{ width, height }}
        >
          asset manquant : <code className="ml-1 font-mono">{screenshot.src}</code>
        </div>
        {caption && (
          <figcaption className="max-w-full text-xs text-muted-foreground">{caption}</figcaption>
        )}
      </figure>
    );
  }

  return (
    <>
      <figure
        className={cn(
          'group relative flex flex-col items-start gap-2',
          className,
        )}
      >
        <button
          type="button"
          onClick={openLightbox}
          aria-label={alt}
          className="block overflow-hidden rounded-md border border-border bg-muted/30 transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          style={{ width, height }}
        >
          {isGif ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshot.src}
              alt={alt}
              loading="lazy"
              onError={() => setLoadFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={screenshot.src}
              alt={alt}
              width={width}
              height={height}
              onError={() => setLoadFailed(true)}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
        </button>
        {caption && (
          <figcaption className="max-w-full text-xs text-muted-foreground">
            {caption}
          </figcaption>
        )}
      </figure>

      {openIdx !== null && (
        <ScreenshotLightbox
          screenshots={lightboxList}
          index={openIdx}
          onClose={() => setOpenIdx(null)}
          onNavigate={siblings && siblings.length > 1 ? setOpenIdx : undefined}
        />
      )}
    </>
  );
}

/**
 * Galerie horizontale de screenshots (vue de groupe).
 * Chaque vignette ouvre le lightbox avec navigation prev/next entre toutes.
 */
export function DocScreenshotGallery({
  screenshots,
  className,
}: {
  screenshots: DocScreenshotData[];
  className?: string;
}) {
  if (screenshots.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {screenshots.map((s) => (
        <DocScreenshot key={s.src} screenshot={s} siblings={screenshots} />
      ))}
    </div>
  );
}
