import { describe, it, expect, beforeEach } from 'vitest';
import { HttpServerHandler } from '../HttpServerHandler';
import type { Node, Edge } from '@xyflow/react';
import type { RequestContext } from '../types';
import { defaultServerResources, defaultDegradation } from '@/types';

function createServerNode(overrides: Record<string, unknown> = {}): Node {
  return {
    id: 'server-1',
    type: 'http-server',
    position: { x: 0, y: 0 },
    data: {
      label: 'Server',
      responseDelay: 100,
      errorRate: 0,
      responseStatus: 200,
      resources: defaultServerResources,
      degradation: defaultDegradation,
      ...overrides,
    },
  };
}

function createContext(): RequestContext {
  return {
    chainId: 'chain-1',
    originNodeId: 'client-1',
    startTime: Date.now(),
    currentPath: ['client-1'],
    edgePath: [],
  };
}

function createEdge(target: string): Edge {
  return { id: `e-${target}`, source: 'server-1', target };
}

describe('HttpServerHandler', () => {
  let handler: HttpServerHandler;

  beforeEach(() => {
    handler = new HttpServerHandler();
  });

  describe('getProcessingDelay', () => {
    it('returns delay divided by speed', () => {
      const node = createServerNode({
        degradation: { ...defaultDegradation, enabled: false },
      });
      handler.initialize(node);
      const delay = handler.getProcessingDelay(node, 2);
      // With degradation disabled, delay = baseDelay / speed = 100 / 2 = 50
      expect(delay).toBe(50);
    });
  });

  describe('handleRequestArrival', () => {
    it('forwards to downstream nodes when edges exist', () => {
      const node = createServerNode();
      handler.initialize(node);
      const edges = [createEdge('db-1'), createEdge('db-2')];
      const decision = handler.handleRequestArrival(node, createContext(), edges, []);

      expect(decision.action).toBe('forward');
      if (decision.action === 'forward') {
        expect(decision.targets).toHaveLength(2);
        expect(decision.targets[0].nodeId).toBe('db-1');
        expect(decision.targets[1].nodeId).toBe('db-2');
      }
    });

    it('responds directly when no outgoing edges', () => {
      const node = createServerNode();
      handler.initialize(node);
      const decision = handler.handleRequestArrival(node, createContext(), [], []);
      expect(decision.action).toBe('respond');
    });

    it('rejects when at capacity', () => {
      const node = createServerNode({
        resources: {
          ...defaultServerResources,
          connections: { maxConcurrent: 1, queueSize: 0 },
        },
      });
      handler.initialize(node);

      // First request accepted
      handler.handleRequestArrival(node, createContext(), [], []);

      // Second request should be rejected
      const decision = handler.handleRequestArrival(node, createContext(), [], []);
      expect(decision.action).toBe('reject');
    });

    it('queues when at concurrent limit but queue has space', () => {
      const node = createServerNode({
        resources: {
          ...defaultServerResources,
          connections: { maxConcurrent: 1, queueSize: 10 },
        },
      });
      handler.initialize(node);

      handler.handleRequestArrival(node, createContext(), [], []);
      const decision = handler.handleRequestArrival(node, createContext(), [], []);
      expect(decision.action).toBe('queue');
    });
  });

  describe('recordRequestCompleted', () => {
    it('decrements active requests', () => {
      const node = createServerNode();
      handler.initialize(node);
      handler.handleRequestArrival(node, createContext(), [], []);
      handler.recordRequestCompleted(node.id);

      // Should accept again after completion
      const decision = handler.handleRequestArrival(node, createContext(), [], []);
      expect(decision.action).toBe('respond');
    });
  });

  describe('cleanup', () => {
    it('removes server state', () => {
      const node = createServerNode();
      handler.initialize(node);
      handler.cleanup(node.id);
      expect(handler.getUtilization(node.id, defaultServerResources)).toBeNull();
    });
  });
});
