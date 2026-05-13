import { describe, it, expect } from 'vitest';
import { snapToGrid, snapValue, GRID_SIZE } from '../snap-grid';

describe('snap-grid', () => {
  describe('GRID_SIZE', () => {
    it('matches the canvas minor grid (20px)', () => {
      expect(GRID_SIZE).toBe(20);
    });
  });

  describe('snapToGrid', () => {
    it('rounds to nearest 20px when enabled', () => {
      expect(snapToGrid({ x: 23, y: 47 }, true)).toEqual({ x: 20, y: 40 });
      expect(snapToGrid({ x: 31, y: 50 }, true)).toEqual({ x: 40, y: 60 });
    });

    it('returns position unchanged when disabled', () => {
      expect(snapToGrid({ x: 23, y: 47 }, false)).toEqual({ x: 23, y: 47 });
    });

    it('bypasses snap when bypass=true even if enabled', () => {
      expect(snapToGrid({ x: 23, y: 47 }, true, true)).toEqual({ x: 23, y: 47 });
    });

    it('handles negative coordinates symmetrically', () => {
      expect(snapToGrid({ x: -23, y: -11 }, true)).toEqual({ x: -20, y: -20 });
      const small = snapToGrid({ x: -9, y: -9 }, true);
      // -9 → -0.45 → rounds toward 0 (Math.round) → 0
      expect(Math.abs(small.x)).toBe(0);
      expect(Math.abs(small.y)).toBe(0);
    });

    it('preserves exact grid points', () => {
      expect(snapToGrid({ x: 0, y: 0 }, true)).toEqual({ x: 0, y: 0 });
      expect(snapToGrid({ x: 100, y: 200 }, true)).toEqual({ x: 100, y: 200 });
    });
  });

  describe('snapValue', () => {
    it('snaps a single scalar', () => {
      expect(snapValue(23, true)).toBe(20);
      expect(snapValue(31, true)).toBe(40);
    });
    it('respects disabled and bypass flags', () => {
      expect(snapValue(23, false)).toBe(23);
      expect(snapValue(23, true, true)).toBe(23);
    });
  });
});
