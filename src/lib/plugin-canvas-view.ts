import type { GraphNode, GraphEdge } from '@/types/graph';
import { canvasFilterRegistry, type ProjectKindMeta } from '@/plugins/extensions';

/**
 * Applique les filtres et sélecteurs de position fournis par les plugins
 * pour produire la vue effective des nœuds/edges qui sera ensuite passée
 * à applyCollapseView.
 *
 * - Filtre les nœuds via `canvasFilterRegistry.filterNodes`
 * - Filtre les edges via `canvasFilterRegistry.filterEdges`, en respectant aussi
 *   les filtres node : un edge dont une extrémité est filtrée est automatiquement masqué
 * - Réécrit `position` sur chaque nœud si un sélecteur fournit une position alternative
 *
 * Si aucun plugin n'a enregistré de filtre/sélecteur, retourne les inputs inchangés.
 */
export function applyPluginCanvasView(
  nodes: GraphNode[],
  edges: GraphEdge[],
  projectMeta: ProjectKindMeta,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!canvasFilterRegistry.hasFilters()) {
    return { nodes, edges };
  }

  const context = { projectMeta };

  // Filtre + override de position en une passe.
  const visibleNodes = canvasFilterRegistry.filterNodes(nodes, context).map((n) => {
    const newPos = canvasFilterRegistry.resolveNodePosition(n, context);
    if (newPos === n.position) return n;
    return { ...n, position: newPos };
  });

  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = canvasFilterRegistry
    .filterEdges(edges, context)
    .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

  return { nodes: visibleNodes, edges: visibleEdges };
}
