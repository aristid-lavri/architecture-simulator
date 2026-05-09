import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Contexte fourni aux filtres et sélecteurs de position.
 */
export interface CanvasFilterContext {
  projectMeta: ProjectKindMeta;
}

/**
 * Filtre de visibilité d'un nœud sur le canvas.
 * Un nœud est rendu si TOUS les filtres enregistrés retournent true.
 * Un filtre absent (registry vide) = tous les nœuds visibles (comportement par défaut).
 */
export type NodeVisibilityFilter = (node: GraphNode, context: CanvasFilterContext) => boolean;

/**
 * Filtre de visibilité d'un edge.
 * Un edge est rendu si TOUS les filtres enregistrés retournent true.
 */
export type EdgeVisibilityFilter = (edge: GraphEdge, context: CanvasFilterContext) => boolean;

/**
 * Sélecteur de position : permet à un plugin de fournir une position alternative
 * pour un nœud (ex: position spécifique à un mode de vue actif).
 * Retourne `null` pour laisser la position par défaut (`node.position`).
 * Le premier sélecteur retournant une position non-nulle est utilisé.
 */
export type NodePositionSelector = (
  node: GraphNode,
  context: CanvasFilterContext,
) => { x: number; y: number } | null;

/**
 * Writer de position : permet à un plugin de décider OÙ persister une nouvelle
 * position (ex: dans un slot par-niveau plutôt que dans `position` directement).
 *
 * Retourne :
 *  - `null` → ce writer ne s'applique pas, on consulte le suivant ou on tombe sur
 *    le défaut (`{ position: newPosition }`).
 *  - un patch `Partial<GraphNode>` → appliqué tel quel sur le nœud (ex:
 *    `{ data: { ...node.data, positionsByLevel: { ..., deployment: newPos } } }`).
 *
 * Utilisé par l'auto-layout pour écrire la position calculée dans le bon slot.
 */
export type NodePositionWriter = (
  node: GraphNode,
  newPosition: { x: number; y: number },
  context: CanvasFilterContext,
) => Partial<GraphNode> | null;

interface FilterEntry {
  id: string;
  filter: NodeVisibilityFilter;
}

interface EdgeFilterEntry {
  id: string;
  filter: EdgeVisibilityFilter;
}

interface PositionEntry {
  id: string;
  selector: NodePositionSelector;
  /** Priorité (asc) : un selector avec sortOrder plus bas est consulté en premier. */
  sortOrder?: number;
}

interface PositionWriterEntry {
  id: string;
  writer: NodePositionWriter;
  sortOrder?: number;
}

type CanvasFilterListener = () => void;

class CanvasFilterRegistryImpl {
  private nodeFilters: Map<string, FilterEntry> = new Map();
  private edgeFilters: Map<string, EdgeFilterEntry> = new Map();
  private positionSelectors: Map<string, PositionEntry> = new Map();
  private positionWriters: Map<string, PositionWriterEntry> = new Map();
  private listeners: Set<CanvasFilterListener> = new Set();

  registerNodeFilter(id: string, filter: NodeVisibilityFilter): void {
    this.nodeFilters.set(id, { id, filter });
    this.notify();
  }

  registerEdgeFilter(id: string, filter: EdgeVisibilityFilter): void {
    this.edgeFilters.set(id, { id, filter });
    this.notify();
  }

  registerPositionSelector(
    id: string,
    selector: NodePositionSelector,
    sortOrder?: number,
  ): void {
    this.positionSelectors.set(id, { id, selector, sortOrder });
    this.notify();
  }

  registerPositionWriter(
    id: string,
    writer: NodePositionWriter,
    sortOrder?: number,
  ): void {
    this.positionWriters.set(id, { id, writer, sortOrder });
    this.notify();
  }

  unregister(id: string): void {
    let changed = false;
    if (this.nodeFilters.delete(id)) changed = true;
    if (this.edgeFilters.delete(id)) changed = true;
    if (this.positionSelectors.delete(id)) changed = true;
    if (this.positionWriters.delete(id)) changed = true;
    if (changed) this.notify();
  }

  /** Applique tous les filtres aux nœuds. Vrai si aucun filtre, ou si tous retournent true. */
  isNodeVisible(node: GraphNode, context: CanvasFilterContext): boolean {
    if (this.nodeFilters.size === 0) return true;
    for (const { filter } of this.nodeFilters.values()) {
      if (!filter(node, context)) return false;
    }
    return true;
  }

  isEdgeVisible(edge: GraphEdge, context: CanvasFilterContext): boolean {
    if (this.edgeFilters.size === 0) return true;
    for (const { filter } of this.edgeFilters.values()) {
      if (!filter(edge, context)) return false;
    }
    return true;
  }

  /** Retourne la position effective : 1er selector non-null, sinon `node.position`. */
  resolveNodePosition(node: GraphNode, context: CanvasFilterContext): { x: number; y: number } {
    if (this.positionSelectors.size > 0) {
      const sorted = Array.from(this.positionSelectors.values()).sort(
        (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
      );
      for (const { selector } of sorted) {
        const pos = selector(node, context);
        if (pos !== null) return pos;
      }
    }
    return node.position;
  }

  /**
   * Retourne le patch à appliquer pour persister une nouvelle position.
   * 1er writer non-null, sinon défaut `{ position: newPosition }`.
   * Utilisé par l'auto-layout pour écrire dans `positionsByLevel[activeLevel]`
   * (plugin C4) plutôt que d'écraser `node.position` directement.
   */
  commitNodePosition(
    node: GraphNode,
    newPosition: { x: number; y: number },
    context: CanvasFilterContext,
  ): Partial<GraphNode> {
    if (this.positionWriters.size > 0) {
      const sorted = Array.from(this.positionWriters.values()).sort(
        (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
      );
      for (const { writer } of sorted) {
        const patch = writer(node, newPosition, context);
        if (patch !== null) return patch;
      }
    }
    return { position: newPosition };
  }

  /** Filtre une liste de nœuds en appliquant les visibility filters. */
  filterNodes(nodes: GraphNode[], context: CanvasFilterContext): GraphNode[] {
    if (this.nodeFilters.size === 0) return nodes;
    return nodes.filter((n) => this.isNodeVisible(n, context));
  }

  /** Filtre une liste d'edges en appliquant les visibility filters. */
  filterEdges(edges: GraphEdge[], context: CanvasFilterContext): GraphEdge[] {
    if (this.edgeFilters.size === 0) return edges;
    return edges.filter((e) => this.isEdgeVisible(e, context));
  }

  hasFilters(): boolean {
    return (
      this.nodeFilters.size > 0 ||
      this.edgeFilters.size > 0 ||
      this.positionSelectors.size > 0 ||
      this.positionWriters.size > 0
    );
  }

  subscribe(listener: CanvasFilterListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const canvasFilterRegistry = new CanvasFilterRegistryImpl();
