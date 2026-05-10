'use client';

import { useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { resolveDocText } from '@/lib/doc-text';
import type { DocScreenshot } from '@/data/docs-types';

export interface ScreenshotLightboxProps {
  /** Liste des screenshots ouvrables — vue groupée pour navigation prev/next. */
  screenshots: DocScreenshot[];
  /** Index actuellement affiché. */
  index: number;
  /** Fermeture (Esc, clic backdrop, bouton X). */
  onClose: () => void;
  /** Navigation prev/next ; appelée seulement si `screenshots.length > 1`. */
  onNavigate?: (newIndex: number) => void;
}

/**
 * Lightbox plein écran pour afficher un screenshot PNG/GIF en grand format.
 *
 * - Esc → ferme.
 * - ← / → → navigation si plusieurs screenshots.
 * - Clic backdrop → ferme.
 * - GIF rendu en `<img>` natif (next/image gère mal l'animation).
 * - PNG rendu en `<img>` ici aussi pour simplicité — la page /docs utilise déjà
 *   next/image en miniature, le lightbox est suffisamment ponctuel pour ne pas
 *   bénéficier de l'optimisation Next.
 */
export function ScreenshotLightbox({
  screenshots,
  index,
  onClose,
  onNavigate,
}: ScreenshotLightboxProps) {
  const { t } = useTranslation();
  const current = screenshots[index];
  const hasMulti = screenshots.length > 1 && onNavigate;

  const goPrev = useCallback(() => {
    if (!onNavigate || screenshots.length < 2) return;
    onNavigate((index - 1 + screenshots.length) % screenshots.length);
  }, [index, onNavigate, screenshots.length]);

  const goNext = useCallback(() => {
    if (!onNavigate || screenshots.length < 2) return;
    onNavigate((index + 1) % screenshots.length);
  }, [index, onNavigate, screenshots.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  if (!current) return null;

  const alt = resolveDocText(current.alt, t);
  const caption = resolveDocText(current.caption, t);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={(e) => {
        // Ferme si clic backdrop (pas sur l'image elle-même)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        <X className="h-6 w-6" />
      </button>

      {hasMulti && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous"
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white/80 hover:bg-black/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next"
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white/80 hover:bg-black/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <figure
        className={cn(
          'relative flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.src}
          alt={alt}
          className="max-h-[80vh] max-w-[90vw] rounded-md object-contain shadow-2xl ring-1 ring-white/10"
        />
        {caption && (
          <figcaption className="max-w-[80vw] text-center text-sm text-white/80">
            {caption}
          </figcaption>
        )}
        {hasMulti && (
          <div className="text-xs text-white/60">
            {index + 1} / {screenshots.length}
          </div>
        )}
      </figure>
    </div>
  );
}
