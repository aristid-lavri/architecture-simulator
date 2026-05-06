import { describe, it, expect } from 'vitest';
import { OwaspRes001 } from '../rules/OwaspRes001';
import type { GraphNode, GraphEdge } from '@/types/graph';

const mkNode = (id: string, type: string, parentId?: string): GraphNode => ({
  id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, parentId,
  data: {} as GraphNode['data'],
});
const mkEdge = (s: string, t: string): GraphEdge => ({ id: `${s}-${t}`, source: s, target: t });

describe('OwaspRes001 — circuit breaker on external calls', () => {
  it('passes when CB sits between internal service and external', () => {
    const nodes = [
      mkNode('svc', 'api-service', 'container1'),
      mkNode('cb', 'circuit-breaker'),
      mkNode('ext', 'http-server'), // no parentId → external
    ];
    const edges = [mkEdge('svc', 'cb'), mkEdge('cb', 'ext')];
    expect(OwaspRes001.validate({ nodes, edges })).toEqual([]);
  });

  it('flags when service calls external without CB', () => {
    const nodes = [
      mkNode('svc', 'api-service', 'container1'),
      mkNode('ext', 'http-server'),
    ];
    const edges = [mkEdge('svc', 'ext')];
    const violations = OwaspRes001.validate({ nodes, edges });
    expect(violations.length).toBeGreaterThan(0);
  });

  it('does not flag when external is unreachable', () => {
    const nodes = [
      mkNode('svc', 'api-service', 'container1'),
      mkNode('ext', 'http-server'),
    ];
    expect(OwaspRes001.validate({ nodes, edges: [] })).toEqual([]);
  });
});
