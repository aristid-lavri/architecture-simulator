import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Contexte fourni aux hooks de suppression.
 */
export interface DeleteHookContext {
  /** Nœud sur lequel l'utilisateur déclenche la suppression. */
  node: GraphNode;
  /** Tous les nœuds courants du graphe (pour calculer les dépendants). */
  allNodes: GraphNode[];
  /** Tous les edges courants. */
  allEdges: GraphEdge[];
  /** Métadonnées du projet courant. */
  projectMeta: ProjectKindMeta;
}

/**
 * Contexte fourni aux hooks de suppression d'edge.
 */
export interface EdgeDeleteHookContext {
  /** Edge sur lequel l'utilisateur déclenche la suppression. */
  edge: GraphEdge;
  /** Tous les nodes courants. */
  allNodes: GraphNode[];
  /** Tous les edges courants (pour calculer les dépendants — ex. raffinements enfants). */
  allEdges: GraphEdge[];
  /** Métadonnées du projet courant. */
  projectMeta: ProjectKindMeta;
}

/**
 * Décision retournée par un hook de suppression.
 *
 * - `proceed` : laisser le store appliquer la suppression normale.
 * - `intercept` : le hook prend en charge la suite (typiquement en ouvrant un dialog).
 *   Le store NE supprime PAS le nœud — c'est au hook d'appeler `removeNode` plus tard
 *   avec un flag `bypassHooks: true` une fois la décision utilisateur prise.
 */
export type DeleteHookDecision =
  | { kind: 'proceed' }
  | { kind: 'intercept' };

/**
 * Hook appelé avant la suppression d'un nœud, dans l'ordre d'enregistrement.
 * Le 1er hook qui retourne `intercept` arrête la chaîne et bloque la suppression
 * (charge au plugin d'appeler une suppression directe ensuite si l'utilisateur confirme).
 */
export type DeleteHook = (context: DeleteHookContext) => DeleteHookDecision;

/**
 * Hook symétrique pour la suppression d'edge. Mêmes sémantiques (`proceed` / `intercept`).
 */
export type EdgeDeleteHook = (context: EdgeDeleteHookContext) => DeleteHookDecision;

interface HookEntry {
  id: string;
  hook: DeleteHook;
  sortOrder?: number;
}

interface EdgeHookEntry {
  id: string;
  hook: EdgeDeleteHook;
  sortOrder?: number;
}

type DeleteHookListener = () => void;

class DeleteHookRegistryImpl {
  private hooks: Map<string, HookEntry> = new Map();
  private edgeHooks: Map<string, EdgeHookEntry> = new Map();
  private listeners: Set<DeleteHookListener> = new Set();

  register(id: string, hook: DeleteHook, sortOrder?: number): void {
    this.hooks.set(id, { id, hook, sortOrder });
    this.notify();
  }

  registerEdgeHook(id: string, hook: EdgeDeleteHook, sortOrder?: number): void {
    this.edgeHooks.set(id, { id, hook, sortOrder });
    this.notify();
  }

  unregister(id: string): void {
    let changed = false;
    if (this.hooks.delete(id)) changed = true;
    if (this.edgeHooks.delete(id)) changed = true;
    if (changed) this.notify();
  }

  /**
   * Consulte les hooks dans l'ordre. Retourne le premier verdict d'interception.
   * Si tous les hooks retournent `proceed` (ou aucun hook), retourne `proceed`.
   */
  consult(context: DeleteHookContext): DeleteHookDecision {
    if (this.hooks.size === 0) return { kind: 'proceed' };
    const sorted = Array.from(this.hooks.values()).sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
    );
    for (const { hook } of sorted) {
      const decision = hook(context);
      if (decision.kind === 'intercept') return decision;
    }
    return { kind: 'proceed' };
  }

  /** Symétrique de `consult` pour les edges. */
  consultEdge(context: EdgeDeleteHookContext): DeleteHookDecision {
    if (this.edgeHooks.size === 0) return { kind: 'proceed' };
    const sorted = Array.from(this.edgeHooks.values()).sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
    );
    for (const { hook } of sorted) {
      const decision = hook(context);
      if (decision.kind === 'intercept') return decision;
    }
    return { kind: 'proceed' };
  }

  hasHooks(): boolean {
    return this.hooks.size > 0;
  }

  hasEdgeHooks(): boolean {
    return this.edgeHooks.size > 0;
  }

  subscribe(listener: DeleteHookListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const deleteHookRegistry = new DeleteHookRegistryImpl();
