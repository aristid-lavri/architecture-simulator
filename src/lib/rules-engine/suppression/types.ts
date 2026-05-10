export interface SuppressedRule {
  ruleId: string;
  reason: string;       // mandatory non-empty (the writer enforces this)
  suppressedAt: string; // ISO 8601 date
}

/** The key used inside edge.data to store the array of suppressions. */
export const SUPPRESSED_RULES_KEY = 'suppressedRules' as const;
