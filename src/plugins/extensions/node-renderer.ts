import type { GraphNode } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';

/**
 * Variantes de rendu disponibles pour un nœud.
 * Le NodeRenderer (PixiJS) consulte le registre pour savoir quel style appliquer.
 *
 * - `default` : rendu CE habituel (icône + nom + technologie + barre de signal).
 * - `strict` : rendu textuel uniforme (boîte uniforme, pas d'icône — utilisable pour des notations
 *              minimalistes uniformes par un plugin).
 *
 * Les plugins peuvent référencer `strict` ou ajouter leurs propres variantes via
 * un mécanisme d'override plus poussé dans une future itération.
 */
export type NodeRenderVariant = 'default' | 'strict';

/**
 * Indications de rendu produites par un NodeRendererProvider et consommées par le moteur de rendu.
 * Le rendu reste assuré par le CE — le plugin déclare seulement des hints.
 */
export interface NodeRenderHints {
  /** Variante de rendu à appliquer. */
  variant?: NodeRenderVariant;
  /** Couleur de fond override (CSS oklch / hex). */
  backgroundColor?: string;
  /** Couleur de bordure override. */
  borderColor?: string;
  /** Couleur de texte primaire override. */
  textColor?: string;
  /** Texte de tag affiché dans le coin (ex: "EXT", "L1", "L3"). */
  cornerTag?: string;
  /** Affiche la description en italique sous le nom (lue depuis node.data.description). */
  showDescription?: boolean;
  /** Champs additionnels libres pour les plugins (lus par leur propre extension renderer). */
  extra?: Record<string, unknown>;
}

export interface NodeRendererContext {
  projectMeta: ProjectKindMeta;
}

/**
 * Provider qui détermine si un nœud doit recevoir un rendu alternatif et avec quels hints.
 * Retourne `null` pour ne pas affecter ce nœud.
 */
export type NodeRendererProvider = (
  node: GraphNode,
  context: NodeRendererContext,
) => NodeRenderHints | null;

interface ProviderEntry {
  id: string;
  provider: NodeRendererProvider;
  /** Priorité (asc) : un provider plus bas est consulté en premier. Le premier non-null gagne. */
  sortOrder?: number;
}

type NodeRendererListener = () => void;

class NodeRendererRegistryImpl {
  private providers: Map<string, ProviderEntry> = new Map();
  private listeners: Set<NodeRendererListener> = new Set();

  register(id: string, provider: NodeRendererProvider, sortOrder?: number): void {
    this.providers.set(id, { id, provider, sortOrder });
    this.notify();
  }

  unregister(id: string): void {
    if (this.providers.delete(id)) this.notify();
  }

  /**
   * Calcule les hints de rendu effectifs pour un nœud.
   * Retourne null si aucun provider n'a fourni de hints (rendu CE par défaut).
   */
  resolveHints(node: GraphNode, context: NodeRendererContext): NodeRenderHints | null {
    if (this.providers.size === 0) return null;
    const sorted = Array.from(this.providers.values()).sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
    );
    for (const { provider } of sorted) {
      const hints = provider(node, context);
      if (hints !== null) return hints;
    }
    return null;
  }

  hasProviders(): boolean {
    return this.providers.size > 0;
  }

  subscribe(listener: NodeRendererListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const nodeRendererRegistry = new NodeRendererRegistryImpl();
