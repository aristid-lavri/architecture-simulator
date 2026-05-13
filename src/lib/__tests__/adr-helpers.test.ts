import { describe, it, expect } from 'vitest';
import {
  createEmptyADR,
  validateADR,
  applySupersede,
  dedupeLinks,
  nextAdrNumber,
  removeLinksToTarget,
} from '../adr-helpers';
import type { ADR } from '@/types/adr';

describe('createEmptyADR', () => {
  it('creates a draft ADR with sane defaults', () => {
    const adr = createEmptyADR(7);
    expect(adr.number).toBe(7);
    expect(adr.status).toBe('proposed');
    expect(adr.title).toBe('');
    expect(adr.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(adr.context).toBe('');
    expect(adr.createdAt).toBeGreaterThan(0);
  });
});

describe('validateADR', () => {
  it('requires title and date', () => {
    const adr = createEmptyADR(1);
    const errors = validateADR(adr);
    expect(errors).toContain('title');
    expect(errors).toContain('context');
  });

  it('accepts a fully-populated ADR', () => {
    const adr: ADR = {
      id: 'a', number: 1, title: 't', status: 'accepted',
      date: '2026-05-13', context: 'c', decision: 'd', consequences: 'q',
      createdAt: 1, updatedAt: 1,
    };
    expect(validateADR(adr)).toEqual([]);
  });
});

describe('applySupersede', () => {
  const base = (id: string, n: number): ADR => ({
    id, number: n, title: '', status: 'accepted',
    date: '', context: '', decision: '', consequences: '',
    createdAt: 0, updatedAt: 0,
  });

  it('marks A as superseded when B supersedes A', () => {
    const a = base('a', 1);
    const b = base('b', 2);
    const updated = applySupersede({ supersederId: 'b', supersededId: 'a' }, [a, b]);
    const ua = updated.find((x) => x.id === 'a')!;
    const ub = updated.find((x) => x.id === 'b')!;
    expect(ua.status).toBe('superseded');
    expect(ua.supersededBy).toBe('b');
    expect(ub.supersedes).toContain('a');
  });

  it('is idempotent', () => {
    const a = base('a', 1);
    const b = base('b', 2);
    const r1 = applySupersede({ supersederId: 'b', supersededId: 'a' }, [a, b]);
    const r2 = applySupersede({ supersederId: 'b', supersededId: 'a' }, r1);
    expect(r2.find((x) => x.id === 'b')!.supersedes).toEqual(['a']);
  });
});

describe('dedupeLinks', () => {
  it('removes exact duplicates preserving order', () => {
    expect(dedupeLinks([
      { kind: 'node', targetId: 'a' },
      { kind: 'edge', targetId: 'a' },
      { kind: 'node', targetId: 'a' },
    ])).toEqual([
      { kind: 'node', targetId: 'a' },
      { kind: 'edge', targetId: 'a' },
    ]);
  });
});

describe('nextAdrNumber', () => {
  it('returns 1 when empty', () => {
    expect(nextAdrNumber([])).toBe(1);
  });
  it('returns max(number)+1', () => {
    const adrs: ADR[] = [
      { id: 'a', number: 5, title: '', status: 'accepted', date: '', context: '', decision: '', consequences: '', createdAt: 0, updatedAt: 0 },
      { id: 'b', number: 3, title: '', status: 'accepted', date: '', context: '', decision: '', consequences: '', createdAt: 0, updatedAt: 0 },
    ];
    expect(nextAdrNumber(adrs)).toBe(6);
  });
});

describe('removeLinksToTarget', () => {
  it('drops links pointing to deleted graph element', () => {
    const adr: ADR = {
      id: 'a', number: 1, title: '', status: 'accepted', date: '',
      context: '', decision: '', consequences: '',
      links: [
        { kind: 'node', targetId: 'n1' },
        { kind: 'node', targetId: 'n2' },
        { kind: 'edge', targetId: 'n1' },
      ],
      createdAt: 0, updatedAt: 0,
    };
    const out = removeLinksToTarget(adr, 'node', 'n1');
    expect(out.links).toEqual([
      { kind: 'node', targetId: 'n2' },
      { kind: 'edge', targetId: 'n1' },
    ]);
  });
});
