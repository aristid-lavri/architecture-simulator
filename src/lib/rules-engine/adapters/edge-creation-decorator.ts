import { evaluateOnEdgeCreation } from '@/lib/rules-engine/evaluation';
import type { EdgeCreationDecorator } from '@/plugins/extensions/edge-creation';
import type { GraphNode, GraphEdge } from '@/types/graph';

/**
 * Edge-creation decorator that consults the rules engine.
 *  - If at least one ERROR violation fires : return EdgeRejection (blocks the edge, surfaces a toast).
 *  - Otherwise : enrich edge.data with `pendingViolations` (the WARNING entries) for downstream UI badge rendering.
 *
 * Requires the consumer to provide the current nodes + edges via the EdgeCreationContext.
 * The context is enriched in the host wiring (see PixiCanvas / bootstrap) to expose `getNodes()` / `getEdges()`.
 *
 * For Phase 1, since the existing EdgeCreationContext only carries `projectMeta`, we add the helpers
 * via a thin extension contract (duck-typed). When the helpers are absent, the decorator fails open.
 */
export const coreRulesDecorator: EdgeCreationDecorator = (draftEdge, ctx) => {
  const enriched = ctx as {
    projectMeta: unknown;
    getNodes?: () => GraphNode[];
    getEdges?: () => GraphEdge[];
  };

  if (!enriched.getNodes || !enriched.getEdges) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[coreRulesDecorator] EdgeCreationContext missing getNodes/getEdges, skipping rules',
      );
    }
    return draftEdge.data ?? null;
  }

  const nodes = enriched.getNodes();
  const edges = enriched.getEdges();
  const { blocking, warnings } = evaluateOnEdgeCreation(draftEdge, nodes, edges);

  if (blocking.length > 0) {
    const first = blocking[0];
    return {
      reject: true,
      messageKey: first.messageKey,
      ...(first.messageParams !== undefined ? { params: first.messageParams } : {}),
    };
  }

  if (warnings.length > 0) {
    return {
      ...(draftEdge.data ?? {}),
      pendingViolations: warnings.map((v) => ({
        ruleId: v.ruleId,
        severity: v.severity,
        messageKey: v.messageKey,
        messageParams: v.messageParams,
      })),
    };
  }

  return draftEdge.data ?? null;
};
