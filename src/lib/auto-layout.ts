import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { GraphNode, GraphEdge } from '@/types/graph';
import { NODE_WIDTH, getNodeHeight } from '@/components/canvas/constants';

const elk = new ELK();

export interface LayoutOptions {
  direction?: 'RIGHT' | 'DOWN';
  spacing?: number;
  nodeSpacing?: number;
}

const DEFAULT_NODE_WIDTH = NODE_WIDTH;
const DEFAULT_NODE_HEIGHT = 80;
const GROUP_PADDING = 40;

const GROUP_NODE_TYPES = new Set(['network-zone', 'host-server', 'container']);

function isGroupNode(node: GraphNode): boolean {
  return GROUP_NODE_TYPES.has(node.type ?? '');
}

/** Effective rendered dimensions of a non-group node (uses overrides on the node, falls back to type defaults). */
function effectiveLeafSize(node: GraphNode): { width: number; height: number } {
  return {
    width: node.width ?? DEFAULT_NODE_WIDTH,
    height: node.height ?? getNodeHeight(node.type) ?? DEFAULT_NODE_HEIGHT,
  };
}

/**
 * Construit récursivement un ElkNode pour un group node et ses enfants.
 * Supporte l'imbrication (zone > host > container).
 */
function buildGroupElkNode(
  groupNode: GraphNode,
  allNodes: GraphNode[],
  edges: GraphEdge[],
  direction: string,
  nodeSpacing: number
): ElkNode {
  // Trouver les enfants directs de ce group node
  const directChildren = allNodes.filter(
    (n) => n.parentId === groupNode.id
  );

  const elkChildren: ElkNode[] = [];

  for (const child of directChildren) {
    if (isGroupNode(child)) {
      // Enfant composite (ex: host-server dans une zone)
      elkChildren.push(buildGroupElkNode(child, allNodes, edges, direction, nodeSpacing));
    } else {
      elkChildren.push({
        id: child.id,
        ...effectiveLeafSize(child),
      });
    }
  }

  // Edges internes à ce group (entre ses enfants directs uniquement)
  const directChildIds = new Set(directChildren.map((c) => c.id));
  const internalEdges = edges
    .filter((e) => directChildIds.has(e.source) && directChildIds.has(e.target))
    .map((e): ElkExtendedEdge => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    }));

  return {
    id: groupNode.id,
    layoutOptions: {
      'elk.padding': `[top=${GROUP_PADDING + 20},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(nodeSpacing),
    },
    children: elkChildren,
    edges: internalEdges,
  };
}

export interface LayoutResult {
  nodes: GraphNode[];
  /**
   * Edges enriched with `data._waypoints` (a polyline of absolute coordinates produced by
   * ELK's orthogonal edge router). The renderer can use these to draw the same routes ELK
   * planned, avoiding crossings the ad-hoc per-edge router would otherwise introduce.
   *
   * The `_` prefix marks the field as transient; `cleanData` in the YAML exporter strips
   * underscore-prefixed keys so waypoints are never serialised.
   */
  edges: GraphEdge[];
}

/**
 * Auto-layout hiérarchique via ELK.
 * Respecte les relations parent/enfant imbriquées (zone > host > container).
 * Retourne les noeuds avec positions mises à jour + groups redimensionnés, et les edges
 * enrichis de waypoints orthogonaux issus du routage ELK.
 */
export async function applyAutoLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: LayoutOptions = {}
): Promise<LayoutResult> {
  const { direction = 'RIGHT', spacing = 60, nodeSpacing = 40 } = options;

  // Identifier les group nodes racines (sans parent ou dont le parent n'est pas un group)
  const topLevelGroups = nodes.filter((n) => {
    if (!isGroupNode(n)) return false;
    const parentId = n.parentId;
    if (!parentId) return true;
    const parent = nodes.find((p) => p.id === parentId);
    return !parent || !isGroupNode(parent);
  });

  // Nœuds libres (pas de parent, pas un group)
  const freeNodes = nodes.filter((n) => {
    const parentId = n.parentId;
    return !parentId && !isGroupNode(n);
  });

  // Construire le graphe ELK
  const elkChildren: ElkNode[] = [];

  // Ajouter les groups racines comme nœuds composites
  for (const group of topLevelGroups) {
    elkChildren.push(buildGroupElkNode(group, nodes, edges, direction, nodeSpacing));
  }

  // Ajouter les nœuds libres avec leurs dimensions réelles
  for (const node of freeNodes) {
    elkChildren.push({
      id: node.id,
      ...effectiveLeafSize(node),
    });
  }

  // Identify which edges are internal to one group (both endpoints among the same group's
  // direct children). Those are emitted at the group level by `buildGroupElkNode`. Everything
  // else (cross-group, free-node, or cross-hierarchy-level) is emitted at the root and routed
  // by ELK with `hierarchyHandling: INCLUDE_CHILDREN`.
  const internalEdgeIds = new Set<string>();
  for (const node of nodes) {
    if (!isGroupNode(node)) continue;
    const directChildIds = new Set(nodes.filter((n) => n.parentId === node.id).map((n) => n.id));
    for (const e of edges) {
      if (directChildIds.has(e.source) && directChildIds.has(e.target)) {
        internalEdgeIds.add(e.id);
      }
    }
  }

  const rootEdges = edges
    .filter((e) => !internalEdgeIds.has(e.id))
    .map((e): ElkExtendedEdge => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    }));

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': String(spacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing),
      'elk.spacing.componentComponent': String(spacing),
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: elkChildren,
    edges: rootEdges,
  };

  const layoutResult = await elk.layout(elkGraph);

  // Appliquer les positions calculées récursivement
  const nodePositions = new Map<string, { x: number; y: number }>();
  const groupSizes = new Map<string, { width: number; height: number }>();
  const waypointsByEdge = new Map<string, { x: number; y: number }[]>();

  /**
   * Walk the ELK output tree, accumulating absolute parent offsets so that edge waypoints
   * (which ELK emits in their container's local frame) end up in root-frame coordinates.
   */
  function walk(elkNode: ElkNode, parentAbsX: number, parentAbsY: number): void {
    const absX = parentAbsX + (elkNode.x ?? 0);
    const absY = parentAbsY + (elkNode.y ?? 0);

    if (elkNode.id !== 'root') {
      // Position is relative to the parent — keep as-is for the GraphNode model (which
      // also uses parent-relative coordinates via parentId).
      nodePositions.set(elkNode.id, { x: elkNode.x ?? 0, y: elkNode.y ?? 0 });
      if (elkNode.children && elkNode.children.length > 0) {
        groupSizes.set(elkNode.id, {
          width: elkNode.width ?? 400,
          height: elkNode.height ?? 300,
        });
      }
    }

    // Edges declared on this container — coordinates are local to it.
    if (elkNode.edges) {
      for (const edge of elkNode.edges) {
        if (!edge.sections || edge.sections.length === 0) continue;
        const section = edge.sections[0];
        const points: { x: number; y: number }[] = [
          { x: absX + section.startPoint.x, y: absY + section.startPoint.y },
          ...(section.bendPoints ?? []).map((p) => ({ x: absX + p.x, y: absY + p.y })),
          { x: absX + section.endPoint.x, y: absY + section.endPoint.y },
        ];
        waypointsByEdge.set(edge.id, points);
      }
    }

    for (const child of elkNode.children ?? []) {
      walk(child, absX, absY);
    }
  }

  walk(layoutResult, 0, 0);

  const layoutedNodes = nodes.map((node) => {
    const pos = nodePositions.get(node.id);
    const size = groupSizes.get(node.id);
    if (!pos && !size) return node;
    return {
      ...node,
      position: pos || node.position,
      ...(size ? { width: size.width, height: size.height } : {}),
    };
  });

  const layoutedEdges = edges.map((edge) => {
    const waypoints = waypointsByEdge.get(edge.id);
    if (!waypoints) return edge;
    const data = (edge.data ?? {}) as Record<string, unknown>;
    return {
      ...edge,
      data: { ...data, _waypoints: waypoints },
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}
