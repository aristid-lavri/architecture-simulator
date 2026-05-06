import { describe, it, expect } from 'vitest';
import { OwaspNet003 } from '../rules/OwaspNet003';
import type { GraphNode } from '@/types/graph';

const mkSensitive = (id: string, type: string, parentId?: string): GraphNode => ({
  id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, parentId,
  data: {} as GraphNode['data'],
});

describe('OwaspNet003 — sensitive components in zones', () => {
  it('flags database without parentId (no zone)', () => {
    expect(OwaspNet003.validate({ nodes: [mkSensitive('db', 'database')], edges: [] }))
      .toHaveLength(1);
  });
  it('passes database with parentId (in zone)', () => {
    expect(OwaspNet003.validate({ nodes: [mkSensitive('db', 'database', 'zone1')], edges: [] }))
      .toEqual([]);
  });
  it('flags cache and identity-provider without zone', () => {
    const nodes = [
      mkSensitive('cache', 'cache'),
      mkSensitive('idp', 'identity-provider'),
    ];
    expect(OwaspNet003.validate({ nodes, edges: [] })).toHaveLength(2);
  });
  it('does not flag non-sensitive types like http-server', () => {
    expect(OwaspNet003.validate({ nodes: [mkSensitive('s', 'http-server')], edges: [] }))
      .toEqual([]);
  });
});
