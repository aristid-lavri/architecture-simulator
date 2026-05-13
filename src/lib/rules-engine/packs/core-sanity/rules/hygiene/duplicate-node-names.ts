import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';

/**
 * Detects two or more nodes sharing the same non-empty label. Duplicate labels make
 * the architecture diagram ambiguous and confuse log/trace correlation.
 *
 * Emits one violation per duplicate cluster, listing all node IDs that share the label.
 */
const rule: Rule = {
  id: 'core-sanity/hygiene/duplicate-node-names',
  packId: 'core-sanity',
  category: 'hygiene',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const byLabel = new Map<string, string[]>();
    for (const node of ctx.nodes) {
      const label = (node.data as { label?: string })?.label;
      if (!label || !label.trim()) continue;
      const key = label.trim().toLowerCase();
      let arr = byLabel.get(key);
      if (!arr) { arr = []; byLabel.set(key, arr); }
      arr.push(node.id);
    }
    const violations: RuleViolation[] = [];
    for (const [, ids] of byLabel) {
      if (ids.length < 2) continue;
      violations.push(
        createViolation(rule.id, 'warning', { nodeIds: ids }),
      );
    }
    return violations;
  },
};

export default rule;
