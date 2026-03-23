import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';

/**
 * Handler par défaut pour les types de nœuds non reconnus.
 * Comportement: forward vers le premier edge sortant, ou respond si aucun edge.
 */
export class DefaultHandler implements NodeRequestHandler {
  readonly nodeType = 'default';

  private readonly baseDelay = 50;

  getProcessingDelay(_node: GraphNode, speed: number): number {
    return this.baseDelay / speed;
  }

  handleRequestArrival(
    _node: GraphNode,
    _context: RequestContext,
    outgoingEdges: GraphEdge[],
    allNodes: GraphNode[]
  ): RequestDecision {
    // Si pas d'edges sortants, on répond
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    // Forward vers le premier edge sortant
    const edge = outgoingEdges[0];
    const targetNode = allNodes.find((n) => n.id === edge.target);

    if (!targetNode) {
      return { action: 'respond', isError: true };
    }

    return {
      action: 'forward',
      targets: [
        {
          nodeId: edge.target,
          edgeId: edge.id,
        },
      ],
    };
  }
}
