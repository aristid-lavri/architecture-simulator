import type { SimulationMetrics, ExtendedSimulationMetrics, ResourceSample, ClientGroupMetrics, TimeSeriesSnapshot } from '@/types';
import type { RejectionReason } from './handlers/types';

/**
 * Collecteur de metriques pour la simulation.
 * Enregistre les requetes, reponses, latences (avec percentiles P50/P95/P99),
 * les rejets, les metriques de file d'attente, l'historique des ressources
 * et les statistiques par groupe de clients.
 */
export class MetricsCollector {
  private static readonly MAX_LATENCY_SAMPLES = 10000;

  private metrics: SimulationMetrics;
  private latencies: number[] = [];
  private sortedCache: number[] | null = null;

  // Extended metrics for stress testing
  private resourceHistory: ResourceSample[] = [];
  private rejectionCount: number = 0;
  private rejectionsByReason: Map<RejectionReason, number> = new Map();
  private queueMetrics = {
    totalQueued: 0,
    maxQueueDepth: 0,
    totalQueueTime: 0,
    queuedCount: 0,
  };
  private clientGroupStats: Map<string, ClientGroupMetrics> = new Map();

  // Per-server metrics tracking
  private perServerMetrics: Map<string, { requests: number; errors: number; totalLatency: number; lastRpsUpdate: number; rps: number }> = new Map();

  // Per-hierarchy metrics tracking (aggregated by parent)
  private perHierarchyMetrics: Map<string, { cpu: number; memory: number; requests: number; errors: number }> = new Map();

  // Database query type counters
  private databaseQueryCounts = { read: 0, write: 0, transaction: 0 };

  // Time-series snapshots
  private timeSeries: TimeSeriesSnapshot[] = [];

  constructor() {
    this.metrics = this.createInitialMetrics();
  }

  private createInitialMetrics(): SimulationMetrics {
    return {
      requestsSent: 0,
      responsesReceived: 0,
      successCount: 0,
      errorCount: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      requestsPerSecond: 0,
      startTime: null,
    };
  }

  start(): void {
    if (this.metrics.startTime === null) {
      this.metrics.startTime = Date.now();
    }
  }

  recordRequestSent(): void {
    this.metrics.requestsSent++;
    this.updateRps();
  }

  recordResponse(success: boolean, latency: number): void {
    this.metrics.responsesReceived++;
    this.latencies.push(latency);
    this.sortedCache = null; // invalidate percentile cache
    // Rotate oldest samples to prevent unbounded growth
    if (this.latencies.length > MetricsCollector.MAX_LATENCY_SAMPLES) {
      this.latencies = this.latencies.slice(-MetricsCollector.MAX_LATENCY_SAMPLES);
    }

    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.errorCount++;
    }

