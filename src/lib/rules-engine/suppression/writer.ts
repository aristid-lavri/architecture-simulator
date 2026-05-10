import type { GraphEdge } from '@/types/graph';
import { type SuppressedRule, SUPPRESSED_RULES_KEY } from './types';
import { getSuppressedRules } from './reader';

/**
 * Adds (or replaces) a suppression for the given ruleId on this edge.
 * Returns a new edge object — never mutates the input.
 * Throws if `reason` is empty after trim.
 */
export function addSuppression(
  edge: GraphEdge,
  ruleId: string,
  reason: string,
  now: () => Date = () => new Date(),
): GraphEdge {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new Error('[suppression.addSuppression] reason cannot be empty');
  }
  const next: SuppressedRule = {
    ruleId,
    reason: trimmed,
    suppressedAt: now().toISOString(),
  };
  const existing = getSuppressedRules(edge).filter((s) => s.ruleId !== ruleId);
  const updated = [...existing, next];
  return {
    ...edge,
    data: { ...(edge.data ?? {}), [SUPPRESSED_RULES_KEY]: updated },
  };
}

/**
 * Removes the suppression for the given ruleId on this edge, if present.
 * Returns a new edge object — never mutates the input. No-op if not suppressed.
 */
export function removeSuppression(edge: GraphEdge, ruleId: string): GraphEdge {
  const updated = getSuppressedRules(edge).filter((s) => s.ruleId !== ruleId);
  return {
    ...edge,
    data: { ...(edge.data ?? {}), [SUPPRESSED_RULES_KEY]: updated },
  };
}
