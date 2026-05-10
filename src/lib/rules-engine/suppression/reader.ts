import type { GraphEdge } from '@/types/graph';
import { type SuppressedRule, SUPPRESSED_RULES_KEY } from './types';

/**
 * Returns the list of suppressed rules on this edge. Returns [] for edges with no data,
 * no suppressions key, or a malformed value.
 */
export function getSuppressedRules(edge: GraphEdge): SuppressedRule[] {
  const raw = edge.data?.[SUPPRESSED_RULES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSuppressedRule);
}

export function isRuleSuppressedOnEdge(edge: GraphEdge, ruleId: string): boolean {
  return getSuppressedRules(edge).some((s) => s.ruleId === ruleId);
}

export function findSuppression(edge: GraphEdge, ruleId: string): SuppressedRule | undefined {
  return getSuppressedRules(edge).find((s) => s.ruleId === ruleId);
}

function isSuppressedRule(v: unknown): v is SuppressedRule {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.ruleId === 'string'
    && typeof o.reason === 'string'
    && typeof o.suppressedAt === 'string';
}
