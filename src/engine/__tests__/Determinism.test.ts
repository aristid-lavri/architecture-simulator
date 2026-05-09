import { describe, it, expect } from 'vitest';
import { CacheManager } from '../CacheManager';
import { DatabaseManager } from '../DatabaseManager';
import { LoadBalancerManager } from '../LoadBalancerManager';
import { VirtualClientManager } from '../VirtualClientManager';
import { createSeededRNG } from '../SimulationRNG';
import type {
  CacheNodeData,
  DatabaseNodeData,
  LoadBalancerNodeData,
  ClientGroupNodeData,
} from '@/types';

/**
 * Test de non-regression B2.1 (Reproductibilite).
 *
 * Verifie qu'avec un meme seed, deux instances independantes des managers
 * produisent EXACTEMENT la meme sequence de decisions probabilistes
 * (HIT/MISS du cache, errorRate de la DB, weighted-LB selection, intervalle
 * variance des virtual clients).
 *
 * Couvre la chaine d'injection : seed -> RNG -> manager.
 */
describe('Determinism (B2.1 - Reproductibilite)', () => {
  it('CacheManager : same seed produces identical HIT/MISS sequence', () => {
    const config: CacheNodeData = {
      label: 'cache',
      cacheType: 'redis',
      initialHitRatio: 50,
      hitRatioVariance: 10,
      warmUpEnabled: false,
      warmUpDurationMs: 0,
      configuration: {
        maxKeys: 1000,
        maxMemoryMB: 512,
        defaultTTLSeconds: 60,
        evictionPolicy: 'lru',
      },
      performance: {
        getLatencyMs: 1,
        setLatencyMs: 2,
      },
    };

    const seed = 42;
    const cacheA = new CacheManager(createSeededRNG(seed));
    const cacheB = new CacheManager(createSeededRNG(seed));
    cacheA.initializeCache('n1', config);
    cacheB.initializeCache('n1', config);

    const sequenceA: boolean[] = [];
    const sequenceB: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      sequenceA.push(cacheA.get('n1', `key-${i}`).hit);
      sequenceB.push(cacheB.get('n1', `key-${i}`).hit);
    }
    expect(sequenceA).toEqual(sequenceB);
  });

  it('DatabaseManager : same seed produces identical errorRate decisions', () => {
    const config: DatabaseNodeData = {
      label: 'db',
      databaseType: 'postgresql',
      connectionPool: {
        maxConnections: 10,
        minConnections: 1,
        connectionTimeoutMs: 5000,
        idleTimeoutMs: 30000,
      },
      performance: {
        readLatencyMs: 5,
        writeLatencyMs: 10,
        transactionLatencyMs: 20,
      },
      capacity: {
        maxQueriesPerSecond: 1000,
      },
      errorRate: 30,
    };

    const seed = 'database-seed';
    const dbA = new DatabaseManager(createSeededRNG(seed));
    const dbB = new DatabaseManager(createSeededRNG(seed));
    dbA.initializeDatabase('db1', config);
    dbB.initializeDatabase('db1', config);

    const failsA: boolean[] = [];
    const failsB: boolean[] = [];
    for (let i = 0; i < 500; i++) {
      failsA.push(dbA.shouldQueryFail('db1'));
      failsB.push(dbB.shouldQueryFail('db1'));
    }
    expect(failsA).toEqual(failsB);
    // Sanity check : taux mesure ~ 30%
    const errorRate = failsA.filter(Boolean).length / failsA.length;
    expect(errorRate).toBeGreaterThan(0.20);
    expect(errorRate).toBeLessThan(0.40);
  });

  it('LoadBalancerManager (weighted) : same seed produces identical backend selection', () => {
    const config: LoadBalancerNodeData = {
      label: 'lb',
      provider: 'generic',
      maxConnections: 10000,
      maxRPS: 5000,
      baseLatencyMs: 5,
      algorithm: 'weighted',
      stickySessions: false,
      sessionTTLSeconds: 3600,
      healthCheck: {
        enabled: false,
        intervalMs: 5000,
        timeoutMs: 3000,
        unhealthyThreshold: 3,
      },
    };

    const seed = 12345;
    const lbA = new LoadBalancerManager(createSeededRNG(seed));
    const lbB = new LoadBalancerManager(createSeededRNG(seed));
    lbA.initializeLoadBalancer('lb1', config);
    lbB.initializeLoadBalancer('lb1', config);
    for (const id of ['b1', 'b2', 'b3']) {
      lbA.registerBackend('lb1', id, id === 'b1' ? 5 : id === 'b2' ? 3 : 1);
      lbB.registerBackend('lb1', id, id === 'b1' ? 5 : id === 'b2' ? 3 : 1);
    }

    const selA: (string | null)[] = [];
    const selB: (string | null)[] = [];
    for (let i = 0; i < 200; i++) {
      selA.push(lbA.selectBackend('lb1'));
      selB.push(lbB.selectBackend('lb1'));
    }
    expect(selA).toEqual(selB);
  });

  it('VirtualClientManager : same seed produces identical interval jitter', () => {
    const data = {
      label: 'group',
      virtualClients: 1,
      method: 'GET' as const,
      path: '/',
      requestMode: 'parallel' as const,
      concurrentRequests: 1,
      distribution: 'random' as const,
      baseInterval: 1000,
      intervalVariance: 50,
      rampUpEnabled: false,
      rampUpDuration: 0,
      rampUpCurve: 'linear' as const,
    } as ClientGroupNodeData;

    const seed = 7;
    const mgrA = new VirtualClientManager(createSeededRNG(seed));
    const mgrB = new VirtualClientManager(createSeededRNG(seed));

    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 100; i++) {
      seqA.push(mgrA.getNextRequestDelay(data));
      seqB.push(mgrB.getNextRequestDelay(data));
    }
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences (sanity)', () => {
    const config: CacheNodeData = {
      label: 'cache',
      cacheType: 'redis',
      initialHitRatio: 50,
      hitRatioVariance: 0,
      warmUpEnabled: false,
      warmUpDurationMs: 0,
      configuration: {
        maxKeys: 1000,
        maxMemoryMB: 512,
        defaultTTLSeconds: 60,
        evictionPolicy: 'lru',
      },
      performance: { getLatencyMs: 1, setLatencyMs: 2 },
    };
    const cacheA = new CacheManager(createSeededRNG(1));
    const cacheB = new CacheManager(createSeededRNG(999));
    cacheA.initializeCache('n1', config);
    cacheB.initializeCache('n1', config);

    const seqA: boolean[] = [];
    const seqB: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      seqA.push(cacheA.get('n1', `key-${i}`).hit);
      seqB.push(cacheB.get('n1', `key-${i}`).hit);
    }
    expect(seqA).not.toEqual(seqB);
  });
});
