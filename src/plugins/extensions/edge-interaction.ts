import type { GraphEdge } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Événement d'interaction sur un edge du canvas, dispatchable aux plugins.
 * Symétrique de `NodeInteractionEvent` côté nodes.
 */
export type EdgeInteractionEvent =
  | { type: 'doubleclick'; edgeId: string; edge: GraphEdge };

export interface EdgeInteractionContext {
  projectMeta: ProjectKindMeta;
}

/**
 * Un handler retourne `true` pour signaler que l'événement est consommé
 * (pas de propagation aux handlers suivants ni au comportement par défaut).
 */
export type EdgeInteractionHandler = (
  event: EdgeInteractionEvent,
  context: EdgeInteractionContext,
) => boolean;

interface HandlerEntry {
  id: string;
  handler: EdgeInteractionHandler;
  sortOrder: number;
}

class EdgeInteractionRegistryImpl {
  private handlers: Map<string, HandlerEntry> = new Map();

  registerHandler(id: string, handler: EdgeInteractionHandler, sortOrder = 100): void {
    this.handlers.set(id, { id, handler, sortOrder });
  }

  unregister(id: string): void {
    this.handlers.delete(id);
  }

  dispatch(event: EdgeInteractionEvent, context: EdgeInteractionContext): boolean {
    if (this.handlers.size === 0) return false;
    const sorted = Array.from(this.handlers.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (const { handler } of sorted) {
      try {
        if (handler(event, context)) return true;
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[edgeInteractionRegistry] handler threw', e);
        }
      }
    }
    return false;
  }

  hasHandlers(): boolean {
    return this.handlers.size > 0;
  }
}

export const edgeInteractionRegistry = new EdgeInteractionRegistryImpl();
