import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import type { ComponentType } from '@/types';
import { CONTAINER_TYPES } from '@/types';

/**
 * Detects nodes with zero edges (incoming + outgoing).
 *
 * Excluded:
 *  - Container-like types (network-zone, host-server, container) — they don't need edges.
 *  - Passive infra (dns, service-discovery, identity-provider) — they can sit unattached as
 *    discoverable infrastructure even if no edge is drawn yet.
 *  - circuit-breaker — already handled by orphan-circuit-breaker.
 */
const EXEMPT = new Set<ComponentType>([
  ...CONTAINER_TYPES,
  'dns',
  'service-discovery',
  'identity-provider',
  'circuit-breaker',
]);

const rule: Rule = {
  id: 'core-sanity/topology/orphan-node',
  packId: 'core-sanity',
  category: 'topology',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    const degree = new Map<string, number>();
    for (const e of ctx.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    for (const node of ctx.nodes) {
      const type = node.type as ComponentType;
      if (EXEMPT.has(type)) continue;
      if ((degree.get(node.id) ?? 0) === 0) {
        violations.push(
          createViolation(rule.id, 'warning', { nodeIds: [node.id] }),
        );
      }
    }
    return violations;
  },
};

export default rule;
