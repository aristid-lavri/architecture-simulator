/**
 * Helpers for the server resource preset dropdown (A4.3).
 *
 * The preset palette itself lives in `@/types` (`serverPresets`). This module
 * adds two small utilities: pure detection of which preset matches a current
 * `ServerResources` value, and a pure applier used by the Properties Panel and
 * tests alike.
 */
import { serverPresets } from '@/types';
import type { ServerResources } from '@/types';

export type ServerPresetKey = keyof typeof serverPresets;
export type ServerPresetSelection = ServerPresetKey | 'custom';

/**
 * Deep-equal-on-fields comparison for `ServerResources`. We avoid a generic
 * deep-equal dep — the shape is fixed and small.
 */
function resourcesEqual(a: ServerResources, b: ServerResources): boolean {
  return (
    a.cpu.cores === b.cpu.cores &&
    a.cpu.maxUtilization === b.cpu.maxUtilization &&
    a.cpu.processingTimePerRequest === b.cpu.processingTimePerRequest &&
    a.memory.totalMB === b.memory.totalMB &&
    a.memory.memoryPerRequestMB === b.memory.memoryPerRequestMB &&
    a.memory.baseUsageMB === b.memory.baseUsageMB &&
    a.network.bandwidthMbps === b.network.bandwidthMbps &&
    a.network.baseLatencyMs === b.network.baseLatencyMs &&
    a.network.requestSizeKB === b.network.requestSizeKB &&
    a.network.responseSizeKB === b.network.responseSizeKB &&
    a.connections.maxConcurrent === b.connections.maxConcurrent &&
    a.connections.queueSize === b.connections.queueSize &&
    a.connections.connectionTimeoutMs === b.connections.connectionTimeoutMs
  );
}

/**
 * Detect which preset key matches the provided resources, or `'custom'` if
 * the values diverge from every preset.
 */
export function detectServerPreset(resources: ServerResources | undefined): ServerPresetSelection {
  if (!resources) return 'custom';
  const keys = Object.keys(serverPresets) as ServerPresetKey[];
  for (const key of keys) {
    if (resourcesEqual(resources, serverPresets[key])) return key;
  }
  return 'custom';
}

/**
 * Apply a preset to a node-data-like object and return the updated `resources`
 * field. Returns `undefined` if `preset === 'custom'` (caller should treat as
 * a no-op).
 */
export function applyServerPreset(preset: ServerPresetSelection): ServerResources | undefined {
  if (preset === 'custom') return undefined;
  // Return a fresh clone so callers can safely mutate downstream.
  const src = serverPresets[preset];
  return {
    cpu: { ...src.cpu },
    memory: { ...src.memory },
    network: { ...src.network },
    connections: { ...src.connections },
  };
}
