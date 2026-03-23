import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { GraphNode, GraphEdge } from '@/types/graph';

const elk = new ELK();

export interface LayoutOptions {
  direction?: 'RIGHT' | 'DOWN';
  spacing?: number;
  nodeSpacing?: number;
}

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;
const GROUP_PADDING = 40;

const GROUP_NODE_TYPES = new Set(['network-zone', 'host-server', 'container']);

function isGroupNode(node: GraphNode): boolean {
  return GROUP_NODE_TYPES.has(node.type ?? '');
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
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
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

/**
 * Collecte récursivement tous les IDs descendants d'un group node.
 */
function collectDescendantIds(groupId: string, allNodes: GraphNode[]): string[] {
  const children = allNodes.filter(
    (n) => n.parentId === groupId
  );
  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    if (isGroupNode(child)) {
      ids.push(...collectDescendantIds(child.id, allNodes));
    }
  }
  return ids;
}

/**
 * Remonte la chaîne parentId pour trouver l'ancêtre racine (top-level group ou le nœud lui-même).
 */
function findTopLevelAncestor(nodeId: string, allNodes: GraphNode[]): string {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) return nodeId;
  const parentId = node.parentId;
  if (!parentId) return nodeId;
  const parent = allNodes.find((n) => n.id === parentId);
  if (!parent) return nodeId;
  // Si le parent a aussi un parent, remonter
  const grandParentId = parent.parentId;
  if (grandParentId) return findTopLevelAncestor(parentId, allNodes);
  return parentId;
}

/**
 * Auto-layout hiérarchique via ELK.
 * Respecte les relations parent/enfant imbriquées (zone > host > container).
 * Retourne les noeuds avec positions mises à jour + groups redimensionnés.
 */
export async function applyAutoLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: LayoutOptions = {}
): Promise<GraphNode[]> {
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

  // Ajouter les nœuds libres
  for (const node of freeNodes) {
    elkChildren.push({
      id: node.id,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    });
  }

  // Collecter tous les IDs qui sont enfants d'un group
  const allGroupedIds = new Set<string>();
  for (const group of topLevelGroups) {
    allGroupedIds.add(group.id);
    for (const id of collectDescendantIds(group.id, nodes)) {
      allGroupedIds.add(id);
    }
  }

  // Edges inter-groups (entre nœuds de groupes différents ou nœuds libres)
  const interGroupEdges = edges.filter((e) => {
    const sourceTop = findTopLevelAncestor(e.source, nodes);
    const targetTop = findTopLevelAncestor(e.target, nodes);
    return sourceTop !== targetTop;
  });

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(spacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing),
      'elk.spacing.componentComponent': String(spacing),
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: elkChildren,
    edges: interGroupEdges.map((e): ElkExtendedEdge => {
      const sourceTop = findTopLevelAncestor(e.source, nodes);
      const targetTop = findTopLevelAncestor(e.target, nodes);
      return {
        id: e.id,
        sources: [allGroupedIds.has(e.source) ? sourceTop : e.source],
        targets: [allGroupedIds.has(e.target) ? targetTop : e.target],
      };
    }),
  };

  const layoutResult = await elk.layout(elkGraph);

  // Appliquer les positions calculées récursivement
  const nodePositions = new Map<string, { x: number; y: number }>();
  const groupSizes = new Map<string, { width: number; height: number }>();

  function extractPositions(elkNodes: ElkNode[]): void {
    for (const elkNode of elkNodes) {
      nodePositions.set(elkNode.id, { x: elkNode.x ?? 0, y: elkNode.y ?? 0 });
      if (elkNode.children && elkNode.children.length > 0) {
        // C'est un group node — enregistrer sa taille
        groupSizes.set(elkNode.id, {
          width: elkNode.width ?? 400,
          height: elkNode.height ?? 300,
        });
        extractPositions(elkNode.children);
      }
    }
  }

  extractPositions(layoutResult.children || []);

  return nodes.map((node) => {
    const pos = nodePositions.get(node.id);
    const size = groupSizes.get(node.id);
    if (!pos && !size) return node;

    return {
      ...node,
      position: pos || node.position,
      ...(size ? { width: size.width, height: size.height } : {}),
    };
  });
}
