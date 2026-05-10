import type { GraphEdge } from '@/types/graph';
import type { RuleViolation } from '@/lib/rules-engine/core';
import { isRuleSuppressedOnEdge } from '@/lib/rules-engine/suppression';

/**
 * Filters out violations that are suppressed on at least one of the violation's `edgeIds`.
 *
 * Semantics for Phase 1 : a violation is considered suppressed if its `ruleId` is suppressed
 * on ANY of the edges it concerns. (Most edge-scope violations name a single edge ; graph-scope
 * violations may name multiple — being suppressed on any one is enough to silence the entry.)
 *
 * Violations with no `edgeIds` (e.g. graph-scope violations attached to a node only) are
 * never filtered by this function — there's no edge on which to attach the suppression.
 */
export function filterSuppressedViolations(
  violations: RuleViolation[],
  edges: GraphEdge[],
): RuleViolation[] {
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of edges) edgeMap.set(e.id, e);
  return violations.filter((v) => {
    if (!v.edgeIds || v.edgeIds.length === 0) return true;
    for (const eid of v.edgeIds) {
      const edge = edgeMap.get(eid);
      if (edge && isRuleSuppressedOnEdge(edge, v.ruleId)) return false;
    }
    return true;
  });
}
