import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { DNSNodeData } from '@/types';

export class DNSHandler implements NodeRequestHandler {
  readonly nodeType = 'dns';

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as DNSNodeData;
    return data.resolutionLatencyMs / speed;
  }

  handleRequestArrival(
    node: Node,
    _context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
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
