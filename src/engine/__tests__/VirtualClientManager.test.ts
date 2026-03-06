import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VirtualClientManager } from '../VirtualClientManager';
import type { ClientGroupNodeData } from '@/types';

function createGroupData(overrides: Partial<ClientGroupNodeData> = {}): ClientGroupNodeData {
  return {
    label: 'Test Group',
    virtualClients: 10,
    baseInterval: 1000,
    intervalVariance: 0,
    distribution: 'uniform',
    method: 'GET',
    path: '/api/test',
    rampUpEnabled: false,
    rampUpDuration: 5000,
    rampUpCurve: 'linear',
    requestMode: 'sequential',
    ...overrides,
  } as ClientGroupNodeData;
}

describe('VirtualClientManager', () => {
  let vcm: VirtualClientManager;
  const groupId = 'group-1';

  beforeEach(() => {
    vi.useFakeTimers();
    vcm = new VirtualClientManager();
  });

  afterEach(() => {
    vcm.cleanupAll();
    vi.useRealTimers();
  });

  describe('initializeGroup', () => {
    it('creates the correct number of clients', () => {
      vcm.initializeGroup(groupId, createGroupData({ virtualClients: 5 }));
      expect(vcm.getAllClients(groupId)).toHaveLength(5);
    });

    it('all clients active when ramp-up disabled', () => {
      vcm.initializeGroup(groupId, createGroupData());
      const active = vcm.getActiveClients(groupId);
      expect(active).toHaveLength(10);
    });

    it('no clients active initially when ramp-up enabled', () => {
      vcm.initializeGroup(groupId, createGroupData({ rampUpEnabled: true }));
      const active = vcm.getActiveClients(groupId);
      expect(active).toHaveLength(0);
    });
  });

  describe('shouldSendRequest', () => {
    it('returns false for inactive client', () => {
      vcm.initializeGroup(groupId, createGroupData({ rampUpEnabled: true }));
      expect(vcm.shouldSendRequest(groupId, 0, createGroupData({ rampUpEnabled: true }))).toBe(false);
    });

    it('returns true when enough time has passed (uniform)', () => {
      const data = createGroupData({ baseInterval: 100 });
      vcm.initializeGroup(groupId, data);
      // First request should be allowed (lastRequestAt = 0)
      expect(vcm.shouldSendRequest(groupId, 0, data)).toBe(true);
    });

    it('blocks sequential requests while one is in flight', () => {
      const data = createGroupData({ requestMode: 'sequential' });
      vcm.initializeGroup(groupId, data);
      vcm.recordRequestSent(groupId, 0);
      expect(vcm.shouldSendRequest(groupId, 0, data)).toBe(false);
    });

    it('allows parallel requests up to limit', () => {
      const data = createGroupData({ requestMode: 'parallel', concurrentRequests: 2, baseInterval: 100 } as Partial<ClientGroupNodeData>);
      vcm.initializeGroup(groupId, data);
      vcm.recordRequestSent(groupId, 0);
      // Advance past baseInterval so the time check passes
      vi.advanceTimersByTime(200);
      // Should still allow (1 active < 2 max concurrent)
      expect(vcm.shouldSendRequest(groupId, 0, data)).toBe(true);
    });
  });

  describe('recordRequestSent/Completed', () => {
    it('increments active requests on send', () => {
      vcm.initializeGroup(groupId, createGroupData());
      vcm.recordRequestSent(groupId, 0);
      const clients = vcm.getAllClients(groupId);
      expect(clients[0].activeRequests).toBe(1);
      expect(clients[0].requestsSent).toBe(1);
    });

    it('decrements active requests on complete', () => {
      vcm.initializeGroup(groupId, createGroupData());
      vcm.recordRequestSent(groupId, 0);
      vcm.recordRequestCompleted(groupId, 0);
      const clients = vcm.getAllClients(groupId);
      expect(clients[0].activeRequests).toBe(0);
    });

    it('does not go below 0', () => {
      vcm.initializeGroup(groupId, createGroupData());
      vcm.recordRequestCompleted(groupId, 0);
      const clients = vcm.getAllClients(groupId);
      expect(clients[0].activeRequests).toBe(0);
    });
  });

  describe('getGroupStats', () => {
    it('returns correct stats', () => {
      vcm.initializeGroup(groupId, createGroupData({ virtualClients: 3 }));
      vcm.recordRequestSent(groupId, 0);
      vcm.recordRequestSent(groupId, 1);
      const stats = vcm.getGroupStats(groupId);
      expect(stats.activeClients).toBe(3);
      expect(stats.totalRequests).toBe(2);
    });
  });

  describe('getNextRequestDelay', () => {
    it('returns baseInterval for uniform distribution', () => {
      const data = createGroupData({ distribution: 'uniform', baseInterval: 500 });
      expect(vcm.getNextRequestDelay(data)).toBe(500);
    });

    it('returns 0 for burst distribution', () => {
      const data = createGroupData({ distribution: 'burst' });
      expect(vcm.getNextRequestDelay(data)).toBe(0);
    });

    it('returns value with variance for random distribution', () => {
      const data = createGroupData({ distribution: 'random', baseInterval: 1000, intervalVariance: 50 });
      const delay = vcm.getNextRequestDelay(data);
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1500);
    });
  });

  describe('hasGroup', () => {
    it('returns true for existing group', () => {
      vcm.initializeGroup(groupId, createGroupData());
      expect(vcm.hasGroup(groupId)).toBe(true);
    });

    it('returns false for unknown group', () => {
      expect(vcm.hasGroup('unknown')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes a single group', () => {
      vcm.initializeGroup(groupId, createGroupData());
      vcm.cleanup(groupId);
      expect(vcm.hasGroup(groupId)).toBe(false);
    });

    it('cleanupAll removes all groups', () => {
      vcm.initializeGroup('g1', createGroupData());
      vcm.initializeGroup('g2', createGroupData());
      vcm.cleanupAll();
      expect(vcm.hasGroup('g1')).toBe(false);
      expect(vcm.hasGroup('g2')).toBe(false);
    });
  });
});
