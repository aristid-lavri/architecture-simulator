import type { GraphNode, GraphEdge } from '@/types/graph';
import type { DraftEdge } from '@/plugins/extensions/edge-creation';
import {
  type RuleViolation,
  buildContext,
  ruleRegistry,
} from '@/lib/rules-engine/core';
import { filterSuppressedViolations } from './suppression-filter';

export interface EdgeEvaluationResult {
  blocking: RuleViolation[];   // severity === 'error'
  warnings: RuleViolation[];   // severity === 'warning'
}

/**
 * Runs all edge-scope rules against the given draft edge in the context of the current graph.
 * Returns violations split by severity. Suppressions are filtered out.
 *
 * If a rule throws during evaluation, the error is logged (in non-production) and the rule is skipped.
 */
export function evaluateOnEdgeCreation(
  draftEdge: DraftEdge,
  nodes: GraphNode[],
  edges: GraphEdge[],
): EdgeEvaluationResult {
  const ctx = buildContext(nodes, edges, draftEdge);
  const rules = ruleRegistry.rulesFor('edge');
  const all: RuleViolation[] = [];
  for (const rule of rules) {
    try {
      const out = rule.evaluate(ctx);
      if (out && out.length > 0) all.push(...out);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[rules-engine] rule ${rule.id} threw during edge evaluation`, e);
      }
    }
  }

  // Suppressions on the draft edge itself can short-circuit a violation.
  // Build a synthetic edges list including the draft so suppression filter can look it up.
  const draftAsEdge: GraphEdge = {
    id: draftEdge.id,
    source: draftEdge.source,
    target: draftEdge.target,
    sourceHandle: draftEdge.sourceHandle,
    targetHandle: draftEdge.targetHandle,
    data: draftEdge.data,
  };
  const filtered = filterSuppressedViolations(all, [...edges, draftAsEdge]);

  return {
    blocking: filtered.filter((v) => v.severity === 'error'),
    warnings: filtered.filter((v) => v.severity === 'warning'),
  };
}
