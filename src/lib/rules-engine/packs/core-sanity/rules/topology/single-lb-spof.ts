import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import type { ComponentType } from '@/types';

/**
 * Detects a single load-balancer acting as a single point of failure.
 *
 * Heuristic:
 *  - A load-balancer is a SPOF when it has 2+ outgoing edges (multiple backends, so
 *    it's actually load-balancing) BUT only 1 incoming edge AND no peer load-balancer
 *    exists in the graph as a backup. If the user only has one LB and it dies,
 *    everything behind it goes down.
 */
const rule: Rule = {
  id: 'core-sanity/topology/single-lb-spof',
  packId: 'core-sanity',
  category: 'topology',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    const lbs = ctx.nodes.filter((n) => (n.type as ComponentType) === 'load-balancer');
    if (lbs.length === 0 || lbs.length >= 2) return [];

    const lb = lbs[0];
    let outDegree = 0;
    for (const e of ctx.edges) {
      if (e.source === lb.id) outDegree++;
    }
    if (outDegree >= 2) {
      violations.push(
        createViolation(rule.id, 'warning', { nodeIds: [lb.id] }),
      );
    }
    return violations;
  },
};

export default rule;
