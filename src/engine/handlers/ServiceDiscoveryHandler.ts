import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { ServiceDiscoveryNodeData } from '@/types';

export class ServiceDiscoveryHandler implements NodeRequestHandler {
  readonly nodeType = 'service-discovery';

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as ServiceDiscoveryNodeData;
    return data.lookupLatencyMs / speed;
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

    // Service discovery resolves to a healthy service instance
    // If multiple targets, pick one (simulates health-based routing)
    if (outgoingEdges.length > 1) {
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
