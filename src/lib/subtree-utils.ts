/**
 * Helpers de traversée de sous-arbre sur le graph d'architecture.
 *
 * Trois mécanismes de hiérarchie sont consultés en parallèle :
 *   1. **`node.parentId` natif CE** — nesting physique (zones, hosts, containers).
 *   2. **`data.parentSystemId` C4** — appartenance d'un container L2 à un système L1.
 *   3. **`data.parentContainerId` C4** — appartenance d'un component L3 à un container L2.
 *
 * Tous les trois mènent à un membre du sous-arbre. Le résultat est l'union des descendants
 * accessibles par n'importe lequel.
 */

import type { GraphNode, GraphEdge } from '@/types/graph';

interface ParentRefs {
  parentId?: string;
  parentSystemId?: string;
  parentContainerId?: string;
}

function getParentRefs(n: GraphNode): ParentRefs {
  const data = n.data as { parentSystemId?: unknown; parentContainerId?: unknown };
  return {
    parentId: n.parentId,
    parentSystemId: typeof data.parentSystemId === 'string' ? data.parentSystemId : undefined,
    parentContainerId: typeof data.parentContainerId === 'string' ? data.parentContainerId : undefined,
  };
}

/**
 * Retourne l'ensemble des IDs de nodes appartenant au sous-arbre enraciné en `rootId`.
 * Inclut le root lui-même. Vide si `rootId` n'existe pas dans `allNodes`.
 *
 * Coût : O(N²) au pire (chaque BFS step itère sur tous les nodes). Acceptable pour les
 * tailles typiques (<2000 nodes).
 */
export function findSubtreeNodes(
  rootId: string,
  allNodes: ReadonlyArray<GraphNode>,
): Set<string> {
  if (!allNodes.some((n) => n.id === rootId)) return new Set();

  const result = new Set<string>([rootId]);
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const candidate of allNodes) {
      if (result.has(candidate.id)) continue;
      const refs = getParentRefs(candidate);
      if (refs.parentId === current
        || refs.parentSystemId === current
        || refs.parentContainerId === current) {
        result.add(candidate.id);
        queue.push(candidate.id);
      }
    }
  }

  return result;
}

export interface BoundaryEdges {
  /** Edges venant de l'extérieur du subtree vers un node interne. */
  entering: GraphEdge[];
  /** Edges sortant d'un node interne vers l'extérieur. */
  leaving: GraphEdge[];
  /** Edges entièrement contenues dans le subtree. */
  internal: GraphEdge[];
}

/**
 * Classifie chaque edge selon sa relation au subtree :
 *  - `entering` : source ∉ subtree, target ∈ subtree
 *  - `leaving`  : source ∈ subtree, target ∉ subtree
 *  - `internal` : source ∈ subtree ET target ∈ subtree
 *
 * Les edges entièrement hors subtree sont ignorées (pas dans le résultat).
 */
export function findBoundaryEdges(
  subtreeNodeIds: ReadonlySet<string>,
  allEdges: ReadonlyArray<GraphEdge>,
): BoundaryEdges {
  const entering: GraphEdge[] = [];
  const leaving: GraphEdge[] = [];
  const internal: GraphEdge[] = [];

  for (const e of allEdges) {
    const sourceIn = subtreeNodeIds.has(e.source);
    const targetIn = subtreeNodeIds.has(e.target);
    if (sourceIn && targetIn) internal.push(e);
    else if (!sourceIn && targetIn) entering.push(e);
    else if (sourceIn && !targetIn) leaving.push(e);
  }

  return { entering, leaving, internal };
}
