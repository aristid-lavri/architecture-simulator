import { describe, it, expect } from 'vitest';
import { computeContainerSize, resizeAncestors } from '../container-sizing';
import type { GraphNode } from '@/types/graph';

const mkNode = (id: string, type: GraphNode['type'], partial: Partial<GraphNode> = {}): GraphNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: {} as GraphNode['data'],
  ...partial,
});

describe('computeContainerSize — empty container', () => {
  it('returns the default size for an empty zone', () => {
    const zone = mkNode('z1', 'network-zone');
    const size = computeContainerSize(zone, [zone]);
    expect(size.width).toBe(400);
    expect(size.height).toBe(300);
  });

  it('returns the default size for an empty host-server', () => {
    const host = mkNode('h1', 'host-server');
    const size = computeContainerSize(host, [host]);
    expect(size.width).toBe(300);
    expect(size.height).toBe(250);
  });
});

describe('computeContainerSize — populated container', () => {
  it('grows to cover children at large positions', () => {
    const zone = mkNode('z1', 'network-zone');
    const child = mkNode('c1', 'http-server', {
      parentId: 'z1',
      position: { x: 500, y: 400 },
      width: 180,
      height: 80,
    });
    const size = computeContainerSize(zone, [zone, child]);
    // child right = 680, bottom = 480 → +20 padding → 700, 500
    expect(size.width).toBe(700);
    expect(size.height).toBe(500);
  });

  it('keeps the default minimum when children are small', () => {
    const zone = mkNode('z1', 'network-zone');
    const child = mkNode('c1', 'http-server', {
      parentId: 'z1',
      position: { x: 10, y: 10 },
      width: 50,
      height: 50,
    });
    const size = computeContainerSize(zone, [zone, child]);
    // child needs only 80x80 — default 400x300 wins
    expect(size.width).toBe(400);
    expect(size.height).toBe(300);
  });

  it('uses the rightmost / bottommost child to drive both dimensions', () => {
    const zone = mkNode('z1', 'network-zone');
    const a = mkNode('a', 'http-server', { parentId: 'z1', position: { x: 600, y: 50 }, width: 100, height: 80 });
    const b = mkNode('b', 'http-server', { parentId: 'z1', position: { x: 50, y: 500 }, width: 100, height: 80 });
    const size = computeContainerSize(zone, [zone, a, b]);
    expect(size.width).toBe(720);  // a's right (700) + 20
    expect(size.height).toBe(600); // b's bottom (580) + 20
  });

  it('ignores nodes that are not direct children', () => {
    const zone = mkNode('z1', 'network-zone');
    const grand = mkNode('g1', 'http-server', {
      parentId: 'h1', // grandchild via a host (not a direct child of zone)
      position: { x: 9999, y: 9999 },
    });
    const size = computeContainerSize(zone, [zone, grand]);
    expect(size.width).toBe(400);
    expect(size.height).toBe(300);
  });
});

describe('resizeAncestors — single level', () => {
  it('resizes the parent container based on the child', () => {
    const zone = mkNode('z1', 'network-zone', { width: 400, height: 300 });
    const child = mkNode('c1', 'http-server', {
      parentId: 'z1',
      position: { x: 500, y: 100 },
      width: 180,
      height: 80,
    });
    const updated = resizeAncestors([zone, child], 'c1');
    const newZone = updated.find((n) => n.id === 'z1')!;
    expect(newZone.width).toBe(700); // 500 + 180 + 20
  });

  it('does not modify the array when no change is required', () => {
    const zone = mkNode('z1', 'network-zone', { width: 400, height: 300 });
    const child = mkNode('c1', 'http-server', {
      parentId: 'z1',
      position: { x: 10, y: 10 },
      width: 50,
      height: 50,
    });
    const original = [zone, child];
    const updated = resizeAncestors(original, 'c1');
    // No size change → reference equality is preserved (Map shouldn't allocate new array entries)
    expect(updated.find((n) => n.id === 'z1')!.width).toBe(400);
    expect(updated.find((n) => n.id === 'z1')!.height).toBe(300);
  });
});

describe('resizeAncestors — nested cascade', () => {
  it('cascades through zone → host → container → service', () => {
    const zone = mkNode('z1', 'network-zone', { width: 400, height: 300 });
    const host = mkNode('h1', 'host-server', {
      parentId: 'z1',
      position: { x: 30, y: 50 },
      width: 300,
      height: 250,
    });
    const container = mkNode('co1', 'container', {
      parentId: 'h1',
      position: { x: 20, y: 50 },
      width: 200,
      height: 180,
    });
    const service = mkNode('s1', 'http-server', {
      parentId: 'co1',
      position: { x: 600, y: 400 },
      width: 100,
      height: 80,
    });
    const updated = resizeAncestors([zone, host, container, service], 's1');

    const newContainer = updated.find((n) => n.id === 'co1')!;
    expect(newContainer.width).toBe(720); // service right (700) + 20

    const newHost = updated.find((n) => n.id === 'h1')!;
    // container is now 720 wide at x=20 → host right = 740 + 20 = 760
    expect(newHost.width).toBe(760);

    const newZone = updated.find((n) => n.id === 'z1')!;
    // host is now at x=30, width=760 → zone right = 790 + 20 = 810
    expect(newZone.width).toBe(810);
  });

  it('stops the cascade when reaching a non-container parent (defensive)', () => {
    // Edge case: a non-container parent is unusual but the code must not loop forever.
    const fakeParent = mkNode('p1', 'http-server', { width: 100, height: 80 });
    const child = mkNode('c1', 'http-server', { parentId: 'p1', position: { x: 0, y: 0 } });
    const updated = resizeAncestors([fakeParent, child], 'c1');
    expect(updated).toHaveLength(2); // unchanged
  });
});
