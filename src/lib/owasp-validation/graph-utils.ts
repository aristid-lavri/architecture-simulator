// src/lib/owasp-validation/graph-utils.ts
import type { GraphNode, GraphEdge } from '@/types/graph';

/**
 * Vérifie si `targetId` est joignable depuis `sourceId` en suivant les edges.
 * BFS classique sur les edges sortants.
 */
export function isReachableFrom(
  sourceId: string,
  targetId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): boolean {
  if (sourceId === targetId) return true;
  const adjacency = buildAdjacency(edges);
  const visited = new Set<string>([sourceId]);
  const queue = [sourceId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? [];
    for (const next of neighbors) {
      if (next === targetId) return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/**
 * Vérifie si le chemin amont vers `targetId` (depuis n'importe quel client-group)
 * traverse au moins un nœud du type `upstreamType`.
 */
export function hasUpstreamOfType(
  targetId: string,
  upstreamType: GraphNode['type'],
  nodes: GraphNode[],
  edges: GraphEdge[]
): boolean {
  const reverseAdjacency = buildReverseAdjacency(edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>([targetId]);
  const queue = [targetId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const upstream = reverseAdjacency.get(current) ?? [];
    for (const prev of upstream) {
      const node = nodeMap.get(prev);
      if (node?.type === upstreamType) return true;
      if (!visited.has(prev)) {
        visited.add(prev);
        queue.push(prev);
      }
    }
  }
  return false;
}

/**
 * Retourne la liste de node IDs (du source vers target) du premier chemin trouvé.
 * Utilisé pour rapporter le contexte d'une violation. Retourne [] si non joignable.
 */
export function getUpstreamPath(
  targetId: string,
  sourceId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): string[] {
  const adjacency = buildAdjacency(edges);
  const parent = new Map<string, string>();
  const visited = new Set<string>([sourceId]);
  const queue = [sourceId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) {
      const path: string[] = [];
      let node: string | undefined = targetId;
      while (node !== undefined) {
        path.unshift(node);
        node = parent.get(node);
      }
      return path;
    }
    const neighbors = adjacency.get(current) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        parent.set(next, current);
        queue.push(next);
      }
    }
  }
  return [];
}

function buildAdjacency(edges: GraphEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    if (!map.has(e.source)) map.set(e.source, []);
    map.get(e.source)!.push(e.target);
  }
  return map;
}

function buildReverseAdjacency(edges: GraphEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    if (!map.has(e.target)) map.set(e.target, []);
    map.get(e.target)!.push(e.source);
  }
  return map;
}

/** Retourne tous les nœuds joignables depuis `sourceId` (transitif) */
export function allReachableFrom(
  sourceId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): Set<string> {
  const adjacency = buildAdjacency(edges);
  const visited = new Set<string>([sourceId]);
  const queue = [sourceId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}
