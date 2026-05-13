import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';

/**
 * Detects at least one directed cycle in the dependency graph.
 * Cycles often indicate unsafe coupling (deadlocks, recursive calls without backpressure)
 * and tend to confuse downstream simulation analysis.
 *
 * Implementation: depth-first search with WHITE/GRAY/BLACK coloring. Reports each node
 * that participates in a detected back-edge as a single violation per cycle root.
 */
const rule: Rule = {
  id: 'core-sanity/topology/cycle-detected',
  packId: 'core-sanity',
  category: 'topology',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    const adj = new Map<string, string[]>();
    for (const e of ctx.edges) {
      if (e.source === e.target) {
        violations.push(
          createViolation(rule.id, 'warning', { nodeIds: [e.source], edgeIds: [e.id] }),
        );
        continue;
      }
      let l = adj.get(e.source);
      if (!l) { l = []; adj.set(e.source, l); }
      l.push(e.target);
    }

    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const n of ctx.nodes) color.set(n.id, WHITE);

    const reported = new Set<string>();
    function dfs(nodeId: string): void {
      color.set(nodeId, GRAY);
      const neighbors = adj.get(nodeId) ?? [];
      for (const next of neighbors) {
        const c = color.get(next) ?? WHITE;
        if (c === GRAY) {
          // Back-edge -> cycle. Report (next) as the root of the cycle (unique).
          if (!reported.has(next)) {
            reported.add(next);
            violations.push(
              createViolation(rule.id, 'warning', { nodeIds: [next, nodeId] }),
            );
          }
        } else if (c === WHITE) {
          dfs(next);
        }
      }
      color.set(nodeId, BLACK);
    }

    for (const n of ctx.nodes) {
      if ((color.get(n.id) ?? WHITE) === WHITE) dfs(n.id);
    }
    return violations;
  },
};

export default rule;
