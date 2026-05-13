import { describe, it, expect } from 'vitest';
import {
  compose,
  required,
  isInteger,
  isFiniteNumber,
  min,
  max,
  range,
  positive,
  nonNegative,
  validatePort,
  validateRatio01,
  validatePercent100,
  validateLatencyMs,
  validateRps,
  validatePositiveCount,
  validateNonNegativeCount,
  validateCpuCores,
  validateMemoryMb,
} from '../field-validation';

describe('field-validation primitives', () => {
  it('required catches null/undefined/blank string', () => {
    expect(required(null)).toMatch(/obligatoire/);
    expect(required(undefined)).toMatch(/obligatoire/);
    expect(required('')).toMatch(/obligatoire/);
    expect(required('   ')).toMatch(/obligatoire/);
    expect(required(0)).toBeNull();
    expect(required('foo')).toBeNull();
  });

  it('isFiniteNumber rejects NaN, Infinity, non-number', () => {
    expect(isFiniteNumber(NaN)).not.toBeNull();
    expect(isFiniteNumber(Infinity)).not.toBeNull();
    expect(isFiniteNumber(-Infinity)).not.toBeNull();
    expect(isFiniteNumber(42)).toBeNull();
  });

  it('isInteger rejects floats', () => {
    expect(isInteger(1.5)).not.toBeNull();
    expect(isInteger(2)).toBeNull();
    expect(isInteger(0)).toBeNull();
  });

  it('min / max / range', () => {
    expect(min(10)(9)).not.toBeNull();
    expect(min(10)(10)).toBeNull();
    expect(max(100)(101)).not.toBeNull();
    expect(max(100)(100)).toBeNull();
    expect(range(1, 5)(0)).not.toBeNull();
    expect(range(1, 5)(6)).not.toBeNull();
    expect(range(1, 5)(3)).toBeNull();
  });

  it('positive / nonNegative', () => {
    expect(positive(0)).not.toBeNull();
    expect(positive(1)).toBeNull();
    expect(nonNegative(-1)).not.toBeNull();
    expect(nonNegative(0)).toBeNull();
  });

  it('compose returns first error, null when all pass', () => {
    const v = compose(isInteger, range(1, 10));
    expect(v(1.5)).toMatch(/entier/);
    expect(v(0)).toMatch(/entre/);
    expect(v(11)).toMatch(/entre/);
    expect(v(5)).toBeNull();
  });
});

describe('field-validation business validators', () => {
  it('validatePort accepts 1-65535', () => {
    expect(validatePort(0)).not.toBeNull();
    expect(validatePort(1)).toBeNull();
    expect(validatePort(8080)).toBeNull();
    expect(validatePort(65535)).toBeNull();
    expect(validatePort(65536)).not.toBeNull();
    expect(validatePort(100000)).not.toBeNull();
    expect(validatePort(-1)).not.toBeNull();
  });

  it('validateRatio01 accepts 0..1', () => {
    expect(validateRatio01(0)).toBeNull();
    expect(validateRatio01(0.5)).toBeNull();
    expect(validateRatio01(1)).toBeNull();
    expect(validateRatio01(1.01)).not.toBeNull();
    expect(validateRatio01(-0.1)).not.toBeNull();
  });

  it('validatePercent100 accepts 0..100', () => {
    expect(validatePercent100(50)).toBeNull();
    expect(validatePercent100(0)).toBeNull();
    expect(validatePercent100(100)).toBeNull();
    expect(validatePercent100(101)).not.toBeNull();
    expect(validatePercent100(-1)).not.toBeNull();
  });

  it('validateLatencyMs accepts 0..60000', () => {
    expect(validateLatencyMs(50)).toBeNull();
    expect(validateLatencyMs(60000)).toBeNull();
    expect(validateLatencyMs(60001)).not.toBeNull();
    expect(validateLatencyMs(-1)).not.toBeNull();
  });

  it('validateRps accepts integer 0..1_000_000', () => {
    expect(validateRps(0)).toBeNull();
    expect(validateRps(250)).toBeNull();
    expect(validateRps(1.5)).not.toBeNull();
    expect(validateRps(2_000_000)).not.toBeNull();
  });

  it('validatePositiveCount and validateNonNegativeCount', () => {
    expect(validatePositiveCount(0)).not.toBeNull();
    expect(validatePositiveCount(1)).toBeNull();
    expect(validatePositiveCount(-5)).not.toBeNull();
    expect(validatePositiveCount(2.5)).not.toBeNull();

    expect(validateNonNegativeCount(0)).toBeNull();
    expect(validateNonNegativeCount(-1)).not.toBeNull();
  });

  it('validateCpuCores accepts integer 1..256', () => {
    expect(validateCpuCores(1)).toBeNull();
    expect(validateCpuCores(256)).toBeNull();
    expect(validateCpuCores(0)).not.toBeNull();
    expect(validateCpuCores(257)).not.toBeNull();
    expect(validateCpuCores(2.5)).not.toBeNull();
  });

  it('validateMemoryMb accepts integer 1..1_048_576', () => {
    expect(validateMemoryMb(1)).toBeNull();
    expect(validateMemoryMb(2048)).toBeNull();
    expect(validateMemoryMb(1_048_576)).toBeNull();
    expect(validateMemoryMb(0)).not.toBeNull();
    expect(validateMemoryMb(1_048_577)).not.toBeNull();
  });
});
