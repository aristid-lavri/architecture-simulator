import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('recordRequestSent', () => {
    it('increments request count', () => {
      collector.start();
      collector.recordRequestSent();
      collector.recordRequestSent();
      expect(collector.getMetrics().requestsSent).toBe(2);
    });
  });

  describe('recordResponse', () => {
    it('records successful responses', () => {
      collector.recordResponse(true, 100);
      const metrics = collector.getMetrics();
      expect(metrics.responsesReceived).toBe(1);
      expect(metrics.successCount).toBe(1);
      expect(metrics.errorCount).toBe(0);
    });

    it('records error responses', () => {
      collector.recordResponse(false, 100);
      const metrics = collector.getMetrics();
      expect(metrics.errorCount).toBe(1);
      expect(metrics.successCount).toBe(0);
    });

    it('tracks min and max latency', () => {
      collector.recordResponse(true, 50);
      collector.recordResponse(true, 200);
      collector.recordResponse(true, 100);
      const metrics = collector.getMetrics();
      expect(metrics.minLatency).toBe(50);
      expect(metrics.maxLatency).toBe(200);
    });

    it('tracks total latency', () => {
      collector.recordResponse(true, 50);
      collector.recordResponse(true, 150);
      expect(collector.getMetrics().totalLatency).toBe(200);
    });
  });

  describe('getAverageLatency', () => {
    it('returns 0 with no responses', () => {
      expect(collector.getAverageLatency()).toBe(0);
    });

    it('calculates correct average', () => {
      collector.recordResponse(true, 100);
      collector.recordResponse(true, 200);
      expect(collector.getAverageLatency()).toBe(150);
    });
  });

  describe('getSuccessRate', () => {
    it('returns 0 with no responses', () => {
      expect(collector.getSuccessRate()).toBe(0);
    });

    it('calculates correct rate', () => {
      collector.recordResponse(true, 100);
      collector.recordResponse(true, 100);
      collector.recordResponse(false, 100);
      expect(collector.getSuccessRate()).toBe(67); // 2/3 rounded
    });
  });

  describe('percentiles', () => {
    it('returns 0 with no data', () => {
      expect(collector.getP50()).toBe(0);
      expect(collector.getP95()).toBe(0);
      expect(collector.getP99()).toBe(0);
    });

    it('calculates P50 correctly', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordResponse(true, i);
      }
      expect(collector.getP50()).toBe(50);
    });

    it('calculates P95 correctly', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordResponse(true, i);
      }
      expect(collector.getP95()).toBe(95);
    });

    it('calculates P99 correctly', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordResponse(true, i);
      }
      expect(collector.getP99()).toBe(99);
    });
  });

  describe('extended metrics', () => {
    it('tracks rejection count', () => {
      collector.recordRejection();
      collector.recordRejection();
      expect(collector.getRejectionCount()).toBe(2);
    });

    it('tracks queue metrics', () => {
      collector.recordQueued(5);
      collector.recordQueued(10);
      const qm = collector.getQueueMetrics();
      expect(qm.totalQueued).toBe(2);
      expect(qm.maxQueueDepth).toBe(10);
    });

    it('tracks dequeue wait time', () => {
      collector.recordDequeued(100);
      collector.recordDequeued(200);
      const qm = collector.getQueueMetrics();
      expect(qm.queuedCount).toBe(2);
      expect(qm.totalQueueTime).toBe(300);
    });
  });

  describe('reset', () => {
    it('resets all metrics', () => {
      collector.start();
      collector.recordRequestSent();
      collector.recordResponse(true, 100);
      collector.recordRejection();
      collector.reset();

      const metrics = collector.getMetrics();
      expect(metrics.requestsSent).toBe(0);
      expect(metrics.responsesReceived).toBe(0);
      expect(collector.getRejectionCount()).toBe(0);
    });
  });
});
