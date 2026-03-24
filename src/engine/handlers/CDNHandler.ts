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
    _allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as CDNNodeData;

    // Rate limiting
    const maxRps = data.maxRequestsPerSecond ?? 10000;
    if (!this.throughputLimiter.tryAcquire(node.id, maxRps)) {
      return { action: 'reject', reason: 'rate-limit' };
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
