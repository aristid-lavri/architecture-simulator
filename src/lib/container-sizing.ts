import type { GraphNode } from '@/types/graph';
import {
  NODE_WIDTH, getNodeHeight,
  ZONE_DEFAULT_WIDTH, ZONE_DEFAULT_HEIGHT,
  HOST_DEFAULT_WIDTH, HOST_DEFAULT_HEIGHT,
  CONTAINER_DEFAULT_WIDTH, CONTAINER_DEFAULT_HEIGHT,
} from '@/components/canvas/constants';

/** Inner padding between the bounding box of children and the container border. */
const CONTAINER_PADDING = 20;

const CONTAINER_TYPES = new Set(['network-zone', 'host-server', 'container']);

export function isContainerNode(node: GraphNode | undefined): boolean {
  return !!node && CONTAINER_TYPES.has(node.type);
}

/** Skip resize cascades through a container that is currently collapsed — its size is
 *  pinned to the standard collapsed dimensions until the user expands it again. */
function isCollapsedContainer(node: GraphNode): boolean {
  const data = node.data as Record<string, unknown> | undefined;
  return data?.collapsed === true;
}

interface Size { width: number; height: number; }

function defaultSizeFor(type: string): Size {
  switch (type) {
    case 'network-zone': return { width: ZONE_DEFAULT_WIDTH, height: ZONE_DEFAULT_HEIGHT };
    case 'host-server':  return { width: HOST_DEFAULT_WIDTH, height: HOST_DEFAULT_HEIGHT };
    case 'container':    return { width: CONTAINER_DEFAULT_WIDTH, height: CONTAINER_DEFAULT_HEIGHT };
    default:             return { width: NODE_WIDTH, height: 80 };
  }
}

/**
 * Compute the size a container should have to comfortably hold its direct children.
 *
 * The computation uses parent-relative child coordinates (the canonical representation in
 * `GraphNode.position` for nested nodes) and extends to cover the rightmost / bottommost
 * child plus padding. The result never shrinks below the type's default size, so an empty
 * or sparsely-populated container keeps a reasonable footprint.
 *
 * The container is NOT shifted to cover children with negative positions — that would
 * require relocating siblings to keep them in place, which is out of scope here.
 */
export function computeContainerSize(container: GraphNode, allNodes: GraphNode[]): Size {
  const fallback = defaultSizeFor(container.type);
  const directChildren = allNodes.filter((n) => n.parentId === container.id);
  if (directChildren.length === 0) return fallback;

  let maxRight = 0;
  let maxBottom = 0;
  for (const child of directChildren) {
    const w = child.width ?? NODE_WIDTH;
    const h = child.height ?? getNodeHeight(child.type);
    const right = child.position.x + w;
    const bottom = child.position.y + h;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return {
    width: Math.max(fallback.width, Math.round(maxRight + CONTAINER_PADDING)),
    height: Math.max(fallback.height, Math.round(maxBottom + CONTAINER_PADDING)),
  };
}

/**
 * Walk up the parent chain from `fromNodeId`, recomputing each ancestor container's size
 * based on the (possibly mutated) child list. Returns a new array with the updated nodes.
 *
 * Used after any user action that changes a child's geometry within a container —
 * drop, drag-end, resize-end, reparent. Cascades through nested containers
 * (zone → host-server → container → service).
 */
export function resizeAncestors(nodes: GraphNode[], fromNodeId: string): GraphNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const start = byId.get(fromNodeId);
  if (!start) return nodes;

  let result = nodes;
  let parentId = start.parentId;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent || !isContainerNode(parent)) break;
    // Don't grow a collapsed container — its size is intentionally fixed.
    if (isCollapsedContainer(parent)) {
      parentId = parent.parentId;
      continue;
    }
    const size = computeContainerSize(parent, result);
    if (parent.width !== size.width || parent.height !== size.height) {
      result = result.map((n) => (n.id === parent.id ? { ...n, width: size.width, height: size.height } : n));
      // Refresh the byId map so the next iteration sees the new parent dimensions.
      byId.set(parent.id, { ...parent, width: size.width, height: size.height });
    }
    parentId = parent.parentId;
  }
  return result;
}

/**
 * Same as `resizeAncestors` but seeded with multiple anchor nodes — useful when a single
 * action affects two parent chains (e.g. reparenting: the old parent loses a child, the
 * new parent gains one, and both chains may need recomputation up to a common ancestor).
 */
export function resizeAncestorsForMany(nodes: GraphNode[], fromNodeIds: string[]): GraphNode[] {
  let result = nodes;
  for (const id of fromNodeIds) {
    result = resizeAncestors(result, id);
  }
  return result;
}

/**
 * Recompute the size of `containerId` itself and all its ancestor containers.
 * Useful after a reparent: the OLD parent may have lost its last child (and thus needs
 * to shrink to its default), while the NEW parent gained one (and grew to fit). We can't
 * use `resizeAncestors(nodes, containerId)` for the old parent because that walks UP from
 * its parent — this helper includes the container itself.
 */
export function resizeContainerAndAncestors(nodes: GraphNode[], containerId: string): GraphNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const start = byId.get(containerId);
  if (!start || !isContainerNode(start)) return nodes;

  let result = nodes;
  let current: GraphNode | undefined = start;
  while (current && isContainerNode(current)) {
    if (isCollapsedContainer(current)) {
      current = current.parentId ? byId.get(current.parentId) : undefined;
      continue;
    }
    const size = computeContainerSize(current, result);
    if (current.width !== size.width || current.height !== size.height) {
      const updated = { ...current, width: size.width, height: size.height };
      result = result.map((n) => (n.id === current!.id ? updated : n));
      byId.set(current.id, updated);
    }
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return result;
}
