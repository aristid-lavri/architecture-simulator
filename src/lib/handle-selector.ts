import type { GraphNode } from '@/types/graph';

type HandleSide = 'top' | 'right' | 'bottom' | 'left';

interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getNodeRect(node: GraphNode, allNodes: GraphNode[]): NodeRect {
  // Compute absolute position by walking up the parentId chain
  let absX = node.position.x;
  let absY = node.position.y;
  let current = node;
  while (current.parentId) {
    const parent = allNodes.find((n) => n.id === current.parentId);
    if (!parent) break;
    absX += parent.position.x;
    absY += parent.position.y;
    current = parent;
  }
  const width = node.width || 160;
  const height = node.height || 60;
  return { x: absX, y: absY, width, height };
}

function selectSide(sourceRect: NodeRect, targetRect: NodeRect): { sourceSide: HandleSide; targetSide: HandleSide } {
  const sCx = sourceRect.x + sourceRect.width / 2;
  const sCy = sourceRect.y + sourceRect.height / 2;
  const tCx = targetRect.x + targetRect.width / 2;
  const tCy = targetRect.y + targetRect.height / 2;

  const dx = tCx - sCx;
  const dy = tCy - sCy;

  // Angle in degrees, 0 = right, 90 = down
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Map angle to side pair
  if (angle >= -45 && angle < 45) {
    // Target is to the right
    return { sourceSide: 'right', targetSide: 'left' };
  } else if (angle >= 45 && angle < 135) {
    // Target is below
    return { sourceSide: 'bottom', targetSide: 'top' };
  } else if (angle >= -135 && angle < -45) {
    // Target is above
    return { sourceSide: 'top', targetSide: 'bottom' };
  } else {
    // Target is to the left
    return { sourceSide: 'left', targetSide: 'right' };
  }
}

export function selectOptimalHandles(
  sourceNode: GraphNode,
  targetNode: GraphNode,
  allNodes: GraphNode[]
): { sourceHandle: string; targetHandle: string } {
  const sourceRect = getNodeRect(sourceNode, allNodes);
  const targetRect = getNodeRect(targetNode, allNodes);
  const { sourceSide, targetSide } = selectSide(sourceRect, targetRect);
  return {
    sourceHandle: `source-${sourceSide}`,
    targetHandle: `target-${targetSide}`,
  };
}

/**
 * Recalculate optimal handles for all edges based on current node positions.
 * Returns a map of edgeId → { sourceHandle, targetHandle }.
 */
export function recalculateAllHandles(
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }>,
  nodes: GraphNode[]
): Map<string, { sourceHandle: string; targetHandle: string }> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const result = new Map<string, { sourceHandle: string; targetHandle: string }>();

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const handles = selectOptimalHandles(sourceNode, targetNode, nodes);
    result.set(edge.id, handles);
  }

  return result;
}
