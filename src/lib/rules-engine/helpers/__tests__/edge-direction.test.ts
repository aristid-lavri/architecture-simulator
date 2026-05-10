import { describe, expect, it } from 'vitest';
import {
  canTypeInitiate,
  canTypeBeTarget,
  resolveEdgeEndpoints,
  resolveEdgeTypes,
  findEdges,
} from '../edge-direction';
import { buildContext } from '@/lib/rules-engine/core';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { DraftEdge } from '@/plugins/extensions/edge-creation';

function node(id: string, type: GraphNode['type']): GraphNode {
  return { id, type, position: { x: 0, y: 0 }, data: {} };
}

function edge(id: string, source: string, target: string): GraphEdge {
  return { id, source, target };
}

describe('canTypeInitiate', () => {
  it('returns false for data-layer types', () => {
    expect(canTypeInitiate('database')).toBe(false);
    expect(canTypeInitiate('cache')).toBe(false);
    expect(canTypeInitiate('cloud-storage')).toBe(false);
  });
  it('returns false for filter types', () => {
    expect(canTypeInitiate('waf')).toBe(false);
    expect(canTypeInitiate('firewall')).toBe(false);
  });
  it('returns false for dns and identity-provider', () => {
    expect(canTypeInitiate('dns')).toBe(false);
    expect(canTypeInitiate('identity-provider')).toBe(false);
  });
  it('returns true for clients and servers', () => {
    expect(canTypeInitiate('http-client')).toBe(true);
    expect(canTypeInitiate('client-group')).toBe(true);
    expect(canTypeInitiate('http-server')).toBe(true);
    expect(canTypeInitiate('api-service')).toBe(true);
  });
});

describe('canTypeBeTarget', () => {
  it('returns false for client types', () => {
    expect(canTypeBeTarget('http-client')).toBe(false);
    expect(canTypeBeTarget('client-group')).toBe(false);
  });
  it('returns true for non-client types', () => {
    expect(canTypeBeTarget('database')).toBe(true);
    expect(canTypeBeTarget('cache')).toBe(true);
    expect(canTypeBeTarget('http-server')).toBe(true);
    expect(canTypeBeTarget('api-service')).toBe(true);
    expect(canTypeBeTarget('dns')).toBe(true);
  });
});

describe('resolveEdgeEndpoints', () => {
  it('returns nodes when both endpoints exist', () => {
    const s = node('s', 'http-client');
    const t = node('t', 'http-server');
    const draft: DraftEdge = { id: 'd', source: 's', target: 't' };
    const ctx = buildContext([s, t], [], draft);
    const ep = resolveEdgeEndpoints(ctx);
    expect(ep).not.toBeNull();
    expect(ep!.source).toBe(s);
    expect(ep!.target).toBe(t);
  });

  it('returns null when source is missing', () => {
    const t = node('t', 'http-server');
    const draft: DraftEdge = { id: 'd', source: 'missing', target: 't' };
    const ctx = buildContext([t], [], draft);
    expect(resolveEdgeEndpoints(ctx)).toBeNull();
  });

  it('returns null when target is missing', () => {
    const s = node('s', 'http-client');
    const draft: DraftEdge = { id: 'd', source: 's', target: 'missing' };
    const ctx = buildContext([s], [], draft);
    expect(resolveEdgeEndpoints(ctx)).toBeNull();
  });

  it('returns null when no draftEdge', () => {
    const ctx = buildContext([node('a', 'http-client')], []);
    expect(resolveEdgeEndpoints(ctx)).toBeNull();
  });
});

describe('resolveEdgeTypes', () => {
  it('returns the source/target ComponentType strings', () => {
    const s = node('s', 'http-client');
    const t = node('t', 'database');
    const draft: DraftEdge = { id: 'd', source: 's', target: 't' };
    const ctx = buildContext([s, t], [], draft);
    const types = resolveEdgeTypes(ctx);
    expect(types).toEqual({ sourceType: 'http-client', targetType: 'database' });
  });

  it('returns null when endpoints missing', () => {
    const ctx = buildContext([], []);
    expect(resolveEdgeTypes(ctx)).toBeNull();
  });
});

describe('findEdges', () => {
  it('returns edges matching the predicate', () => {
    const a = node('a', 'http-client');
    const b = node('b', 'http-server');
    const c = node('c', 'database');
    const e1 = edge('e1', 'a', 'b');
    const e2 = edge('e2', 'b', 'c');
    const e3 = edge('e3', 'a', 'c');
    const ctx = buildContext([a, b, c], [e1, e2, e3]);
    const result = findEdges(
      ctx,
      (_s, t) => (t.type as string) === 'database',
    );
    expect(result).toEqual([e2, e3]);
  });

  it('skips edges whose endpoints are missing from the nodeMap', () => {
    const a = node('a', 'http-client');
    const e1 = edge('e1', 'a', 'ghost');
    const ctx = buildContext([a], [e1]);
    expect(findEdges(ctx, () => true)).toEqual([]);
  });

  it('returns an empty array when no edges match', () => {
    const a = node('a', 'http-client');
    const b = node('b', 'http-server');
    const ctx = buildContext([a, b], [edge('e1', 'a', 'b')]);
    expect(findEdges(ctx, () => false)).toEqual([]);
  });
});
