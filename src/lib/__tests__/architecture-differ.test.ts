import { describe, it, expect } from 'vitest';
import { diffArchitectures } from '../architecture-differ';
import type { ArchitectureSnapshot } from '@/types';
import type { GraphNode, GraphEdge } from '@/types/graph';

const node = (id: string, type: string, label: string, x = 0, y = 0): GraphNode => ({
  id,
  type: type as GraphNode['type'],
  position: { x, y },
  data: { label },
});

const edge = (id: string, source: string, target: string): GraphEdge => ({
  id, source, target, data: {},
});

const snap = (nodes: GraphNode[], edges: GraphEdge[] = []): ArchitectureSnapshot => ({
  id: 'snap', name: 's', timestamp: 0, nodes, edges,
});

describe('diffArchitectures — nodes', () => {
  it('détecte un nœud ajouté', () => {
    const a = snap([node('n1', 'api-service', 'Foo')]);
    const b = snap([node('n1', 'api-service', 'Foo'), node('n2', 'database', 'DB')]);
    const d = diffArchitectures(a, b);
    expect(d.nodes.find((n) => n.id === 'n2')?.status).toBe('added');
    expect(d.summary.nodesAdded).toBe(1);
  });

  it('détecte un nœud supprimé', () => {
    const a = snap([node('n1', 'api-service', 'Foo'), node('n2', 'database', 'DB')]);
    const b = snap([node('n1', 'api-service', 'Foo')]);
    const d = diffArchitectures(a, b);
    expect(d.nodes.find((n) => n.id === 'n2')?.status).toBe('removed');
    expect(d.summary.nodesRemoved).toBe(1);
  });

  it('détecte un nœud inchangé', () => {
    const a = snap([node('n1', 'api-service', 'Foo', 100, 50)]);
    const b = snap([node('n1', 'api-service', 'Foo', 100, 50)]);
    const d = diffArchitectures(a, b);
    expect(d.nodes[0].status).toBe('unchanged');
    expect(d.nodes[0].changedFields).toEqual([]);
  });

  it('détecte un nœud modifié — label change', () => {
    const a = snap([node('n1', 'api-service', 'Foo')]);
    const b = snap([node('n1', 'api-service', 'Bar')]);
    const d = diffArchitectures(a, b);
    expect(d.nodes[0].status).toBe('modified');
    expect(d.nodes[0].changedFields).toContain('data.label');
  });

  it('détecte un nœud modifié — type change', () => {
    const a = snap([node('n1', 'api-service', 'Foo')]);
    const b = snap([node('n1', 'database', 'Foo')]);
    const d = diffArchitectures(a, b);
    expect(d.nodes[0].status).toBe('modified');
    expect(d.nodes[0].changedFields).toContain('type');
  });

  it('détecte un nœud modifié — position change', () => {
    const a = snap([node('n1', 'api-service', 'Foo', 100, 100)]);
    const b = snap([node('n1', 'api-service', 'Foo', 200, 100)]);
    const d = diffArchitectures(a, b);
    expect(d.nodes[0].status).toBe('modified');
    expect(d.nodes[0].changedFields).toContain('position');
  });
});

describe('diffArchitectures — edges', () => {
  it('détecte un edge ajouté/supprimé/modifié', () => {
    const a = snap([node('n1', 'api-service', 'A'), node('n2', 'database', 'B')], [
      edge('e1', 'n1', 'n2'),
    ]);
    const b = snap([node('n1', 'api-service', 'A'), node('n2', 'database', 'B'), node('n3', 'cache', 'C')], [
      edge('e1', 'n1', 'n3'), // source-target change
      edge('e2', 'n1', 'n2'),
    ]);
    const d = diffArchitectures(a, b);
    expect(d.summary.edgesAdded).toBe(1);
    expect(d.summary.edgesRemoved).toBe(0);
    expect(d.summary.edgesModified).toBe(1);
    expect(d.edges.find((e) => e.id === 'e1')?.status).toBe('modified');
    expect(d.edges.find((e) => e.id === 'e2')?.status).toBe('added');
  });
});

describe('diffArchitectures — summary', () => {
  it('totaux cohérents avec les statuts individuels', () => {
    const a = snap([node('n1', 'a', 'X'), node('n2', 'b', 'Y')]);
    const b = snap([node('n1', 'a', 'XX'), node('n3', 'c', 'Z')]);
    const d = diffArchitectures(a, b);
    expect(d.summary.nodesAdded).toBe(1);
    expect(d.summary.nodesRemoved).toBe(1);
    expect(d.summary.nodesModified).toBe(1);
  });
});
