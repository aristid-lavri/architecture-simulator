'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { resolveDocText } from '@/lib/doc-text';
import { cn } from '@/lib/utils';

export interface LabelWithTooltipProps {
  /** Texte du label (clé i18n OU texte brut). */
  children: ReactNode;
  /**
   * Clé i18n de la description (ex. `components.http-server.fields.responseDelay.description`).
   * Si la clé est introuvable, aucun tooltip n'est rendu (graceful degradation).
   */
  tooltipKey?: string;
  /** Alternative à `tooltipKey` : texte brut de la description (fallback). */
  tooltipText?: string;
  /** Côté d'affichage du tooltip. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Classes additionnelles pour le label. */
  className?: string;
}

/**
 * Wrapper de label avec tooltip optionnel. Utilisé par le Properties Panel pour
 * exposer la description d'un champ au survol (~ « JSDoc hover »).
 *
 * - Si `tooltipKey` ou `tooltipText` est défini → l'icône `Info` apparaît et le
 *   hover ouvre un tooltip avec la description résolue via `t()` ou plain text.
 * - Si aucune description n'est fournie → rend juste le label (pas d'icône).
 *
 * Le hover/focus active le tooltip ; un clic ne fait rien (pour l'aide riche,
 * utiliser le bouton « ⓘ » de section qui ouvre `PropertyHelpDrawer`).
 */
export function LabelWithTooltip({
  children,
  tooltipKey,
  tooltipText,
  side = 'top',
  className,
}: LabelWithTooltipProps) {
  const { t } = useTranslation();

  // Résout la description : priorité clé i18n, puis texte brut.
  let description: string | undefined;
  if (tooltipKey) {
    const resolved = t(tooltipKey);
    // Si t() retourne la clé brute, la traduction est absente → pas de tooltip.
    if (resolved !== tooltipKey) description = resolved;
  }
  if (!description && tooltipText) {
    description = resolveDocText(tooltipText, t);
  }

  if (!description) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span>{children}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Field description"
            className="inline-flex h-3 w-3 cursor-help items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-left">
          {description}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
