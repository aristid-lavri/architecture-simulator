import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import type { ComponentType } from '@/types';

/**
 * Detects two-or-more client-groups directly targeting the same http-server with no
 * CDN or load-balancer between them. Indicates a likely missing edge caching layer
 * for a high-traffic frontend path.
 */
const rule: Rule = {
  id: 'core-sanity/performance/no-cdn-multi-clients',
  packId: 'core-sanity',
  category: 'performance',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const violations: RuleViolation[] = [];
    // Map<serverId, Set<clientGroupSourceId>> for direct client-group → http-server edges.
    const byServer = new Map<string, Set<string>>();
    for (const e of ctx.edges) {
      const source = ctx.nodeMap.get(e.source);
      const target = ctx.nodeMap.get(e.target);
      if (!source || !target) continue;
      if ((source.type as ComponentType) !== 'client-group') continue;
      if ((target.type as ComponentType) !== 'http-server') continue;
      let set = byServer.get(target.id);
      if (!set) { set = new Set(); byServer.set(target.id, set); }
      set.add(source.id);
    }
    // Look at the graph: if there's NO cdn in graph at all, warn for every server hit by 2+ groups.
    const hasCdn = ctx.nodes.some((n) => (n.type as ComponentType) === 'cdn');
    if (hasCdn) return [];
    for (const [serverId, sources] of byServer) {
      if (sources.size >= 2) {
        violations.push(
          createViolation(rule.id, 'warning', { nodeIds: [serverId] }),
        );
      }
    }
    return violations;
  },
};

export default rule;
