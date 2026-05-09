import type { GraphNode } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Hint d'overlay produit par un provider et consommé par PixiCanvas.
 * Le canvas dessine la primitive correspondante au-dessus du node identifié.
 */
export interface OverlayHint {
  kind: 'border' | 'strike-border';
  /** Couleur du trait, format hex `0xRRGGBB`. */
  color: number;
  /** Opacité du trait dans [0, 1]. */
  alpha: number;
}

export interface CanvasOverlayContext {
  /** Tous les nœuds du graphe — visibles ou non. */
  allNodes: GraphNode[];
  /** Méta du projet courant. Permet à un provider de no-op selon le `kind`. */
  projectMeta: ProjectKindMeta;
}

/**
 * Provider qui retourne une Map `nodeId → OverlayHint` pour les nœuds qui doivent
 * recevoir un overlay. Les nœuds absents de la map ne sont pas affectés.
 */
export type CanvasOverlayProvider = (ctx: CanvasOverlayContext) => Map<string, OverlayHint>;

type Listener = () => void;

class CanvasOverlayRegistryImpl {
  private providers: Map<string, CanvasOverlayProvider> = new Map();
  private listeners: Set<Listener> = new Set();
  private version = 0;

  register(id: string, provider: CanvasOverlayProvider): void {
    this.providers.set(id, provider);
    this.notify();
  }

  unregister(id: string): void {
    if (this.providers.delete(id)) this.notify();
  }

  /**
   * Exécute tous les providers enregistrés et fusionne leurs résultats. En cas de
   * doublon sur le même `nodeId`, la dernière écriture l'emporte (ordre d'insertion).
   */
  collect(ctx: CanvasOverlayContext): Map<string, OverlayHint> {
    const out = new Map<string, OverlayHint>();
    for (const provider of this.providers.values()) {
      for (const [id, hint] of provider(ctx)) out.set(id, hint);
    }
    return out;
  }

  hasProviders(): boolean {
    return this.providers.size > 0;
  }

  /**
   * Numéro de version monotone, incrémenté à chaque `notify()`. Utilisé par
   * `useSyncExternalStore` côté React pour forcer un re-render quand l'état
   * effectif d'un overlay change même si le set de providers reste identique.
   */
  getVersion(): number {
    return this.version;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Notifie manuellement les listeners (ex: app-store change → re-render canvas). */
  notify(): void {
    this.version++;
    for (const l of this.listeners) l();
  }
}

export const canvasOverlayRegistry = new CanvasOverlayRegistryImpl();
