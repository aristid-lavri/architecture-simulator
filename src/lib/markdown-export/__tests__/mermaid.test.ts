// __tests__/mermaid.test.ts
import { describe, it, expect } from 'vitest';
import { buildMermaid } from '../sections/mermaid';
import type { GraphNode, GraphEdge } from '@/types/graph';

const node = (id: string, type: string, label: string): GraphNode => ({
  id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, data: { label },
});

describe('buildMermaid', () => {
  it('returns an empty fence when graph is empty', () => {
    const out = buildMermaid({ nodes: [], edges: [] });
    expect(out.content).toMatch(/```mermaid[\s\S]*flowchart LR/);
    expect(out.content).toContain('%% empty');
  });

  it('renders nodes with sanitized ids and labels', () => {
    const nodes = [node('db.1', 'database', 'orders db')];
    const out = buildMermaid({ nodes, edges: [] });
    // Mermaid identifiers cannot contain dots — they must be replaced
    expect(out.content).toContain('n_db_1[');
    expect(out.content).toContain('orders db');
  });

  it('renders edges with protocol labels', () => {
    const nodes = [node('a', 'http-client', 'client'), node('b', 'api-service', 'api')];
    const edges: GraphEdge[] = [{ id: 'e1', source: 'a', target: 'b', data: { protocol: 'https' } }];
    const out = buildMermaid({ nodes, edges });
    expect(out.content).toContain('n_a -->|https| n_b');
  });

  it('escapes pipes and quotes in labels', () => {
    const nodes = [node('a', 'api-service', 'foo | "bar"')];
    const out = buildMermaid({ nodes, edges: [] });
    expect(out.content).not.toContain('foo |');
    expect(out.content).toContain('foo &#124; ');
  });
});
