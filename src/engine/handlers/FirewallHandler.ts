import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { FirewallNodeData } from '@/types';
import { ThroughputLimiter } from '../ThroughputLimiter';

export class FirewallHandler implements NodeRequestHandler {
  readonly nodeType = 'firewall';

  private throughputLimiter = new ThroughputLimiter();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as FirewallNodeData;
    return data.inspectionLatencyMs / speed;
  }

  cleanup(nodeId: string): void {
    this.throughputLimiter.cleanup(nodeId);
  }

  handleRequestArrival(
    node: GraphNode,
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as FirewallNodeData;

    // Rate limiting
    const maxRps = data.maxRequestsPerSecond ?? 5000;
    if (!this.throughputLimiter.tryAcquire(node.id, maxRps)) {
      return { action: 'reject', reason: 'rate-limit' };
    }

    const requestPort = context.targetPort;

    // Check IP filtering if blockedIPs is configured
    if (context.sourceIP && data.blockedIPs.length > 0) {
      if (data.blockedIPs.includes(context.sourceIP)) {
        return { action: 'reject', reason: 'firewall-blocked' };
      }
    }

    if (data.defaultAction === 'deny') {
      if (requestPort == null || !data.allowedPorts.includes(requestPort)) {
        return { action: 'reject', reason: 'firewall-blocked' };
      }
    } else {
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
