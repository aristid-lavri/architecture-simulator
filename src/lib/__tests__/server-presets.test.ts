/**
 * Unit tests for the host-server preset helpers (A4.3).
 */
import { describe, it, expect } from 'vitest';
import { applyServerPreset, detectServerPreset } from '@/lib/server-presets';
import { serverPresets, defaultServerResources } from '@/types';
import type { ServerResources } from '@/types';

describe('applyServerPreset', () => {
  it('returns the small preset values', () => {
    const result = applyServerPreset('small');
    expect(result).toBeDefined();
    expect(result!.cpu.cores).toBe(1);
    expect(result!.memory.totalMB).toBe(512);
    expect(result!.connections.maxConcurrent).toBe(20);
  });

  it('returns the medium preset values', () => {
    const result = applyServerPreset('medium');
    expect(result).toBeDefined();
    expect(result!.cpu.cores).toBe(4);
    expect(result!.memory.totalMB).toBe(8192);
  });

  it('returns the large preset values', () => {
    const result = applyServerPreset('large');
    expect(result).toBeDefined();
    expect(result!.cpu.cores).toBe(16);
    expect(result!.memory.totalMB).toBe(32768);
    expect(result!.network.bandwidthMbps).toBe(10000);
  });

  it('returns undefined for custom (no-op)', () => {
    expect(applyServerPreset('custom')).toBeUndefined();
  });

  it('returns a fresh clone (does not share refs with serverPresets)', () => {
    const result = applyServerPreset('medium')!;
    result.cpu.cores = 999;
    expect(serverPresets.medium.cpu.cores).toBe(4);
  });

  it('applies preset to a mock node and overwrites cpu/memory/network/connections', () => {
    const node = { data: { resources: { ...defaultServerResources } as ServerResources } };
    const applied = applyServerPreset('large');
    expect(applied).toBeDefined();
    node.data.resources = applied!;
    expect(node.data.resources.cpu.cores).toBe(16);
    expect(node.data.resources.memory.totalMB).toBe(32768);
    expect(node.data.resources.network.bandwidthMbps).toBe(10000);
    expect(node.data.resources.connections.maxConcurrent).toBe(1000);
  });
});

describe('detectServerPreset', () => {
  it('detects "small" when resources match the small preset', () => {
    expect(detectServerPreset(serverPresets.small)).toBe('small');
  });

  it('detects "medium" when resources match the medium preset', () => {
    expect(detectServerPreset(serverPresets.medium)).toBe('medium');
  });

  it('detects "large" when resources match the large preset', () => {
    expect(detectServerPreset(serverPresets.large)).toBe('large');
  });

  it('returns "custom" when resources diverge from every preset', () => {
    const custom: ServerResources = {
      ...serverPresets.medium,
      cpu: { ...serverPresets.medium.cpu, cores: 7 },
    };
    expect(detectServerPreset(custom)).toBe('custom');
  });

  it('returns "custom" for undefined resources', () => {
    expect(detectServerPreset(undefined)).toBe('custom');
  });

  it('returns "custom" for the default resources (medium-shape but distinct baseUsageMB)', () => {
    // defaultServerResources has baseUsageMB=512, while medium preset has 1024
    expect(detectServerPreset(defaultServerResources)).toBe('custom');
  });
});
