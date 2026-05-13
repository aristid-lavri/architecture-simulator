// __tests__/compiler.test.ts
import { describe, it, expect } from 'vitest';
import { compileCustomRules } from '../compiler';
import type { CustomRulesDocument } from '../types';
import { buildContext } from '@/lib/rules-engine/core';
import type { GraphNode, GraphEdge } from '@/types/graph';

function nd(id: string, type: string, opts: Partial<GraphNode> = {}): GraphNode {
  return { id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, data: {}, ...opts };
}

describe('compileCustomRules', () => {
  it('rejects rule with no id', () => {
    const doc: CustomRulesDocument = {
      rules: [{ description: 'x', severity: 'error', scope: 'graph' } as never],
    };
    const { result } = compileCustomRules(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /id/i.test(e.message))).toBe(true);
  });

  it('rejects duplicate ids', () => {
    const doc: CustomRulesDocument = {
      rules: [
        { id: 'a', description: '', severity: 'error', scope: 'graph', forall: { node: {} }, require: { tag: 't' } },
        { id: 'a', description: '', severity: 'error', scope: 'graph', forall: { node: {} }, require: { tag: 't' } },
      ],
    };
    const { result } = compileCustomRules(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /duplicate/i.test(e.message))).toBe(true);
  });

  it('rejects edge-scope without forbid|when+require', () => {
    const doc: CustomRulesDocument = {
      rules: [{ id: 'r', description: '', severity: 'error', scope: 'edge' }],
    };
    const { result } = compileCustomRules(doc);
    expect(result.ok).toBe(false);
  });

  it('compiles a forbid-edge rule and detects violation', () => {
    const doc: CustomRulesDocument = {
      rules: [
        {
          id: 'my/forbid-cache-client',
          description: '',
          severity: 'error',
          scope: 'edge',
          forbid: { source: { type: 'cache' }, target: { type: 'http-client' } },
        },
      ],
    };
    const { pack, result } = compileCustomRules(doc);
    expect(result.ok).toBe(true);
    expect(pack.rules).toHaveLength(1);

    const cache = nd('c', 'cache');
    const client = nd('cl', 'http-client');
    const edge: GraphEdge = { id: 'e', source: 'c', target: 'cl' };
    const ctx = buildContext([cache, client], [edge], edge);
    const violations = pack.rules[0].evaluate(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].edgeIds).toEqual(['e']);
  });

  it('compiles a graph-scope require-ancestor-zone rule', () => {
    const doc: CustomRulesDocument = {
      rules: [
        {
          id: 'my/payment-in-pci',
          description: '',
          severity: 'error',
          scope: 'graph',
          forall: { node: { tag: 'payment' } },
          require: { ancestor_zone: { tag: 'pci' } },
        },
      ],
    };
    const { pack, result } = compileCustomRules(doc);
    expect(result.ok).toBe(true);

    const zonePci = nd('z1', 'network-zone', {
      data: { zoneType: 'backend' },
      metadata: { tags: ['pci'] },
    });
    const zoneOther = nd('z2', 'network-zone', { data: { zoneType: 'dmz' } });
    const ok = nd('ok', 'api-service', { parentId: 'z1', metadata: { tags: ['payment'] } });
    const bad = nd('bad', 'api-service', { parentId: 'z2', metadata: { tags: ['payment'] } });
    const ctx = buildContext([zonePci, zoneOther, ok, bad], []);
    const violations = pack.rules[0].evaluate(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].nodeIds).toEqual(['bad']);
  });

  it('compiles require:protocol_in for edge scope', () => {
    const doc: CustomRulesDocument = {
      rules: [
        {
          id: 'my/payment-edges-tls',
          description: '',
          severity: 'error',
          scope: 'edge',
          when: { edge: { tag: 'payment' } },
          require: { protocol_in: ['https', 'grpc-tls'] },
        },
      ],
    };
    const { pack, result } = compileCustomRules(doc);
    expect(result.ok).toBe(true);

    const a = nd('a', 'api-service');
    const b = nd('b', 'database');
    const e: GraphEdge = { id: 'e1', source: 'a', target: 'b', data: { protocol: 'http', tags: ['payment'] } };
    const ctx = buildContext([a, b], [e], e);
    expect(pack.rules[0].evaluate(ctx)).toHaveLength(1);

    const eOk: GraphEdge = { id: 'e2', source: 'a', target: 'b', data: { protocol: 'https', tags: ['payment'] } };
    const ctxOk = buildContext([a, b], [eOk], eOk);
    expect(pack.rules[0].evaluate(ctxOk)).toHaveLength(0);
  });
});
