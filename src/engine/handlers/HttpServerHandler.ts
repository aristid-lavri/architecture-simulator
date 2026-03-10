import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { HttpServerNodeData, ResourceUtilization } from '@/types';
import { complexityMultipliers } from '@/types';
import { ResourceManager } from '../ResourceManager';

/**
 * État runtime d'un serveur HTTP
 */
interface ServerState {
  activeRequests: number;
  queuedRequests: number;
  totalRequests: number;
  requestsPerSecond: number;
  lastSecondRequests: number;
  lastSecondTimestamp: number;
}

/**
 * Handler pour les nœuds HTTP Server.
 * Gère la dégradation des performances basée sur l'utilisation des ressources.
 */
export class HttpServerHandler implements NodeRequestHandler {
  readonly nodeType = 'http-server';

  private serverStates: Map<string, ServerState> = new Map();

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as HttpServerNodeData;
    const state = this.getOrCreateState(node.id);

    // Calculer l'utilisation actuelle
    const utilization = ResourceManager.calculateUtilization(
      data.resources,
      state.activeRequests,
      state.queuedRequests,
      state.requestsPerSecond
    );

    // Appliquer la dégradation de latence
    const degradedDelay = ResourceManager.calculateDegradedLatency(
      data.responseDelay,
      utilization,
      data.degradation
    );

    // Appliquer le multiplicateur de complexité du code
    const complexityFactor = data.processingComplexity
      ? complexityMultipliers[data.processingComplexity]
      : 1.0;

    return (degradedDelay * complexityFactor) / speed;
  }

  initialize(node: Node): void {
    this.serverStates.set(node.id, this.createInitialState());
  }

  cleanup(nodeId: string): void {
    this.serverStates.delete(nodeId);
  }

  handleRequestArrival(
    node: Node,
    _context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    const data = node.data as HttpServerNodeData;
    const state = this.getOrCreateState(node.id);

    // Mettre à jour le compteur de requêtes par seconde
    this.updateRequestsPerSecond(state);

    // Calculer l'utilisation actuelle
    const utilization = ResourceManager.calculateUtilization(
      data.resources,
      state.activeRequests,
      state.queuedRequests,
      state.requestsPerSecond
    );

    // Vérifier si on peut accepter la requête
    const acceptStatus = ResourceManager.canAcceptRequest(data.resources, utilization);

    if (acceptStatus === 'reject') {
      return { action: 'reject', reason: 'capacity' };
    }

    if (acceptStatus === 'queue') {
      state.queuedRequests++;
      return { action: 'queue' };
    }

    // Accepter la requête
    state.activeRequests++;
    state.totalRequests++;
    state.lastSecondRequests++;

    // Simuler le taux d'erreur
    const isError = Math.random() * 100 < data.errorRate;

    // Si pas d'edges sortants ou erreur, répondre directement
    if (outgoingEdges.length === 0 || isError) {
      return { action: 'respond', isError };
    }

    // Forward vers TOUS les edges sortants (pour supporter event-driven / fan-out)
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
   * Appelé quand une requête termine son traitement
   */
  recordRequestCompleted(nodeId: string): void {
    const state = this.serverStates.get(nodeId);
    if (state && state.activeRequests > 0) {
      state.activeRequests--;
    }
  }

  /**
   * Appelé quand une requête en file d'attente est traitée
   */
  processQueuedRequest(nodeId: string): boolean {
    const state = this.serverStates.get(nodeId);
    if (state && state.queuedRequests > 0) {
      state.queuedRequests--;
      state.activeRequests++;
      return true;
    }
    return false;
  }

  /**
   * Récupère l'utilisation actuelle d'un serveur
   */
  getUtilization(nodeId: string, resources: HttpServerNodeData['resources']): ResourceUtilization | null {
    const state = this.serverStates.get(nodeId);
    if (!state) return null;

    return ResourceManager.calculateUtilization(
      resources,
      state.activeRequests,
      state.queuedRequests,
      state.requestsPerSecond
    );
  }

  private getOrCreateState(nodeId: string): ServerState {
    let state = this.serverStates.get(nodeId);
    if (!state) {
      state = this.createInitialState();
      this.serverStates.set(nodeId, state);
    }
    return state;
  }

  private createInitialState(): ServerState {
    return {
      activeRequests: 0,
      queuedRequests: 0,
      totalRequests: 0,
      requestsPerSecond: 0,
      lastSecondRequests: 0,
      lastSecondTimestamp: Date.now(),
    };
  }

  private updateRequestsPerSecond(state: ServerState): void {
    const now = Date.now();
    const elapsed = now - state.lastSecondTimestamp;

    if (elapsed >= 1000) {
      state.requestsPerSecond = state.lastSecondRequests * (1000 / elapsed);
      state.lastSecondRequests = 0;
      state.lastSecondTimestamp = now;
    }
  }
}
