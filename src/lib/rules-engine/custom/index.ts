// src/lib/rules-engine/custom/index.ts
import { ruleRegistry } from '@/lib/rules-engine/core';
import { parseCustomRulesYaml } from './parser';
import { compileCustomRules } from './compiler';
import { CUSTOM_RULES_PACK_ID, type CustomRulesCompileResult } from './types';

export * from './types';
export { parseCustomRulesYaml } from './parser';
export { compileCustomRules } from './compiler';
export { matchNode, matchEdge, getAncestorZone, getDottedField } from './matchers';

export interface ApplyResult extends CustomRulesCompileResult {
  /** True if a parse error or compile error occurred. registry is left unchanged in that case. */
  parseError?: string;
}

/**
 * Parses the YAML and (only if successful and all rules valid) replaces the
 * `project-custom` pack in the registry. On failure, leaves the registry untouched
 * and returns the list of errors for the UI to show inline.
 *
 * Empty/whitespace input → clears the pack (no errors).
 */
export function applyCustomRulesPack(yaml: string): ApplyResult {
  let doc;
  try {
    doc = parseCustomRulesYaml(yaml);
  } catch (e) {
    return {
      ok: false,
      rulesCount: 0,
      errors: [
        { ruleIndex: -1, ruleId: null, message: e instanceof Error ? e.message : 'YAML parse error.' },
      ],
      parseError: e instanceof Error ? e.message : 'YAML parse error.',
    };
  }

  if (doc.rules.length === 0) {
    ruleRegistry.unregisterPack(CUSTOM_RULES_PACK_ID);
    return { ok: true, rulesCount: 0, errors: [] };
  }

  const { pack, result } = compileCustomRules(doc);
  if (!result.ok) return result;

  ruleRegistry.unregisterPack(CUSTOM_RULES_PACK_ID);
  ruleRegistry.registerPack(pack);
  return result;
}

export function clearCustomRulesPack(): void {
  ruleRegistry.unregisterPack(CUSTOM_RULES_PACK_ID);
}
