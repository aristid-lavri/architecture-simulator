import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { FirewallNodeData } from '@/types';

export class FirewallHandler implements NodeRequestHandler {
  readonly nodeType = 'firewall';

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as FirewallNodeData;
    return data.inspectionLatencyMs / speed;
  }

  handleRequestArrival(
    node: GraphNode,
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as FirewallNodeData;
    const requestPort = context.targetPort;

    // Check IP filtering if blockedIPs is configured
    if (context.sourceIP && data.blockedIPs.length > 0) {
      if (data.blockedIPs.includes(context.sourceIP)) {
        return { action: 'reject', reason: 'firewall-blocked' };
      }
    }

    if (data.defaultAction === 'deny') {
      // Default deny: only allow if request port is explicitly in allowedPorts
      if (requestPort == null || !data.allowedPorts.includes(requestPort)) {
        return { action: 'reject', reason: 'firewall-blocked' };
      }
    } else {
      // Default allow: block only if a port is specified and not in allowedPorts
      if (requestPort != null && data.allowedPorts.length > 0 && !data.allowedPorts.includes(requestPort)) {
        return { action: 'reject', reason: 'firewall-blocked' };
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
