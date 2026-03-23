import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { CloudFunctionNodeData } from '@/types';

interface FunctionState {
  activeInstances: number;
  lastInvocationTime: number;
}

export class CloudFunctionHandler implements NodeRequestHandler {
  readonly nodeType = 'cloud-function';

  private nodeStates: Map<string, FunctionState> = new Map();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as CloudFunctionNodeData;
    const state = this.getOrCreateState(node.id);

    const isColdStart = state.activeInstances === 0 ||
      (Date.now() - state.lastInvocationTime > 300000);

    const latency = isColdStart ? data.coldStartMs : data.warmStartMs;
    return latency / speed;
  }

  initialize(node: GraphNode): void {
    const data = node.data as CloudFunctionNodeData;
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
    const data = node.data as CloudFunctionNodeData;
    const state = this.getOrCreateState(node.id);

    if (state.activeInstances >= data.concurrencyLimit) {
      return { action: 'reject', reason: 'capacity' };
    }

    state.activeInstances = Math.min(state.activeInstances + 1, data.maxInstances);
    state.lastInvocationTime = Date.now();

    setTimeout(() => {
      const s = this.nodeStates.get(node.id);
      if (s && s.activeInstances > data.minInstances) {
        s.activeInstances--;
      }
    }, 5000);

    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    const edge = outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id }],
    };
  }

  private getOrCreateState(nodeId: string): FunctionState {
    let state = this.nodeStates.get(nodeId);
    if (!state) {
      state = { activeInstances: 0, lastInvocationTime: 0 };
      this.nodeStates.set(nodeId, state);
    }
    return state;
  }
}
