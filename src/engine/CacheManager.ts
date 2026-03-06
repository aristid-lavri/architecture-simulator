import type {
  CacheNodeData,
  CacheUtilization,
  EvictionPolicy,
} from '@/types';

/**
 * Entrée dans le cache avec métadonnées LRU/LFU
 */
interface CacheEntry {
  key: string;
  value: string;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  ttlMs?: number;
}

interface CacheState {
  nodeId: string;
  config: CacheNodeData;
  utilization: CacheUtilization;
  startTime: number;
  /** Dictionnaire clé-valeur réel */
  entries: Map<string, CacheEntry>;
}

/**
 * Simule un cache cle-valeur (Redis/Memcached) avec store reel.
 * Supporte les politiques d'eviction LRU, LFU et FIFO,
 * le TTL par entree et le suivi du hit ratio.
 */
export class CacheManager {
  private cacheStates: Map<string, CacheState> = new Map();

  /**
   * Initialize a cache node
   */
  initializeCache(nodeId: string, config: CacheNodeData): void {
    this.cacheStates.set(nodeId, {
      nodeId,
      config,
      utilization: this.createInitialUtilization(),
      startTime: Date.now(),
      entries: new Map(),
    });
  }

  /**
   * Update cache configuration
   */
  updateConfig(nodeId: string, config: CacheNodeData): void {
    const state = this.cacheStates.get(nodeId);
    if (state) {
      state.config = config;
    }
  }

