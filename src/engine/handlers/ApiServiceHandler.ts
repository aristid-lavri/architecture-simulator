import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { ApiServiceNodeData } from '@/types';

/**
 * Etat runtime d'un API Service
 */
interface ServiceState {
  activeRequests: number;
  totalRequests: number;
}

/**
 * Handler pour les noeuds API Service.
 * Similaire a HttpServerHandler mais SANS gestion de ressources propres.
 * Utilise responseTime du node data comme delay, gere errorRate,
 * et forward vers edges sortants ou repond directement.
 */
export class ApiServiceHandler implements NodeRequestHandler {
  readonly nodeType = 'api-service';

  private serviceStates: Map<string, ServiceState> = new Map();

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as ApiServiceNodeData;
    return data.responseTime / speed;
  }

  initialize(node: Node): void {
    this.serviceStates.set(node.id, {
      activeRequests: 0,
      totalRequests: 0,
    });
  }

  cleanup(nodeId: string): void {
    this.serviceStates.delete(nodeId);
  }

  handleRequestArrival(
    node: Node,
    _context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    const data = node.data as ApiServiceNodeData;
    const state = this.getOrCreateState(node.id);

    // Verifier la limite de requetes concurrentes
    if (state.activeRequests >= data.maxConcurrentRequests) {
      return { action: 'reject', reason: 'capacity' };
    }

    // Accepter la requete
    state.activeRequests++;
    state.totalRequests++;

    // Simuler le taux d'erreur
    const isError = Math.random() * 100 < data.errorRate;

    // Si erreur ou pas d'edges sortants, repondre directement
    if (isError || outgoingEdges.length === 0) {
      return { action: 'respond', isError };
    }

    // Forward vers tous les edges sortants
    const targets = outgoingEdges.map((edge) => ({
      nodeId: edge.target,
      edgeId: edge.id,
    }));

    return {
      action: 'forward',
      targets,
    };
  }

  /**
   * Appele quand une requete termine son traitement
   */
  recordRequestCompleted(nodeId: string): void {
    const state = this.serviceStates.get(nodeId);
    if (state && state.activeRequests > 0) {
      state.activeRequests--;
    }
  }

  private getOrCreateState(nodeId: string): ServiceState {
    let state = this.serviceStates.get(nodeId);
    if (!state) {
      state = { activeRequests: 0, totalRequests: 0 };
      this.serviceStates.set(nodeId, state);
    }
    return state;
  }
}
