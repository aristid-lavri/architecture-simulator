import { describe, it, expect } from 'vitest';
import type { GraphEdge } from '@/types/graph';
import {
  getSuppressedRules,
  isRuleSuppressedOnEdge,
  findSuppression,
  addSuppression,
  removeSuppression,
  SUPPRESSED_RULES_KEY,
  type SuppressedRule,
} from '../index';

function makeEdge(data?: Record<string, unknown>): GraphEdge {
  return {
    id: 'edge-1',
    source: 'a',
    target: 'b',
    ...(data !== undefined ? { data } : {}),
  };
}

const VALID: SuppressedRule = {
  ruleId: 'rule-x',
  reason: 'business rationale',
  suppressedAt: '2026-01-01T00:00:00.000Z',
};

describe('suppression/reader', () => {
  describe('getSuppressedRules', () => {
    it('returns [] for an edge with no data', () => {
      const edge = makeEdge();
      expect(getSuppressedRules(edge)).toEqual([]);
    });

    it('returns [] for an edge with empty data object', () => {
      const edge = makeEdge({});
      expect(getSuppressedRules(edge)).toEqual([]);
    });

    it('returns [] for an edge with empty suppressions array', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [] });
      expect(getSuppressedRules(edge)).toEqual([]);
    });

    it('returns [] when the key value is not an array (object, string, null)', () => {
      expect(getSuppressedRules(makeEdge({ [SUPPRESSED_RULES_KEY]: 'oops' }))).toEqual([]);
      expect(getSuppressedRules(makeEdge({ [SUPPRESSED_RULES_KEY]: { foo: 'bar' } }))).toEqual([]);
      expect(getSuppressedRules(makeEdge({ [SUPPRESSED_RULES_KEY]: null }))).toEqual([]);
    });

    it('returns the array on a well-formed edge', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      expect(getSuppressedRules(edge)).toEqual([VALID]);
    });

    it('filters out malformed entries (missing/wrong-type fields)', () => {
      const edge = makeEdge({
        [SUPPRESSED_RULES_KEY]: [
          VALID,
          { ruleId: 'no-reason', suppressedAt: '2026-01-01T00:00:00.000Z' },
          { ruleId: 'r', reason: 'r', suppressedAt: 123 },
          { ruleId: 42, reason: 'r', suppressedAt: '2026-01-01T00:00:00.000Z' },
          null,
          'not-an-object',
          undefined,
        ],
      });
      expect(getSuppressedRules(edge)).toEqual([VALID]);
    });
  });

  describe('isRuleSuppressedOnEdge', () => {
    it('returns true when the ruleId is present', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      expect(isRuleSuppressedOnEdge(edge, 'rule-x')).toBe(true);
    });

    it('returns false when the ruleId is absent', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      expect(isRuleSuppressedOnEdge(edge, 'rule-y')).toBe(false);
    });

    it('returns false on edges with no data', () => {
      expect(isRuleSuppressedOnEdge(makeEdge(), 'rule-x')).toBe(false);
    });
  });

  describe('findSuppression', () => {
    it('returns the matching entry', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      expect(findSuppression(edge, 'rule-x')).toEqual(VALID);
    });

    it('returns undefined if not found', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      expect(findSuppression(edge, 'rule-y')).toBeUndefined();
    });

    it('returns undefined when no data', () => {
      expect(findSuppression(makeEdge(), 'rule-x')).toBeUndefined();
    });
  });
});

