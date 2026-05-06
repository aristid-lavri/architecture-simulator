import { describe, it, expect } from 'vitest';
import { runOwaspValidation } from '../engine';
import { ALL_RULES } from '../rules';

describe('runOwaspValidation', () => {
  it('returns 10 rules total', () => {
    expect(ALL_RULES.length).toBe(10);
  });

  it('passes empty graph (vacuously true)', () => {
    const result = runOwaspValidation({ nodes: [], edges: [] });
    expect(result.failedRules).toBe(0);
    expect(result.violations).toEqual([]);
    expect(result.passedRules).toBe(10);
  });

  it('aggregates violations by severity', () => {
    const result = runOwaspValidation({
      nodes: [
        { id: 'c', type: 'client-group', position: { x: 0, y: 0 }, data: {} as never },
        { id: 'g', type: 'api-gateway', position: { x: 0, y: 0 }, data: { authType: 'none' } as never },
      ],
      edges: [{ id: 'c-g', source: 'c', target: 'g' }],
    });
    expect(result.failedRules).toBeGreaterThanOrEqual(1);
    expect(result.bySeverity.CRITICAL).toBeGreaterThanOrEqual(1);
  });
});
