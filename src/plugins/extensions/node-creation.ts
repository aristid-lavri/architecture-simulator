import type { GraphNode } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Brouillon de nœud à décorer avant insertion dans le store.
 * Ne contient que les champs structurants ; les decorators ne peuvent pas modifier
 * `id`, `type`, `position` — uniquement enrichir `data`.
 */
export type DraftNode = Pick<GraphNode, 'id' | 'type' | 'position' | 'data'>;

/**
 * Contexte fourni à un decorator au moment de la création.
 *
 * - `projectMeta` : métadonnées du projet courant (kind + extensions plugin).
 * - `dragMimeType` : étiquette logique de la source drag-drop, si disponible
 *   (les plugins peuvent y placer un identifiant arbitraire via `dataTransfer`).
 * - `dragExtra` : autres types `dataTransfer` lus depuis l'évènement drop, indexés
 *   par mime-type. Permet aux plugins de transmettre des métadonnées additionnelles
 *   (ex: une étiquette posée par leur palette) sans étendre l'API CE.
 */
export interface NodeCreationContext {
  projectMeta: ProjectKindMeta;
  dragMimeType?: string;
  dragExtra?: Record<string, string>;
}

/**
 * Decorator de création de nœud.
 *
 * Reçoit un brouillon (read-only) + contexte, retourne une nouvelle valeur de `data`
 * qui sera mergée par-dessus celle du brouillon. Le decorator ne mute jamais `draftNode`.
 *
 * Plusieurs decorators peuvent s'enchainer : chacun voit le `draftNode` avec le `data`
 * accumulé des decorators précédents.
 */
export type NodeCreationDecorator = (
  draftNode: DraftNode,
  ctx: NodeCreationContext,
) => GraphNode['data'];

interface DecoratorEntry {
  id: string;
  decorator: NodeCreationDecorator;
  sortOrder: number;
}

class NodeCreationDecoratorRegistryImpl {
  private decorators: Map<string, DecoratorEntry> = new Map();

  /**
   * Enregistre un decorator. `sortOrder` croissant = appliqué en premier.
   */
  register(id: string, decorator: NodeCreationDecorator, sortOrder = 100): void {
    this.decorators.set(id, { id, decorator, sortOrder });
  }

  unregister(id: string): void {
    this.decorators.delete(id);
  }

  /**
   * Applique tous les decorators dans l'ordre `sortOrder` croissant et retourne
   * la valeur finale de `data` à utiliser pour créer le nœud.
   *
   * Si aucun decorator n'est enregistré, retourne `draftNode.data` inchangé.
   * Les exceptions sont attrapées et loggées en dev pour ne pas bloquer la création.
   */
  apply(draftNode: DraftNode, ctx: NodeCreationContext): GraphNode['data'] {
    if (this.decorators.size === 0) return draftNode.data;
    const sorted = Array.from(this.decorators.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    let data = draftNode.data;
    for (const { decorator } of sorted) {
      try {
        const next = decorator({ ...draftNode, data }, ctx);
        if (next && next !== data) {
          data = { ...data, ...next };
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[nodeCreationDecoratorRegistry] decorator threw', e);
        }
      }
    }
    return data;
  }

  hasDecorators(): boolean {
    return this.decorators.size > 0;
  }
}

export const nodeCreationDecoratorRegistry = new NodeCreationDecoratorRegistryImpl();
