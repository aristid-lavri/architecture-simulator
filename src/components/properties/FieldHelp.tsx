'use client';

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Petite icône `?` 12px next-to-label qui ouvre un tooltip d'aide contextuelle
 * (A4.4). Le contenu vit dans `properties.<type>.<field>.help` (i18n FR + EN).
 *
 * Why : un énorme nombre de champs du PropertiesPanel demandent une plage
 * typique ou une formule pour être rempli intelligemment. Sans aide, l'utilisateur
 * met "n'importe quoi par devinette". Mais alourdir tous les labels avec un texte
 * d'aide visible permanent gonfle le panel verticalement (opposé à A4.1). Tooltip
 * = compromis : découvrable, accessible clavier (focusable), zéro impact spatial.
 *
 * Fallback : si la clé i18n n'existe pas (le `t()` du projet renvoie alors la
 * clé elle-même), le composant ne rend rien — évite de polluer l'UI avec un
 * tooltip qui montrerait `properties.foo.bar.help` brut.
 */
export interface FieldHelpProps {
  /** Clé i18n complète (ex : `'properties.httpServer.port.help'`). */
  i18nKey: string;
  /** `aria-label` du bouton trigger. Défaut : "Aide". */
  ariaLabel?: string;
  /** Side du tooltip (Radix). Défaut : `'top'`. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function FieldHelp({ i18nKey, ariaLabel = 'Aide', side = 'top', className }: FieldHelpProps) {
  const { t } = useTranslation();
  const text = t(i18nKey);
  // `useTranslation().t` renvoie la clé elle-même si manquante → fallback : ne rien rendre.
  if (text === i18nKey) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex items-center justify-center rounded-sm text-muted-foreground/70 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors',
            className,
          )}
          // Empeche le label parent (Radix uses asChild) de re-trigger un focus du champ.
          onClick={(e) => e.preventDefault()}
        >
          <HelpCircle className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
