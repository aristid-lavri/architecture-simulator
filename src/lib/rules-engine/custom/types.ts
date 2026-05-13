// src/lib/rules-engine/custom/types.ts
import type { ComponentType } from '@/types';
import type { RuleSeverity, RuleScope } from '@/lib/rules-engine/core';

export interface NodeMatcher {
  type?: ComponentType | ComponentType[];
  tag?: string | string[];
  owner_team?: string;
  in_zone_type?: 'vpc' | 'dmz' | 'backend';
}

export interface EdgeMatcher {
  source?: NodeMatcher;
  target?: NodeMatcher;
  protocol?: string | string[];
  tag?: string;
}

export type Requirement =
  | { ancestor_zone: NodeMatcher }
  | { metadata_field: string }
  | { protocol_in: string[] }
  | { target_type: ComponentType | ComponentType[] }
  | { tag: string };

export interface CustomRuleDeclaration {
  id: string;
  description: string;
  severity: RuleSeverity;
  scope: RuleScope;
  // graph-scope :
  forall?: { node?: NodeMatcher; edge?: EdgeMatcher };
  require?: Requirement;
  // edge-scope :
  when?: { edge?: EdgeMatcher; node?: NodeMatcher };
  forbid?: EdgeMatcher;
}

export interface CustomRulesDocument {
  rules: CustomRuleDeclaration[];
}

export interface CustomRulesCompileResult {
  ok: boolean;
  rulesCount: number;
  errors: CustomRulesError[];
}

export interface CustomRulesError {
  /** Index in source `rules:` array (or -1 for document-level error). */
  ruleIndex: number;
  /** ruleId if known, else null. */
  ruleId: string | null;
  message: string;
  /** Optional path inside the rule object for fine-grained UI highlight. */
  path?: string;
}

export const CUSTOM_RULES_PACK_ID = 'project-custom' as const;
