// src/lib/rules-engine/custom/parser.ts
import YAML from 'yaml';
import type { CustomRulesDocument } from './types';

export function parseCustomRulesYaml(raw: string): CustomRulesDocument {
  const trimmed = raw.trim();
  if (trimmed === '') return { rules: [] };

  const parsed = YAML.parse(trimmed);
  if (parsed == null) return { rules: [] };

  if (typeof parsed !== 'object') {
    throw new Error('Custom rules YAML must be a mapping with a `rules:` key.');
  }
  const rules = (parsed as Record<string, unknown>).rules;
  if (rules === undefined) return { rules: [] };
  if (!Array.isArray(rules)) {
    throw new Error('`rules` must be an array.');
  }

  // Shape validation is performed by the compiler — parser is structural only.
  return { rules: rules as CustomRulesDocument['rules'] };
}
