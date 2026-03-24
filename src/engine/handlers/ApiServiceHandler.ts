import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision, ResponseDecision } from './types';
import type { ApiServiceNodeData, ResourceUtilization } from '@/types';
import { ResourceManager } from '../ResourceManager';

/**
 * Etat runtime d'un API Service
 */
interface ServiceState {
  activeRequests: number;
  queuedRequests: number;
  totalRequests: number;
  requestsPerSecond: number;
  lastSecondRequests: number;
  lastSecondTimestamp: number;
}

/**
 * Handler pour les noeuds API Service.
 * Utilise ResourceManager pour la dégradation de latence si `resources` est configuré,
 * sinon fallback sur la formule quadratique simplifiée.
 */
export class ApiServiceHandler implements NodeRequestHandler {
  readonly nodeType = 'api-service';

  private serviceStates: Map<string, ServiceState> = new Map();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as ApiServiceNodeData;
    const state = this.getOrCreateState(node.id);

    // Si ResourceManager est configuré, utiliser la dégradation standard
    if (data.resources && data.degradation) {
      const utilization = ResourceManager.calculateUtilization(
        data.resources,
        state.activeRequests,
        state.queuedRequests,
        state.requestsPerSecond
      );
      return ResourceManager.calculateDegradedLatency(
        data.responseTime,
        utilization,
        data.degradation
      ) / speed;
    }

    // Fallback : formule quadratique simplifiée
    const loadFactor = data.maxConcurrentRequests > 0
      ? state.activeRequests / data.maxConcurrentRequests
      : 0;
    const degradedLatency = data.responseTime * (1 + loadFactor * loadFactor * 3);
    return degradedLatency / speed;
  }

  initialize(node: GraphNode): void {
    this.serviceStates.set(node.id, this.createInitialState());
  }

  cleanup(nodeId: string): void {
    this.serviceStates.delete(nodeId);
  }

  handleRequestArrival(
    node: GraphNode,
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as ApiServiceNodeData;
    const state = this.getOrCreateState(node.id);

    // Vérifier l'authentification si activée
    const authType = data.authType ?? 'none';
    if (authType !== 'none') {
      if (!context.authToken) {
        return { action: 'reject', reason: 'no-token' };
      }
      if (context.authToken.expiresAt < Date.now()) {
        return { action: 'reject', reason: 'token-expired' };
      }
      const authFailureRate = data.authFailureRate ?? 0;
      if (authFailureRate > 0 && Math.random() * 100 < authFailureRate) {
        return { action: 'reject', reason: 'auth-failure' };
      }
    }

    // Mettre à jour le compteur de requêtes par seconde
    this.updateRequestsPerSecond(state);

    // Vérifier la capacité via ResourceManager si configuré
    if (data.resources) {
      const utilization = ResourceManager.calculateUtilization(
        data.resources,
        state.activeRequests,
        state.queuedRequests,
        state.requestsPerSecond
      );
      const acceptStatus = ResourceManager.canAcceptRequest(data.resources, utilization);

      if (acceptStatus === 'reject') {
        return { action: 'reject', reason: 'capacity' };
      }
      if (acceptStatus === 'queue') {
        state.queuedRequests++;
        return { action: 'queue' };
      }
    } else {
      // Fallback : limite simple par maxConcurrentRequests
      if (state.activeRequests >= data.maxConcurrentRequests) {
        return { action: 'reject', reason: 'capacity' };
      }
    }

    // Accepter la requete
    state.activeRequests++;
    state.totalRequests++;
    state.lastSecondRequests++;

    // Simuler le taux d'erreur avec degradation sous charge
    const loadFactor = data.maxConcurrentRequests > 0
      ? state.activeRequests / data.maxConcurrentRequests
      : 0;
    const dynamicErrorRate = data.errorRate + (loadFactor > 0.8 ? (loadFactor - 0.8) * 50 : 0);
    const isError = Math.random() * 100 < dynamicErrorRate;

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

  handleResponsePassthrough(
    node: GraphNode,
    _context: RequestContext,
    isError: boolean
  ): ResponseDecision {
    this.recordRequestCompleted(node.id);
    return { action: 'passthrough', isError };
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

  /**
   * Appelé quand une requête en file d'attente est traitée
   */
  processQueuedRequest(nodeId: string): boolean {
    const state = this.serviceStates.get(nodeId);
    if (state && state.queuedRequests > 0) {
      state.queuedRequests--;
      state.activeRequests++;
      return true;
    }
    return false;
  }

  /**
   * Récupère l'utilisation actuelle du service
   */
  getUtilization(nodeId: string, resources: ApiServiceNodeData['resources']): ResourceUtilization | null {
    const state = this.serviceStates.get(nodeId);
    if (!state || !resources) return null;

    return ResourceManager.calculateUtilization(
      resources,
      state.activeRequests,
      state.queuedRequests,
      state.requestsPerSecond
    );
  }

  private getOrCreateState(nodeId: string): ServiceState {
    let state = this.serviceStates.get(nodeId);
    if (!state) {
      state = this.createInitialState();
      this.serviceStates.set(nodeId, state);
    }
    return state;
  }

  private createInitialState(): ServiceState {
    return {
      activeRequests: 0,
      queuedRequests: 0,
      totalRequests: 0,
      requestsPerSecond: 0,
      lastSecondRequests: 0,
      lastSecondTimestamp: Date.now(),
    };
  }

  private updateRequestsPerSecond(state: ServiceState): void {
    const now = Date.now();
    const elapsed = now - state.lastSecondTimestamp;

    if (elapsed >= 1000) {
      state.requestsPerSecond = state.lastSecondRequests * (1000 / elapsed);
      state.lastSecondRequests = 0;
      state.lastSecondTimestamp = now;
    }
  }
}
