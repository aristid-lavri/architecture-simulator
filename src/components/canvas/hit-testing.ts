import type { GraphNode } from '@/types/graph';
import type { ComponentType } from '@/types';
import { CONTAINER_TYPES, canBeChildOf } from '@/types';

/**
 * Finds the deepest container at a given world position that accepts the dropped type.
 */
export function findContainerAtPosition(
  nodes: GraphNode[],
  position: { x: number; y: number },
  droppedType: ComponentType,
): GraphNode | null {
  function getDepth(node: GraphNode): number {
    let depth = 0;
    let current = node;
    while (current.parentId) {
      depth++;
      const parent = nodes.find((n) => n.id === current.parentId);
      if (!parent) break;
      current = parent;
    }
    return depth;
  }

  function getAbsolutePosition(node: GraphNode): { x: number; y: number } {
    let absX = node.position.x;
    let absY = node.position.y;
    let current = node;
    while (current.parentId) {
      const parent = nodes.find((n) => n.id === current.parentId);
      if (!parent) break;
      absX += parent.position.x;
      absY += parent.position.y;
      current = parent;
    }
    return { x: absX, y: absY };
  }

  const containerNodes = nodes.filter(
    (n) => CONTAINER_TYPES.includes(n.type)
  );

  let bestMatch: GraphNode | null = null;
  let bestDepth = -1;

  for (const container of containerNodes) {
    if (!canBeChildOf(droppedType, container.type)) continue;

    const absPos = getAbsolutePosition(container);
    const width = container.width ?? 400;
    const height = container.height ?? 250;

    if (
      position.x >= absPos.x &&
      position.x <= absPos.x + width &&
      position.y >= absPos.y &&
      position.y <= absPos.y + height
    ) {
      const depth = getDepth(container);
      if (depth > bestDepth) {
        bestDepth = depth;
        bestMatch = container;
      }
    }
  }

  return bestMatch;
}
