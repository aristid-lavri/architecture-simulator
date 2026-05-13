import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import { isClient } from '@/lib/rules-engine/helpers';
import type { ComponentType } from '@/types';

/**
 * Detects a database that receives traffic directly from a client (http-client or
 * client-group) — i.e. exposed publicly without any API/service layer in front.
 *
 * Severity: error. This is a top-tier security and architectural smell.
 *
 * Note: `routing/client-direct-to-db` is the edge-scope warning fired AT creation time
 * with severity warning. THIS rule is graph-scope and severity error : it blocks the
 * simulation from starting (since errors are blocking per A6.4).
 */
const rule: Rule = {
  id: 'core-sanity/exposure/db-exposed-publicly',
  packId: 'core-sanity',
  category: 'exposure',
  scope: 'graph',
  severity: 'error',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    for (const e of ctx.edges) {
      const source = ctx.nodeMap.get(e.source);
      const target = ctx.nodeMap.get(e.target);
      if (!source || !target) continue;
      if ((target.type as ComponentType) !== 'database') continue;
      if (!isClient(source.type as ComponentType)) continue;
      violations.push(
        createViolation(rule.id, 'error', {
          edgeIds: [e.id],
          nodeIds: [source.id, target.id],
        }),
      );
    }
    return violations;
  },
};

export default rule;
