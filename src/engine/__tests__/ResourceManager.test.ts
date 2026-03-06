import { describe, it, expect } from 'vitest';
import { ResourceManager } from '../ResourceManager';
import type { ServerResources, ResourceUtilization, DegradationSettings } from '@/types';

const defaultResources: ServerResources = {
  cpu: { cores: 4, processingTimePerRequest: 50 },
  memory: { totalMB: 8192, baseUsageMB: 512, memoryPerRequestMB: 10 },
  network: { bandwidthMbps: 1000, requestSizeKB: 5, responseSizeKB: 50 },
  connections: { maxConcurrent: 100, queueSize: 50 },
};

describe('ResourceManager', () => {
  describe('calculateUtilization', () => {
    it('returns zero utilization with no active requests', () => {
      const util = ResourceManager.calculateUtilization(defaultResources, 0, 0, 0);
      expect(util.cpu).toBe(0);
      expect(util.memory).toBeCloseTo(6.25, 1); // 512/8192 * 100
      expect(util.network).toBe(0);
      expect(util.activeConnections).toBe(0);
      expect(util.queuedRequests).toBe(0);
    });

    it('calculates CPU utilization correctly', () => {
      // (activeReq * procTime) / (cores * 1000) * 100
      // (10 * 50) / (4 * 1000) * 100 = 12.5%
      const util = ResourceManager.calculateUtilization(defaultResources, 10, 0, 0);
      expect(util.cpu).toBeCloseTo(12.5, 1);
    });

    it('calculates memory utilization correctly', () => {
      // (512 + 10 * 10) / 8192 * 100 = 7.47%
      const util = ResourceManager.calculateUtilization(defaultResources, 10, 0, 0);
      expect(util.memory).toBeCloseTo(7.47, 1);
    });

    it('calculates network utilization correctly', () => {
      // (100 * (5 + 50) * 8) / (1000 * 1000) * 100 = 4.4%
      const util = ResourceManager.calculateUtilization(defaultResources, 0, 0, 100);
      expect(util.network).toBeCloseTo(4.4, 1);
    });

    it('clamps all values at 100%', () => {
      const util = ResourceManager.calculateUtilization(defaultResources, 10000, 0, 100000);
      expect(util.cpu).toBe(100);
      expect(util.memory).toBe(100);
      expect(util.network).toBe(100);
    });
  });

  describe('calculateDegradedLatency', () => {
    const utilization: ResourceUtilization = {
      cpu: 80,
      memory: 60,
      network: 40,
      activeConnections: 50,
      queuedRequests: 0,
    };

    it('returns base latency when degradation is disabled', () => {
      const settings: DegradationSettings = { enabled: false, formula: 'quadratic', latencyPower: 2 };
      expect(ResourceManager.calculateDegradedLatency(100, utilization, settings)).toBe(100);
    });

    it('applies linear degradation', () => {
      const settings: DegradationSettings = { enabled: true, formula: 'linear', latencyPower: 2 };
      // maxUtil = 80/100 = 0.8, latency = 100 * (1 + 0.8) = 180
      expect(ResourceManager.calculateDegradedLatency(100, utilization, settings)).toBe(180);
    });

    it('applies quadratic degradation', () => {
      const settings: DegradationSettings = { enabled: true, formula: 'quadratic', latencyPower: 2 };
      // maxUtil = 0.8, latency = 100 * (1 + 0.8^2) = 164
      expect(ResourceManager.calculateDegradedLatency(100, utilization, settings)).toBeCloseTo(164, 0);
    });

    it('applies exponential degradation', () => {
      const settings: DegradationSettings = { enabled: true, formula: 'exponential', latencyPower: 2 };
      // maxUtil = 0.8, latency = 100 * (1 + 0.8^3) = 151.2
      expect(ResourceManager.calculateDegradedLatency(100, utilization, settings)).toBeCloseTo(151.2, 0);
    });
  });

  describe('canAcceptRequest', () => {
    it('accepts when under concurrent limit', () => {
      const util: ResourceUtilization = { cpu: 50, memory: 50, network: 50, activeConnections: 50, queuedRequests: 0 };
      expect(ResourceManager.canAcceptRequest(defaultResources, util)).toBe('accept');
    });

    it('queues when at concurrent limit but queue has space', () => {
      const util: ResourceUtilization = { cpu: 50, memory: 50, network: 50, activeConnections: 100, queuedRequests: 10 };
      expect(ResourceManager.canAcceptRequest(defaultResources, util)).toBe('queue');
    });

    it('rejects when both concurrent and queue are full', () => {
      const util: ResourceUtilization = { cpu: 50, memory: 50, network: 50, activeConnections: 100, queuedRequests: 50 };
      expect(ResourceManager.canAcceptRequest(defaultResources, util)).toBe('reject');
    });
  });

  describe('getUtilizationColor', () => {
    it('returns green below 70%', () => {
      expect(ResourceManager.getUtilizationColor(69)).toBe('green');
    });

    it('returns orange between 70-89%', () => {
      expect(ResourceManager.getUtilizationColor(85)).toBe('orange');
    });

    it('returns red at 90%+', () => {
      expect(ResourceManager.getUtilizationColor(95)).toBe('red');
    });
  });
});
