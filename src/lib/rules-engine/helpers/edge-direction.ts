import type { ComponentType } from '@/types/index';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { RuleContext } from '@/lib/rules-engine/core';

/** Types that should NEVER initiate an outbound connection (data-layer + filters + IdP). */
const NEVER_INITIATES = new Set<ComponentType>([
  'database',
  'cache',
  'cloud-storage',
  'waf',
  'firewall',
  'dns',
  'identity-provider',
]);

/** Types that should NEVER be the target of application-layer traffic from another component. */
const NEVER_BE_TARGET = new Set<ComponentType>([
  'http-client',
  'client-group',
  // 'dns' is special — it can receive lookups but not application traffic; rule will use a more specific check
]);

export function canTypeInitiate(t: ComponentType): boolean {
  return !NEVER_INITIATES.has(t);
}

export function canTypeBeTarget(t: ComponentType): boolean {
  return !NEVER_BE_TARGET.has(t);
}

/**
 * Resolves the source/target nodes from the draft edge using the context's nodeMap.
 * Returns null if either side is missing or if there is no draftEdge in context.
 */
export function resolveEdgeEndpoints(
  ctx: RuleContext,
): { source: GraphNode; target: GraphNode } | null {
  if (!ctx.draftEdge) return null;
  const source = ctx.nodeMap.get(ctx.draftEdge.source);
  const target = ctx.nodeMap.get(ctx.draftEdge.target);
  if (!source || !target) return null;
  return { source, target };
}

/**
 * Convenience: extracts the ComponentType strings from the draft edge.
 * Returns null if endpoints missing.
 */
export function resolveEdgeTypes(
  ctx: RuleContext,
): { sourceType: ComponentType; targetType: ComponentType } | null {
  const ep = resolveEdgeEndpoints(ctx);
  if (!ep) return null;
  return {
    sourceType: ep.source.type as ComponentType,
    targetType: ep.target.type as ComponentType,
  };
}

/**
 * All edges that match a predicate over (source, target, edge).
 * Useful for graph-scope rules that need to scan the whole graph.
 */
export function findEdges(
  ctx: RuleContext,
  predicate: (source: GraphNode, target: GraphNode, edge: GraphEdge) => boolean,
): GraphEdge[] {
  const out: GraphEdge[] = [];
  for (const e of ctx.edges) {
    const s = ctx.nodeMap.get(e.source);
    const t = ctx.nodeMap.get(e.target);
    if (s && t && predicate(s, t, e)) out.push(e);
  }
  return out;
}
