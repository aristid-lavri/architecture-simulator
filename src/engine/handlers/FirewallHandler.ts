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
    context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    const data = node.data as FirewallNodeData;
    const requestPort = context.targetPort;

    if (data.defaultAction === 'deny') {
      // Default deny: only allow if request port is explicitly in allowedPorts
      if (requestPort == null || !data.allowedPorts.includes(requestPort)) {
        return { action: 'reject', reason: 'blocked' };
      }
    } else {
      // Default allow: block only if a port is specified and not in allowedPorts
      if (requestPort != null && data.allowedPorts.length > 0 && !data.allowedPorts.includes(requestPort)) {
        return { action: 'reject', reason: 'blocked' };
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
