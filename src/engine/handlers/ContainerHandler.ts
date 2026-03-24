import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { ContainerNodeData } from '@/types';

export class ContainerHandler implements NodeRequestHandler {
  readonly nodeType = 'container';

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as ContainerNodeData;
    return data.responseDelayMs / speed;
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

    // Trouver les edges qui pointent vers des enfants directs (parentId === container id)
    const childEdges = outgoingEdges.filter((edge) => {
      const targetNode = allNodes.find((n) => n.id === edge.target);
      return targetNode && (targetNode as GraphNode & { parentId?: string }).parentId === node.id;
    });

    // Si des enfants existent, router vers un enfant (round-robin simplifié via index)
    const routingEdges = childEdges.length > 0 ? childEdges : outgoingEdges;

    if (routingEdges.length === 1) {
      const edge = routingEdges[0];
      return {
        action: 'forward',
        targets: [{ nodeId: edge.target, edgeId: edge.id }],
      };
    }

    // Plusieurs enfants : sélection aléatoire (simule un routage interne)
    const selected = routingEdges[Math.floor(Math.random() * routingEdges.length)];
    return {
      action: 'forward',
      targets: [{ nodeId: selected.target, edgeId: selected.id }],
    };
  }
}
