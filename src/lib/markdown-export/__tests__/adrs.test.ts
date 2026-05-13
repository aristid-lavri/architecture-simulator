// __tests__/adrs.test.ts
import { describe, it, expect } from 'vitest';
import { buildAdrs } from '../sections/adrs';
import type { ADR } from '@/types/adr';
import type { GraphNode } from '@/types/graph';

const baseAdr = (n: number, title: string, status: ADR['status'] = 'accepted', opts: Partial<ADR> = {}): ADR => ({
  id: `a${n}`, number: n, title, status,
  date: '2026-05-13', context: 'C', decision: 'D', consequences: 'Q',
  createdAt: 0, updatedAt: 0, ...opts,
});

describe('buildAdrs', () => {
  it('returns placeholder when no ADRs', () => {
    const out = buildAdrs({ adrs: [], nodes: [], edges: [] });
    expect(out.content).toMatch(/no architecture decisions/i);
  });

  it('renders each ADR with all four standard sections', () => {
    const adrs = [baseAdr(1, 'Pick Postgres')];
    const out = buildAdrs({ adrs, nodes: [], edges: [] });
    expect(out.content).toContain('### ADR-0001 — Pick Postgres');
    expect(out.content).toContain('#### Context');
    expect(out.content).toContain('#### Decision');
    expect(out.content).toContain('#### Consequences');
  });

  it('renders alternatives only if present', () => {
    const out1 = buildAdrs({ adrs: [baseAdr(1, 't', 'accepted', { alternatives: 'A' })], nodes: [], edges: [] });
    expect(out1.content).toContain('#### Alternatives');
    const out2 = buildAdrs({ adrs: [baseAdr(1, 't')], nodes: [], edges: [] });
    expect(out2.content).not.toContain('#### Alternatives');
  });

  it('renders linked elements with their labels', () => {
    const nodes: GraphNode[] = [{ id: 'n1', type: 'database', position: { x: 0, y: 0 }, data: { label: 'orders-db' } }];
    const adrs = [baseAdr(1, 't', 'accepted', { links: [{ kind: 'node', targetId: 'n1' }] })];
    const out = buildAdrs({ adrs, nodes, edges: [] });
    expect(out.content).toMatch(/Linked elements:.*orders-db/);
  });

  it('orders by number ascending', () => {
    const out = buildAdrs({ adrs: [baseAdr(2, 'B'), baseAdr(1, 'A')], nodes: [], edges: [] });
    const idxA = out.content.indexOf('ADR-0001');
    const idxB = out.content.indexOf('ADR-0002');
    expect(idxA).toBeGreaterThan(-1);
    expect(idxA).toBeLessThan(idxB);
  });
});
