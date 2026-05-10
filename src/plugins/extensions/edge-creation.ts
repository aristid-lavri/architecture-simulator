import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Brouillon d'edge à décorer avant insertion dans le store.
 * Symétrique de `DraftNode`. Les decorators ne peuvent enrichir que `data` (pas modifier
 * source/target/handles) et peuvent retourner `null` pour bloquer la création.
 */
export type DraftEdge = Pick<GraphEdge, 'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle' | 'data'>;

export interface EdgeCreationContext {
  projectMeta: ProjectKindMeta;
  /** Lecture lazy de l'état courant du graphe — utilisée par les decorators contextuels (ex: rules-engine). */
  getNodes?: () => GraphNode[];
  getEdges?: () => GraphEdge[];
}

/**
 * Refus explicite de création d'edge avec message i18n. Permet à un decorator
 * (typiquement le rules-engine) de signaler à l'appelant qu'il doit afficher un toast
 * et annuler la création — variante "loud" du `null` historique (qui reste un refus silencieux).
 */
export type EdgeRejection = {
  reject: true;
  messageKey: string;
  params?: Record<string, string | number>;
};

/**
 * Type guard pour distinguer un `EdgeRejection` d'un `data` enrichi.
 */
export function isEdgeRejection(v: unknown): v is EdgeRejection {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { reject?: unknown }).reject === true &&
    typeof (v as { messageKey?: unknown }).messageKey === 'string'
  );
}

/**
 * Decorator de création d'edge.
 *
 * Retours possibles :
 *  - `Record<string, unknown>` : nouveau `data` à merger.
 *  - `null` : bloque la création silencieusement (validation échouée).
 *  - `EdgeRejection` : bloque la création AVEC message i18n à afficher (toast/feedback).
 */
export type EdgeCreationDecorator = (
  draftEdge: DraftEdge,
  ctx: EdgeCreationContext,
) => GraphEdge['data'] | null | EdgeRejection;

interface DecoratorEntry {
  id: string;
  decorator: EdgeCreationDecorator;
  sortOrder: number;
}

class EdgeCreationDecoratorRegistryImpl {
  private decorators: Map<string, DecoratorEntry> = new Map();

  register(id: string, decorator: EdgeCreationDecorator, sortOrder = 100): void {
    this.decorators.set(id, { id, decorator, sortOrder });
  }

  unregister(id: string): void {
    this.decorators.delete(id);
  }

  /**
   * Applique tous les decorators dans l'ordre `sortOrder` croissant.
   *
   * Retour :
   *  - Le `data` final si tous les decorators ont accepté la création.
   *  - `null` si un decorator a refusé silencieusement (la création doit être annulée par l'appelant).
   *  - `EdgeRejection` si un decorator a refusé avec message à afficher (l'appelant utilise
   *    `isEdgeRejection()` pour distinguer et surfacer un toast i18n).
   */
  apply(draftEdge: DraftEdge, ctx: EdgeCreationContext): GraphEdge['data'] | null | EdgeRejection {
    if (this.decorators.size === 0) return draftEdge.data;
    const sorted = Array.from(this.decorators.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    let data: GraphEdge['data'] = draftEdge.data;
    for (const { decorator } of sorted) {
      try {
        const next = decorator({ ...draftEdge, data }, ctx);
        if (next === null) return null;
        if (isEdgeRejection(next)) return next;
        if (next && next !== data) {
          data = { ...data, ...next };
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[edgeCreationDecoratorRegistry] decorator threw', e);
        }
      }
    }
    return data;
  }

  hasDecorators(): boolean {
    return this.decorators.size > 0;
  }
}

export const edgeCreationDecoratorRegistry = new EdgeCreationDecoratorRegistryImpl();
