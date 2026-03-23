import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { HostServerNodeData, ResourceUtilization } from '@/types';
import { ResourceManager } from '../ResourceManager';

/**
 * État runtime d'un host server
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
 * Handler pour les nœuds Host Server.
 * Gère les ressources physiques partagées et le routage par port mapping vers les containers enfants.
 */
export class HostServerHandler implements NodeRequestHandler {
  readonly nodeType = 'host-server';

  private serverStates: Map<string, ServerState> = new Map();

  getProcessingDelay(_node: GraphNode, speed: number): number {
    // Petit overhead fixe pour le routage du host (~1ms)
    return 1 / speed;
  }

  initialize(node: GraphNode): void {
    this.serverStates.set(node.id, this.createInitialState());
  }

  cleanup(nodeId: string): void {
    this.serverStates.delete(nodeId);
  }

  handleRequestArrival(
    node: GraphNode,
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as HostServerNodeData;
    const state = this.getOrCreateState(node.id);

    // Mettre à jour le compteur de requêtes par seconde
    this.updateRequestsPerSecond(state);

    // Calculer l'utilisation actuelle des ressources du host
    const utilization = ResourceManager.calculateUtilization(
      data.resources,
      state.activeRequests,
      state.queuedRequests,
      state.requestsPerSecond
    );

    // Vérifier la capacité du host
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

    // Routage par port mapping
    if (data.portMappings.length > 0 && context.targetPort != null) {
      const mapping = data.portMappings.find((m) => m.hostPort === context.targetPort);
      if (mapping) {
        // Trouver l'edge sortant vers le container ciblé
        const targetEdge = outgoingEdges.find((e) => e.target === mapping.containerNodeId);
        if (targetEdge) {
          return {
            action: 'forward',
            targets: [{ nodeId: mapping.containerNodeId, edgeId: targetEdge.id }],
          };
        }
      }
    }

    // Fallback : si un seul port mapping et un seul outgoing edge vers un enfant, router automatiquement
    if (data.portMappings.length === 1 && outgoingEdges.length > 0) {
      const mapping = data.portMappings[0];
      const childNodes = allNodes.filter(
        (n) => (n as GraphNode & { parentId?: string }).parentId === node.id
      );
      const targetEdge = outgoingEdges.find(
        (e) => e.target === mapping.containerNodeId && childNodes.some((c) => c.id === e.target)
      );
      if (targetEdge) {
        return {
          action: 'forward',
          targets: [{ nodeId: mapping.containerNodeId, edgeId: targetEdge.id }],
        };
      }
    }

    // Fallback : forward vers tous les outgoing edges (fan-out)
    if (outgoingEdges.length > 0) {
      const targets = outgoingEdges.map((edge) => ({
        nodeId: edge.target,
        edgeId: edge.id,
      }));
      return { action: 'forward', targets };
    }

    // Pas d'edges sortants : répondre directement
    return { action: 'respond', isError: false };
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
   * Récupère l'utilisation actuelle du host server
   */
  getUtilization(nodeId: string, resources: HostServerNodeData['resources']): ResourceUtilization | null {
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
