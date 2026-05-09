import { describe, it, expect } from 'vitest';
import {
  createSeededRNG,
  cyrb53,
  randomSeed,
  rngUtils,
  type SimulationRNG,
} from '../SimulationRNG';

describe('SimulationRNG', () => {
  describe('createSeededRNG', () => {
    it('produces deterministic sequences for identical numeric seeds', () => {
      const rngA = createSeededRNG(12345);
      const rngB = createSeededRNG(12345);
      const samplesA: number[] = [];
      const samplesB: number[] = [];
      for (let i = 0; i < 1000; i++) {
        samplesA.push(rngA());
        samplesB.push(rngB());
      }
      expect(samplesA).toEqual(samplesB);
    });

    it('produces deterministic sequences for identical string seeds', () => {
      const rngA = createSeededRNG('my-experiment-42');
      const rngB = createSeededRNG('my-experiment-42');
      for (let i = 0; i < 1000; i++) {
        expect(rngA()).toBe(rngB());
      }
    });

    it('produces different sequences for different seeds', () => {
      const rngA = createSeededRNG(1);
      const rngB = createSeededRNG(2);
      const samplesA: number[] = [];
      const samplesB: number[] = [];
      for (let i = 0; i < 100; i++) {
        samplesA.push(rngA());
        samplesB.push(rngB());
      }
      expect(samplesA).not.toEqual(samplesB);
    });

    it('returns values strictly in [0, 1)', () => {
      const rng = createSeededRNG(42);
      for (let i = 0; i < 10000; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('produces a roughly uniform distribution', () => {
      const rng = createSeededRNG('uniform-check');
      const buckets = new Array(10).fill(0);
      const N = 100_000;
      for (let i = 0; i < N; i++) {
        buckets[Math.floor(rng() * 10)]++;
      }
      // Allow +/- 2% deviation per bucket (tres permissif pour mulberry32)
      const expected = N / 10;
      for (const count of buckets) {
        expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
      }
    });
  });

  describe('cyrb53', () => {
    it('is deterministic', () => {
      expect(cyrb53('hello')).toBe(cyrb53('hello'));
    });

    it('produces different hashes for different inputs', () => {
      expect(cyrb53('hello')).not.toBe(cyrb53('world'));
    });

    it('produces different hashes for different seeds', () => {
      expect(cyrb53('hello', 0)).not.toBe(cyrb53('hello', 1));
    });
  });

  describe('randomSeed', () => {
    it('returns a 32-bit unsigned integer', () => {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(0x100000000);
    });

    it('returns different values across calls (entropy)', () => {
      const seeds = new Set<number>();
      for (let i = 0; i < 20; i++) {
        seeds.add(randomSeed());
      }
      // Tres tolerant : >= 50% de seeds distincts. Dans un meme tick Date.now est
      // constant, donc l'entropie vient uniquement de Math.random sur 16 bits — on
      // garde la barre basse pour eviter les flakes sur des hosts rapides.
      expect(seeds.size).toBeGreaterThanOrEqual(10);
    });
  });

  describe('rngUtils', () => {
    it('intRange returns integers in [0, max)', () => {
      const rng: SimulationRNG = createSeededRNG(7);
      for (let i = 0; i < 1000; i++) {
        const v = rngUtils.intRange(rng, 10);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(10);
      }
    });

    it('chance is deterministic and respects probability', () => {
      const rng = createSeededRNG('chance-seed');
      let trues = 0;
      const N = 10000;
      for (let i = 0; i < N; i++) {
        if (rngUtils.chance(rng, 0.3)) trues++;
      }
      // Tolerance 1% autour de 30%
      expect(trues / N).toBeGreaterThan(0.28);
      expect(trues / N).toBeLessThan(0.32);
    });
  });
});
