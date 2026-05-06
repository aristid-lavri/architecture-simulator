import type { GraphNode, GraphEdge } from '@/types/graph';

/**
 * Détecte et filtre les edges qui contournent un cache déjà présent dans la topologie.
 *
 * Anti-pattern visé : un service `S` connecté à la fois à un cache `C` et
 * directement à une DB `D`, alors que `C → D` existe aussi. Sans filtrage,
 * `S` envoie en parallèle vers `C` ET `D` (fan-out via le mécanisme de fork
 * du dispatcher), neutralisant l'effet du cache.
 *
 * Comportement : si `S` a un edge vers un nœud `cache`, et qu'un autre edge
 * sortant de `S` cible un nœud déjà accessible en aval du cache, cet edge
 * direct est filtré. Le cache prend la responsabilité de fallback via son
 * propre mécanisme cache-miss.
 *
 * @param outgoingEdges Edges sortants du nœud source
 * @param allNodes Tous les nœuds du graphe (pour résoudre les types des targets)
 * @param allEdges Tous les edges du graphe (pour explorer le downstream du cache)
 * @returns Sous-ensemble des edges sortants après filtrage
 */
export function filterCacheBypassEdges(
  outgoingEdges: GraphEdge[],
  allNodes: GraphNode[],
  allEdges: GraphEdge[] | undefined
): GraphEdge[] {
  if (!allEdges || allEdges.length === 0) return outgoingEdges;

  const cacheEdges = outgoingEdges.filter((edge) => {
    const target = allNodes.find((n) => n.id === edge.target);
    return target?.type === 'cache';
  });
  if (cacheEdges.length === 0) return outgoingEdges;

  const cacheDownstreamIds = new Set<string>();
  for (const cacheEdge of cacheEdges) {
    for (const downstreamEdge of allEdges) {
      if (downstreamEdge.source === cacheEdge.target) {
        cacheDownstreamIds.add(downstreamEdge.target);
      }
    }
  }

  if (cacheDownstreamIds.size === 0) return outgoingEdges;

  return outgoingEdges.filter((edge) => {
    const target = allNodes.find((n) => n.id === edge.target);
    if (target?.type === 'cache') return true;
    return !cacheDownstreamIds.has(edge.target);
  });
}
