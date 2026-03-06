import { describe, it, expect, beforeEach } from 'vitest';
import { ApiGatewayHandler } from '../ApiGatewayHandler';
import type { Node, Edge } from '@xyflow/react';
import type { RequestContext } from '../types';

function createGatewayNode(overrides: Record<string, unknown> = {}): Node {
  return {
    id: 'gw-1',
    type: 'api-gateway',
    position: { x: 0, y: 0 },
    data: {
      label: 'API Gateway',
      baseLatencyMs: 10,
      errorRate: 0,
      authType: 'none',
      authFailureRate: 0,
      rateLimiting: {
        enabled: false,
        requestsPerSecond: 100,
        burstSize: 10,
        windowMs: 1000,
      },
      routeRules: [],
      ...overrides,
    },
  };
}

function createContext(path?: string): RequestContext {
  return {
    chainId: 'chain-1',
    originNodeId: 'client-1',
    startTime: Date.now(),
    currentPath: ['client-1'],
    edgePath: [],
    requestPath: path || '/api/test',
  };
}

function createEdge(target: string): Edge {
  return { id: `e-${target}`, source: 'gw-1', target };
}

describe('ApiGatewayHandler', () => {
  let handler: ApiGatewayHandler;

  beforeEach(() => {
    handler = new ApiGatewayHandler();
  });

  describe('getProcessingDelay', () => {
    it('returns baseLatencyMs / speed', () => {
      const node = createGatewayNode({ baseLatencyMs: 20 });
      expect(handler.getProcessingDelay(node, 2)).toBe(10);
    });
  });

  describe('rate limiting', () => {
    it('allows requests when rate limiting disabled', () => {
      const node = createGatewayNode();
      handler.initialize(node);
      const edges = [createEdge('server-1')];
      const decision = handler.handleRequestArrival(node, createContext(), edges, []);
      expect(decision.action).toBe('forward');
    });

    it('rejects when rate limit exceeded', () => {
      const node = createGatewayNode({
        rateLimiting: {
          enabled: true,
          requestsPerSecond: 1,
          burstSize: 0,
          windowMs: 1000,
        },
      });
      handler.initialize(node);
      const edges = [createEdge('server-1')];

      // First request allowed
      handler.handleRequestArrival(node, createContext(), edges, []);

      // Second request should be rate-limited
      const decision = handler.handleRequestArrival(node, createContext(), edges, []);
      expect(decision.action).toBe('reject');
      if (decision.action === 'reject') {
        expect(decision.reason).toBe('rate-limit');
      }
    });

    it('allows burst requests within burst size', () => {
      const node = createGatewayNode({
        rateLimiting: {
          enabled: true,
          requestsPerSecond: 1,
          burstSize: 2,
          windowMs: 1000,
        },
      });
      handler.initialize(node);
      const edges = [createEdge('server-1')];

      // 1 (normal) + 2 (burst) = 3 requests should be allowed
      handler.handleRequestArrival(node, createContext(), edges, []);
      handler.handleRequestArrival(node, createContext(), edges, []);
      const third = handler.handleRequestArrival(node, createContext(), edges, []);
      expect(third.action).toBe('forward');

      // 4th should be rejected
      const fourth = handler.handleRequestArrival(node, createContext(), edges, []);
      expect(fourth.action).toBe('reject');
    });
  });

  describe('route rules', () => {
    it('forwards to first edge when no route rules', () => {
      const node = createGatewayNode();
      handler.initialize(node);
      const edges = [createEdge('server-1'), createEdge('server-2')];
      const decision = handler.handleRequestArrival(node, createContext(), edges, []);

      expect(decision.action).toBe('forward');
      if (decision.action === 'forward') {
        expect(decision.targets[0].nodeId).toBe('server-1');
      }
    });

    it('routes by path pattern to matching service', () => {
      const node = createGatewayNode({
        routeRules: [
          { pathPattern: '/api/users/**', targetServiceName: 'user-service', priority: 1 },
          { pathPattern: '/api/orders/**', targetServiceName: 'order-service', priority: 2 },
        ],
      });
      handler.initialize(node);

      const edges = [createEdge('server-1'), createEdge('server-2')];
      const allNodes: Node[] = [
        { id: 'server-1', type: 'http-server', position: { x: 0, y: 0 }, data: { serviceName: 'user-service' } },
        { id: 'server-2', type: 'http-server', position: { x: 0, y: 0 }, data: { serviceName: 'order-service' } },
      ];

      const decision = handler.handleRequestArrival(node, createContext('/api/orders/123'), edges, allNodes);
      expect(decision.action).toBe('forward');
      if (decision.action === 'forward') {
        expect(decision.targets[0].nodeId).toBe('server-2');
      }
    });
  });

  describe('responds when no outgoing edges', () => {
    it('responds directly', () => {
      const node = createGatewayNode();
      handler.initialize(node);
      const decision = handler.handleRequestArrival(node, createContext(), [], []);
      expect(decision.action).toBe('respond');
    });
  });

  describe('stats', () => {
    it('tracks total and blocked requests', () => {
      const node = createGatewayNode({
        rateLimiting: {
          enabled: true,
          requestsPerSecond: 1,
          burstSize: 0,
          windowMs: 1000,
        },
      });
      handler.initialize(node);
      const edges = [createEdge('server-1')];

      handler.handleRequestArrival(node, createContext(), edges, []);
      handler.handleRequestArrival(node, createContext(), edges, []);

      const stats = handler.getStats(node.id);
      expect(stats?.totalRequests).toBe(2);
      expect(stats?.rateLimitHits).toBe(1);
      expect(stats?.blockedRequests).toBe(1);
    });
  });
});
