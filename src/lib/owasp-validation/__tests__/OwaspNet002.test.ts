import { describe, it, expect } from 'vitest';
import { OwaspNet002 } from '../rules/OwaspNet002';
import type { GraphNode } from '@/types/graph';

const mkZone = (id: string, zoneType: string): GraphNode =>
  ({ id, type: 'network-zone', position: { x: 0, y: 0 }, data: { zoneType } as GraphNode['data'] });
const mkDb = (id: string, parentId?: string): GraphNode =>
  ({ id, type: 'database', position: { x: 0, y: 0 }, parentId, data: {} as GraphNode['data'] });

describe('OwaspNet002 — DB never in DMZ', () => {
  it('flags DB inside DMZ zone', () => {
    const nodes = [mkZone('z1', 'dmz'), mkDb('db', 'z1')];
    expect(OwaspNet002.validate({ nodes, edges: [] })).toHaveLength(1);
  });
  it('passes DB inside data zone', () => {
    const nodes = [mkZone('z1', 'data'), mkDb('db', 'z1')];
    expect(OwaspNet002.validate({ nodes, edges: [] })).toEqual([]);
  });
  it('passes DB without zone (out of scope)', () => {
    expect(OwaspNet002.validate({ nodes: [mkDb('db')], edges: [] })).toEqual([]);
  });
});
