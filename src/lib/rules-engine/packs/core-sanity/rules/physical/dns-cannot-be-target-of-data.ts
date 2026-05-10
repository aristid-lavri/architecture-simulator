import { type Rule, createViolation } from '@/lib/rules-engine/core';
import { INFRA_PASSIVE_TYPES, resolveEdgeTypes } from '@/lib/rules-engine/helpers';

/**
 * Phase 1 heuristic: DNS should never be a target of "data" traffic.
 * We use INFRA_PASSIVE_TYPES as a rough proxy — if the source is itself
 * passive infra (DNS, service-discovery, IdP), the edge is allowed; any
 * other source initiating an edge to DNS is flagged.
 */
const rule: Rule = {
  id: 'core-sanity/physical/dns-cannot-be-target-of-data',
  packId: 'core-sanity',
  category: 'physical',
  scope: 'edge',
  severity: 'error',
  evaluate: (ctx) => {
    const types = resolveEdgeTypes(ctx);
    if (!types) return [];
    if (types.targetType !== 'dns') return [];
    if (INFRA_PASSIVE_TYPES.has(types.sourceType)) return [];
    return [
      createViolation(rule.id, 'error', {
        edgeIds: ctx.draftEdge ? [ctx.draftEdge.id] : undefined,
        nodeIds: [ctx.draftEdge!.source, ctx.draftEdge!.target],
      }),
    ];
  },
};

export default rule;
