import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { FirewallNodeData } from '@/types';

export class FirewallHandler implements NodeRequestHandler {
  readonly nodeType = 'firewall';

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as FirewallNodeData;
    return data.inspectionLatencyMs / speed;
  }

  handleRequestArrival(
    node: Node,
    _context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    const data = node.data as FirewallNodeData;

    // Simulate firewall rules: deny if default is deny and no explicit allow
    if (data.defaultAction === 'deny') {
      // Small chance the request is allowed (simulating port matching)
      const allowed = data.allowedPorts.length > 0;
      if (!allowed) {
        return { action: 'reject', reason: 'rate-limit' };
      }
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
