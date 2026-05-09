import type { GraphNode } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Événement d'interaction sur un nœud du canvas, dispatchable aux plugins.
 * Les plugins peuvent réagir (par exemple : drill-down sur double-clic).
 */
export type NodeInteractionEvent =
  | { type: 'doubleclick'; nodeId: string; node: GraphNode }
  | { type: 'longpress'; nodeId: string; node: GraphNode };

/**
 * Contexte fourni au handler.
 */
export interface NodeInteractionContext {
  projectMeta: ProjectKindMeta;
}

/**
 * Un handler retourne `true` pour signaler que l'événement est consommé
 * (pas de propagation aux handlers suivants ni au comportement par défaut).
 */
export type NodeInteractionHandler = (
  event: NodeInteractionEvent,
  context: NodeInteractionContext,
) => boolean;

interface HandlerEntry {
  id: string;
  handler: NodeInteractionHandler;
  /** Ordre asc (0 = consulté en premier). */
  sortOrder: number;
}

class NodeInteractionRegistryImpl {
  private handlers: Map<string, HandlerEntry> = new Map();

  registerHandler(id: string, handler: NodeInteractionHandler, sortOrder = 100): void {
    this.handlers.set(id, { id, handler, sortOrder });
  }

  unregister(id: string): void {
    this.handlers.delete(id);
  }

  /**
   * Dispatch d'un événement.
   * Retourne `true` si au moins un handler l'a consommé.
   * Les handlers sont consultés par sortOrder croissant ; le premier qui retourne
   * `true` arrête la chaîne.
   */
  dispatch(event: NodeInteractionEvent, context: NodeInteractionContext): boolean {
    if (this.handlers.size === 0) return false;
    const sorted = Array.from(this.handlers.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (const { handler } of sorted) {
      try {
        if (handler(event, context)) return true;
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[nodeInteractionRegistry] handler threw', e);
        }
      }
    }
    return false;
  }

  hasHandlers(): boolean {
    return this.handlers.size > 0;
  }
}

export const nodeInteractionRegistry = new NodeInteractionRegistryImpl();
