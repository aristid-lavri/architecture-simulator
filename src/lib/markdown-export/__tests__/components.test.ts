// __tests__/components.test.ts
import { describe, it, expect } from 'vitest';
import { buildComponents } from '../sections/components';
import type { GraphNode } from '@/types/graph';

const nd = (id: string, type: string, opts: Partial<GraphNode> = {}): GraphNode => ({
  id, type: type as GraphNode['type'], position: { x: 0, y: 0 }, data: { label: id }, ...opts,
});

describe('buildComponents', () => {
  it('returns "no components" placeholder for empty input', () => {
    const out = buildComponents({ nodes: [] });
    expect(out.content).toMatch(/no components/i);
    expect(out.count).toBe(0);
  });

  it('groups nodes by category with one table per category', () => {
    const nodes = [
      nd('c1', 'http-client'),
      nd('s1', 'api-service'),
      nd('db1', 'database'),
    ];
    const out = buildComponents({ nodes });
    expect(out.content).toContain('### Simulation');
    expect(out.content).toContain('### Compute');
    expect(out.content).toContain('### Data');
    expect(out.count).toBe(3);
  });

  it('renders tags and owner', () => {
    const nodes = [
      nd('s', 'api-service', { metadata: { tags: ['payment'], owner: { team: 'payments-team' } } }),
    ];
    const out = buildComponents({ nodes });
    expect(out.content).toContain('payment');
    expect(out.content).toContain('payments-team');
  });

  it('escapes pipe characters in label/notes', () => {
    const nodes = [nd('s', 'api-service', { data: { label: 'a|b' }, metadata: { notes: 'x|y' } })];
    const out = buildComponents({ nodes });
    expect(out.content).not.toContain('| a|b |');
    expect(out.content).toContain('a\\|b');
  });
});
