import type { GraphNode, GraphEdge } from '@/types/graph';
import type { DraftEdge } from '@/plugins/extensions/edge-creation';

export interface RuleContext {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Present iff rule scope === 'edge'. The edge being created/re-evaluated. */
  draftEdge?: DraftEdge;
  /** Precomputed map { nodeId → node } for O(1) lookup — built once per evaluation pass. */
  nodeMap: Map<string, GraphNode>;
}

export function buildContext(
  nodes: GraphNode[],
  edges: GraphEdge[],
  draftEdge?: DraftEdge,
): RuleContext {
  const nodeMap = new Map<string, GraphNode>();
  for (const node of nodes) nodeMap.set(node.id, node);
  return { nodes, edges, draftEdge, nodeMap };
}
