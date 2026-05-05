import { describe, it, expect } from 'vitest';
import { OwaspDos001 } from '../rules/OwaspDos001';
import type { GraphNode } from '@/types/graph';

const mkNode = (id: string, type: string, authFailureRate?: number): GraphNode => ({
  id, type: type as GraphNode['type'], position: { x: 0, y: 0 },
  data: { authFailureRate } as GraphNode['data'],
});

describe('OwaspDos001 — auth failure rate sanity', () => {
  it('passes when authFailureRate <= 5', () => {
    expect(OwaspDos001.validate({ nodes: [mkNode('gw', 'api-gateway', 2)], edges: [] })).toEqual([]);
  });
  it('flags when authFailureRate > 5', () => {
    expect(OwaspDos001.validate({ nodes: [mkNode('gw', 'api-gateway', 10)], edges: [] })).toHaveLength(1);
  });
  it('passes when authFailureRate undefined', () => {
    expect(OwaspDos001.validate({ nodes: [mkNode('gw', 'api-gateway')], edges: [] })).toEqual([]);
  });
});
