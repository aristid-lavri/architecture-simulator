import { describe, it, expect, beforeEach } from 'vitest';
import { LoadBalancerManager } from '../LoadBalancerManager';
import type { LoadBalancerNodeData } from '@/types';

const defaultConfig: LoadBalancerNodeData = {
  label: 'Test LB',
  algorithm: 'round-robin',
  healthCheck: {
    enabled: true,
    intervalMs: 5000,
    timeoutMs: 3000,
    unhealthyThreshold: 3,
  },
  stickySessions: false,
  sessionTTLSeconds: 3600,
};

describe('LoadBalancerManager', () => {
  let lb: LoadBalancerManager;
  const lbId = 'lb-1';

  beforeEach(() => {
    lb = new LoadBalancerManager();
    lb.initializeLoadBalancer(lbId, defaultConfig);
    lb.registerBackend(lbId, 'server-1');
    lb.registerBackend(lbId, 'server-2');
    lb.registerBackend(lbId, 'server-3');
  });

  describe('round-robin', () => {
    it('cycles through backends in order', () => {
      expect(lb.selectBackend(lbId)).toBe('server-1');
      expect(lb.selectBackend(lbId)).toBe('server-2');
      expect(lb.selectBackend(lbId)).toBe('server-3');
      expect(lb.selectBackend(lbId)).toBe('server-1'); // wraps around
    });
  });

  describe('least-connections', () => {
    it('selects backend with fewest connections', () => {
      lb.cleanup(lbId);
      lb.initializeLoadBalancer(lbId, { ...defaultConfig, algorithm: 'least-connections' });
      lb.registerBackend(lbId, 'server-1');
      lb.registerBackend(lbId, 'server-2');

      lb.recordRequestSent(lbId, 'server-1');
      lb.recordRequestSent(lbId, 'server-1');
      lb.recordRequestSent(lbId, 'server-2');

      expect(lb.selectBackend(lbId)).toBe('server-2');
    });
  });

  describe('ip-hash', () => {
    it('returns deterministic selection for same client', () => {
      lb.cleanup(lbId);
      lb.initializeLoadBalancer(lbId, { ...defaultConfig, algorithm: 'ip-hash' });
      lb.registerBackend(lbId, 'server-1');
      lb.registerBackend(lbId, 'server-2');
      lb.registerBackend(lbId, 'server-3');

      const first = lb.selectBackend(lbId, 'client-42');
      const second = lb.selectBackend(lbId, 'client-42');
      expect(first).toBe(second);
    });
  });

  describe('sticky sessions', () => {
    it('routes to same backend for same client', () => {
      lb.cleanup(lbId);
      lb.initializeLoadBalancer(lbId, { ...defaultConfig, stickySessions: true });
      lb.registerBackend(lbId, 'server-1');
      lb.registerBackend(lbId, 'server-2');

      const first = lb.selectBackend(lbId, 'client-1');
      const second = lb.selectBackend(lbId, 'client-1');
      expect(first).toBe(second);
    });

    it('falls back when sticky backend is unhealthy', () => {
      lb.cleanup(lbId);
      lb.initializeLoadBalancer(lbId, { ...defaultConfig, stickySessions: true });
      lb.registerBackend(lbId, 'server-1');
      lb.registerBackend(lbId, 'server-2');

      lb.selectBackend(lbId, 'client-1'); // assigns to server-1
      lb.setBackendHealth(lbId, 'server-1', false);

      const fallback = lb.selectBackend(lbId, 'client-1');
      expect(fallback).toBe('server-2');
    });
  });

  describe('health checks', () => {
    it('marks backend unhealthy after consecutive failures', () => {
      lb.recordRequestCompleted(lbId, 'server-1', false);
      lb.recordRequestCompleted(lbId, 'server-1', false);
      lb.recordRequestCompleted(lbId, 'server-1', false);

      // server-1 should be unhealthy now (threshold = 3)
      const util = lb.getUtilization(lbId);
      const server1 = util?.backends.find(b => b.nodeId === 'server-1');
      expect(server1?.healthy).toBe(false);
    });

    it('resets failure count on success', () => {
      lb.recordRequestCompleted(lbId, 'server-1', false);
      lb.recordRequestCompleted(lbId, 'server-1', false);
      lb.recordRequestCompleted(lbId, 'server-1', true); // resets

      const util = lb.getUtilization(lbId);
      const server1 = util?.backends.find(b => b.nodeId === 'server-1');
      expect(server1?.healthy).toBe(true);
    });
  });

  describe('request tracking', () => {
    it('increments active connections', () => {
      lb.recordRequestSent(lbId, 'server-1');
      const util = lb.getUtilization(lbId);
      expect(util?.activeConnections).toBe(1);
      expect(util?.totalRequests).toBe(1);
    });

    it('decrements on completion', () => {
      lb.recordRequestSent(lbId, 'server-1');
      lb.recordRequestCompleted(lbId, 'server-1', true);
      const util = lb.getUtilization(lbId);
      expect(util?.activeConnections).toBe(0);
    });
  });

  describe('selectBackend edge cases', () => {
    it('returns null for unknown LB', () => {
      expect(lb.selectBackend('unknown')).toBeNull();
    });

    it('returns null when all backends are unhealthy', () => {
      lb.setBackendHealth(lbId, 'server-1', false);
      lb.setBackendHealth(lbId, 'server-2', false);
      lb.setBackendHealth(lbId, 'server-3', false);
      expect(lb.selectBackend(lbId)).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('removes LB state', () => {
      lb.cleanup(lbId);
      expect(lb.getUtilization(lbId)).toBeNull();
    });

    it('cleanupAll removes all', () => {
      lb.cleanupAll();
      expect(lb.getLoadBalancerIds()).toHaveLength(0);
    });
  });
});
