'use client';

import { type RefObject } from 'react';
import { useScrollSpy, scrollToSection } from './useScrollSpy';
import { cn } from '@/lib/utils';

/**
 * Bandeau sticky de chips qui jump-to chaque section du PropertiesPanel
 * (A4.1a). Le panel marque ses groupes via `<div data-section="basic">…</div>`
 * et passe la liste ordonnée à ce composant. Active = section au top du
 * scroller (déterminé par `useScrollSpy`).
 *
 * Why : panel de 4632 lignes avec ~30 séparateurs → scroll fatigue, perte de
 * vue d'ensemble. Refondre en vrais tabs nécessiterait de toucher chaque
 * branche par-type (M effort). Le navigator livre 80 % de la valeur (jump
 * direct + indication de position) avec 0 refonte de la logique de rendu.
 *
 * Si `sections` est vide ou contient un seul item → le composant ne rend rien
 * (pas de valeur à montrer un nav avec une seule entrée).
 */
export interface SectionNavItem {
  id: string;
  label: string;
}

export interface PropertiesSectionNavProps {
  /** Ref du conteneur scrollable (ScrollArea Viewport). */
  scrollRootRef: RefObject<HTMLElement | null>;
  sections: readonly SectionNavItem[];
  className?: string;
}

export function PropertiesSectionNav({ scrollRootRef, sections, className }: PropertiesSectionNavProps) {
  const sectionIds = sections.map((s) => s.id);
  const activeId = useScrollSpy(scrollRootRef, sectionIds);

  if (sections.length < 2) return null;

  return (
    <div
      className={cn(
        'sticky top-0 z-10 -mx-4 px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
      role="navigation"
      aria-label="Sections du panneau"
    >
      <div className="flex flex-wrap gap-1">
        {sections.map((s) => {
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(scrollRootRef.current, s.id)}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'px-2 py-0.5 rounded-sm text-[11px] font-mono uppercase tracking-wide border transition-colors',
                isActive
                  ? 'bg-signal-flux/15 text-signal-flux border-signal-flux/40'
                  : 'bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
