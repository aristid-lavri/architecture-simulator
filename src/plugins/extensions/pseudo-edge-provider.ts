import type { GraphEdge, GraphNode } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Edge synthétique injectée dans le rendu mais **pas persistée** dans l'architecture-store.
 * Un pseudo-edge a le même shape qu'un GraphEdge à l'exception du flag `__pseudo: true` et
 * d'un id préfixé `pseudo:` pour éviter les collisions.
 *
 * Le provider est réinvoqué à chaque changement de la liste des edges réelles, des nodes,
 * ou du projectMeta.
 */
export interface PseudoEdge extends GraphEdge {
  __pseudo: true;
  /** Hint visuel : `'ghost'` pour pointillé + opacité réduite. */
  visualHint?: 'ghost' | 'highlight';
}

export interface PseudoEdgeContext {
  projectMeta: ProjectKindMeta;
  nodes: ReadonlyArray<GraphNode>;
  edges: ReadonlyArray<GraphEdge>;
}

export type PseudoEdgeProvider = (ctx: PseudoEdgeContext) => PseudoEdge[];

interface ProviderEntry {
  id: string;
  provider: PseudoEdgeProvider;
  sortOrder?: number;
}

class PseudoEdgeRegistryImpl {
  private providers: Map<string, ProviderEntry> = new Map();
  private listeners: Set<() => void> = new Set();

  register(id: string, provider: PseudoEdgeProvider, sortOrder?: number): void {
    this.providers.set(id, { id, provider, sortOrder });
    this.notify();
  }
  unregister(id: string): void {
    if (this.providers.delete(id)) this.notify();
  }
  collect(ctx: PseudoEdgeContext): PseudoEdge[] {
    if (this.providers.size === 0) return [];
    const sorted = Array.from(this.providers.values()).sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
    );
    const out: PseudoEdge[] = [];
    for (const { provider } of sorted) out.push(...provider(ctx));
    return out;
  }
  hasProviders(): boolean {
    return this.providers.size > 0;
  }
  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private notify(): void {
    for (const l of this.listeners) l();
  }
}

export const pseudoEdgeRegistry = new PseudoEdgeRegistryImpl();
