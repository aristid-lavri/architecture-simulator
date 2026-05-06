import type { GraphNode, GraphEdge } from '@/types/graph';

/** Edges sortantes d'un noeud (le noeud est `source`). */
export function outgoingEdges(edges: GraphEdge[], nodeId: string): GraphEdge[] {
  return edges.filter((e) => e.source === nodeId);
}

/** Edges entrantes vers un noeud (le noeud est `target`). */
export function incomingEdges(edges: GraphEdge[], nodeId: string): GraphEdge[] {
  return edges.filter((e) => e.target === nodeId);
}

/** Lookup d'un noeud par id, ou undefined si absent. */
export function getNodeById(nodes: GraphNode[], id: string): GraphNode | undefined {
  return nodes.find((n) => n.id === id);
}
