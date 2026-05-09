import type { GraphEdge } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Brouillon d'edge à décorer avant insertion dans le store.
 * Symétrique de `DraftNode`. Les decorators ne peuvent enrichir que `data` (pas modifier
 * source/target/handles) et peuvent retourner `null` pour bloquer la création.
 */
export type DraftEdge = Pick<GraphEdge, 'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle' | 'data'>;

export interface EdgeCreationContext {
  projectMeta: ProjectKindMeta;
}

/**
 * Decorator de création d'edge.
 *
 * Retours possibles :
 *  - `Record<string, unknown>` : nouveau `data` à merger.
 *  - `null` : bloque la création (validation échouée). Charge au plugin d'afficher un toast/feedback.
 */
export type EdgeCreationDecorator = (
  draftEdge: DraftEdge,
  ctx: EdgeCreationContext,
) => GraphEdge['data'] | null;

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
   *  - `null` si un decorator a refusé (la création doit être annulée par l'appelant).
   */
  apply(draftEdge: DraftEdge, ctx: EdgeCreationContext): GraphEdge['data'] | null {
    if (this.decorators.size === 0) return draftEdge.data;
    const sorted = Array.from(this.decorators.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    let data: GraphEdge['data'] = draftEdge.data;
    for (const { decorator } of sorted) {
      try {
        const next = decorator({ ...draftEdge, data }, ctx);
        if (next === null) return null;
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
