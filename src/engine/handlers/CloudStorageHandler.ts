import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { CloudStorageNodeData } from '@/types';

export class CloudStorageHandler implements NodeRequestHandler {
  readonly nodeType = 'cloud-storage';

  private requestCounts: Map<string, number> = new Map();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as CloudStorageNodeData;
    return data.readLatencyMs / speed;
  }

  initialize(_node: GraphNode): void {
    // no-op
  }

  cleanup(nodeId: string): void {
    this.requestCounts.delete(nodeId);
  }

  handleRequestArrival(
    node: GraphNode,
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as CloudStorageNodeData;
    const method = context.httpMethod || 'GET';

    // Rate limiting
    const count = this.requestCounts.get(node.id) || 0;
    if (count >= data.maxRequestsPerSecond) {
      return { action: 'reject', reason: 'rate-limit' };
    }
    this.requestCounts.set(node.id, count + 1);

    // Reset counter every second
    if (count === 0) {
      setTimeout(() => this.requestCounts.set(node.id, 0), 1000);
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
