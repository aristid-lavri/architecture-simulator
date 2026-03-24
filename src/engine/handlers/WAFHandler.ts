import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { WAFNodeData } from '@/types';
import { ThroughputLimiter } from '../ThroughputLimiter';

export class WAFHandler implements NodeRequestHandler {
  readonly nodeType = 'waf';

  private throughputLimiter = new ThroughputLimiter();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as WAFNodeData;
    return data.inspectionLatencyMs / speed;
  }

  cleanup(nodeId: string): void {
    this.throughputLimiter.cleanup(nodeId);
  }

  handleRequestArrival(
    node: GraphNode,
    _context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as WAFNodeData;

    // Rate limiting (WAF already had requestsPerSecond field)
    const maxRps = data.requestsPerSecond ?? 5000;
    if (!this.throughputLimiter.tryAcquire(node.id, maxRps)) {
      return { action: 'reject', reason: 'rate-limit' };
    }

    // Simulate blocking based on block rate
    const isBlocked = Math.random() * 100 < data.blockRate;

    if (isBlocked) {
      return { action: 'reject', reason: 'waf-blocked' };
    }

    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    const edge = outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id }],
    };
  }
}
