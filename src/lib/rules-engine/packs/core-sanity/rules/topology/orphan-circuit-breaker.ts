import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';

const rule: Rule = {
  id: 'core-sanity/topology/orphan-circuit-breaker',
  packId: 'core-sanity',
  category: 'topology',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    for (const node of ctx.nodes) {
      if (node.type !== 'circuit-breaker') continue;
      let degree = 0;
      for (const e of ctx.edges) {
        if (e.source === node.id || e.target === node.id) degree++;
      }
      if (degree === 1) {
        violations.push(
          createViolation(rule.id, 'warning', { nodeIds: [node.id] }),
        );
      }
    }
    return violations;
  },
};

export default rule;
