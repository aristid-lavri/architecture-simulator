import type { RuleViolation } from './violation';
import type { RuleContext } from './context';

export type RuleSeverity = 'error' | 'warning';
export type RuleScope = 'edge' | 'graph';

export interface Rule {
  /** Format obligatoire : `<packId>/<category>/<rule-name>`, e.g. 'core-sanity/physical/db-cannot-initiate' */
  id: string;
  scope: RuleScope;
  severity: RuleSeverity;
  /** Sub-category within the pack, e.g. 'physical' | 'routing' | 'topology' */
  category: string;
  /** Pack this rule belongs to (denormalized for fast filtering) */
  packId: string;
  evaluate: (ctx: RuleContext) => RuleViolation[];
}

export interface RulePack {
  id: string;
  rules: Rule[];
}
