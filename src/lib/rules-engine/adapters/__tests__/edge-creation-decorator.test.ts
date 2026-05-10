import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { DraftEdge, EdgeCreationContext } from '@/plugins/extensions/edge-creation';
import {
  type Rule,
  type RulePack,
  createViolation,
  ruleRegistry,
} from '@/lib/rules-engine/core';
import { SUPPRESSED_RULES_KEY } from '@/lib/rules-engine/suppression';
import { coreRulesDecorator } from '../edge-creation-decorator';

function makeRule(
  id: string,
  severity: Rule['severity'],
  evaluate: Rule['evaluate'],
  category = 'test',
  packId = 'test-pack',
): Rule {
  return { id, scope: 'edge', severity, category, packId, evaluate };
}

function makePack(id: string, rules: Rule[]): RulePack {
  return { id, rules };
}

function makeNode(id: string, type = 'http-server'): GraphNode {
  return { id, type, position: { x: 0, y: 0 }, data: {} };
}

function makeDraft(
  id = 'draft-1',
  source = 'a',
  target = 'b',
  data?: GraphEdge['data'],
): DraftEdge {
  return { id, source, target, data };
}

function makeEnrichedCtx(
  nodes: GraphNode[],
  edges: GraphEdge[],
): EdgeCreationContext {
  return {
    projectMeta: { kind: 'simulator' } as unknown as EdgeCreationContext['projectMeta'],
    getNodes: () => nodes,
    getEdges: () => edges,
  } as unknown as EdgeCreationContext;
}

function makeBareCtx(): EdgeCreationContext {
  return {
    projectMeta: { kind: 'simulator' } as unknown as EdgeCreationContext['projectMeta'],
  } as EdgeCreationContext;
}

describe('coreRulesDecorator', () => {
  beforeEach(() => {
    ruleRegistry.clear();
  });

  it('returns draftEdge.data ?? null when context lacks getNodes/getEdges (fail-open)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const draftWithData = makeDraft('d1', 'a', 'b', { protocol: 'http' });
    expect(coreRulesDecorator(draftWithData, makeBareCtx())).toEqual({ protocol: 'http' });

    const draftBare = makeDraft();
    expect(coreRulesDecorator(draftBare, makeBareCtx())).toBeNull();
    warnSpy.mockRestore();
  });

  it('returns draftEdge.data ?? null when registry is empty', () => {
    const draftWithData = makeDraft('d1', 'a', 'b', { protocol: 'http' });
    const ctx = makeEnrichedCtx([makeNode('a'), makeNode('b')], []);
    expect(coreRulesDecorator(draftWithData, ctx)).toEqual({ protocol: 'http' });

    expect(coreRulesDecorator(makeDraft(), ctx)).toBeNull();
  });

  it('returns EdgeRejection when an ERROR rule fires', () => {
    const violation = createViolation('test-pack/cat/err', 'error', {
      edgeIds: ['draft-1'],
      messageParams: { name: 'X' },
    });
    ruleRegistry.registerPack(
      makePack('test-pack', [makeRule('test-pack/cat/err', 'error', () => [violation])]),
    );

    const ctx = makeEnrichedCtx([makeNode('a'), makeNode('b')], []);
    const result = coreRulesDecorator(makeDraft(), ctx);

    expect(result).toEqual({
      reject: true,
      messageKey: violation.messageKey,
      params: { name: 'X' },
    });
  });

  it('omits params when the firing ERROR rule has no messageParams', () => {
    const violation = createViolation('test-pack/cat/err', 'error', {
      edgeIds: ['draft-1'],
    });
    ruleRegistry.registerPack(
      makePack('test-pack', [makeRule('test-pack/cat/err', 'error', () => [violation])]),
    );

    const ctx = makeEnrichedCtx([], []);
    const result = coreRulesDecorator(makeDraft(), ctx) as {
      reject: true;
      messageKey: string;
      params?: unknown;
    };

    expect(result.reject).toBe(true);
    expect(result.messageKey).toBe(violation.messageKey);
    expect('params' in result).toBe(false);
  });

  it('returns enriched data with pendingViolations when only WARNING rules fire', () => {
    const w1 = createViolation('test-pack/cat/w1', 'warning', {
      edgeIds: ['draft-1'],
      messageParams: { a: 1 },
    });
    const w2 = createViolation('test-pack/cat/w2', 'warning', {
      edgeIds: ['draft-1'],
    });
    ruleRegistry.registerPack(
      makePack('test-pack', [
        makeRule('test-pack/cat/w1', 'warning', () => [w1]),
        makeRule('test-pack/cat/w2', 'warning', () => [w2]),
      ]),
    );

    const ctx = makeEnrichedCtx([], []);
    const draft = makeDraft('draft-1', 'a', 'b', { protocol: 'http' });
    const result = coreRulesDecorator(draft, ctx) as Record<string, unknown>;

    expect(result.protocol).toBe('http');
    expect(result.pendingViolations).toEqual([
      { ruleId: 'test-pack/cat/w1', severity: 'warning', messageKey: w1.messageKey, messageParams: { a: 1 } },
      { ruleId: 'test-pack/cat/w2', severity: 'warning', messageKey: w2.messageKey, messageParams: undefined },
    ]);
  });

  it('preserves an empty draft.data when only WARNING rules fire', () => {
    const w1 = createViolation('test-pack/cat/w1', 'warning', {
      edgeIds: ['draft-1'],
    });
    ruleRegistry.registerPack(
      makePack('test-pack', [makeRule('test-pack/cat/w1', 'warning', () => [w1])]),
    );

    const ctx = makeEnrichedCtx([], []);
    const result = coreRulesDecorator(makeDraft(), ctx) as Record<string, unknown>;
    expect(result.pendingViolations).toBeDefined();
    expect((result.pendingViolations as unknown[]).length).toBe(1);
  });

  it('error wins over warning : returns rejection (no pendingViolations) when both fire', () => {
    const err = createViolation('test-pack/cat/err', 'error', { edgeIds: ['draft-1'] });
    const warn = createViolation('test-pack/cat/warn', 'warning', { edgeIds: ['draft-1'] });
    ruleRegistry.registerPack(
      makePack('test-pack', [
        makeRule('test-pack/cat/err', 'error', () => [err]),
        makeRule('test-pack/cat/warn', 'warning', () => [warn]),
      ]),
    );

    const ctx = makeEnrichedCtx([], []);
    const result = coreRulesDecorator(makeDraft(), ctx) as { reject: boolean; messageKey: string };
    expect(result.reject).toBe(true);
    expect(result.messageKey).toBe(err.messageKey);
  });

  it('respects suppression on the draft : no rejection, no warning surfaced', () => {
    const err = createViolation('test-pack/cat/err', 'error', { edgeIds: ['draft-1'] });
    ruleRegistry.registerPack(
      makePack('test-pack', [makeRule('test-pack/cat/err', 'error', () => [err])]),
    );

    const draftSuppressed = makeDraft('draft-1', 'a', 'b', {
      protocol: 'http',
      [SUPPRESSED_RULES_KEY]: [
        {
          ruleId: 'test-pack/cat/err',
          reason: 'accepted',
          suppressedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const ctx = makeEnrichedCtx([], []);
    const result = coreRulesDecorator(draftSuppressed, ctx);

    // No rejection — and since no warnings either, the decorator returns draft.data ?? null
    expect(result).toEqual({
      protocol: 'http',
      [SUPPRESSED_RULES_KEY]: [
        {
          ruleId: 'test-pack/cat/err',
          reason: 'accepted',
          suppressedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
  });
});
