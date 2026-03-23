import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { DNSNodeData } from '@/types';

export class DNSHandler implements NodeRequestHandler {
  readonly nodeType = 'dns';

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as DNSNodeData;
    return data.resolutionLatencyMs / speed;
  }

  handleRequestArrival(
    node: GraphNode,
    _context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    const data = node.data as DNSNodeData;

    // Failover: if first target is "down", try next
    if (data.failoverEnabled && outgoingEdges.length > 1) {
      const selected = outgoingEdges[Math.floor(Math.random() * outgoingEdges.length)];
      return {
        action: 'forward',
        targets: [{ nodeId: selected.target, edgeId: selected.id }],
      };
    }

    const edge = outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id }],
    };
  }
}
