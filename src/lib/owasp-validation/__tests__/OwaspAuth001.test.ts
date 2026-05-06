import { describe, it, expect } from 'vitest';
import { OwaspAuth001 } from '../rules/OwaspAuth001';
import type { GraphNode, GraphEdge } from '@/types/graph';

const mkNode = (id: string, type: string, data: Record<string, unknown> = {}): GraphNode => ({
  id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, data: data as GraphNode['data'],
});
const mkEdge = (s: string, t: string): GraphEdge => ({ id: `${s}-${t}`, source: s, target: t });

describe('OwaspAuth001 — public endpoints require auth', () => {
  it('passes when public gateway has authType=jwt', () => {
    const nodes = [
      mkNode('client', 'client-group'),
      mkNode('gw', 'api-gateway', { authType: 'jwt' }),
    ];
    const edges = [mkEdge('client', 'gw')];
    expect(OwaspAuth001.validate({ nodes, edges })).toEqual([]);
  });

  it('flags when public gateway has authType=none', () => {
    const nodes = [
      mkNode('client', 'client-group'),
      mkNode('gw', 'api-gateway', { authType: 'none' }),
    ];
    const edges = [mkEdge('client', 'gw')];
    const violations = OwaspAuth001.validate({ nodes, edges });
    expect(violations).toHaveLength(1);
    expect(violations[0].affectedNodeIds).toEqual(['gw']);
  });

  it('does not flag a private gateway (no client reachable)', () => {
    const nodes = [
      mkNode('gw', 'api-gateway', { authType: 'none' }),
    ];
    const edges: GraphEdge[] = [];
    expect(OwaspAuth001.validate({ nodes, edges })).toEqual([]);
  });

  it('flags multiple public endpoints independently', () => {
    const nodes = [
      mkNode('client', 'client-group'),
      mkNode('gw1', 'api-gateway', { authType: 'none' }),
      mkNode('gw2', 'api-gateway', { authType: 'none' }),
    ];
    const edges = [mkEdge('client', 'gw1'), mkEdge('client', 'gw2')];
    const violations = OwaspAuth001.validate({ nodes, edges });
    expect(violations).toHaveLength(2);
  });
});
