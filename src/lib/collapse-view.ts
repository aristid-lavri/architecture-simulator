import type { GraphNode, GraphEdge } from '@/types/graph';

/**
 * Result of folding the raw graph through the collapse rules. Renderers consume
 * `visibleNodes` / `visibleEdges` directly and use `edgeRemap` to redirect particle
 * traffic from underlying edges onto their visible aggregate.
 */
export interface CollapseViewResult {
  visibleNodes: GraphNode[];
  visibleEdges: GraphEdge[];
  /** Map original edge id → visible edge id (only present for aggregated or remapped edges). */
  edgeRemap: Map<string, string>;
}

/** Synthetic edge IDs use this prefix so the renderer can recognise them as aggregates. */
export const AGGREGATE_EDGE_PREFIX = '_agg_';

/**
 * Read the `collapsed` flag from a node's data bag. Returns `false` when missing.
 * Container types only — leaf nodes are always uncollapsed.
 */
function isCollapsed(node: GraphNode): boolean {
  const data = node.data as Record<string, unknown> | undefined;
  return data?.collapsed === true;
}

/**
 * Apply collapse + aggregation rules to produce the visible graph.
 *
 * Behaviour:
 * - Descendants of any collapsed container are hidden.
 * - Edges with one endpoint inside a collapsed container are remapped to the outermost
 *   collapsed ancestor on that side.
 * - Edges where both endpoints land on the same collapsed container after remapping are
 *   dropped (purely internal traffic, invisible at this zoom level).
 * - Multiple edges sharing the same `(effectiveSource, effectiveTarget, protocol)` are
 *   aggregated into a single synthetic edge with `data._aggregateCount = N`. The renderer
 *   shows a "×N" badge based on that field.
 *
 * Identity case (no collapsed nodes): returns the inputs untouched and an empty remap.
 */
export function applyCollapseView(nodes: GraphNode[], edges: GraphEdge[]): CollapseViewResult {
  const collapsedIds = new Set<string>();
  for (const node of nodes) {
    if (isCollapsed(node)) collapsedIds.add(node.id);
  }

  if (collapsedIds.size === 0) {
    return { visibleNodes: nodes, visibleEdges: edges, edgeRemap: new Map() };
  }

  const parentOf = new Map<string, string | undefined>();
  for (const node of nodes) parentOf.set(node.id, node.parentId);

  /**
   * Walk up the parentId chain and return the OUTERMOST collapsed ancestor (the topmost
   * one that should subsume this node visually). Returns null if no ancestor is collapsed.
   */
  function outermostCollapsedAncestor(nodeId: string): string | null {
    let cursor: string | undefined = nodeId;
    let outermost: string | null = null;
    // Hard cap on chain depth to defend against accidental cycles.
    for (let depth = 0; depth < 32 && cursor; depth++) {
      const parentId = parentOf.get(cursor);
      if (!parentId) break;
      if (collapsedIds.has(parentId)) outermost = parentId;
      cursor = parentId;
    }
    return outermost;
  }

  // Hide nodes whose ancestor is collapsed; the collapsed container itself stays visible.
  const visibleNodes = nodes.filter((n) => outermostCollapsedAncestor(n.id) === null);

  /** Effective endpoint for an edge: the outermost collapsed ancestor if any, else the node itself. */
  function effectiveEndpoint(nodeId: string): string {
    return outermostCollapsedAncestor(nodeId) ?? nodeId;
  }

  type Aggregate = {
    effectiveSource: string;
    effectiveTarget: string;
    protocol: string | undefined;
    members: GraphEdge[];
  };
  const aggregates = new Map<string, Aggregate>();

  for (const edge of edges) {
    const effSrc = effectiveEndpoint(edge.source);
    const effTgt = effectiveEndpoint(edge.target);
    if (effSrc === effTgt) {
      // Both endpoints inside the same collapsed container — edge is invisible.
      continue;
    }
    const protocol = (edge.data as Record<string, unknown> | undefined)?.protocol as string | undefined;
    const key = `${effSrc}::${effTgt}::${protocol ?? '_none'}`;
    let agg = aggregates.get(key);
    if (!agg) {
      agg = { effectiveSource: effSrc, effectiveTarget: effTgt, protocol, members: [] };
      aggregates.set(key, agg);
    }
    agg.members.push(edge);
  }

  const visibleEdges: GraphEdge[] = [];
  const edgeRemap = new Map<string, string>();

  for (const agg of aggregates.values()) {
    if (agg.members.length === 1) {
      const original = agg.members[0];
      const wasRemapped = original.source !== agg.effectiveSource || original.target !== agg.effectiveTarget;
      if (wasRemapped) {
        // Endpoint moved to a collapsed container, but no aggregation needed.
        // We keep the original id so the renderer/cache reuses the existing visuals.
        visibleEdges.push({
          ...original,
          source: agg.effectiveSource,
          target: agg.effectiveTarget,
        });
        // edgeRemap entry not needed: visible id == original id.
      } else {
        visibleEdges.push(original);
      }
      continue;
    }

    // 2+ edges: synthesize a single aggregate edge.
    const aggregateId = `${AGGREGATE_EDGE_PREFIX}${agg.effectiveSource}__${agg.effectiveTarget}__${agg.protocol ?? 'none'}`;
    const sample = agg.members[0];
    visibleEdges.push({
      id: aggregateId,
      source: agg.effectiveSource,
      target: agg.effectiveTarget,
      data: {
        ...(sample.data as Record<string, unknown> | undefined ?? {}),
        _aggregateCount: agg.members.length,
        _aggregatedIds: agg.members.map((m) => m.id),
      },
    });
    for (const member of agg.members) {
      edgeRemap.set(member.id, aggregateId);
    }
  }

  return { visibleNodes, visibleEdges, edgeRemap };
}

/** Read the aggregate count from an edge produced by `applyCollapseView`. Returns 1 for non-aggregates. */
export function aggregateCount(edge: GraphEdge): number {
  const data = edge.data as Record<string, unknown> | undefined;
  const count = data?._aggregateCount;
  return typeof count === 'number' && count > 1 ? count : 1;
}
