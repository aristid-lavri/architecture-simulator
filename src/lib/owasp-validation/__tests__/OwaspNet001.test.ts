import { describe, it, expect } from 'vitest';
import { OwaspNet001 } from '../rules/OwaspNet001';
import type { GraphNode, GraphEdge } from '@/types/graph';

const mkNode = (id: string, type: string): GraphNode =>
  ({ id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, data: {} as GraphNode['data'] });
const mkEdge = (s: string, t: string): GraphEdge => ({ id: `${s}-${t}`, source: s, target: t });

describe('OwaspNet001 — WAF in front of public APIs', () => {
  it('passes when WAF is in path client → WAF → gateway', () => {
    const nodes = [mkNode('c', 'client-group'), mkNode('w', 'waf'), mkNode('g', 'api-gateway')];
    const edges = [mkEdge('c', 'w'), mkEdge('w', 'g')];
    expect(OwaspNet001.validate({ nodes, edges })).toEqual([]);
  });

  it('flags when client → gateway direct (no WAF)', () => {
    const nodes = [mkNode('c', 'client-group'), mkNode('g', 'api-gateway')];
    const edges = [mkEdge('c', 'g')];
    const violations = OwaspNet001.validate({ nodes, edges });
    expect(violations).toHaveLength(1);
    expect(violations[0].affectedNodeIds).toContain('g');
  });

  it('does not flag private gateway (no client)', () => {
    const nodes = [mkNode('g', 'api-gateway')];
    expect(OwaspNet001.validate({ nodes, edges: [] })).toEqual([]);
  });
});
