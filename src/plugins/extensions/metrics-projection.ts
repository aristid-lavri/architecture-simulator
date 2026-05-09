import type { GraphNode } from '@/types/graph';
import type { ComponentAnalytics } from '@/analytics/types';
import type { ProjectKindMeta } from './project-kind';

/**
 * Métriques à pousser dans le footer d'un nœud — forme alignée sur `NodeFooterMetrics`
 * du NodeRenderer (cf. `components/canvas/NodeRenderer.ts`).
 *
 * Exposée ici (et pas importée depuis NodeRenderer) pour garder le registry indépendant
 * du rendu et facilement consommable hors-canvas si besoin.
 */
export interface ProjectedFooterMetrics {
  requestsIn: number;
  requestsOut: number;
  successCount: number;
  errorCount: number;
  cpu?: number;
  memory?: number;
  queueDepth?: number;
  connectedServices?: number;
}

export interface MetricsProjectionContext {
  /** Analytics calculés par l'engine pour les nœuds qui ont un handler. Clé = nodeId. */
  analyticsByNodeId: Map<string, ComponentAnalytics>;
  /** Tous les nœuds du graphe (visibles ou non). */
  allNodes: GraphNode[];
  /** Méta du projet courant. Permet à un provider de no-op selon le kind. */
  projectMeta: ProjectKindMeta;
}

/**
 * Projecteur qui dérive des métriques footer pour des nœuds qui n'ont pas leur propre
 * handler de simulation. Cas d'usage canonique : projeter les métriques d'un Container L2
 * sur ses N Container Instances Deployment (cf. `c4-multilevel/projector/DeploymentProjector.ts`).
 *
 * Retourne une Map par nodeId. Les nœuds absents ne sont pas affectés.
 */
export type MetricsProjectionProvider = (
  context: MetricsProjectionContext,
) => Map<string, ProjectedFooterMetrics>;

interface ProviderEntry {
  ownerId: string;
  provider: MetricsProjectionProvider;
}

type Listener = () => void;

class MetricsProjectionRegistryImpl {
  private entries: Map<string, ProviderEntry> = new Map();
  private listeners: Set<Listener> = new Set();

  register(ownerId: string, provider: MetricsProjectionProvider): void {
    this.entries.set(ownerId, { ownerId, provider });
    this.notify();
  }

  unregister(ownerId: string): void {
    if (this.entries.delete(ownerId)) this.notify();
  }

  /**
   * Exécute tous les providers enregistrés et fusionne leurs résultats. En cas de doublon
   * sur le même nodeId, la dernière écriture l'emporte (ordre d'enregistrement).
   */
  collectProjections(context: MetricsProjectionContext): Map<string, ProjectedFooterMetrics> {
    const out = new Map<string, ProjectedFooterMetrics>();
    for (const { provider } of this.entries.values()) {
      const result = provider(context);
      for (const [nodeId, metrics] of result) {
        out.set(nodeId, metrics);
      }
    }
    return out;
  }

  hasProviders(): boolean {
    return this.entries.size > 0;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const metricsProjectionRegistry = new MetricsProjectionRegistryImpl();
