import { describe, it, expect } from 'vitest';
import { OwaspRes002 } from '../rules/OwaspRes002';
import type { GraphNode } from '@/types/graph';

const mkDb = (id: string, data: Record<string, unknown> = {}): GraphNode => ({
  id, type: 'database', position: { x: 0, y: 0 }, data: data as GraphNode['data'],
});

describe('OwaspRes002 — connection pool on database', () => {
  it('passes when pool configured', () => {
    expect(OwaspRes002.validate({
      nodes: [mkDb('db', { connectionPool: { maxConnections: 50 } })],
      edges: [],
    })).toEqual([]);
  });

  it('flags when pool missing', () => {
    expect(OwaspRes002.validate({
      nodes: [mkDb('db', {})],
      edges: [],
    })).toHaveLength(1);
  });

  it('flags when maxConnections is 0', () => {
    expect(OwaspRes002.validate({
      nodes: [mkDb('db', { connectionPool: { maxConnections: 0 } })],
      edges: [],
    })).toHaveLength(1);
  });

  it('does not flag non-database', () => {
    const nodes = [{ id: 'cache', type: 'cache' as GraphNode['type'], position: { x: 0, y: 0 }, data: {} as GraphNode['data'] }];
    expect(OwaspRes002.validate({ nodes, edges: [] })).toEqual([]);
  });
});
