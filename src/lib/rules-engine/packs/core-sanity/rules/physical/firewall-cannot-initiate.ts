import { type Rule, createViolation } from '@/lib/rules-engine/core';
import { resolveEdgeTypes } from '@/lib/rules-engine/helpers';

const rule: Rule = {
  id: 'core-sanity/physical/firewall-cannot-initiate',
  packId: 'core-sanity',
  category: 'physical',
  scope: 'edge',
  severity: 'error',
  evaluate: (ctx) => {
    const types = resolveEdgeTypes(ctx);
    if (!types) return [];
    if (types.sourceType !== 'firewall' && types.sourceType !== 'waf') return [];
    return [
      createViolation(rule.id, 'error', {
        edgeIds: ctx.draftEdge ? [ctx.draftEdge.id] : undefined,
        nodeIds: [ctx.draftEdge!.source, ctx.draftEdge!.target],
      }),
    ];
  },
};

export default rule;
