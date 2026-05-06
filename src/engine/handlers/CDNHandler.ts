import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { CDNNodeData } from '@/types';
import { ThroughputLimiter } from '../ThroughputLimiter';

export class CDNHandler implements NodeRequestHandler {
  readonly nodeType = 'cdn';

  private throughputLimiter = new ThroughputLimiter();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as CDNNodeData;
    return data.edgeLatencyMs / speed;
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
    const data = node.data as CDNNodeData;

    // Rate limiting
    const maxRps = data.maxRequestsPerSecond ?? 10000;
    if (!this.throughputLimiter.tryAcquire(node.id, maxRps)) {
      return { action: 'reject', reason: 'rate-limit' };
    }

    // Bypass cache pour les requêtes d'auth (Task 22)
    if (context.isAuthRequest === true) {
      if (outgoingEdges.length === 0) {
        return { action: 'respond', isError: true };
      }
      const edge = pickAuthAwareEdge(context, outgoingEdges, allNodes) ?? outgoingEdges[0];
      return {
        action: 'forward',
        targets: [{ nodeId: edge.target, edgeId: edge.id, delay: data.originLatencyMs }],
      };
    }

    // Adjust cache hit ratio based on content type
    let effectiveHitRatio = data.cacheHitRatio;
    if (context.contentType === 'static') {
      effectiveHitRatio = Math.min(99, data.cacheHitRatio * 1.3);
    } else if (context.contentType === 'user-specific') {
      effectiveHitRatio = data.cacheHitRatio * 0.3;
    }

    // Simulate cache hit/miss based on adjusted ratio
    const isHit = Math.random() * 100 < effectiveHitRatio;

    if (isHit) {
      return {
        action: 'respond',
        isError: false,
        delay: data.edgeLatencyMs,
      };
    }

    // Cache miss → forward to origin
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: true };
    }

    const edge = outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id, delay: data.originLatencyMs }],
    };
  }
}

/**
 * Pour une requête d'acquisition de token (isAuthRequest), préfère un edge
 * menant vers un identity-provider (1 hop) ou via une infrastructure passthrough.
 */
function pickAuthAwareEdge(
  context: RequestContext,
  outgoingEdges: GraphEdge[],
  allNodes: GraphNode[]
): GraphEdge | null {
  if (context.isAuthRequest !== true) return null;
  for (const edge of outgoingEdges) {
    const target = allNodes.find((n) => n.id === edge.target);
    if (target?.type === 'identity-provider') return edge;
  }
  const PASSTHROUGH = new Set(['waf', 'cdn', 'api-gateway', 'load-balancer', 'firewall', 'dns']);
  for (const edge of outgoingEdges) {
    const target = allNodes.find((n) => n.id === edge.target);
    if (target && PASSTHROUGH.has(target.type)) return edge;
  }
  return null;
}
