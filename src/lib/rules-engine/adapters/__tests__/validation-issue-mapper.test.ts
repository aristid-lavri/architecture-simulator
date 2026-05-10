import { describe, expect, it } from 'vitest';
import { createViolation, type RuleViolation } from '@/lib/rules-engine/core';
import {
  ruleViolationToValidationIssue,
  ruleViolationsToValidationIssues,
} from '../validation-issue-mapper';

describe('ruleViolationToValidationIssue', () => {
  it('maps severity 1:1 (error)', () => {
    const v = createViolation('p/c/r', 'error', { edgeIds: ['e1'] });
    const issue = ruleViolationToValidationIssue(v, 0);
    expect(issue.severity).toBe('error');
  });

  it('maps severity 1:1 (warning)', () => {
    const v = createViolation('p/c/r', 'warning', { edgeIds: ['e1'] });
    const issue = ruleViolationToValidationIssue(v, 0);
    expect(issue.severity).toBe('warning');
  });

  it("always emits category: 'rule'", () => {
    const v = createViolation('p/c/r', 'error', { edgeIds: ['e1'] });
    const issue = ruleViolationToValidationIssue(v, 0);
    expect(issue.category).toBe('rule');
  });

  it('builds id from ruleId + first edgeId when present', () => {
    const v = createViolation('pack/cat/rule-x', 'error', {
      edgeIds: ['edge-42', 'edge-99'],
    });
    const issue = ruleViolationToValidationIssue(v, 7);
    expect(issue.id).toBe('rule-pack/cat/rule-x-edge-42');
  });

  it('builds id from ruleId + first nodeId when no edgeIds', () => {
    const v = createViolation('pack/cat/rule-y', 'warning', {
      nodeIds: ['node-1', 'node-2'],
    });
    const issue = ruleViolationToValidationIssue(v, 3);
    expect(issue.id).toBe('rule-pack/cat/rule-y-node-1');
  });

  it('falls back to index-based anchor when no edgeIds and no nodeIds', () => {
    const v = createViolation('pack/cat/rule-z', 'warning');
    const issue = ruleViolationToValidationIssue(v, 5);
    expect(issue.id).toBe('rule-pack/cat/rule-z-i5');
  });

  it('preserves messageKey, messageParams, nodeIds and edgeIds', () => {
    const v: RuleViolation = {
      ruleId: 'p/c/r',
      severity: 'warning',
      messageKey: 'rules.foo.bar.message',
      messageParams: { x: 1, name: 'lb' },
      edgeIds: ['e1', 'e2'],
      nodeIds: ['n1'],
    };
    const issue = ruleViolationToValidationIssue(v, 0);
    expect(issue.messageKey).toBe('rules.foo.bar.message');
    expect(issue.messageParams).toEqual({ x: 1, name: 'lb' });
    expect(issue.nodeIds).toEqual(['n1']);
    expect(issue.edgeIds).toEqual(['e1', 'e2']);
  });

  it('omits messageParams when violation has none', () => {
    const v = createViolation('p/c/r', 'warning', { edgeIds: ['e1'] });
    const issue = ruleViolationToValidationIssue(v, 0);
    expect(issue.messageParams).toBeUndefined();
  });

  it('omits nodeIds and edgeIds when not present', () => {
    const v = createViolation('p/c/r', 'warning');
    const issue = ruleViolationToValidationIssue(v, 0);
    expect(issue.nodeIds).toBeUndefined();
    expect(issue.edgeIds).toBeUndefined();
  });
});

describe('ruleViolationsToValidationIssues', () => {
  it('maps a list keeping order and indexes', () => {
    const violations: RuleViolation[] = [
      createViolation('p/c/a', 'error', { edgeIds: ['e1'] }),
      createViolation('p/c/b', 'warning'),
      createViolation('p/c/c', 'error', { nodeIds: ['n1'] }),
    ];
    const issues = ruleViolationsToValidationIssues(violations);
    expect(issues).toHaveLength(3);
    expect(issues[0].id).toBe('rule-p/c/a-e1');
    expect(issues[1].id).toBe('rule-p/c/b-i1');
    expect(issues[2].id).toBe('rule-p/c/c-n1');
  });

  it('returns an empty list for an empty input', () => {
    expect(ruleViolationsToValidationIssues([])).toEqual([]);
  });
});
