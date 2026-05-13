import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import type { ComponentType, NetworkZoneNodeData } from '@/types';

/**
 * Detects an http-server / api-service / serverless / cloud-function located in a
 * `public` or `dmz` zone that is reachable from clients without ever passing through
 * an identity-provider in the graph.
 *
 * Heuristic: if there is NO `identity-provider` node anywhere in the graph AND the
 * service is in a public/dmz zone AND it has at least one incoming edge whose chain
 * eventually originates from a client → warn. We use a simple structural check
 * (existence of any identity-provider in the graph) to avoid expensive path-reachability.
 */
const PUBLICLY_REACHABLE_ZONES = new Set(['public', 'dmz']);
const APPLICATION_SERVICES = new Set<ComponentType>([
  'http-server',
  'api-service',
  'serverless',
  'cloud-function',
]);

function ancestorZoneType(
  nodeId: string,
  ctx: Parameters<Rule['evaluate']>[0],
): string | null {
  let current = ctx.nodeMap.get(nodeId);
  while (current) {
    if ((current.type as ComponentType) === 'network-zone') {
      const data = current.data as Partial<NetworkZoneNodeData>;
      return data.zoneType ?? 'custom';
    }
    if (!current.parentId) return null;
    current = ctx.nodeMap.get(current.parentId);
  }
  return null;
}

const rule: Rule = {
  id: 'core-sanity/security/public-service-no-auth',
  packId: 'core-sanity',
  category: 'security',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const hasIdP = ctx.nodes.some((n) => (n.type as ComponentType) === 'identity-provider');
    if (hasIdP) return [];
    const violations: RuleViolation[] = [];
    for (const node of ctx.nodes) {
      if (!APPLICATION_SERVICES.has(node.type as ComponentType)) continue;
      const zoneType = ancestorZoneType(node.id, ctx);
      if (!zoneType || !PUBLICLY_REACHABLE_ZONES.has(zoneType)) continue;
      let hasIncoming = false;
      for (const e of ctx.edges) {
        if (e.target === node.id) { hasIncoming = true; break; }
      }
      if (hasIncoming) {
        violations.push(
          createViolation(rule.id, 'warning', { nodeIds: [node.id] }),
        );
      }
    }
    return violations;
  },
};

export default rule;
