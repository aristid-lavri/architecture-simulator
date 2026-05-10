import type { RuleViolation } from '@/lib/rules-engine/core';
import type { ValidationIssue } from '@/lib/simulation-validator';

/**
 * Maps a RuleViolation (from the rules engine) to a ValidationIssue (consumed by ValidationPanel).
 *
 * - id : derived from ruleId + first edgeId (or first nodeId, or counter) for stability across re-renders
 * - severity : 1:1 (rules engine has no 'info' in Phase 1)
 * - category : always 'rule'
 * - edgeIds / nodeIds : copied 1:1 when present
 */
export function ruleViolationToValidationIssue(
  v: RuleViolation,
  index: number,
): ValidationIssue {
  const anchor = v.edgeIds?.[0] ?? v.nodeIds?.[0] ?? `i${index}`;
  const issue: ValidationIssue = {
    id: `rule-${v.ruleId}-${anchor}`,
    severity: v.severity,
    category: 'rule',
    messageKey: v.messageKey,
    ruleId: v.ruleId,
  };
  if (v.messageParams !== undefined) issue.messageParams = v.messageParams;
  if (v.nodeIds !== undefined) issue.nodeIds = v.nodeIds;
  if (v.edgeIds !== undefined) issue.edgeIds = v.edgeIds;
  return issue;
}

/**
 * Convenience batch mapper. Indexes are passed through to keep id generation stable
 * for violations that have neither edgeIds nor nodeIds.
 */
export function ruleViolationsToValidationIssues(
  violations: RuleViolation[],
): ValidationIssue[] {
  return violations.map(ruleViolationToValidationIssue);
}
