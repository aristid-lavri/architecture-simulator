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
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as WAFNodeData;

    // Rate limiting (WAF already had requestsPerSecond field)
    const maxRps = data.requestsPerSecond ?? 5000;
    if (!this.throughputLimiter.tryAcquire(node.id, maxRps)) {
      return { action: 'reject', reason: 'rate-limit' };
    }

    // Simulate blocking based on block rate
    const rng = context.rng ?? Math.random;
    const isBlocked = rng() * 100 < data.blockRate;

    if (isBlocked) {
      return { action: 'reject', reason: 'waf-blocked' };
    }

    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    // Pour les requêtes d'auth (Task 22), préférer un edge menant vers une infra d'auth
    const edge = pickAuthAwareEdge(context, outgoingEdges, allNodes) ?? outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id }],
    };
  }
}

/**
 * Pour une requête d'acquisition de token (isAuthRequest), préfère un edge
 * menant vers un identity-provider (1 hop) ou via une infrastructure passthrough.
 * Retourne null si aucune préférence (caller utilise le défaut outgoingEdges[0]).
 */
function pickAuthAwareEdge(
  context: RequestContext,
  outgoingEdges: GraphEdge[],
  allNodes: GraphNode[]
): GraphEdge | null {
  if (context.isAuthRequest !== true) return null;
  // 1. Préférer un edge direct vers un IdP
  for (const edge of outgoingEdges) {
    const target = allNodes.find((n) => n.id === edge.target);
    if (target?.type === 'identity-provider') return edge;
  }
  // 2. Fallback : edge vers un noeud passthrough (qui peut éventuellement mener à un IdP)
  const PASSTHROUGH = new Set(['waf', 'cdn', 'api-gateway', 'load-balancer', 'firewall', 'dns']);
  for (const edge of outgoingEdges) {
    const target = allNodes.find((n) => n.id === edge.target);
    if (target && PASSTHROUGH.has(target.type)) return edge;
  }
  return null;
}
