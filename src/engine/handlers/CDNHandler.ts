import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { CDNNodeData } from '@/types';

export class CDNHandler implements NodeRequestHandler {
  readonly nodeType = 'cdn';

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as CDNNodeData;
    return data.edgeLatencyMs / speed;
  }

  handleRequestArrival(
    node: GraphNode,
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as CDNNodeData;

    // Adjust cache hit ratio based on content type
    let effectiveHitRatio = data.cacheHitRatio;
    if (context.contentType === 'static') {
      // Static content has higher cache hit ratio (up to 99%)
      effectiveHitRatio = Math.min(99, data.cacheHitRatio * 1.3);
    } else if (context.contentType === 'user-specific') {
      // User-specific content is rarely cached
      effectiveHitRatio = data.cacheHitRatio * 0.3;
    }
    // 'dynamic' uses the base ratio as-is

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
