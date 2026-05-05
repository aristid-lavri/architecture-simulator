// src/lib/owasp-validation/__tests__/graph-utils.test.ts
import { describe, it, expect } from 'vitest';
import { isReachableFrom, hasUpstreamOfType, getUpstreamPath } from '../graph-utils';
import type { GraphNode, GraphEdge } from '@/types/graph';

const mkNode = (id: string, type: string, data: Record<string, unknown> = {}): GraphNode => ({
  id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, data: data as GraphNode['data'],
});
const mkEdge = (from: string, to: string): GraphEdge => ({
  id: `${from}-${to}`, source: from, target: to,
});

describe('isReachableFrom', () => {
  it('returns true when target is directly connected', () => {
    const nodes = [mkNode('A', 'client-group'), mkNode('B', 'http-server')];
    const edges = [mkEdge('A', 'B')];
    expect(isReachableFrom('A', 'B', nodes, edges)).toBe(true);
  });

  it('returns true through multi-hop path', () => {
    const nodes = [
      mkNode('A', 'client-group'), mkNode('B', 'waf'), mkNode('C', 'api-gateway'), mkNode('D', 'api-service'),
    ];
    const edges = [mkEdge('A', 'B'), mkEdge('B', 'C'), mkEdge('C', 'D')];
    expect(isReachableFrom('A', 'D', nodes, edges)).toBe(true);
  });

  it('returns false when not reachable', () => {
    const nodes = [mkNode('A', 'client-group'), mkNode('B', 'database')];
    const edges: GraphEdge[] = [];
    expect(isReachableFrom('A', 'B', nodes, edges)).toBe(false);
  });
});

describe('hasUpstreamOfType', () => {
  it('returns true when target has WAF in upstream path', () => {
    const nodes = [mkNode('A', 'client-group'), mkNode('B', 'waf'), mkNode('C', 'api-gateway')];
    const edges = [mkEdge('A', 'B'), mkEdge('B', 'C')];
    expect(hasUpstreamOfType('C', 'waf', nodes, edges)).toBe(true);
  });

  it('returns false when no WAF upstream', () => {
    const nodes = [mkNode('A', 'client-group'), mkNode('C', 'api-gateway')];
    const edges = [mkEdge('A', 'C')];
    expect(hasUpstreamOfType('C', 'waf', nodes, edges)).toBe(false);
  });
});

describe('getUpstreamPath', () => {
  it('returns the chain of node ids leading to target', () => {
    const nodes = [mkNode('A', 'client-group'), mkNode('B', 'waf'), mkNode('C', 'api-gateway')];
    const edges = [mkEdge('A', 'B'), mkEdge('B', 'C')];
    const path = getUpstreamPath('C', 'A', nodes, edges);
    expect(path).toEqual(['A', 'B', 'C']);
  });
});
