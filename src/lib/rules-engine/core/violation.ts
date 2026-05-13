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

/**
 * i18n key for a ruleId, with an optional suffix (default 'message').
 *
 * Suffix conventions :
 *  - 'message'      — long-form sentence shown in the validation panel (default).
 *  - 'short'        — concise label for menus / badges.
 *  - 'title'        — short heading for the new blocking-dialog (A6.4).
 *  - 'description'  — detailed explanation in the blocking-dialog.
 *  - 'suggestion'   — actionable hint shown to the user to fix the violation.
 */
export function ruleIdToI18nKey(
  ruleId: string,
  suffix: 'message' | 'short' | 'title' | 'description' | 'suggestion' = 'message',
): string {
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
