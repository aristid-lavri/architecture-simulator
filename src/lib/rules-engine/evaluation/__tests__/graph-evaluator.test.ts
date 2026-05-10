import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphNode, GraphEdge } from '@/types/graph';
import {
  type Rule,
  type RulePack,
  type RuleContext,
  createViolation,
  ruleRegistry,
} from '@/lib/rules-engine/core';
import { SUPPRESSED_RULES_KEY } from '@/lib/rules-engine/suppression';
import { evaluateGraph } from '../graph-evaluator';

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

function makeEdge(
  id: string,
  source = 'a',
  target = 'b',
  data?: GraphEdge['data'],
): GraphEdge {
  return { id, source, target, data };
}

describe('evaluateGraph', () => {
  beforeEach(() => {
    ruleRegistry.clear();
  });

  it('returns [] for an empty graph and empty registry', () => {
    expect(evaluateGraph([], [])).toEqual([]);
  });

  it('runs a graph-scope rule exactly once', () => {
    const evaluate = vi.fn(() => [
      createViolation('test-pack/cat/g1', 'error', { nodeIds: ['n1'] }),
    ]);
    ruleRegistry.registerPack(
      makePack('test-pack', [makeRule('test-pack/cat/g1', 'graph', 'error', evaluate)]),
    );

    const out = evaluateGraph(
      [makeNode('a'), makeNode('b')],
      [makeEdge('e1'), makeEdge('e2', 'b', 'a')],
    );
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(1);
    expect(out[0].ruleId).toBe('test-pack/cat/g1');
  });

  it('runs an edge-scope rule once per existing edge', () => {
    const seenDraftIds: string[] = [];
    const evaluate = vi.fn((ctx: RuleContext) => {
      if (!ctx.draftEdge) return [];
      seenDraftIds.push(ctx.draftEdge.id);
      return [
        createViolation('test-pack/cat/e1', 'error', {
          edgeIds: [ctx.draftEdge.id],
        }),
      ];
    });
    ruleRegistry.registerPack(
      makePack('test-pack', [makeRule('test-pack/cat/e1', 'edge', 'error', evaluate)]),
    );

    const edges = [makeEdge('e1'), makeEdge('e2'), makeEdge('e3')];
    const out = evaluateGraph([makeNode('a'), makeNode('b')], edges);

    expect(evaluate).toHaveBeenCalledTimes(3);
    expect(seenDraftIds.sort()).toEqual(['e1', 'e2', 'e3']);
    expect(out).toHaveLength(3);
    expect(out.map((v) => v.edgeIds?.[0]).sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('filters out a violation whose edgeId is suppressed on that edge', () => {
    const evaluate = vi.fn((ctx: RuleContext) => {
      if (!ctx.draftEdge) return [];
      return [
        createViolation('test-pack/cat/e1', 'error', {
          edgeIds: [ctx.draftEdge.id],
        }),
      ];
    });
    ruleRegistry.registerPack(
      makePack('test-pack', [makeRule('test-pack/cat/e1', 'edge', 'error', evaluate)]),
    );

    const edges = [
      makeEdge('e1'),
      makeEdge('e2', 'a', 'b', {
        [SUPPRESSED_RULES_KEY]: [
          {
            ruleId: 'test-pack/cat/e1',
            reason: 'ok',
            suppressedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    ];
    const out = evaluateGraph([makeNode('a'), makeNode('b')], edges);
    expect(out).toHaveLength(1);
    expect(out[0].edgeIds).toEqual(['e1']);
  });

  it('never filters a graph-scope violation with no edgeIds', () => {
    const violation = createViolation('test-pack/cat/g1', 'error', {
      nodeIds: ['n1'],
    });
    ruleRegistry.registerPack(
      makePack(
        'test-pack',
        [makeRule('test-pack/cat/g1', 'graph', 'error', () => [violation])],
      ),
    );

    // An edge has the same ruleId suppressed — but since the violation has no edgeIds,
    // it should NOT be filtered.
    const edges = [
      makeEdge('e1', 'a', 'b', {
        [SUPPRESSED_RULES_KEY]: [
          {
            ruleId: 'test-pack/cat/g1',
            reason: 'irrelevant',
            suppressedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    ];
    const out = evaluateGraph([makeNode('a'), makeNode('b')], edges);
    expect(out).toEqual([violation]);
  });

  it('skips a rule that throws and continues evaluating the others (graph scope)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const goodViolation = createViolation('test-pack/cat/good', 'error', {
      nodeIds: ['n1'],
    });
    ruleRegistry.registerPack(
      makePack('test-pack', [
        makeRule('test-pack/cat/bad', 'graph', 'error', () => {
          throw new Error('boom');
        }),
        makeRule('test-pack/cat/good', 'graph', 'error', () => [goodViolation]),
      ]),
    );

    const out = evaluateGraph([], []);
    expect(out).toEqual([goodViolation]);
    errorSpy.mockRestore();
  });

  it('skips an edge-scope rule that throws on one edge but produces violations on others', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const evaluate = vi.fn((ctx: RuleContext) => {
      if (!ctx.draftEdge) return [];
      if (ctx.draftEdge.id === 'e2') throw new Error('boom on e2');
      return [
        createViolation('test-pack/cat/e1', 'error', {
          edgeIds: [ctx.draftEdge.id],
        }),
      ];
    });
    ruleRegistry.registerPack(
      makePack('test-pack', [makeRule('test-pack/cat/e1', 'edge', 'error', evaluate)]),
    );

    const out = evaluateGraph(
      [makeNode('a'), makeNode('b')],
      [makeEdge('e1'), makeEdge('e2'), makeEdge('e3')],
    );
    expect(out.map((v) => v.edgeIds?.[0]).sort()).toEqual(['e1', 'e3']);
    errorSpy.mockRestore();
  });
});
