import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import type { ComponentType, NetworkZoneNodeData } from '@/types';

/**
 * Detects an edge that crosses from a `public` network-zone into any non-public zone
 * without going through a filter/gateway component (firewall, waf, api-gateway,
 * load-balancer). Such edges represent direct public exposure of a backend service
 * and are a security anti-pattern.
 *
 * The check is purely structural: it does not validate semantics of the firewall config.
 */
const GATEWAYS = new Set<ComponentType>([
  'firewall',
  'waf',
  'api-gateway',
  'load-balancer',
]);

function ancestorZone(
  nodeId: string,
  ctx: Parameters<Rule['evaluate']>[0],
): { id: string; zoneType: string } | null {
  let current = ctx.nodeMap.get(nodeId);
  while (current) {
    if ((current.type as ComponentType) === 'network-zone') {
      const data = current.data as Partial<NetworkZoneNodeData>;
      return { id: current.id, zoneType: data.zoneType ?? 'custom' };
    }
    if (!current.parentId) return null;
    current = ctx.nodeMap.get(current.parentId);
  }
  return null;
}

const rule: Rule = {
  id: 'core-sanity/security/cross-zone-edge-no-gateway',
  packId: 'core-sanity',
  category: 'security',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    for (const e of ctx.edges) {
      const source = ctx.nodeMap.get(e.source);
      const target = ctx.nodeMap.get(e.target);
      if (!source || !target) continue;

      const sourceZone = ancestorZone(source.id, ctx);
      const targetZone = ancestorZone(target.id, ctx);
      if (!sourceZone || !targetZone) continue;
      if (sourceZone.id === targetZone.id) continue;
      // Only flag public→non-public crossings.
      if (sourceZone.zoneType !== 'public') continue;
      if (targetZone.zoneType === 'public') continue;
      // OK if target itself is a gateway
      if (GATEWAYS.has(target.type as ComponentType)) continue;

      violations.push(
        createViolation(rule.id, 'warning', {
          edgeIds: [e.id],
          nodeIds: [source.id, target.id],
        }),
      );
    }
    return violations;
  },
};

export default rule;
