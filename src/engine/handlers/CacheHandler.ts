import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { CacheNodeData } from '@/types';
import { CacheManager } from '../CacheManager';

/**
 * Handler pour les nœuds Cache.
 * Implémente le pattern cache-aside avec un vrai dictionnaire clé-valeur:
 * - Cache hit (clé existe) → respond directement avec la valeur
 * - Cache miss (clé n'existe pas) → forward vers la DB, puis stocker et répondre
 */
export class CacheHandler implements NodeRequestHandler {
  readonly nodeType = 'cache';

  private manager: CacheManager;

  constructor(manager: CacheManager) {
    this.manager = manager;
  }

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as CacheNodeData;
    return data.performance.getLatencyMs / speed;
  }

  initialize(node: GraphNode): void {
    const data = node.data as CacheNodeData;
    this.manager.initializeCache(node.id, data);
  }

  cleanup(nodeId: string): void {
    this.manager.cleanup(nodeId);
  }

  /**
   * Génère une clé de cache basée sur le path HTTP de la requête.
   * Inclut la méthode HTTP si disponible pour différencier GET/POST sur le même path.
   * Fallback sur originNodeId si aucun requestPath n'est défini.
   */
  private generateCacheKey(context: RequestContext): string {
    const method = context.httpMethod ?? 'GET';
    if (context.requestPath) {
      return `${method}:${context.requestPath}`;
    }
    return `${method}:resource:${context.originNodeId}`;
  }

  handleRequestArrival(
    node: GraphNode,
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    const cacheKey = this.generateCacheKey(context);

    // Si c'est un retour de la DB après un cache miss
    if (context.waitingForDb && context.cacheNodeId === node.id) {
      // Stocker la réponse de la DB dans le cache
      this.manager.set(node.id, cacheKey, `db_response_${Date.now()}`);
      return { action: 'respond', isError: false };
    }

    // Vérifier le cache avec la clé
    const { hit, latency } = this.manager.get(node.id, cacheKey);

    if (hit) {
      // Cache HIT - la clé existe, répondre directement
      return {
        action: 'respond',
        isError: false,
        delay: latency
      };
    }

    // Cache MISS - la clé n'existe pas, aller chercher dans la DB
    if (outgoingEdges.length === 0) {
      // Pas de DB configurée, répondre en erreur
      return { action: 'respond', isError: true };
    }

    const dbEdge = outgoingEdges[0];

    return {
      action: 'cache-miss',
      dbTarget: {
        nodeId: dbEdge.target,
        edgeId: dbEdge.id,
      },
      cacheNodeId: node.id,
    };
  }

  /**
   * Retourne le délai pour l'opération SET (après cache miss)
   */
  getSetDelay(node: GraphNode, speed: number): number {
    const data = node.data as CacheNodeData;
    return data.performance.setLatencyMs / speed;
  }

  /**
   * Permet d'ajouter manuellement une entrée au cache (pour pré-chauffage)
   */
  warmUp(nodeId: string, key: string, value: string): void {
    this.manager.set(nodeId, key, value);
  }

  /**
   * Vérifie si une clé existe dans le cache
   */
  hasKey(nodeId: string, key: string): boolean {
    return this.manager.has(nodeId, key);
  }

  /**
   * Retourne le nombre d'entrées dans le cache
   */
  getCacheSize(nodeId: string): number {
    return this.manager.size(nodeId);
  }
}
