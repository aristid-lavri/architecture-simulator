import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheManager } from '../CacheManager';
import type { CacheNodeData } from '@/types';

function createConfig(overrides: Partial<CacheNodeData> = {}): CacheNodeData {
  return {
    label: 'Test Cache',
    cacheType: 'redis',
    configuration: {
      maxKeys: 5,
      maxMemoryMB: 512,
      defaultTTLSeconds: 3600,
      evictionPolicy: 'lru',
    },
    performance: {
      getLatencyMs: 1,
      setLatencyMs: 2,
    },
    initialHitRatio: 80,
    hitRatioVariance: 10,
    warmUpEnabled: false,
    warmUpDurationMs: 5000,
    ...overrides,
  };
}

describe('CacheManager', () => {
  let cache: CacheManager;
  const nodeId = 'cache-1';

  beforeEach(() => {
    cache = new CacheManager();
    cache.initializeCache(nodeId, createConfig());
  });

  describe('get/set', () => {
    it('returns miss for unknown key', () => {
      const result = cache.get(nodeId, 'unknown');
      expect(result.hit).toBe(false);
    });

    it('returns hit after set', () => {
      cache.set(nodeId, 'key1', 'value1');
      const result = cache.get(nodeId, 'key1');
      expect(result.hit).toBe(true);
      expect(result.value).toBe('value1');
    });

    it('tracks hit and miss counts', () => {
      cache.set(nodeId, 'key1', 'value1');
      cache.get(nodeId, 'key1'); // hit
      cache.get(nodeId, 'key2'); // miss

      const util = cache.getUtilization(nodeId);
      expect(util?.hitCount).toBe(1);
      expect(util?.missCount).toBe(1);
      expect(util?.hitRatio).toBe(50);
    });
  });

  describe('has', () => {
    it('returns false for missing key', () => {
      expect(cache.has(nodeId, 'missing')).toBe(false);
    });

    it('returns true for existing key', () => {
      cache.set(nodeId, 'key1', 'val');
      expect(cache.has(nodeId, 'key1')).toBe(true);
    });
  });

  describe('delete', () => {
    it('removes a key', () => {
      cache.set(nodeId, 'key1', 'val');
      cache.delete(nodeId, 'key1');
      expect(cache.has(nodeId, 'key1')).toBe(false);
    });
  });

  describe('eviction - LRU', () => {
    it('evicts least recently used when at capacity', () => {
      vi.useFakeTimers();
      try {
        // maxKeys is 5
        vi.setSystemTime(1000);
        cache.set(nodeId, 'a', '1');
        vi.setSystemTime(2000);
        cache.set(nodeId, 'b', '2');
        vi.setSystemTime(3000);
        cache.set(nodeId, 'c', '3');
        vi.setSystemTime(4000);
        cache.set(nodeId, 'd', '4');
        vi.setSystemTime(5000);
        cache.set(nodeId, 'e', '5');

        // Access 'a' to make it recently used
        vi.setSystemTime(6000);
        cache.get(nodeId, 'a');

        // Adding 'f' should evict 'b' (least recently used, accessed at 2000)
        vi.setSystemTime(7000);
        cache.set(nodeId, 'f', '6');

        expect(cache.has(nodeId, 'a')).toBe(true);
        expect(cache.has(nodeId, 'b')).toBe(false);
        expect(cache.has(nodeId, 'f')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('eviction - LFU', () => {
    it('evicts least frequently used', () => {
      cache.cleanup(nodeId);
      cache.initializeCache(nodeId, createConfig({
        configuration: {
          maxKeys: 3,
          maxMemoryMB: 512,
          defaultTTLSeconds: 3600,
          evictionPolicy: 'lfu',
        },
      }));

      cache.set(nodeId, 'a', '1');
      cache.set(nodeId, 'b', '2');
      cache.set(nodeId, 'c', '3');

      // Access 'a' and 'c' multiple times
      cache.get(nodeId, 'a');
      cache.get(nodeId, 'a');
      cache.get(nodeId, 'c');

      // 'b' has fewest accesses (only the initial set = 1)
      cache.set(nodeId, 'd', '4');

      expect(cache.has(nodeId, 'b')).toBe(false);
      expect(cache.has(nodeId, 'a')).toBe(true);
      expect(cache.has(nodeId, 'd')).toBe(true);
    });
  });

  describe('eviction - FIFO', () => {
    it('evicts oldest entry', () => {
      cache.cleanup(nodeId);
      cache.initializeCache(nodeId, createConfig({
        configuration: {
          maxKeys: 3,
          maxMemoryMB: 512,
          defaultTTLSeconds: 3600,
          evictionPolicy: 'fifo',
        },
      }));

      cache.set(nodeId, 'a', '1');
      cache.set(nodeId, 'b', '2');
      cache.set(nodeId, 'c', '3');
      cache.set(nodeId, 'd', '4'); // should evict 'a'

      expect(cache.has(nodeId, 'a')).toBe(false);
      expect(cache.has(nodeId, 'd')).toBe(true);
    });
  });

  describe('utilization', () => {
    it('returns null for unknown node', () => {
      expect(cache.getUtilization('unknown')).toBeNull();
    });

    it('tracks memory usage percentage', () => {
      cache.set(nodeId, 'a', '1');
      cache.set(nodeId, 'b', '2');
      const util = cache.getUtilization(nodeId);
      // 2/5 * 100 = 40%
      expect(util?.memoryUsage).toBe(40);
    });

    it('tracks eviction count', () => {
      for (let i = 0; i < 7; i++) {
        cache.set(nodeId, `key${i}`, `val${i}`);
      }
      const util = cache.getUtilization(nodeId);
      expect(util?.evictionCount).toBe(2); // 7 - 5 = 2 evictions
    });
  });

  describe('cleanup', () => {
    it('removes cache state', () => {
      cache.cleanup(nodeId);
      expect(cache.getUtilization(nodeId)).toBeNull();
    });

    it('cleanupAll removes all states', () => {
      cache.initializeCache('cache-2', createConfig());
      cache.cleanupAll();
      expect(cache.getCacheIds()).toHaveLength(0);
    });
  });
});
