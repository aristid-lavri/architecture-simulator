import { describe, it, expect } from 'vitest';
import { computeEdgeAnchors, type NodeBounds } from '../edge-anchors';
import type { GraphEdge } from '@/types/graph';

const mkEdge = (id: string, source: string, target: string, data: Partial<GraphEdge> = {}): GraphEdge => ({
  id, source, target, ...data,
});

const bounds = (x: number, y: number, w = 100, h = 60): NodeBounds => ({ x, y, width: w, height: h });

describe('computeEdgeAnchors — single edge', () => {
  it('places the only edge at the midpoint of each side', () => {
    const map = new Map<string, NodeBounds>([
      ['A', bounds(0, 0)],   // centre at (50, 30)
      ['B', bounds(200, 0)], // centre at (250, 30)
    ]);
    const anchors = computeEdgeAnchors([mkEdge('e1', 'A', 'B')], map);
    const a = anchors.get('e1')!;
    expect(a.sourceSide).toBe('right');
    expect(a.targetSide).toBe('left');
    expect(a.source).toEqual({ x: 100, y: 30 });
    expect(a.target).toEqual({ x: 200, y: 30 });
  });

  it('detects vertical orientation (top/bottom)', () => {
    const map = new Map<string, NodeBounds>([
      ['A', bounds(0, 0)],
      ['B', bounds(0, 200)],
    ]);
    const anchors = computeEdgeAnchors([mkEdge('e1', 'A', 'B')], map);
    const a = anchors.get('e1')!;
    expect(a.sourceSide).toBe('bottom');
    expect(a.targetSide).toBe('top');
  });
});

describe('computeEdgeAnchors — parallel edges on same side', () => {
  it('distributes 2 edges symmetrically around the midpoint', () => {
    const map = new Map<string, NodeBounds>([
      ['A', bounds(0, 0)],
      ['B', bounds(200, 0)],
    ]);
    const edges = [mkEdge('e1', 'A', 'B'), mkEdge('e2', 'A', 'B')];
    const anchors = computeEdgeAnchors(edges, map);

    // 2 edges on 60-px-tall right side of A: ratios 0.2 and 0.8
    // y positions: 0 + 60*0.2 = 12 and 0 + 60*0.8 = 48
    expect(anchors.get('e1')!.source).toEqual({ x: 100, y: 12 });
    expect(anchors.get('e2')!.source).toEqual({ x: 100, y: 48 });

    // Targets distributed on left side of B
    expect(anchors.get('e1')!.target).toEqual({ x: 200, y: 12 });
    expect(anchors.get('e2')!.target).toEqual({ x: 200, y: 48 });
  });

  it('distributes 5 edges across the side (within MAX_DISTINCT_ANCHORS=4)', () => {
    const map = new Map<string, NodeBounds>([
      ['A', bounds(0, 0)],
      ['B', bounds(200, 0)],
    ]);
    const edges = ['e1', 'e2', 'e3', 'e4', 'e5'].map((id) => mkEdge(id, 'A', 'B'));
    const anchors = computeEdgeAnchors(edges, map);

    // 5 > 4 → collapse all to centre (ratio 0.5)
    for (const e of edges) {
      expect(anchors.get(e.id)!.source).toEqual({ x: 100, y: 30 });
    }
  });

  it('distributes 4 edges with ratios 0.2, 0.4, 0.6, 0.8', () => {
    const map = new Map<string, NodeBounds>([
      ['A', bounds(0, 0)],
      ['B', bounds(200, 0)],
    ]);
    const edges = ['e1', 'e2', 'e3', 'e4'].map((id) => mkEdge(id, 'A', 'B'));
    const anchors = computeEdgeAnchors(edges, map);
    const ys = edges.map((e) => anchors.get(e.id)!.source.y);
    expect(ys).toEqual([12, 24, 36, 48]); // 60 * [0.2, 0.4, 0.6, 0.8]
  });

  it('produces stable ordering regardless of input edge order', () => {
    const map = new Map<string, NodeBounds>([
      ['A', bounds(0, 0)],
      ['B', bounds(200, 0)],
    ]);
    const inOrder = computeEdgeAnchors([mkEdge('e1', 'A', 'B'), mkEdge('e2', 'A', 'B')], map);
    const reversed = computeEdgeAnchors([mkEdge('e2', 'A', 'B'), mkEdge('e1', 'A', 'B')], map);
    expect(inOrder.get('e1')!.source).toEqual(reversed.get('e1')!.source);
    expect(inOrder.get('e2')!.source).toEqual(reversed.get('e2')!.source);
  });
});

