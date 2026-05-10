import { type Rule, createViolation } from '@/lib/rules-engine/core';
import { resolveEdgeTypes } from '@/lib/rules-engine/helpers';

const rule: Rule = {
  id: 'core-sanity/routing/lb-targets-lb',
  packId: 'core-sanity',
  category: 'routing',
  scope: 'edge',
  severity: 'warning',
  evaluate: (ctx) => {
    const types = resolveEdgeTypes(ctx);
    if (!types) return [];
    if (types.sourceType !== 'load-balancer' || types.targetType !== 'load-balancer') {
      return [];
    }
    return [
      createViolation(rule.id, 'warning', {
        edgeIds: ctx.draftEdge ? [ctx.draftEdge.id] : undefined,
        nodeIds: [ctx.draftEdge!.source, ctx.draftEdge!.target],
      }),
    ];
  },
};

export default rule;
