// __tests__/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseCustomRulesYaml } from '../parser';

describe('parseCustomRulesYaml', () => {
  it('parses empty/whitespace-only as empty document', () => {
    expect(parseCustomRulesYaml('').rules).toEqual([]);
    expect(parseCustomRulesYaml('   \n  ').rules).toEqual([]);
  });

  it('parses valid YAML with one rule', () => {
    const yaml = `
rules:
  - id: my/r1
    description: test
    severity: error
    scope: edge
    forbid:
      source: { type: cache }
      target: { type: http-client }
`;
    const doc = parseCustomRulesYaml(yaml);
    expect(doc.rules).toHaveLength(1);
    expect(doc.rules[0].id).toBe('my/r1');
    expect(doc.rules[0].forbid?.source?.type).toBe('cache');
  });

  it('throws on malformed YAML', () => {
    expect(() => parseCustomRulesYaml('rules: [\n  - id:')).toThrow();
  });

  it('throws when top-level rules is not an array', () => {
    expect(() => parseCustomRulesYaml('rules: not-an-array')).toThrow(/rules.*must be an array/i);
  });
});
