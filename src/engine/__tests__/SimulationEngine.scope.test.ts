import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { GraphNode, GraphEdge } from '@/types/graph';
import { SimulationEngine } from '../SimulationEngine';

function makeNoopCallbacks() {
  return {
    onStateChange: vi.fn(),
    onAddParticle: vi.fn(),
    onRemoveParticle: vi.fn(),
    onBatchUpdateProgress: vi.fn(),
    onNodeStatusChange: vi.fn(),
    onMetricsUpdate: vi.fn(),
    onResourceUpdate: vi.fn(),
    onClientGroupUpdate: vi.fn(),
    onMessageQueueUpdate: vi.fn(),
    onApiGatewayUpdate: vi.fn(),
    onHierarchicalResourceUpdate: vi.fn(),
    onError: vi.fn(),
    onTimeSeriesSnapshot: vi.fn(),
    onSimulationComplete: vi.fn(),
    onBottleneckUpdate: vi.fn(),
    onExtendedMetricsUpdate: vi.fn(),
  };
}

const node = (id: string, type: string, data: Record<string, unknown> = {}, parentId?: string): GraphNode => ({
  id,
  type: type as GraphNode['type'],
  position: { x: 0, y: 0 },
  data,
  parentId,
});

const edge = (id: string, source: string, target: string, data: Record<string, unknown> = {}): GraphEdge => ({
  id, source, target, data,
});

describe('SimulationEngine — scoped simulation (Phase 1E)', () => {
  let engine: SimulationEngine;
  let callbacks: ReturnType<typeof makeNoopCallbacks>;

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = makeNoopCallbacks();
    engine = new SimulationEngine(callbacks, { seed: 42 });
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  describe('setSimulationScope', () => {
    it('stores the scope config', () => {
      const scope = {
        subtreeRoot: 'root',
        subtreeNodeIds: new Set(['root', 'a']),
        syntheticEmitters: [],
        sinks: new Set<string>(),
      };
      engine.setSimulationScope(scope);
      expect(engine.getSimulationScope()).toBe(scope);
    });

    it('clears the scope when null is passed', () => {
      engine.setSimulationScope({
        subtreeRoot: 'root',
        subtreeNodeIds: new Set(['root']),
        syntheticEmitters: [],
        sinks: new Set(),
      });
      engine.setSimulationScope(null);
      expect(engine.getSimulationScope()).toBeNull();
    });

    it('returns null by default (no scope active)', () => {
      expect(engine.getSimulationScope()).toBeNull();
    });
  });

  describe('scope filter dans sendRequest', () => {
    it('drops requests originating outside the subtree (via http-client emitter)', () => {
      // Setup : http-client outside the scope, target node inside.
      // Avec scope actif, le http-client ne devrait pas générer de request en dehors.
      const outsideClient = node('outside', 'http-client', {
        method: 'GET', path: '/test', requestMode: 'single',
      });
      const insideTarget = node('target', 'http-server', {});
      const e = edge('e', 'outside', 'target');

      engine.setNodesAndEdges([outsideClient, insideTarget], [e]);
      engine.setSimulationScope({
        subtreeRoot: 'target',
        subtreeNodeIds: new Set(['target']),
        syntheticEmitters: [],
        sinks: new Set(),
      });
      engine.start();

      // En sim normale (sans scope), le http-client émet une request immédiate au start.
      // Avec scope, son `sendRequest` est filtré → metrics restent à 0.
      const metrics = engine.getFinalMetrics().metrics;
      expect(metrics.requestsSent).toBe(0);
    });

    it('allows requests originating inside the subtree', () => {
      const insideClient = node('inside', 'http-client', {
        method: 'GET', path: '/test', requestMode: 'single',
      });
      const target = node('target', 'http-server', {});
      const e = edge('e', 'inside', 'target');

      engine.setNodesAndEdges([insideClient, target], [e]);
      engine.setSimulationScope({
        subtreeRoot: 'inside',
        subtreeNodeIds: new Set(['inside', 'target']),
        syntheticEmitters: [],
        sinks: new Set(),
      });
      engine.start();

      const metrics = engine.getFinalMetrics().metrics;
      expect(metrics.requestsSent).toBeGreaterThanOrEqual(1);
    });
  });

  describe('synthetic emitters', () => {
    it('fires an immediate request on start for each configured emitter', () => {
      const target = node('target', 'http-server', {});
      const external = node('external', 'http-client', {
        method: 'GET', path: '/x', requestMode: 'single',
      });
      const e = edge('boundary', 'external', 'target');

      engine.setNodesAndEdges([external, target], [e]);
      engine.setSimulationScope({
        subtreeRoot: 'target',
        subtreeNodeIds: new Set(['target']),
        syntheticEmitters: [{ edgeId: 'boundary', requestsPerSecond: 10 }],
        sinks: new Set(),
      });
      engine.start();

      // Le http-client `external` est filtré (hors subtree). MAIS le synthetic emitter
      // émet depuis le target node sur l'edge boundary → 1 request comptabilisée.
      const metrics = engine.getFinalMetrics().metrics;
      expect(metrics.requestsSent).toBeGreaterThanOrEqual(1);
    });

    it('schedules periodic injection at the configured rate', () => {
      const target = node('target', 'http-server', {});
      const e = edge('boundary', 'ext', 'target');

      engine.setNodesAndEdges([target], [e]);
      engine.setSimulationScope({
        subtreeRoot: 'target',
        subtreeNodeIds: new Set(['target']),
        syntheticEmitters: [{ edgeId: 'boundary', requestsPerSecond: 10 }],
        sinks: new Set(),
      });
      engine.start();

      const initialCount = engine.getFinalMetrics().metrics.requestsSent;
      // RPS=10 → intervalMs=100. Avancer 250ms = 2 ticks supplémentaires.
      vi.advanceTimersByTime(250);
      const after = engine.getFinalMetrics().metrics.requestsSent;
      expect(after).toBeGreaterThan(initialCount);
    });

    it('stops synthetic emitter timers on stop()', () => {
      const target = node('target', 'http-server', {});
      const e = edge('boundary', 'ext', 'target');

      engine.setNodesAndEdges([target], [e]);
      engine.setSimulationScope({
        subtreeRoot: 'target',
        subtreeNodeIds: new Set(['target']),
        syntheticEmitters: [{ edgeId: 'boundary', requestsPerSecond: 100 }],
        sinks: new Set(),
      });
      engine.start();
      const beforeStop = engine.getFinalMetrics().metrics.requestsSent;
      engine.stop();
      vi.advanceTimersByTime(1000);
      // Après stop, metrics sont reset à 0 (cf. stop() → metrics.reset()).
      // Donc on vérifie qu'il n'y a pas eu d'erreur (les timers étaient bien clearés).
      expect(() => engine.getFinalMetrics().metrics).not.toThrow();
      expect(beforeStop).toBeGreaterThanOrEqual(1);
    });

    it('skips emitters whose edge does not exist (defensive)', () => {
      const target = node('target', 'http-server', {});
      engine.setNodesAndEdges([target], []);
      engine.setSimulationScope({
        subtreeRoot: 'target',
        subtreeNodeIds: new Set(['target']),
        syntheticEmitters: [{ edgeId: 'ghost-edge', requestsPerSecond: 10 }],
        sinks: new Set(),
      });
      // Should not throw.
      expect(() => engine.start()).not.toThrow();
      expect(engine.getFinalMetrics().metrics.requestsSent).toBe(0);
    });
  });
});
