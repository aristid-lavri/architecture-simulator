import type { ProjectKindMeta } from './project-kind';
import type { ComponentType } from 'react';

/**
 * Registre des overlays HTML rendus PAR-DESSUS le canvas PixiJS, sous le breadcrumb.
 *
 * Distinct de `canvasOverlayRegistry` (qui pilote des hints Pixi-level type border/strike-border
 * dessinés DANS le viewport) : ce registre-ci monte des composants React HTML en
 * `position: absolute` au-dessus du `<canvas>`, hors du viewport pan/zoom.
 *
 * Cas d'usage : ports de boundary, badges contextuels, pop-overs liés à des nodes,
 * ghost-edges décoratives, vues split-screen. Le composant overlay reçoit `projectMeta`
 * et est responsable de son propre fetching de state (Zustand selectors).
 *
 * Le DOM rendu est en `position: absolute; inset: 0; pointer-events: none;` ; les
 * sous-composants peuvent ré-activer `pointer-events: auto` sur leurs éléments interactifs.
 */
export interface CanvasHtmlOverlayProps {
  projectMeta: ProjectKindMeta;
}

export interface CanvasHtmlOverlayRegistration {
  id: string;
  component: ComponentType<CanvasHtmlOverlayProps>;
  /** asc : plus bas = rendu derrière. Défaut 100. */
  sortOrder?: number;
  shouldRender?: (ctx: { projectMeta: ProjectKindMeta }) => boolean;
}

type Listener = () => void;

class CanvasHtmlOverlayRegistryImpl {
  private entries: Map<string, CanvasHtmlOverlayRegistration> = new Map();
  private listeners: Set<Listener> = new Set();
  private cachedList: CanvasHtmlOverlayRegistration[] = [];

  register(entry: CanvasHtmlOverlayRegistration): void {
    this.entries.set(entry.id, entry);
    this.rebuildCache();
    this.notify();
  }

  unregister(id: string): void {
    if (this.entries.delete(id)) {
      this.rebuildCache();
      this.notify();
    }
  }

  /**
   * Liste cachée des entrées triées par `sortOrder` croissant. La référence est
   * stable entre deux mutations — requis par `useSyncExternalStore` pour éviter
   * une boucle de re-render infinie côté React.
   */
  list(): CanvasHtmlOverlayRegistration[] {
    return this.cachedList;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private rebuildCache(): void {
    this.cachedList = Array.from(this.entries.values()).sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
    );
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}

export const canvasHtmlOverlayRegistry = new CanvasHtmlOverlayRegistryImpl();
