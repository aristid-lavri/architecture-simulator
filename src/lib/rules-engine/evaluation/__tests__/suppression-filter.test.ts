import { describe, expect, it } from 'vitest';
import type { GraphEdge } from '@/types/graph';
import {
  type RuleViolation,
  createViolation,
} from '@/lib/rules-engine/core';
import { SUPPRESSED_RULES_KEY } from '@/lib/rules-engine/suppression';
import { filterSuppressedViolations } from '../suppression-filter';

function makeEdge(id: string, suppressedRuleIds: string[] = []): GraphEdge {
  const data: Record<string, unknown> = {};
  if (suppressedRuleIds.length > 0) {
    data[SUPPRESSED_RULES_KEY] = suppressedRuleIds.map((ruleId) => ({
      ruleId,
      reason: 'test',
      suppressedAt: '2026-01-01T00:00:00.000Z',
    }));
  }
  return {
    id,
    source: 's',
    target: 't',
    data,
  };
}

describe('filterSuppressedViolations', () => {
  it('returns [] for an empty violation list', () => {
    expect(filterSuppressedViolations([], [])).toEqual([]);
    expect(filterSuppressedViolations([], [makeEdge('e1')])).toEqual([]);
  });

  it('never filters violations with no edgeIds', () => {
    const v: RuleViolation = createViolation('p/c/r1', 'error', {
      nodeIds: ['n1'],
    });
    const edges = [makeEdge('e1', ['p/c/r1'])]; // even with suppression matching ruleId
    expect(filterSuppressedViolations([v], edges)).toEqual([v]);
  });

  it('never filters violations with empty edgeIds array', () => {
    const v: RuleViolation = createViolation('p/c/r1', 'error', {
      edgeIds: [],
    });
    const edges = [makeEdge('e1', ['p/c/r1'])];
    expect(filterSuppressedViolations([v], edges)).toEqual([v]);
  });

  it('filters out a violation whose edgeId has the rule suppressed', () => {
    const v: RuleViolation = createViolation('p/c/r1', 'error', {
      edgeIds: ['e1'],
    });
    const edges = [makeEdge('e1', ['p/c/r1'])];
    expect(filterSuppressedViolations([v], edges)).toEqual([]);
  });

  it('keeps a violation whose edgeId is not suppressed for that rule', () => {
    const v: RuleViolation = createViolation('p/c/r1', 'error', {
      edgeIds: ['e1'],
    });
    const edges = [makeEdge('e1', ['p/c/other'])]; // different rule suppressed
    expect(filterSuppressedViolations([v], edges)).toEqual([v]);
  });

  it('filters when violation lists multiple edges and at least one suppresses the rule', () => {
    const v: RuleViolation = createViolation('p/c/r1', 'error', {
      edgeIds: ['e1', 'e2', 'e3'],
    });
    const edges = [
      makeEdge('e1'),
      makeEdge('e2', ['p/c/r1']), // suppressed here
      makeEdge('e3'),
    ];
    expect(filterSuppressedViolations([v], edges)).toEqual([]);
  });

  it('keeps a violation referencing an unknown edgeId (missing edge handled gracefully)', () => {
    const v: RuleViolation = createViolation('p/c/r1', 'error', {
      edgeIds: ['ghost'],
    });
    const edges = [makeEdge('e1', ['p/c/r1'])];
    expect(filterSuppressedViolations([v], edges)).toEqual([v]);
  });

  it('preserves order and filters only suppressed ones', () => {
    const v1 = createViolation('p/c/r1', 'error', { edgeIds: ['e1'] });
    const v2 = createViolation('p/c/r2', 'warning', { edgeIds: ['e2'] });
    const v3 = createViolation('p/c/r3', 'error', { edgeIds: ['e3'] });
    const edges = [
      makeEdge('e1'),
      makeEdge('e2', ['p/c/r2']),
      makeEdge('e3'),
    ];
    const out = filterSuppressedViolations([v1, v2, v3], edges);
    expect(out).toEqual([v1, v3]);
  });
});