  /**
   * Check if a key exists in the cache (without updating stats)
   */
  has(nodeId: string, key: string): boolean {
    const state = this.cacheStates.get(nodeId);
    if (!state) return false;

    const entry = state.entries.get(key);
    if (!entry) return false;

    // Check TTL expiration
    if (entry.ttlMs && Date.now() - entry.createdAt > entry.ttlMs) {
      state.entries.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get a value from the cache
   * Returns hit status, value (if hit), and latency
   */
  get(nodeId: string, key: string): { hit: boolean; value?: string; latency: number } {
    const state = this.cacheStates.get(nodeId);
    if (!state) return { hit: false, latency: 0 };

    const { config } = state;
    const latency = config.performance.getLatencyMs;

    const entry = state.entries.get(key);

    // Check if entry exists and is not expired
    if (entry) {
      // Check TTL expiration
      if (entry.ttlMs && Date.now() - entry.createdAt > entry.ttlMs) {
        // Entry expired - remove it
        state.entries.delete(key);
        state.utilization.missCount++;
        this.updateUtilization(state);
        return { hit: false, latency };
      }

      // Cache HIT - update access metadata
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
      state.utilization.hitCount++;
      this.updateUtilization(state);

      return { hit: true, value: entry.value, latency };
    }

    // Cache MISS
    state.utilization.missCount++;
    this.updateUtilization(state);

    return { hit: false, latency };
  }

  /**
   * Set a value in the cache
   * Returns latency and whether eviction occurred
   */
  set(nodeId: string, key: string, value: string = 'cached_data'): { latency: number; evicted: boolean } {
    const state = this.cacheStates.get(nodeId);
    if (!state) return { latency: 0, evicted: false };

    const { config } = state;
    const latency = config.performance.setLatencyMs;
    let evicted = false;

    // Check if we need to evict before adding
    if (state.entries.size >= config.configuration.maxKeys && !state.entries.has(key)) {
      this.evict(state);
      evicted = true;
      state.utilization.evictionCount++;
    }

    // Add or update entry
    const now = Date.now();
    state.entries.set(key, {
      key,
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      ttlMs: config.configuration.defaultTTLSeconds * 1000,
    });

    this.updateUtilization(state);

    return { latency, evicted };
  }

  /**
   * Delete a key from the cache
   */
  delete(nodeId: string, key: string): boolean {
    const state = this.cacheStates.get(nodeId);
    if (!state) return false;

    const deleted = state.entries.delete(key);
    if (deleted) {
      this.updateUtilization(state);
    }
    return deleted;
  }

  /**
   * Clear all entries from a cache
   */
  clear(nodeId: string): void {
    const state = this.cacheStates.get(nodeId);
    if (!state) return;

    state.entries.clear();
    this.updateUtilization(state);
  }

  /**
   * Evict an entry based on the eviction policy
   */
  private evict(state: CacheState): void {
    if (state.entries.size === 0) return;

    const policy = state.config.configuration.evictionPolicy;
    let keyToEvict: string | null = null;

    switch (policy) {
      case 'lru': {
        // Least Recently Used
        let oldestAccess = Infinity;
        for (const [key, entry] of state.entries) {
          if (entry.lastAccessedAt < oldestAccess) {
            oldestAccess = entry.lastAccessedAt;
            keyToEvict = key;
          }
        }
        break;
      }

      case 'lfu': {
        // Least Frequently Used
        let lowestCount = Infinity;
        for (const [key, entry] of state.entries) {
          if (entry.accessCount < lowestCount) {
            lowestCount = entry.accessCount;
            keyToEvict = key;
          }
        }
        break;
      }

      case 'fifo':
      default: {
        // First In First Out
        let oldestCreation = Infinity;
        for (const [key, entry] of state.entries) {
          if (entry.createdAt < oldestCreation) {
            oldestCreation = entry.createdAt;
            keyToEvict = key;
          }
        }
        break;
      }
    }

    if (keyToEvict) {
      state.entries.delete(keyToEvict);
    }
  }

  /**
   * Update utilization statistics
   */
  private updateUtilization(state: CacheState): void {
    const { hitCount, missCount } = state.utilization;
    const total = hitCount + missCount;

    state.utilization.keyCount = state.entries.size;
    state.utilization.hitRatio = total > 0 ? (hitCount / total) * 100 : 0;
    state.utilization.memoryUsage = Math.min(
      100,
      (state.entries.size / state.config.configuration.maxKeys) * 100
    );
  }

  /**
   * Get current utilization for a cache
   */
  getUtilization(nodeId: string): CacheUtilization | null {
    const state = this.cacheStates.get(nodeId);
    if (!state) return null;

    return state.utilization;
  }

  /**
   * Get all keys in the cache
   */
  getKeys(nodeId: string): string[] {
    const state = this.cacheStates.get(nodeId);
    if (!state) return [];

    return Array.from(state.entries.keys());
  }

  /**
   * Get the number of entries in the cache
   */
  size(nodeId: string): number {
    const state = this.cacheStates.get(nodeId);
    if (!state) return 0;

    return state.entries.size;
  }

  /**
   * Create initial utilization state
   */
  private createInitialUtilization(): CacheUtilization {
    return {
      memoryUsage: 0,
      keyCount: 0,
      hitCount: 0,
      missCount: 0,
      hitRatio: 0,
      evictionCount: 0,
    };
  }

  /**
   * Cleanup cache state
   */
  cleanup(nodeId: string): void {
    this.cacheStates.delete(nodeId);
  }

  /**
   * Cleanup all cache states
   */
  cleanupAll(): void {
    this.cacheStates.clear();
  }

  /**
   * Get all cache node IDs
   */
  getCacheIds(): string[] {
    return Array.from(this.cacheStates.keys());
  }

  /**
   * Calculate expected latency based on hit/miss
   */
  static calculateExpectedLatency(
    config: CacheNodeData,
    hitRatio: number,
    dbLatency: number
  ): number {
    const hitProbability = hitRatio / 100;
    const hitLatency = config.performance.getLatencyMs;
    const missLatency = config.performance.getLatencyMs + dbLatency;

    return hitLatency * hitProbability + missLatency * (1 - hitProbability);
  }

  /**
   * Get eviction policy description
   */
  static getEvictionPolicyDescription(policy: EvictionPolicy): string {
    switch (policy) {
      case 'lru':
        return 'Least Recently Used';
      case 'lfu':
        return 'Least Frequently Used';
      case 'fifo':
        return 'First In First Out';
      default:
        return policy;
    }
  }
}
