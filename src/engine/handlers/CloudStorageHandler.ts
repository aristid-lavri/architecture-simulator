import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { CloudStorageNodeData } from '@/types';
import { ThroughputLimiter } from '../ThroughputLimiter';

export class CloudStorageHandler implements NodeRequestHandler {
  readonly nodeType = 'cloud-storage';

  private throughputLimiter = new ThroughputLimiter();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as CloudStorageNodeData;
    return data.readLatencyMs / speed;
  }

  initialize(_node: GraphNode): void {
    // no-op
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
    const data = node.data as CloudStorageNodeData;
    const method = context.httpMethod || 'GET';

    // Rate limiting via ThroughputLimiter
    if (!this.throughputLimiter.tryAcquire(node.id, data.maxRequestsPerSecond)) {
      return { action: 'reject', reason: 'rate-limit' };
    }

    // Differentiate latency based on HTTP method
    const delay = (method === 'POST' || method === 'PUT')
      ? data.writeLatencyMs
      : method === 'DELETE'
        ? data.writeLatencyMs * 0.5
        : data.readLatencyMs;

    // Storage is typically a terminal node (no outgoing)
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false, delay };
    }

    const edge = outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id, delay }],
    };
  }
}
