// __tests__/integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { applyCustomRulesPack, clearCustomRulesPack } from '../index';
import { ruleRegistry } from '@/lib/rules-engine/core';
import { evaluateGraph } from '@/lib/rules-engine/evaluation';
import type { GraphNode } from '@/types/graph';

describe('applyCustomRulesPack', () => {
  beforeEach(() => {
    ruleRegistry.clear();
  });

  it('registers a pack from valid YAML', () => {
    const yaml = `
rules:
  - id: my/db-tag
    description: dbs need a tag
    severity: warning
    scope: graph
    forall: { node: { type: database } }
    require: { tag: db }
`;
    const out = applyCustomRulesPack(yaml);
    expect(out.ok).toBe(true);
    expect(out.rulesCount).toBe(1);

    const db: GraphNode = { id: 'd', type: 'database', position: { x: 0, y: 0 }, data: {} };
    const violations = evaluateGraph([db], []);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('my/db-tag');
  });

  it('re-applying replaces the previous pack (idempotent)', () => {
    applyCustomRulesPack(`
rules:
  - id: my/a
    description: ''
    severity: warning
    scope: graph
    forall: { node: { type: database } }
    require: { tag: x }
`);
    applyCustomRulesPack(`
rules:
  - id: my/b
    description: ''
    severity: error
    scope: graph
    forall: { node: { type: cache } }
    require: { tag: y }
`);
    const allIds = ruleRegistry.allRules().map((r) => r.id);
    expect(allIds).toEqual(['my/b']);
  });

  it('returns errors and leaves registry unchanged on bad input', () => {
    applyCustomRulesPack(`
rules:
  - id: my/a
    description: ''
    severity: warning
    scope: graph
    forall: { node: {} }
    require: { tag: x }
`);
    const out = applyCustomRulesPack(`
rules:
  - id: my/a
    description: ''
    severity: warning
    scope: edge
`); // missing forbid/when
    expect(out.ok).toBe(false);
    expect(out.errors.length).toBeGreaterThan(0);
    // previous pack still present
    expect(ruleRegistry.allRules().map((r) => r.id)).toEqual(['my/a']);
  });

  it('clearCustomRulesPack removes it', () => {
    applyCustomRulesPack(`
rules:
  - id: my/a
    description: ''
    severity: warning
    scope: graph
    forall: { node: {} }
    require: { tag: x }
`);
    clearCustomRulesPack();
    expect(ruleRegistry.allRules()).toHaveLength(0);
  });

  it('empty YAML clears the pack without errors', () => {
    applyCustomRulesPack(`
rules:
  - id: my/a
    description: ''
    severity: warning
    scope: graph
    forall: { node: {} }
    require: { tag: x }
`);
    const out = applyCustomRulesPack('');
    expect(out.ok).toBe(true);
    expect(out.rulesCount).toBe(0);
    expect(ruleRegistry.allRules()).toHaveLength(0);
  });
});
