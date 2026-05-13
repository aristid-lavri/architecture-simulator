import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { GraphNode, GraphEdge } from '@/types/graph';
import { SimulationEngine } from '../SimulationEngine';
import { registerCoreRulesEngine, __resetForTests as resetBootstrap } from '@/lib/rules-engine/bootstrap';
import { ruleRegistry } from '@/lib/rules-engine/core';
import { edgeCreationDecoratorRegistry } from '@/plugins/extensions/edge-creation';

/**
 * A6.4 — Verifies that SimulationEngine.start() blocks on error-severity violations
 * and proceeds with a non-blocking warning toast for warning-severity violations.
 */

function makeCallbacks() {
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
    onSimulationBlocked: vi.fn(),
    onSimulationWarnings: vi.fn(),
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

// Valid http-server data so requiredFields doesn't trigger errors.
const SERVER_RES = {
  label: 'API',
  resources: {
    cpu: { processingTimePerRequest: 5 },
    connections: { maxConcurrent: 100 },
  },
  responseDelay: 0,
  errorRate: 0,
};

const CLIENT_DATA = {
  label: 'Client',
  requestMethod: 'GET',
  requestPath: '/x',
  requestMode: 'single',
  requestInterval: 1000,
};

describe('SimulationEngine — A6.4 blocking validation by severity', () => {
  beforeEach(() => {
    ruleRegistry.clear();
    edgeCreationDecoratorRegistry.unregister('core-rules-engine');
    resetBootstrap();
    registerCoreRulesEngine();
  });

  afterEach(() => {
    ruleRegistry.clear();
    edgeCreationDecoratorRegistry.unregister('core-rules-engine');
    resetBootstrap();
  });

  it('blocks start when an error-severity violation is present', () => {
    // db-exposed-publicly (error) : http-client → database
    const client = node('c', 'http-client', CLIENT_DATA);
    const db = node('db', 'database', {
      label: 'DB',
      performance: { readLatencyMs: 5, writeLatencyMs: 10, transactionLatencyMs: 20 },
    });
    const e = edge('e1', 'c', 'db');

    const callbacks = makeCallbacks();
    const engine = new SimulationEngine(callbacks, { seed: 1 });
    engine.setNodesAndEdges([client, db], [e]);

    const result = engine.start();
    expect(result.started).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // onSimulationBlocked must have been fired with the error issues
    expect(callbacks.onSimulationBlocked).toHaveBeenCalledTimes(1);
    const issues = callbacks.onSimulationBlocked.mock.calls[0][0];
    expect(issues.some((i: { ruleId?: string }) => i.ruleId === 'core-sanity/exposure/db-exposed-publicly')).toBe(true);
    // State did not transition to running
    expect(engine.getState()).toBe('idle');
    expect(callbacks.onStateChange).not.toHaveBeenCalled();

    engine.stop();
  });

  it('exposes a blockedReason-shaped list with rule IDs and message keys', () => {
    const client = node('c', 'http-client', CLIENT_DATA);
    const cache = node('cache', 'cache', {
      label: 'Cache',
      performance: { readLatencyMs: 1, writeLatencyMs: 2 },
    });
    const e = edge('e1', 'c', 'cache');

    const callbacks = makeCallbacks();
    const engine = new SimulationEngine(callbacks, { seed: 1 });
    engine.setNodesAndEdges([client, cache], [e]);

    const result = engine.start();
    expect(result.started).toBe(false);
    // Validate the issue list shape so the dialog can render rule ID + suggestion.
    for (const issue of result.errors) {
      expect(issue.severity).toBe('error');
      expect(typeof issue.messageKey).toBe('string');
    }
    engine.stop();
  });

  it('starts with onSimulationWarnings when only warnings are present', () => {
    // Two server nodes, one http-client → one http-server. To trigger a warning-only
    // graph we use a duplicate-node-names hygiene rule (warning severity).
    const c = node('c', 'http-client', CLIENT_DATA);
    const s1 = node('s1', 'http-server', { ...SERVER_RES, label: 'Dup' });
    const s2 = node('s2', 'http-server', { ...SERVER_RES, label: 'Dup' });
    const e1 = edge('e1', 'c', 's1');
    const e2 = edge('e2', 's1', 's2');

    const callbacks = makeCallbacks();
    const engine = new SimulationEngine(callbacks, { seed: 1 });
    engine.setNodesAndEdges([c, s1, s2], [e1, e2]);

    const result = engine.start();
    expect(result.started).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(callbacks.onSimulationWarnings).toHaveBeenCalledTimes(1);
    expect(callbacks.onSimulationBlocked).not.toHaveBeenCalled();
    expect(engine.getState()).toBe('running');

    engine.stop();
  });

  it('skips validation when start({ skipValidation: true }) is used', () => {
    const client = node('c', 'http-client', CLIENT_DATA);
    const db = node('db', 'database', {
      label: 'DB',
      performance: { readLatencyMs: 5, writeLatencyMs: 10, transactionLatencyMs: 20 },
    });
    const e = edge('e1', 'c', 'db');

    const callbacks = makeCallbacks();
    const engine = new SimulationEngine(callbacks, { seed: 1 });
    engine.setNodesAndEdges([client, db], [e]);

    const result = engine.start({ skipValidation: true });
    expect(result.started).toBe(true);
    expect(callbacks.onSimulationBlocked).not.toHaveBeenCalled();
    expect(engine.getState()).toBe('running');

    engine.stop();
  });

  it('validateForStart() returns errors and warnings without side effects', () => {
    const client = node('c', 'http-client', CLIENT_DATA);
    const db = node('db', 'database', {
      label: 'DB',
      performance: { readLatencyMs: 5, writeLatencyMs: 10, transactionLatencyMs: 20 },
    });
    const e = edge('e1', 'c', 'db');

    const callbacks = makeCallbacks();
    const engine = new SimulationEngine(callbacks, { seed: 1 });
    engine.setNodesAndEdges([client, db], [e]);

    const { errors, warnings } = engine.validateForStart();
    expect(errors.length).toBeGreaterThan(0);
    void warnings;
    // No callbacks fired.
    expect(callbacks.onSimulationBlocked).not.toHaveBeenCalled();
    expect(callbacks.onSimulationWarnings).not.toHaveBeenCalled();
    expect(engine.getState()).toBe('idle');
  });
});
