import type { RuleSeverity } from './types';

export interface RuleViolation {
  ruleId: string;
  severity: RuleSeverity;
  /** i18n key in dot notation, e.g. 'rules.core-sanity.physical.db-cannot-initiate.message' */
  messageKey: string;
  messageParams?: Record<string, string | number>;
  /** edge IDs concerned (typically 1 for edge-scope, possibly many for graph-scope) */
  edgeIds?: string[];
  /** node IDs concerned (typically source+target for edge-scope) */
  nodeIds?: string[];
}

/** i18n path prefix for a ruleId (no suffix). E.g. 'core-sanity/physical/db-cannot-initiate' → 'rules.core-sanity.physical.db-cannot-initiate'. */
export function ruleIdToI18nPath(ruleId: string): string {
  return `rules.${ruleId.replaceAll('/', '.')}`;
}

/** i18n key for a ruleId, with an optional suffix (default 'message'). Use 'short' for the menu/badge label. */
export function ruleIdToI18nKey(ruleId: string, suffix: 'message' | 'short' = 'message'): string {
  return `${ruleIdToI18nPath(ruleId)}.${suffix}`;
}

export function createViolation(
  ruleId: string,
  severity: RuleSeverity,
  opts: {
    messageKey?: string;
    messageParams?: Record<string, string | number>;
    edgeIds?: string[];
    nodeIds?: string[];
  } = {},
): RuleViolation {
  return {
    ruleId,
    severity,
    messageKey: opts.messageKey ?? ruleIdToI18nKey(ruleId),
    messageParams: opts.messageParams,
    edgeIds: opts.edgeIds,
    nodeIds: opts.nodeIds,
  };
}
