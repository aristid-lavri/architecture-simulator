import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { CDNNodeData } from '@/types';

export class CDNHandler implements NodeRequestHandler {
  readonly nodeType = 'cdn';

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as CDNNodeData;
    return data.edgeLatencyMs / speed;
  }

  handleRequestArrival(
    node: Node,
    _context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    const data = node.data as CDNNodeData;

    // Simulate cache hit/miss based on ratio
    const isHit = Math.random() * 100 < data.cacheHitRatio;

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