    this.metrics.totalLatency += latency;
    this.metrics.minLatency = Math.min(this.metrics.minLatency, latency);
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);

    this.updateRps();
  }

  private updateRps(): void {
    if (this.metrics.startTime === null) return;

    const elapsedSeconds = (Date.now() - this.metrics.startTime) / 1000;
    if (elapsedSeconds > 0) {
      this.metrics.requestsPerSecond =
        Math.round((this.metrics.requestsSent / elapsedSeconds) * 100) / 100;
    }
  }

  getMetrics(): SimulationMetrics {
    return { ...this.metrics };
  }

  getAverageLatency(): number {
    if (this.metrics.responsesReceived === 0) return 0;
    return Math.round(this.metrics.totalLatency / this.metrics.responsesReceived);
  }

  getSuccessRate(): number {
    if (this.metrics.responsesReceived === 0) return 0;
    return Math.round(
      (this.metrics.successCount / this.metrics.responsesReceived) * 100
    );
  }

  getPercentile(p: number): number {
    if (this.latencies.length === 0) return 0;

    if (!this.sortedCache) {
      this.sortedCache = [...this.latencies].sort((a, b) => a - b);
    }
    const index = Math.ceil((p / 100) * this.sortedCache.length) - 1;
    return this.sortedCache[Math.max(0, index)];
  }

  getP50(): number {
    return this.getPercentile(50);
  }

  getP95(): number {
    return this.getPercentile(95);
  }

  getP99(): number {
    return this.getPercentile(99);
  }

  /**
   * Capture un snapshot temporel des metriques courantes et par serveur.
   * Appele periodiquement (ex: toutes les 5s) par le SimulationEngine.
   */
  captureSnapshot(resourceUtilizations: Map<string, { cpu: number; memory: number }>): TimeSeriesSnapshot {
    const elapsed = this.metrics.startTime ? Date.now() - this.metrics.startTime : 0;
    const perServer: TimeSeriesSnapshot['perServer'] = {};

    for (const [nodeId, m] of this.perServerMetrics) {
      const util = resourceUtilizations.get(nodeId);
      perServer[nodeId] = {
        requests: m.requests,
        errors: m.errors,
        avgLatency: m.requests > 0 ? Math.round(m.totalLatency / m.requests) : 0,
        cpu: util?.cpu ?? 0,
        memory: util?.memory ?? 0,
      };
    }

    // Build perHierarchy data from recorded samples
    const perHierarchy: Record<string, { cpu: number; memory: number; requests: number; errors: number }> = {};
    for (const [parentId, data] of this.perHierarchyMetrics) {
      perHierarchy[parentId] = { ...data };
    }

    const snapshot = {
      timestamp: Date.now(),
      elapsed,
      metrics: { ...this.metrics },
      perServer,
      perHierarchy,
    } as TimeSeriesSnapshot;

    this.timeSeries.push(snapshot);
    return snapshot;
  }

  getTimeSeries(): TimeSeriesSnapshot[] {
    return [...this.timeSeries];
  }

  reset(): void {
    this.metrics = this.createInitialMetrics();
    this.latencies = [];
    this.resourceHistory = [];
    this.rejectionCount = 0;
    this.rejectionsByReason.clear();
    this.queueMetrics = {
      totalQueued: 0,
      maxQueueDepth: 0,
      totalQueueTime: 0,
      queuedCount: 0,
    };
    this.clientGroupStats.clear();
    this.perServerMetrics.clear();
    this.perHierarchyMetrics.clear();
    this.databaseQueryCounts = { read: 0, write: 0, transaction: 0 };
    this.timeSeries = [];
  }

  // ============================================
  // Extended Methods for Stress Testing
  // ============================================

  recordDatabaseQuery(queryType: 'read' | 'write' | 'transaction'): void {
    this.databaseQueryCounts[queryType]++;
  }

  recordRejection(reason?: RejectionReason): void {
    this.rejectionCount++;
    if (reason) {
      this.rejectionsByReason.set(reason, (this.rejectionsByReason.get(reason) || 0) + 1);
    }
  }

  recordQueued(queueDepth: number): void {
    this.queueMetrics.totalQueued++;
    this.queueMetrics.maxQueueDepth = Math.max(
      this.queueMetrics.maxQueueDepth,
      queueDepth
    );
  }

  recordDequeued(waitTime: number): void {
    this.queueMetrics.totalQueueTime += waitTime;
    this.queueMetrics.queuedCount++;
  }

  recordResourceSample(sample: ResourceSample): void {
    this.resourceHistory.push(sample);
    // Keep only the last 60 seconds of samples
    const cutoff = Date.now() - 60000;
    this.resourceHistory = this.resourceHistory.filter((s) => s.timestamp > cutoff);
  }

  updateClientGroupStats(
    groupId: string,
    updates: Partial<ClientGroupMetrics>
  ): void {
    const existing = this.clientGroupStats.get(groupId) || {
      groupId,
      requestsSent: 0,
      responsesReceived: 0,
      successCount: 0,
      errorCount: 0,
      avgLatency: 0,
      p95Latency: 0,
      activeClients: 0,
    };
    this.clientGroupStats.set(groupId, { ...existing, ...updates });
  }

  // Per-server metrics
  recordServerResponse(nodeId: string, success: boolean, latency: number): void {
    const existing = this.perServerMetrics.get(nodeId) || {
      requests: 0, errors: 0, totalLatency: 0, lastRpsUpdate: Date.now(), rps: 0
    };
    existing.requests++;
    if (!success) existing.errors++;
    existing.totalLatency += latency;

    // Calculate server-specific RPS
    const elapsed = (Date.now() - existing.lastRpsUpdate) / 1000;
    if (elapsed > 0) {
      existing.rps = Math.round((existing.requests / elapsed) * 100) / 100;
    }

    this.perServerMetrics.set(nodeId, existing);
  }

  /**
   * Enregistre les metriques agregees d'un parent (host-server, network-zone).
   * Appele par le SimulationEngine apres calcul de l'agregation hierarchique.
   */
  recordHierarchicalSample(parentId: string, aggregated: { cpu: number; memory: number; requests: number; errors: number }): void {
    this.perHierarchyMetrics.set(parentId, { ...aggregated });
  }

  /** Retourne toutes les métriques brutes par serveur pour l'analyse de goulots. */
  getAllServerMetrics(): Map<string, { requests: number; errors: number; totalLatency: number; rps: number }> {
    const result = new Map<string, { requests: number; errors: number; totalLatency: number; rps: number }>();
    for (const [nodeId, m] of this.perServerMetrics) {
      result.set(nodeId, { requests: m.requests, errors: m.errors, totalLatency: m.totalLatency, rps: m.rps });
    }
    return result;
  }

  getServerMetrics(nodeId: string): { throughput: number; errorRate: number } {
    const m = this.perServerMetrics.get(nodeId);
    if (!m || m.requests === 0) return { throughput: 0, errorRate: 0 };
    return {
      throughput: m.rps,
      errorRate: Math.round((m.errors / m.requests) * 10000) / 100,
    };
  }

  getExtendedMetrics(): ExtendedSimulationMetrics {
    return {
      ...this.metrics,
      p50Latency: this.getP50(),
      p95Latency: this.getP95(),
      p99Latency: this.getP99(),
      requestsQueued: this.queueMetrics.totalQueued,
      totalQueued: this.queueMetrics.totalQueued,
      maxQueueDepth: this.queueMetrics.maxQueueDepth,
      avgQueueTime:
        this.queueMetrics.queuedCount > 0
          ? this.queueMetrics.totalQueueTime / this.queueMetrics.queuedCount
          : 0,
      requestsRejected: this.rejectionCount,
      rejectionRate:
        this.metrics.requestsSent > 0
          ? (this.rejectionCount / this.metrics.requestsSent) * 100
          : 0,
      rejectionsByReason: new Map(this.rejectionsByReason),
      resourceHistory: [...this.resourceHistory],
      clientGroupStats: new Map(this.clientGroupStats),
      databaseQueryCounts: { ...this.databaseQueryCounts },
    };
  }

  getRejectionCount(): number {
    return this.rejectionCount;
  }

  getQueueMetrics(): typeof this.queueMetrics {
    return { ...this.queueMetrics };
  }

  getResourceHistory(): ResourceSample[] {
    return [...this.resourceHistory];
  }

  getClientGroupStats(): Map<string, ClientGroupMetrics> {
    return new Map(this.clientGroupStats);
  }
}
