// Core types & primitives
export type {
  RuleSeverity,
  RuleScope,
  Rule,
  RulePack,
  RuleViolation,
  RuleContext,
} from './core';
export { createViolation, buildContext, ruleRegistry, ruleIdToI18nKey, ruleIdToI18nPath } from './core';

// Evaluation orchestrators
export { evaluateOnEdgeCreation, evaluateGraph, filterSuppressedViolations } from './evaluation';
export type { EdgeEvaluationResult } from './evaluation';

// Suppression sub-domain
export type { SuppressedRule } from './suppression';
export {
  getSuppressedRules,
  isRuleSuppressedOnEdge,
  findSuppression,
  addSuppression,
  removeSuppression,
  SUPPRESSED_RULES_KEY,
} from './suppression';

// Adapters (bridges to host app)
export {
  ruleViolationToValidationIssue,
  ruleViolationsToValidationIssues,
  coreRulesDecorator,
} from './adapters';

// Bootstrap helper (call once at app init to register the default pack + decorator)
export { registerCoreRulesEngine } from './bootstrap';
