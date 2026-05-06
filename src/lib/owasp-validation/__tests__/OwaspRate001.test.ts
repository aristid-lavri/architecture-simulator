import { describe, it, expect } from 'vitest';
import { OwaspRate001 } from '../rules/OwaspRate001';
import type { GraphNode, GraphEdge } from '@/types/graph';

const mkNode = (id: string, type: string, data: Record<string, unknown> = {}): GraphNode => ({
  id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, data: data as GraphNode['data'],
});
const mkEdge = (s: string, t: string): GraphEdge => ({ id: `${s}-${t}`, source: s, target: t });

describe('OwaspRate001 — rate limiting on public gateways', () => {
  it('passes when rate limiting enabled', () => {
    const nodes = [
      mkNode('c', 'client-group'),
      mkNode('gw', 'api-gateway', { rateLimiting: { enabled: true, requestsPerSecond: 100 } }),
    ];
    const edges = [mkEdge('c', 'gw')];
    expect(OwaspRate001.validate({ nodes, edges })).toEqual([]);
  });

  it('flags when rate limiting disabled', () => {
    const nodes = [
      mkNode('c', 'client-group'),
      mkNode('gw', 'api-gateway', { rateLimiting: { enabled: false } }),
    ];
    const edges = [mkEdge('c', 'gw')];
    const violations = OwaspRate001.validate({ nodes, edges });
    expect(violations).toHaveLength(1);
    expect(violations[0].affectedNodeIds).toEqual(['gw']);
  });

  it('flags when rateLimiting field missing', () => {
    const nodes = [
      mkNode('c', 'client-group'),
      mkNode('gw', 'api-gateway', {}),
    ];
    const edges = [mkEdge('c', 'gw')];
    expect(OwaspRate001.validate({ nodes, edges })).toHaveLength(1);
  });

  it('does not flag private gateway', () => {
    const nodes = [mkNode('gw', 'api-gateway', { rateLimiting: { enabled: false } })];
    expect(OwaspRate001.validate({ nodes, edges: [] })).toEqual([]);
  });
});
