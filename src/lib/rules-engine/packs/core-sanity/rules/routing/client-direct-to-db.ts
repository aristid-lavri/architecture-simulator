import { type Rule, createViolation } from '@/lib/rules-engine/core';
import { CLIENT_TYPES, resolveEdgeTypes } from '@/lib/rules-engine/helpers';

const rule: Rule = {
  id: 'core-sanity/routing/client-direct-to-db',
  packId: 'core-sanity',
  category: 'routing',
  scope: 'edge',
  severity: 'warning',
  evaluate: (ctx) => {
    const types = resolveEdgeTypes(ctx);
    if (!types) return [];
    if (!CLIENT_TYPES.has(types.sourceType) || types.targetType !== 'database') {
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
