import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { ContainerNodeData } from '@/types';

export class ContainerHandler implements NodeRequestHandler {
  readonly nodeType = 'container';

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as ContainerNodeData;
    return data.responseDelayMs / speed;
  }

  handleRequestArrival(
    node: Node,
    _context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    // If multiple outgoing edges, load balance across replicas
    if (outgoingEdges.length > 1) {
      const targets = outgoingEdges.map((edge) => ({
        nodeId: edge.target,
        edgeId: edge.id,
      }));
      const selected = targets[Math.floor(Math.random() * targets.length)];
      return { action: 'forward', targets: [selected] };
    }

    const edge = outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id }],
    };
  }
}