describe('computeEdgeAnchors — bidirectional edges', () => {
  it('groups A→B and B→A on the same side and distributes them', () => {
    const map = new Map<string, NodeBounds>([
      ['A', bounds(0, 0)],
      ['B', bounds(200, 0)],
    ]);
    const edges = [mkEdge('e1', 'A', 'B'), mkEdge('e2', 'B', 'A')];
    const anchors = computeEdgeAnchors(edges, map);

    // e1 source on right of A, e1 target on left of B
    // e2 source on left of B (faces A which is to the left), e2 target on right of A
    // → A's right side has 2 ends (e1.source + e2.target), B's left has 2 ends (e1.target + e2.source)
    const e1 = anchors.get('e1')!;
    const e2 = anchors.get('e2')!;
    expect(e1.sourceSide).toBe('right');
    expect(e2.targetSide).toBe('right');
    // Two distinct y positions on A's right side
    expect(e1.source.y).not.toBe(e2.target.y);
  });
});

describe('computeEdgeAnchors — self-referent edges excluded', () => {
  it('skips edges where source equals target', () => {
    const map = new Map<string, NodeBounds>([['A', bounds(0, 0)]]);
    const anchors = computeEdgeAnchors([mkEdge('loop', 'A', 'A')], map);
    expect(anchors.has('loop')).toBe(false);
  });
});

describe('computeEdgeAnchors — honorHandles option', () => {
  it('uses parsed handle side instead of angle when honorHandles is true', () => {
    const map = new Map<string, NodeBounds>([
      ['A', bounds(0, 0)],
      ['B', bounds(200, 0)],
    ]);
    // Force the source to use the top handle even though geometry suggests right
    const e = mkEdge('e1', 'A', 'B', { sourceHandle: 'source-top' });
    const anchors = computeEdgeAnchors([e], map, { honorHandles: true });
    expect(anchors.get('e1')!.sourceSide).toBe('top');
  });

  it('falls back to angle-based when handle is missing even with honorHandles', () => {
    const map = new Map<string, NodeBounds>([
      ['A', bounds(0, 0)],
      ['B', bounds(200, 0)],
    ]);
    const anchors = computeEdgeAnchors([mkEdge('e1', 'A', 'B')], map, { honorHandles: true });
    expect(anchors.get('e1')!.sourceSide).toBe('right');
  });
});

describe('computeEdgeAnchors — independent sides', () => {
  it('distributes edges separately on different sides of the same node', () => {
    // Hub at centre with neighbours in the 4 cardinal directions
    const map = new Map<string, NodeBounds>([
      ['hub',   bounds(100, 100)],
      ['north', bounds(100, -200)],
      ['south', bounds(100, 400)],
      ['east',  bounds(400, 100)],
      ['west',  bounds(-200, 100)],
    ]);
    const edges = [
      mkEdge('e_n', 'hub', 'north'),
      mkEdge('e_s', 'hub', 'south'),
      mkEdge('e_e', 'hub', 'east'),
      mkEdge('e_w', 'hub', 'west'),
    ];
    const anchors = computeEdgeAnchors(edges, map);
    // Each side has exactly 1 edge → ratio 0.5 (centre of side)
    expect(anchors.get('e_n')!.source).toEqual({ x: 150, y: 100 }); // top centre
    expect(anchors.get('e_s')!.source).toEqual({ x: 150, y: 160 }); // bottom centre
    expect(anchors.get('e_e')!.source).toEqual({ x: 200, y: 130 }); // right centre
    expect(anchors.get('e_w')!.source).toEqual({ x: 100, y: 130 }); // left centre
  });
});
