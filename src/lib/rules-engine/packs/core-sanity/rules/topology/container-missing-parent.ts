import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import type { ComponentType } from '@/types';

/**
 * Detects a container node that is not nested in a host-server (or has no parent at all).
 * A bare-floating container has no compute substrate to share CPU/memory with —
 * the hierarchical resource manager cannot reason about it correctly.
 */
const rule: Rule = {
  id: 'core-sanity/topology/container-missing-parent',
  packId: 'core-sanity',
  category: 'topology',
  scope: 'graph',
  severity: 'error',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    for (const node of ctx.nodes) {
      if ((node.type as ComponentType) !== 'container') continue;
      const parentId = node.parentId;
      if (!parentId) {
        violations.push(
          createViolation(rule.id, 'error', { nodeIds: [node.id] }),
        );
        continue;
      }
      const parent = ctx.nodeMap.get(parentId);
      if (!parent || (parent.type as ComponentType) !== 'host-server') {
        violations.push(
          createViolation(rule.id, 'error', { nodeIds: [node.id] }),
        );
      }
    }
    return violations;
  },
};

export default rule;
