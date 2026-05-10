import { describe, it, expect } from 'vitest';
import type { GraphNode, GraphEdge } from '@/types/graph';
import { findSubtreeNodes, findBoundaryEdges } from '../subtree-utils';

const node = (id: string, parentId?: string, data: Record<string, unknown> = {}): GraphNode => ({
  id,
  type: 'api-service' as GraphNode['type'],
  position: { x: 0, y: 0 },
  data,
  parentId,
});

const edge = (id: string, source: string, target: string): GraphEdge => ({
  id, source, target, data: {},
});

describe('findSubtreeNodes', () => {
  it('returns just the root when no children', () => {
    const root = node('root');
    expect(findSubtreeNodes('root', [root])).toEqual(new Set(['root']));
  });

  it('returns root + direct children via parentId', () => {
    const root = node('root');
    const child1 = node('c1', 'root');
    const child2 = node('c2', 'root');
    const unrelated = node('u');
    expect(findSubtreeNodes('root', [root, child1, child2, unrelated])).toEqual(
      new Set(['root', 'c1', 'c2']),
    );
  });

  it('returns transitive descendants', () => {
    const root = node('root');
    const child = node('c', 'root');
    const grand = node('g', 'c');
    expect(findSubtreeNodes('root', [root, child, grand])).toEqual(
      new Set(['root', 'c', 'g']),
    );
  });

  it('also follows C4 parentSystemId / parentContainerId hierarchies', () => {
    const sys = node('sys', undefined, { level: 'context' });
    const container = node('cont', undefined, { level: 'containers', parentSystemId: 'sys' });
    const component = node('comp', undefined, { level: 'components', parentContainerId: 'cont' });
    expect(findSubtreeNodes('sys', [sys, container, component])).toEqual(
      new Set(['sys', 'cont', 'comp']),
    );
  });

  it('returns empty set if root not in nodes', () => {
    expect(findSubtreeNodes('ghost', [node('a')])).toEqual(new Set());
  });

  it('handles a node referencing itself defensively (no infinite loop)', () => {
    const self: GraphNode = {
      id: 'a',
      type: 'api-service' as GraphNode['type'],
      position: { x: 0, y: 0 },
      data: { parentSystemId: 'a' },
    };
    // Self-reference shouldn't add 'a' twice or loop; it's already in the result via root.
    expect(findSubtreeNodes('a', [self])).toEqual(new Set(['a']));
  });
});

describe('findBoundaryEdges', () => {
  it('classifies entering / leaving / internal edges', () => {
    const subtree = new Set(['a', 'b']);
    const allEdges: GraphEdge[] = [
      edge('e1', 'ext', 'a'),  // entering
      edge('e2', 'a', 'b'),    // internal
      edge('e3', 'b', 'ext'),  // leaving
      edge('e4', 'ext', 'ext2'), // outside (ignored)
    ];
    const result = findBoundaryEdges(subtree, allEdges);
    expect(result.entering.map((e) => e.id)).toEqual(['e1']);
    expect(result.leaving.map((e) => e.id)).toEqual(['e3']);
    expect(result.internal.map((e) => e.id)).toEqual(['e2']);
  });

  it('returns empty arrays for empty subtree', () => {
    const result = findBoundaryEdges(new Set(), [edge('e', 'a', 'b')]);
    expect(result.entering).toEqual([]);
    expect(result.leaving).toEqual([]);
    expect(result.internal).toEqual([]);
  });
});
