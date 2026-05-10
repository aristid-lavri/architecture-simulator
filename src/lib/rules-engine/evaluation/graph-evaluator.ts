import type { GraphNode, GraphEdge } from '@/types/graph';
import {
  type RuleViolation,
  buildContext,
  ruleRegistry,
} from '@/lib/rules-engine/core';
import { filterSuppressedViolations } from './suppression-filter';

/**
 * Runs the rules engine across the full graph :
 *  - Every graph-scope rule once
 *  - Every edge-scope rule once per existing edge (treated as if it were a draft)
 *
 * Returns the merged list of violations with suppressions filtered out.
 *
 * Errors thrown by individual rules are logged (in non-production) and skipped.
 */
export function evaluateGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
): RuleViolation[] {
  const all: RuleViolation[] = [];

  // Graph-scope rules : single pass.
  const graphCtx = buildContext(nodes, edges);
  for (const rule of ruleRegistry.rulesFor('graph')) {
    try {
      const out = rule.evaluate(graphCtx);
      if (out && out.length > 0) all.push(...out);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[rules-engine] rule ${rule.id} threw during graph evaluation`, e);
      }
    }
  }

  // Edge-scope rules : one pass per edge.
  const edgeRules = ruleRegistry.rulesFor('edge');
  for (const edge of edges) {
    const ctx = buildContext(nodes, edges, edge);
    for (const rule of edgeRules) {
      try {
        const out = rule.evaluate(ctx);
        if (out && out.length > 0) all.push(...out);
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`[rules-engine] rule ${rule.id} threw on edge ${edge.id}`, e);
        }
      }
    }
  }

  return filterSuppressedViolations(all, edges);
}
