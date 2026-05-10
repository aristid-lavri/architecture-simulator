import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { DraftEdge } from '@/plugins/extensions/edge-creation';
import {
  type Rule,
  type RulePack,
  createViolation,
  ruleRegistry,
} from '@/lib/rules-engine/core';
import { SUPPRESSED_RULES_KEY } from '@/lib/rules-engine/suppression';
import { evaluateOnEdgeCreation } from '../edge-evaluator';

function makeRule(
  id: string,
  scope: Rule['scope'],
  severity: Rule['severity'],
  evaluate: Rule['evaluate'],
  packId = 'test-pack',
  category = 'test',
): Rule {
  return { id, scope, severity, category, packId, evaluate };
}

function makePack(id: string, rules: Rule[]): RulePack {
  return { id, rules };
}

function makeNode(id: string): GraphNode {
  return {
    id,
    type: 'http-server',
    position: { x: 0, y: 0 },
    data: {},
  };
}

function makeDraft(
  id = 'draft-1',
  source = 'a',
  target = 'b',
  data?: GraphEdge['data'],
): DraftEdge {
  return { id, source, target, data };
}

describe('evaluateOnEdgeCreation', () => {
  beforeEach(() => {
    ruleRegistry.clear();
  });

  it('returns empty result when registry is empty', () => {
    const out = evaluateOnEdgeCreation(makeDraft(), [], []);
    expect(out).toEqual({ blocking: [], warnings: [] });
  });

  it('returns an error violation in `blocking`', () => {
    const violation = createViolation('test-pack/cat/r1', 'error', {
      edgeIds: ['draft-1'],
    });
    const rule = makeRule('test-pack/cat/r1', 'edge', 'error', () => [violation]);
    ruleRegistry.registerPack(makePack('test-pack', [rule]));

    const out = evaluateOnEdgeCreation(
      makeDraft(),
      [makeNode('a'), makeNode('b')],
      [],
    );
    expect(out.blocking).toEqual([violation]);
    expect(out.warnings).toEqual([]);
  });

  it('returns a warning violation in `warnings`', () => {
    const violation = createViolation('test-pack/cat/w1', 'warning', {
      edgeIds: ['draft-1'],
    });
    const rule = makeRule('test-pack/cat/w1', 'edge', 'warning', () => [violation]);
    ruleRegistry.registerPack(makePack('test-pack', [rule]));

    const out = evaluateOnEdgeCreation(makeDraft(), [], []);
    expect(out.blocking).toEqual([]);
    expect(out.warnings).toEqual([violation]);
  });

  it('does not include rules that return an empty array', () => {
    const rule = makeRule('test-pack/cat/r1', 'edge', 'error', () => []);
    ruleRegistry.registerPack(makePack('test-pack', [rule]));

    const out = evaluateOnEdgeCreation(makeDraft(), [], []);
    expect(out).toEqual({ blocking: [], warnings: [] });
  });

  it('filters out a violation suppressed on the draft edge itself', () => {
    const violation = createViolation('test-pack/cat/r1', 'error', {
      edgeIds: ['draft-1'],
    });
    const rule = makeRule('test-pack/cat/r1', 'edge', 'error', () => [violation]);
    ruleRegistry.registerPack(makePack('test-pack', [rule]));

    const draftWithSuppression = makeDraft('draft-1', 'a', 'b', {
      [SUPPRESSED_RULES_KEY]: [
        {
          ruleId: 'test-pack/cat/r1',
          reason: 'accepted by team',
          suppressedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const out = evaluateOnEdgeCreation(draftWithSuppression, [], []);
    expect(out.blocking).toEqual([]);
    expect(out.warnings).toEqual([]);
  });

  it('does NOT evaluate graph-scope rules (only edge scope)', () => {
    const graphRuleEval = vi.fn(() => [
      createViolation('test-pack/cat/g1', 'error', { edgeIds: ['draft-1'] }),
    ]);
    const edgeRuleEval = vi.fn(() => [
      createViolation('test-pack/cat/e1', 'error', { edgeIds: ['draft-1'] }),
    ]);
    ruleRegistry.registerPack(
      makePack('test-pack', [
        makeRule('test-pack/cat/g1', 'graph', 'error', graphRuleEval),
        makeRule('test-pack/cat/e1', 'edge', 'error', edgeRuleEval),
      ]),
    );

    const out = evaluateOnEdgeCreation(makeDraft(), [], []);
    expect(graphRuleEval).not.toHaveBeenCalled();
    expect(edgeRuleEval).toHaveBeenCalledTimes(1);
    expect(out.blocking).toHaveLength(1);
    expect(out.blocking[0].ruleId).toBe('test-pack/cat/e1');
  });

  it('skips a rule that throws and continues evaluating the others', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const goodViolation = createViolation('test-pack/cat/good', 'error', {
      edgeIds: ['draft-1'],
    });
    ruleRegistry.registerPack(
      makePack('test-pack', [
        makeRule('test-pack/cat/bad', 'edge', 'error', () => {
          throw new Error('boom');
        }),
        makeRule('test-pack/cat/good', 'edge', 'error', () => [goodViolation]),
      ]),
    );

    const out = evaluateOnEdgeCreation(makeDraft(), [], []);
    expect(out.blocking).toEqual([goodViolation]);
    expect(out.warnings).toEqual([]);
    errorSpy.mockRestore();
  });
});
