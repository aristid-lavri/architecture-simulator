import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';

/**
 * Detects two-or-more edges with the same source + target + protocol. Likely a
 * diagram artifact (user clicked twice on the handle) rather than a real second
 * connection.
 */
const rule: Rule = {
  id: 'core-sanity/hygiene/duplicate-edge',
  packId: 'core-sanity',
  category: 'hygiene',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    const buckets = new Map<string, string[]>();
    for (const e of ctx.edges) {
      const protocol = (e.data as { protocol?: string } | undefined)?.protocol ?? '';
      const key = `${e.source}|${e.target}|${protocol}`;
      let arr = buckets.get(key);
      if (!arr) { arr = []; buckets.set(key, arr); }
      arr.push(e.id);
    }
    for (const [, ids] of buckets) {
      if (ids.length < 2) continue;
      violations.push(
        createViolation(rule.id, 'warning', { edgeIds: ids }),
      );
    }
    return violations;
  },
};

export default rule;
