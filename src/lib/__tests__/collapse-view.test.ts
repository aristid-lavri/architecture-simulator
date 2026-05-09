import { describe, it, expect } from 'vitest';
import { applyCollapseView, aggregateCount, AGGREGATE_EDGE_PREFIX } from '../collapse-view';
import type { GraphNode, GraphEdge } from '@/types/graph';

const node = (id: string, type: GraphNode['type'], partial: Partial<GraphNode> = {}): GraphNode => ({
  id, type, position: { x: 0, y: 0 }, data: {} as GraphNode['data'], ...partial,
});

const collapsed = (id: string, type: GraphNode['type'], partial: Partial<GraphNode> = {}): GraphNode =>
  node(id, type, { ...partial, data: { ...(partial.data as object ?? {}), collapsed: true } as GraphNode['data'] });

const edge = (id: string, source: string, target: string, protocol?: string): GraphEdge => ({
  id, source, target,
  ...(protocol ? { data: { protocol } } : {}),
});

describe('applyCollapseView — identity case', () => {
  it('returns inputs untouched when no node is collapsed', () => {
    const nodes = [node('a', 'http-server'), node('b', 'http-server')];
    const edges = [edge('e1', 'a', 'b')];
    const result = applyCollapseView(nodes, edges);
    expect(result.visibleNodes).toBe(nodes);
    expect(result.visibleEdges).toBe(edges);
    expect(result.edgeRemap.size).toBe(0);
  });
});

describe('applyCollapseView — single collapsed zone', () => {
  it('hides descendants of a collapsed zone', () => {
    const z = collapsed('zone1', 'network-zone');
    const child = node('svc1', 'http-server', { parentId: 'zone1' });
    const result = applyCollapseView([z, child], []);
    expect(result.visibleNodes.map((n) => n.id)).toEqual(['zone1']);
  });

  it('remaps an edge from outside into the collapsed zone', () => {
    const outside = node('client', 'http-client');
    const z = collapsed('zone1', 'network-zone');
    const child = node('svc1', 'http-server', { parentId: 'zone1' });
    const e = edge('e1', 'client', 'svc1', 'http');
    const result = applyCollapseView([outside, z, child], [e]);
    // Solo edge, remapped target → kept with same id, no aggregation
    expect(result.visibleEdges).toHaveLength(1);
    expect(result.visibleEdges[0].source).toBe('client');
    expect(result.visibleEdges[0].target).toBe('zone1');
    expect(result.edgeRemap.size).toBe(0);
  });

  it('drops edges where both endpoints are inside the collapsed zone', () => {
    const z = collapsed('zone1', 'network-zone');
    const a = node('svc1', 'http-server', { parentId: 'zone1' });
    const b = node('svc2', 'http-server', { parentId: 'zone1' });
    const result = applyCollapseView([z, a, b], [edge('e1', 'svc1', 'svc2')]);
    expect(result.visibleEdges).toHaveLength(0);
  });
});

describe('applyCollapseView — edge aggregation', () => {
  it('aggregates 3 edges with same (source, target, protocol) into one edge with ×3 badge', () => {
    const outside = node('client', 'http-client');
    const z = collapsed('zone1', 'network-zone');
    const s1 = node('svc1', 'http-server', { parentId: 'zone1' });
    const s2 = node('svc2', 'http-server', { parentId: 'zone1' });
    const s3 = node('svc3', 'http-server', { parentId: 'zone1' });
    const result = applyCollapseView(
      [outside, z, s1, s2, s3],
      [edge('e1', 'client', 'svc1', 'http'), edge('e2', 'client', 'svc2', 'http'), edge('e3', 'client', 'svc3', 'http')],
    );
    expect(result.visibleEdges).toHaveLength(1);
    const agg = result.visibleEdges[0];
    expect(agg.id).toMatch(new RegExp('^' + AGGREGATE_EDGE_PREFIX));
    expect(agg.source).toBe('client');
    expect(agg.target).toBe('zone1');
    expect(aggregateCount(agg)).toBe(3);
    // Particles for the 3 underlying edges should remap to the aggregate
    expect(result.edgeRemap.get('e1')).toBe(agg.id);
    expect(result.edgeRemap.get('e2')).toBe(agg.id);
    expect(result.edgeRemap.get('e3')).toBe(agg.id);
  });

  it('keeps different protocols as separate aggregates', () => {
    const outside = node('client', 'http-client');
    const z = collapsed('zone1', 'network-zone');
    const s1 = node('svc1', 'http-server', { parentId: 'zone1' });
    const s2 = node('svc2', 'http-server', { parentId: 'zone1' });
    const result = applyCollapseView(
      [outside, z, s1, s2],
      [edge('e1', 'client', 'svc1', 'http'), edge('e2', 'client', 'svc2', 'grpc')],
    );
    expect(result.visibleEdges).toHaveLength(2);
    // Each is solo (not aggregated), so they keep their original ids
    expect(result.visibleEdges.find((e) => e.id === 'e1')!.target).toBe('zone1');
    expect(result.visibleEdges.find((e) => e.id === 'e2')!.target).toBe('zone1');
  });
});

describe('applyCollapseView — nested collapse', () => {
  it('uses the outermost collapsed ancestor when multiple ancestors are collapsed', () => {
    const z = collapsed('zone1', 'network-zone');
    const h = collapsed('host1', 'host-server', { parentId: 'zone1' });
    const c = node('container1', 'container', { parentId: 'host1' });
    const s = node('svc1', 'http-server', { parentId: 'container1' });
    const outside = node('client', 'http-client');
    const result = applyCollapseView([outside, z, h, c, s], [edge('e1', 'client', 'svc1', 'http')]);
    expect(result.visibleNodes.map((n) => n.id).sort()).toEqual(['client', 'zone1']);
    expect(result.visibleEdges[0].target).toBe('zone1'); // outermost = zone1, not host1
  });

  it('hides nested host even when only the inner host is collapsed', () => {
    // zone (uncollapsed) > host (collapsed) > container > svc
    const z = node('zone1', 'network-zone');
    const h = collapsed('host1', 'host-server', { parentId: 'zone1' });
    const c = node('container1', 'container', { parentId: 'host1' });
    const s = node('svc1', 'http-server', { parentId: 'container1' });
    const result = applyCollapseView([z, h, c, s], []);
    expect(result.visibleNodes.map((n) => n.id).sort()).toEqual(['host1', 'zone1']);
  });
});

describe('applyCollapseView — bidirectional edges', () => {
  it('produces two separate aggregates for each direction', () => {
    const z = collapsed('zone1', 'network-zone');
    const s = node('svc1', 'http-server', { parentId: 'zone1' });
    const ext1 = node('client1', 'http-client');
    const ext2 = node('client2', 'http-client');
    const result = applyCollapseView(
      [z, s, ext1, ext2],
      [edge('e1', 'svc1', 'client1', 'http'), edge('e2', 'svc1', 'client2', 'http')],
    );
    // Different targets → 2 visible edges, no aggregation
    expect(result.visibleEdges).toHaveLength(2);
    for (const e of result.visibleEdges) expect(e.source).toBe('zone1');
  });
});
