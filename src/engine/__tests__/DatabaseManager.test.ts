import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseManager } from '../DatabaseManager';
import type { DatabaseNodeData } from '@/types';

const defaultConfig: DatabaseNodeData = {
  label: 'Test DB',
  databaseType: 'postgresql',
  connectionPool: {
    maxConnections: 5,
    minConnections: 1,
    connectionTimeoutMs: 5000,
    idleTimeoutMs: 30000,
  },
  performance: {
    readLatencyMs: 10,
    writeLatencyMs: 25,
    transactionLatencyMs: 50,
  },
  capacity: {
    maxQueriesPerSecond: 1000,
  },
  errorRate: 0,
};

describe('DatabaseManager', () => {
  let db: DatabaseManager;
  const nodeId = 'db-1';

  beforeEach(() => {
    db = new DatabaseManager();
    db.initializeDatabase(nodeId, defaultConfig);
  });

  describe('canAcceptQuery', () => {
    it('accepts when pool has capacity', () => {
      expect(db.canAcceptQuery(nodeId)).toBe('accept');
    });

    it('rejects when pool is full', () => {
      // Fill all 5 connections
      for (let i = 0; i < 5; i++) {
        db.executeQuery(nodeId, `q${i}`, 'read');
      }
      expect(db.canAcceptQuery(nodeId)).toBe('reject');
    });

    it('rejects for unknown node', () => {
      expect(db.canAcceptQuery('unknown')).toBe('reject');
    });
  });

  describe('executeQuery', () => {
    it('returns correct latency for read queries', () => {
      const result = db.executeQuery(nodeId, 'q1', 'read');
      expect(result.accepted).toBe(true);
      expect(result.latency).toBe(10); // No degradation at 0% usage
    });

    it('returns correct latency for write queries', () => {
      const result = db.executeQuery(nodeId, 'q1', 'write');
      expect(result.accepted).toBe(true);
      expect(result.latency).toBe(25);
    });

    it('returns correct latency for transaction queries', () => {
      const result = db.executeQuery(nodeId, 'q1', 'transaction');
      expect(result.accepted).toBe(true);
      expect(result.latency).toBe(50);
    });

    it('rejects when pool is full', () => {
      for (let i = 0; i < 5; i++) {
        db.executeQuery(nodeId, `q${i}`, 'read');
      }
      const result = db.executeQuery(nodeId, 'q6', 'read');
      expect(result.accepted).toBe(false);
    });

    it('degrades latency under load', () => {
      // Fill 3 of 5 connections (60% usage > 50% threshold)
      for (let i = 0; i < 3; i++) {
        db.executeQuery(nodeId, `q${i}`, 'read');
      }
      const result = db.executeQuery(nodeId, 'q4', 'read');
      expect(result.latency).toBeGreaterThan(10);
    });
  });

  describe('completeQuery', () => {
    it('frees connection after completion', () => {
      db.executeQuery(nodeId, 'q1', 'read');
      db.completeQuery(nodeId, 'q1');
      const util = db.getUtilization(nodeId);
      expect(util?.activeConnections).toBe(0);
    });
  });

  describe('getUtilization', () => {
    it('returns null for unknown node', () => {
      expect(db.getUtilization('unknown')).toBeNull();
    });

    it('tracks active connections', () => {
      db.executeQuery(nodeId, 'q1', 'read');
      db.executeQuery(nodeId, 'q2', 'write');
      const util = db.getUtilization(nodeId);
      expect(util?.activeConnections).toBe(2);
      expect(util?.connectionPoolUsage).toBeCloseTo(40, 0); // 2/5 * 100
    });
  });

  describe('shouldQueryFail', () => {
    it('returns false when error rate is 0', () => {
      expect(db.shouldQueryFail(nodeId)).toBe(false);
    });

    it('returns false for unknown node', () => {
      expect(db.shouldQueryFail('unknown')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes a single database state', () => {
      db.cleanup(nodeId);
      expect(db.getUtilization(nodeId)).toBeNull();
    });

    it('cleanupAll removes all states', () => {
      db.initializeDatabase('db-2', defaultConfig);
      db.cleanupAll();
      expect(db.getDatabaseIds()).toHaveLength(0);
    });
  });

  describe('static methods', () => {
    it('calculateCapacityUsage returns correct percentage', () => {
      expect(DatabaseManager.calculateCapacityUsage(defaultConfig, 500)).toBe(50);
      expect(DatabaseManager.calculateCapacityUsage(defaultConfig, 1500)).toBe(100); // clamped
    });

    it('getLatencyByType returns correct values', () => {
      expect(DatabaseManager.getLatencyByType(defaultConfig.performance, 'read')).toBe(10);
      expect(DatabaseManager.getLatencyByType(defaultConfig.performance, 'write')).toBe(25);
      expect(DatabaseManager.getLatencyByType(defaultConfig.performance, 'transaction')).toBe(50);
    });
  });
});
