import type { GraphEdge, GraphNode } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Styles de tracé disponibles pour un edge.
 */
export type EdgeStrokeStyle = 'solid' | 'dashed' | 'dotted';

/**
 * Hints de style pour un edge produits par un EdgeStyleProvider.
 */
export interface EdgeStyleHints {
  /** Couleur du trait (CSS color / hex / oklch). */
  color?: string;
  /** Style de tracé. */
  strokeStyle?: EdgeStrokeStyle;
  /** Épaisseur du trait en pixels. */
  strokeWidth?: number;
  /** Label override affiché sur l'edge. */
  label?: string;
  /** Taille de la police du label en pixels. */
  labelSize?: number;
  /** Style du label : mono uppercase (instrument) vs italic (semantic). */
  labelStyle?: 'instrument' | 'semantic';
  /** Champs additionnels libres pour les plugins. */
  extra?: Record<string, unknown>;
}

export interface EdgeStyleContext {
  projectMeta: ProjectKindMeta;
  sourceNode?: GraphNode;
  targetNode?: GraphNode;
}

/**
 * Provider qui retourne des hints de style pour un edge donné.
 * Retourne `null` pour ne pas affecter ce edge.
 */
export type EdgeStyleProvider = (
  edge: GraphEdge,
  context: EdgeStyleContext,
) => EdgeStyleHints | null;

interface ProviderEntry {
  id: string;
  provider: EdgeStyleProvider;
  sortOrder?: number;
}

type EdgeStyleListener = () => void;

class EdgeStyleRegistryImpl {
  private providers: Map<string, ProviderEntry> = new Map();
  private listeners: Set<EdgeStyleListener> = new Set();

  register(id: string, provider: EdgeStyleProvider, sortOrder?: number): void {
    this.providers.set(id, { id, provider, sortOrder });
    this.notify();
  }

  unregister(id: string): void {
    if (this.providers.delete(id)) this.notify();
  }

  resolveHints(edge: GraphEdge, context: EdgeStyleContext): EdgeStyleHints | null {
    if (this.providers.size === 0) return null;
    const sorted = Array.from(this.providers.values()).sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
    );
    for (const { provider } of sorted) {
      const hints = provider(edge, context);
      if (hints !== null) return hints;
    }
    return null;
  }

  hasProviders(): boolean {
    return this.providers.size > 0;
  }

  subscribe(listener: EdgeStyleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const edgeStyleRegistry = new EdgeStyleRegistryImpl();
