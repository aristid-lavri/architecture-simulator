import type { OwaspGraph, OwaspRule, OwaspSeverity, OwaspValidationResult } from './types';
import { ALL_RULES } from './rules';

/**
 * Lance toutes les règles fournies sur le graphe et agrège les résultats.
 * @param graph snapshot des nodes/edges
 * @param rules sous-ensemble de règles à appliquer (par défaut: toutes)
 */
export function runOwaspValidation(
  graph: OwaspGraph,
  rules: ReadonlyArray<OwaspRule> = ALL_RULES
): OwaspValidationResult {
  const violations = rules.flatMap((r) => r.validate(graph));
  const failedRuleIds = new Set(violations.map((v) => v.ruleId));
  const bySeverity: Record<OwaspSeverity, number> = {
    CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0,
  };
  for (const v of violations) {
    const rule = rules.find((r) => r.id === v.ruleId);
    if (rule) bySeverity[rule.severity]++;
  }
  return {
    totalRules: rules.length,
    passedRules: rules.length - failedRuleIds.size,
    failedRules: failedRuleIds.size,
    violations,
    bySeverity,
    evaluatedAt: Date.now(),
  };
}
