import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import type { ComponentType } from '@/types';

/**
 * Detects a message-queue with at least one producer (incoming edge) but no consumer
 * (no outgoing edge). Messages would pile up forever — likely an unfinished design.
 */
const rule: Rule = {
  id: 'core-sanity/topology/mq-no-consumer',
  packId: 'core-sanity',
  category: 'topology',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    for (const node of ctx.nodes) {
      if ((node.type as ComponentType) !== 'message-queue') continue;
      let producers = 0;
      let consumers = 0;
      for (const e of ctx.edges) {
        if (e.target === node.id) producers++;
        if (e.source === node.id) consumers++;
      }
      if (producers > 0 && consumers === 0) {
        violations.push(
          createViolation(rule.id, 'warning', { nodeIds: [node.id] }),
        );
      }
    }
    return violations;
  },
};

export default rule;
