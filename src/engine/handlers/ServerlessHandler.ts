import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision, ResponseDecision } from './types';
import type { ServerlessNodeData } from '@/types';

interface AutoscalingState {
  activeInstances: number;
  lastInvocationTime: number;
}

/**
 * Handler générique pour les fonctions auto-scalées (serverless et cloud-function).
 * Gère le cold/warm start, le scaling entre minInstances et maxInstances,
 * et la limite de concurrence.
 */
export class ServerlessHandler implements NodeRequestHandler {
  readonly nodeType: string;

  private nodeStates: Map<string, AutoscalingState> = new Map();

  constructor(nodeType: string = 'serverless') {
    this.nodeType = nodeType;
  }

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as ServerlessNodeData;
    const state = this.getOrCreateState(node.id);

    // Cold start if no active instances or idle > 5 min
    const isColdStart = state.activeInstances === 0 ||
      (Date.now() - state.lastInvocationTime > 300000);

    const latency = isColdStart ? data.coldStartMs : data.warmStartMs;
    return latency / speed;
  }

  initialize(node: GraphNode): void {
    const data = node.data as ServerlessNodeData;
    this.nodeStates.set(node.id, {
      activeInstances: data.minInstances,
      lastInvocationTime: 0,
    });
  }

  cleanup(nodeId: string): void {
    this.nodeStates.delete(nodeId);
  }

  handleRequestArrival(
    node: GraphNode,
    _context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as ServerlessNodeData;
    const state = this.getOrCreateState(node.id);

    // Check concurrency limit
    if (state.activeInstances >= data.concurrencyLimit) {
      return { action: 'reject', reason: 'capacity' };
    }

    // Scale up
    state.activeInstances = Math.min(state.activeInstances + 1, data.maxInstances);
    state.lastInvocationTime = Date.now();

    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    const edge = outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id }],
    };
  }

  handleResponsePassthrough(
    node: GraphNode,
    _context: RequestContext,
    isError: boolean
  ): ResponseDecision {
    const data = node.data as ServerlessNodeData;
    const state = this.nodeStates.get(node.id);
    if (state && state.activeInstances > data.minInstances) {
      state.activeInstances--;
    }
    return { action: 'passthrough', isError };
  }

  private getOrCreateState(nodeId: string): AutoscalingState {
    let state = this.nodeStates.get(nodeId);
    if (!state) {
      state = { activeInstances: 0, lastInvocationTime: 0 };
      this.nodeStates.set(nodeId, state);
    }
    return state;
  }
}
