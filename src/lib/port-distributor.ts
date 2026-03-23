import type { GraphEdge, GraphNode } from '@/types/graph';

type HandleSide = 'top' | 'right' | 'bottom' | 'left';

interface PortAssignment {
  edgeId: string;
  handleId: string;
  /** Offset percentage along the side (0-100) */
  offset: number;
}

interface NodePortMap {
  /** Per-side port assignments for this node */
  source: Partial<Record<HandleSide, PortAssignment[]>>;
  target: Partial<Record<HandleSide, PortAssignment[]>>;
}

/**
 * For each node, distribute edges across handles on each side.
 * Edges are sorted by the Y (for left/right sides) or X (for top/bottom sides)
 * position of the connected node to minimize crossings.
 */
export function distributeHandles(
  edges: GraphEdge[],
  nodes: GraphNode[]
): Map<string, NodePortMap> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const result = new Map<string, NodePortMap>();

  // Group edges by node and side
  const nodeEdges = new Map<string, {
    source: Map<HandleSide, Array<{ edgeId: string; connectedNodeId: string }>>;
    target: Map<HandleSide, Array<{ edgeId: string; connectedNodeId: string }>>;
  }>();

  for (const edge of edges) {
    const sourceSide = parseHandleSide(edge.sourceHandle, 'right');
    const targetSide = parseHandleSide(edge.targetHandle, 'left');

    // Source node side
    if (!nodeEdges.has(edge.source)) {
      nodeEdges.set(edge.source, { source: new Map(), target: new Map() });
    }
    const sourceEntry = nodeEdges.get(edge.source)!;
    if (!sourceEntry.source.has(sourceSide)) sourceEntry.source.set(sourceSide, []);
    sourceEntry.source.get(sourceSide)!.push({ edgeId: edge.id, connectedNodeId: edge.target });

    // Target node side
    if (!nodeEdges.has(edge.target)) {
      nodeEdges.set(edge.target, { source: new Map(), target: new Map() });
    }
    const targetEntry = nodeEdges.get(edge.target)!;
    if (!targetEntry.target.has(targetSide)) targetEntry.target.set(targetSide, []);
    targetEntry.target.get(targetSide)!.push({ edgeId: edge.id, connectedNodeId: edge.source });
  }

  // For each node, sort edges on each side and assign offsets
  for (const [nodeId, entry] of nodeEdges) {
    const portMap: NodePortMap = { source: {}, target: {} };

    for (const [side, edgeList] of entry.source) {
      portMap.source[side] = assignOffsets(edgeList, side, nodeMap);
    }
    for (const [side, edgeList] of entry.target) {
      portMap.target[side] = assignOffsets(edgeList, side, nodeMap);
    }

    result.set(nodeId, portMap);
  }

  return result;
}

function parseHandleSide(handleId: string | null | undefined, defaultSide: HandleSide): HandleSide {
  if (!handleId) return defaultSide;
  const parts = handleId.split('-');
  const side = parts[parts.length - 1];
  if (side === 'top' || side === 'right' || side === 'bottom' || side === 'left') return side;
  return defaultSide;
}

function assignOffsets(
  edgeList: Array<{ edgeId: string; connectedNodeId: string }>,
  side: HandleSide,
  nodeMap: Map<string, GraphNode>
): PortAssignment[] {
  if (edgeList.length <= 1) {
    return edgeList.map((e) => ({
      edgeId: e.edgeId,
      handleId: `${side}`,
      offset: 50,
    }));
  }

  // Sort by position of connected node to minimize crossings
  const isVerticalSide = side === 'left' || side === 'right';

  const sorted = [...edgeList].sort((a, b) => {
    const nodeA = nodeMap.get(a.connectedNodeId);
    const nodeB = nodeMap.get(b.connectedNodeId);
    if (!nodeA || !nodeB) return 0;
    if (isVerticalSide) {
      return nodeA.position.y - nodeB.position.y;
    } else {
      return nodeA.position.x - nodeB.position.x;
    }
  });

  // Distribute evenly between 20% and 80% of the side
  const margin = 20;
  const range = 100 - 2 * margin;

  return sorted.map((e, i) => ({
    edgeId: e.edgeId,
    handleId: `${side}-${i}`,
    offset: sorted.length === 1 ? 50 : margin + (i / (sorted.length - 1)) * range,
  }));
}

/**
 * Apply port distribution to edges: set sourceHandle/targetHandle with offsets.
 * Returns updated edges with adjusted handle positions via style data.
 */
export function applyPortDistribution(
  edges: GraphEdge[],
  nodes: GraphNode[]
): GraphEdge[] {
  const portMap = distributeHandles(edges, nodes);

  return edges.map((edge) => {
    const sourcePortMap = portMap.get(edge.source);
    const targetPortMap = portMap.get(edge.target);

    let sourceOffset: number | undefined;
    let targetOffset: number | undefined;

    if (sourcePortMap) {
      for (const assignments of Object.values(sourcePortMap.source)) {
        const found = assignments?.find((a) => a.edgeId === edge.id);
        if (found) { sourceOffset = found.offset; break; }
      }
    }
    if (targetPortMap) {
      for (const assignments of Object.values(targetPortMap.target)) {
        const found = assignments?.find((a) => a.edgeId === edge.id);
        if (found) { targetOffset = found.offset; break; }
      }
    }

    if (sourceOffset === undefined && targetOffset === undefined) return edge;

    return {
      ...edge,
      data: {
        ...edge.data,
        sourcePortOffset: sourceOffset,
        targetPortOffset: targetOffset,
      },
    };
  });
}
