import { describe, it, expect, beforeEach } from 'vitest';
import { useArchitectureStore } from '../architecture-store';
import type { GraphNode } from '@/types/graph';

/**
 * Vérifie que `metadata` (notes / tags / lastReviewed / owner) traverse :
 *   1. setNodes → getState (in-memory roundtrip)
 *   2. partialize → JSON.stringify → JSON.parse (localStorage serialization)
 *
 * Cf. NodeMetadata dans src/types/graph.ts et le middleware persist du store.
 */
describe('architecture-store — metadata persistence', () => {
  beforeEach(() => {
    useArchitectureStore.setState({
      nodes: [],
      edges: [],
      past: [],
      future: [],
      snapshots: [],
    });
    localStorage.clear();
  });

  const fullMeta: NonNullable<GraphNode['metadata']> = {
    notes: 'Service critique — révisé par a.lavri',
    tags: ['critical', 'PCI', 'legacy'],
    lastReviewed: '2026-05-13',
    owner: { team: 'platform', individual: 'a.lavri@desjardins.com' },
  };

  const nodeWithMeta: GraphNode = {
    id: 'node-meta',
    type: 'http-server',
    position: { x: 100, y: 200 },
    data: { label: 'API Auth', port: 8080 },
    metadata: fullMeta,
  };

  it('in-memory roundtrip preserves all metadata fields', () => {
    useArchitectureStore.getState().setNodes([nodeWithMeta]);
    const stored = useArchitectureStore.getState().nodes[0];
    expect(stored.metadata).toEqual(fullMeta);
  });

  it('survives JSON serialize/deserialize (simulating localStorage)', () => {
    useArchitectureStore.getState().setNodes([nodeWithMeta]);

    const serialized = JSON.stringify({ nodes: useArchitectureStore.getState().nodes });
    const deserialized = JSON.parse(serialized) as { nodes: GraphNode[] };

    expect(deserialized.nodes[0].metadata).toEqual(fullMeta);
    expect(deserialized.nodes[0].metadata?.tags).toEqual(['critical', 'PCI', 'legacy']);
    expect(deserialized.nodes[0].metadata?.owner?.team).toBe('platform');
  });

  it('omits metadata when undefined (no pollution)', () => {
    const plainNode: GraphNode = {
      id: 'node-plain',
      type: 'http-client',
      position: { x: 0, y: 0 },
      data: { label: 'Client' },
    };
    useArchitectureStore.getState().setNodes([plainNode]);
    const stored = useArchitectureStore.getState().nodes[0];
    expect(stored.metadata).toBeUndefined();

    const json = JSON.stringify(stored);
    expect(json.includes('"metadata"')).toBe(false);
  });

  it('partial metadata (only some fields) is preserved as-is', () => {
    const partial: GraphNode = {
      id: 'node-partial',
      type: 'database',
      position: { x: 0, y: 0 },
      data: { label: 'DB' },
      metadata: { tags: ['data'] },
    };
    useArchitectureStore.getState().setNodes([partial]);
    const stored = useArchitectureStore.getState().nodes[0];

    expect(stored.metadata).toEqual({ tags: ['data'] });
    expect(stored.metadata?.notes).toBeUndefined();
    expect(stored.metadata?.owner).toBeUndefined();
  });

  it('addNode preserves metadata field', () => {
    useArchitectureStore.getState().setNodes([]);
    useArchitectureStore.getState().addNode(nodeWithMeta);
    const stored = useArchitectureStore.getState().nodes[0];
    expect(stored.metadata).toEqual(fullMeta);
  });
});
