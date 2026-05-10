import { describe, expect, it } from 'vitest';
import { buildContext } from '../context';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { DraftEdge } from '@/plugins/extensions/edge-creation';

function makeNode(id: string): GraphNode {
  return {
    id,
    type: 'http-server',
    position: { x: 0, y: 0 },
    data: {},
  };
}

function makeEdge(id: string, source: string, target: string): GraphEdge {
  return { id, source, target };
}

describe('buildContext', () => {
  it('returns a context whose nodeMap.size equals nodes.length', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('e1', 'a', 'b')];
    const ctx = buildContext(nodes, edges);
    expect(ctx.nodeMap.size).toBe(nodes.length);
    expect(ctx.nodes).toBe(nodes);
    expect(ctx.edges).toBe(edges);
  });

  it('nodeMap allows O(1) lookup by id', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const ctx = buildContext([a, b], []);
    expect(ctx.nodeMap.get('a')).toBe(a);
    expect(ctx.nodeMap.get('b')).toBe(b);
    expect(ctx.nodeMap.get('missing')).toBeUndefined();
  });

  it('preserves draftEdge when passed', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const draft: DraftEdge = {
      id: 'draft-1',
      source: 'a',
      target: 'b',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: { protocol: 'http' },
    };
    const ctx = buildContext(nodes, [], draft);
    expect(ctx.draftEdge).toBe(draft);
    expect(ctx.draftEdge?.id).toBe('draft-1');
  });

  it('omits draftEdge when not provided', () => {
    const ctx = buildContext([makeNode('a')], []);
    expect(ctx.draftEdge).toBeUndefined();
  });

  it('produces a valid empty context for empty inputs', () => {
    const ctx = buildContext([], []);
    expect(ctx.nodes).toEqual([]);
    expect(ctx.edges).toEqual([]);
    expect(ctx.nodeMap.size).toBe(0);
    expect(ctx.draftEdge).toBeUndefined();
  });
});
