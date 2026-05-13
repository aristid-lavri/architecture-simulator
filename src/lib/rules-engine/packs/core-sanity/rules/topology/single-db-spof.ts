import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import type { ComponentType } from '@/types';

/**
 * Detects a single database serving 2+ distinct upstream consumers — the DB becomes
 * a SPOF for the whole stack. Heuristic: there is exactly ONE node of type
 * `database` in the graph AND it has 2+ distinct sources pointing to it.
 * Suggests adding a replica / read-replica / multi-AZ setup.
 */
const rule: Rule = {
  id: 'core-sanity/topology/single-db-spof',
  packId: 'core-sanity',
  category: 'topology',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    const dbs = ctx.nodes.filter((n) => (n.type as ComponentType) === 'database');
    if (dbs.length !== 1) return [];
    const db = dbs[0];
    const sources = new Set<string>();
    for (const e of ctx.edges) {
      if (e.target === db.id) sources.add(e.source);
    }
    if (sources.size >= 2) {
      violations.push(
        createViolation(rule.id, 'warning', { nodeIds: [db.id] }),
      );
    }
    return violations;
  },
};

export default rule;
