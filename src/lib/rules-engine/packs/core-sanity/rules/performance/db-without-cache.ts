import { type Rule, type RuleViolation, createViolation } from '@/lib/rules-engine/core';
import type { ComponentType } from '@/types';

/**
 * Detects a database that is read by an http-server / api-service when there's no
 * cache anywhere in the graph. Read-heavy paths typically benefit from a cache
 * layer; absence of any cache for a DB-backed service is a perf smell.
 *
 * Heuristic: a database has at least one service-typed upstream (http-server,
 * api-service, serverless, cloud-function) AND the graph contains zero `cache` nodes.
 */
const SERVICE_TYPES = new Set<ComponentType>([
  'http-server',
  'api-service',
  'serverless',
  'cloud-function',
]);

const rule: Rule = {
  id: 'core-sanity/performance/db-without-cache',
  packId: 'core-sanity',
  category: 'performance',
  scope: 'graph',
  severity: 'warning',
  evaluate: (ctx) => {
    const hasCache = ctx.nodes.some((n) => (n.type as ComponentType) === 'cache');
    if (hasCache) return [];
    const violations: RuleViolation[] = [];
    for (const node of ctx.nodes) {
      if ((node.type as ComponentType) !== 'database') continue;
      let hasServiceUpstream = false;
      for (const e of ctx.edges) {
        if (e.target !== node.id) continue;
        const source = ctx.nodeMap.get(e.source);
        if (!source) continue;
        if (SERVICE_TYPES.has(source.type as ComponentType)) {
          hasServiceUpstream = true;
          break;
        }
      }
      if (hasServiceUpstream) {
        violations.push(
          createViolation(rule.id, 'warning', { nodeIds: [node.id] }),
        );
      }
    }
    return violations;
  },
};

export default rule;