describe('suppression/writer', () => {
  describe('addSuppression', () => {
    it('returns a NEW edge reference (not the same)', () => {
      const edge = makeEdge();
      const result = addSuppression(edge, 'rule-x', 'because');
      expect(result).not.toBe(edge);
      expect(result.data).not.toBe(edge.data);
    });

    it('adds the suppression with trimmed reason and ISO timestamp', () => {
      const edge = makeEdge();
      const fixedNow = () => new Date('2026-05-10T12:34:56.000Z');
      const result = addSuppression(edge, 'rule-x', '  has spaces  ', fixedNow);
      const list = getSuppressedRules(result);
      expect(list).toEqual([
        {
          ruleId: 'rule-x',
          reason: 'has spaces',
          suppressedAt: '2026-05-10T12:34:56.000Z',
        },
      ]);
    });

    it('does not mutate the original edge', () => {
      const original = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      const snapshot = JSON.parse(JSON.stringify(original));
      addSuppression(original, 'rule-y', 'another');
      expect(original).toEqual(snapshot);
      // Reference identity of nested data preserved on original
      expect((original.data?.[SUPPRESSED_RULES_KEY] as unknown[])).toHaveLength(1);
    });

    it('replaces an existing suppression with the same ruleId (no duplicate)', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      const fixedNow = () => new Date('2026-06-01T00:00:00.000Z');
      const result = addSuppression(edge, 'rule-x', 'updated reason', fixedNow);
      const list = getSuppressedRules(result);
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        ruleId: 'rule-x',
        reason: 'updated reason',
        suppressedAt: '2026-06-01T00:00:00.000Z',
      });
    });

    it('throws on empty reason', () => {
      expect(() => addSuppression(makeEdge(), 'rule-x', '')).toThrow(/reason cannot be empty/);
    });

    it('throws on whitespace-only reason', () => {
      expect(() => addSuppression(makeEdge(), 'rule-x', '   \t\n  ')).toThrow(/reason cannot be empty/);
    });

    it('uses injected `now` deterministically', () => {
      const edge = makeEdge();
      const fixedNow = () => new Date('2030-12-31T23:59:59.999Z');
      const result = addSuppression(edge, 'rule-x', 'r', fixedNow);
      expect(getSuppressedRules(result)[0].suppressedAt).toBe('2030-12-31T23:59:59.999Z');
    });

    it('preserves other keys in edge.data', () => {
      const edge = makeEdge({ protocol: 'http', latency: 42 });
      const result = addSuppression(edge, 'rule-x', 'r');
      expect(result.data?.protocol).toBe('http');
      expect(result.data?.latency).toBe(42);
      expect(getSuppressedRules(result)).toHaveLength(1);
    });

    it('appends multiple distinct suppressions', () => {
      const e1 = addSuppression(makeEdge(), 'rule-a', 'ra', () => new Date('2026-01-01T00:00:00.000Z'));
      const e2 = addSuppression(e1, 'rule-b', 'rb', () => new Date('2026-01-02T00:00:00.000Z'));
      const list = getSuppressedRules(e2);
      expect(list).toHaveLength(2);
      expect(list.map((s) => s.ruleId).sort()).toEqual(['rule-a', 'rule-b']);
    });
  });

  describe('removeSuppression', () => {
    it('removes the matching entry', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      const result = removeSuppression(edge, 'rule-x');
      expect(getSuppressedRules(result)).toEqual([]);
    });

    it('is a no-op when the ruleId is absent', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      const result = removeSuppression(edge, 'rule-other');
      expect(getSuppressedRules(result)).toEqual([VALID]);
    });

    it('is a no-op when no data exists', () => {
      const edge = makeEdge();
      const result = removeSuppression(edge, 'rule-x');
      expect(getSuppressedRules(result)).toEqual([]);
    });

    it('returns a NEW edge reference (not the same)', () => {
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      const result = removeSuppression(edge, 'rule-x');
      expect(result).not.toBe(edge);
      expect(result.data).not.toBe(edge.data);
    });

    it('does not mutate the original edge', () => {
      const original = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID] });
      const snapshot = JSON.parse(JSON.stringify(original));
      removeSuppression(original, 'rule-x');
      expect(original).toEqual(snapshot);
    });

    it('preserves other keys in edge.data', () => {
      const edge = makeEdge({
        protocol: 'http',
        latency: 42,
        [SUPPRESSED_RULES_KEY]: [VALID],
      });
      const result = removeSuppression(edge, 'rule-x');
      expect(result.data?.protocol).toBe('http');
      expect(result.data?.latency).toBe(42);
      expect(getSuppressedRules(result)).toEqual([]);
    });

    it('only removes the matching ruleId, keeping the others', () => {
      const other: SuppressedRule = {
        ruleId: 'rule-y',
        reason: 'r',
        suppressedAt: '2026-01-01T00:00:00.000Z',
      };
      const edge = makeEdge({ [SUPPRESSED_RULES_KEY]: [VALID, other] });
      const result = removeSuppression(edge, 'rule-x');
      expect(getSuppressedRules(result)).toEqual([other]);
    });
  });
});
