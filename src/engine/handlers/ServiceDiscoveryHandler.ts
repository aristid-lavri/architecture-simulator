import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { ServiceDiscoveryNodeData } from '@/types';
import { ThroughputLimiter } from '../ThroughputLimiter';

export class ServiceDiscoveryHandler implements NodeRequestHandler {
  readonly nodeType = 'service-discovery';

  private throughputLimiter = new ThroughputLimiter();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as ServiceDiscoveryNodeData;
    return data.lookupLatencyMs / speed;
  }

  cleanup(nodeId: string): void {
    this.throughputLimiter.cleanup(nodeId);
  }

  handleRequestArrival(
    node: GraphNode,
    _context: RequestContext,
    outgoingEdges: GraphEdge[],
    allNodes: GraphNode[]
  ): RequestDecision {
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    const data = node.data as ServiceDiscoveryNodeData;

    // Rate limiting
    const maxRps = data.maxRequestsPerSecond ?? 5000;
    if (!this.throughputLimiter.tryAcquire(node.id, maxRps)) {
      return { action: 'reject', reason: 'rate-limit' };
    }

    // Filtrer les instances saines (exclure down/error)
    const healthyEdges = this.filterHealthyEdges(outgoingEdges, allNodes);
    if (healthyEdges.length === 0) {
      return { action: 'reject', reason: 'capacity' };
    }

    // Sélection aléatoire parmi les instances saines
    if (healthyEdges.length > 1) {
      const selected = healthyEdges[Math.floor(Math.random() * healthyEdges.length)];
      return {
        action: 'forward',
        targets: [{ nodeId: selected.target, edgeId: selected.id }],
      };
    }

    const edge = healthyEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id }],
    };
  }

  private filterHealthyEdges(edges: GraphEdge[], allNodes: GraphNode[]): GraphEdge[] {
    const healthy = edges.filter((edge) => {
      const targetNode = allNodes.find((n) => n.id === edge.target);
      if (!targetNode) return true;
      const status = (targetNode.data as Record<string, unknown>).status as string | undefined;
      return status !== 'down' && status !== 'error';
    });
    return healthy.length > 0 ? healthy : edges;
  }
}
