'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Observe quels `[data-section]` sont actuellement visibles dans le ScrollArea
 * du PropertiesPanel (A4.1a) et renvoie l'id de la section "active" (la plus
 * proche du haut du conteneur).
 *
 * Why : sans ça, la sticky section-nav ne saurait pas surligner la section
 * actuellement à l'écran quand l'utilisateur scrolle manuellement. On utilise
 * IntersectionObserver pour rester performant (pas de scroll listener à
 * 60 fps) et on classe les sections visibles par leur position verticale
 * dans le viewport.
 *
 * Le hook accepte un `rootRef` pour scoper l'observation au scroller du panel
 * (et pas au viewport global).
 */
export function useScrollSpy(
  rootRef: RefObject<HTMLElement | null>,
  sectionIds: readonly string[],
  options?: { rootMargin?: string; threshold?: number },
): string | null {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || sectionIds.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-section');
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        // Pick the first section in the document order that is currently visible —
        // matches "what's at the top of the panel" intuition.
        for (const id of sectionIds) {
          if (visible.has(id)) {
            setActiveId(id);
            return;
          }
        }
      },
      {
        root,
        rootMargin: options?.rootMargin ?? '0px 0px -60% 0px',
        threshold: options?.threshold ?? 0,
      },
    );

    const targets = sectionIds
      .map((id) => root.querySelector<HTMLElement>(`[data-section="${id}"]`))
      .filter((el): el is HTMLElement => el !== null);

    for (const t of targets) observer.observe(t);

    return () => observer.disconnect();
  }, [rootRef, sectionIds, options?.rootMargin, options?.threshold]);

  return activeId;
}

/**
 * Scroll smoothly vers la section identifiée par `data-section="<id>"`
 * à l'intérieur de `root`.
 */
export function scrollToSection(root: HTMLElement | null, sectionId: string): void {
  if (!root) return;
  const target = root.querySelector<HTMLElement>(`[data-section="${sectionId}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
