import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import { isClient } from '@/lib/rules-engine/helpers';
import type { ComponentType } from '@/types';

/**
 * Detects a cache (Redis/Memcached) exposed directly to a client without any
 * service in front. While slightly less critical than a DB, a public cache
 * leaks data and accepts arbitrary writes. Severity: error.
 */
const rule: Rule = {
  id: 'core-sanity/exposure/cache-exposed-publicly',
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
      if ((target.type as ComponentType) !== 'cache') continue;
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
