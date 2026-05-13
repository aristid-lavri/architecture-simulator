import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import { isClient, isServer } from '@/lib/rules-engine/helpers';
import type { ComponentType } from '@/types';

/**
 * Detects an edge that connects two application-layer endpoints (client/service)
 * but carries no protocol annotation (e.g. rest/grpc/graphql/websocket).
 *
 * We avoid flagging infrastructure-only edges (lb→server, firewall→server, etc.)
 * to keep noise low: requirement applies between clients and services only.
 */
function isAppEndpoint(t: ComponentType): boolean {
  return isClient(t) || isServer(t);
}

const rule: Rule = {
  id: 'core-sanity/hygiene/edge-no-protocol',
  packId: 'core-sanity',
  category: 'hygiene',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    for (const e of ctx.edges) {
      const source = ctx.nodeMap.get(e.source);
      const target = ctx.nodeMap.get(e.target);
      if (!source || !target) continue;
      if (!isAppEndpoint(source.type as ComponentType)) continue;
      if (!isAppEndpoint(target.type as ComponentType)) continue;
      const protocol = (e.data as { protocol?: string } | undefined)?.protocol;
      if (!protocol || !String(protocol).trim()) {
        violations.push(
          createViolation(rule.id, 'warning', {
            edgeIds: [e.id],
            nodeIds: [source.id, target.id],
          }),
        );
      }
    }
    return violations;
  },
};

export default rule;
