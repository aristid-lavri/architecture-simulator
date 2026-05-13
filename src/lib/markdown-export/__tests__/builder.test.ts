// __tests__/builder.test.ts
import { describe, it, expect } from 'vitest';
import { buildMarkdown } from '../builder';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ADR } from '@/types/adr';

const fixedDate = new Date('2026-05-13T12:00:00Z');

const nodes: GraphNode[] = [
  { id: 'c', type: 'http-client', position: { x: 0, y: 0 }, data: { label: 'client' } },
  { id: 's', type: 'api-service', position: { x: 0, y: 0 }, data: { label: 'svc' },
    metadata: { tags: ['payment'], owner: { team: 'pay' } } },
  { id: 'db', type: 'database', position: { x: 0, y: 0 }, data: { label: 'orders-db' } },
];
const edges: GraphEdge[] = [
  { id: 'e1', source: 'c', target: 's', data: { protocol: 'https' } },
  { id: 'e2', source: 's', target: 'db', data: { protocol: 'tcp' } },
];
const adrs: ADR[] = [
  { id: 'a1', number: 1, title: 'Pick Postgres', status: 'accepted',
    date: '2026-05-13', context: 'ctx', decision: 'dec', consequences: 'cons',
    links: [{ kind: 'node', targetId: 'db' }],
    createdAt: 0, updatedAt: 0 },
];

describe('buildMarkdown', () => {
  it('includes all sections in correct order for a complete input', () => {
    const md = buildMarkdown({ name: 'P', nodes, edges, adrs, exportedAt: fixedDate });
    const idx = (s: string) => md.indexOf(s);
    expect(idx('# P')).toBe(0);
    expect(idx('## Overview')).toBeGreaterThan(idx('# P'));
    expect(idx('## Diagram')).toBeGreaterThan(idx('## Overview'));
    expect(idx('## Components')).toBeGreaterThan(idx('## Diagram'));
    expect(idx('## Connections')).toBeGreaterThan(idx('## Components'));
    expect(idx('## Architecture Decisions')).toBeGreaterThan(idx('## Connections'));
    expect(idx('## Tags Index')).toBeGreaterThan(idx('## Architecture Decisions'));
  });

  it('produces stable output for the same input (deterministic)', () => {
    const md1 = buildMarkdown({ name: 'P', nodes, edges, adrs, exportedAt: fixedDate });
    const md2 = buildMarkdown({ name: 'P', nodes, edges, adrs, exportedAt: fixedDate });
    expect(md1).toBe(md2);
  });

  it('handles empty input gracefully', () => {
    const md = buildMarkdown({ name: 'Empty', nodes: [], edges: [], adrs: [], exportedAt: fixedDate });
    expect(md).toContain('# Empty');
    expect(md).toMatch(/_no components yet_/);
    expect(md).toMatch(/_no architecture decisions recorded_/);
  });

  it("uses today's date when exportedAt is omitted", () => {
    const md = buildMarkdown({ name: 'P', nodes: [], edges: [] });
    expect(md).toMatch(/Exported on \d{4}-\d{2}-\d{2}/);
  });
});
