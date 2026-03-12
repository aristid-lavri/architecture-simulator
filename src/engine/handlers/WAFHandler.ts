import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { WAFNodeData } from '@/types';

export class WAFHandler implements NodeRequestHandler {
  readonly nodeType = 'waf';

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as WAFNodeData;
    return data.inspectionLatencyMs / speed;
  }

  handleRequestArrival(
    node: Node,
    _context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    const data = node.data as WAFNodeData;

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
