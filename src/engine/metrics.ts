import type { SimulationMetrics, ExtendedSimulationMetrics, ResourceSample, ClientGroupMetrics } from '@/types';

/**
 * Collecteur de metriques pour la simulation.
 * Enregistre les requetes, reponses, latences (avec percentiles P50/P95/P99),
 * les rejets, les metriques de file d'attente, l'historique des ressources
 * et les statistiques par groupe de clients.
 */
export class MetricsCollector {
  private metrics: SimulationMetrics;
  private latencies: number[] = [];

  // Extended metrics for stress testing
  private resourceHistory: ResourceSample[] = [];
  private rejectionCount: number = 0;
  private queueMetrics = {
    totalQueued: 0,
    maxQueueDepth: 0,
    totalQueueTime: 0,
    queuedCount: 0,
  };
  private clientGroupStats: Map<string, ClientGroupMetrics> = new Map();

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

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
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

  reset(): void {
    this.metrics = this.createInitialMetrics();
    this.latencies = [];
    this.resourceHistory = [];
    this.rejectionCount = 0;
    this.queueMetrics = {
      totalQueued: 0,
      maxQueueDepth: 0,
      totalQueueTime: 0,
      queuedCount: 0,
    };
    this.clientGroupStats.clear();
  }

  // ============================================
  // Extended Methods for Stress Testing
  // ============================================

  recordRejection(): void {
    this.rejectionCount++;
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
      resourceHistory: [...this.resourceHistory],
      clientGroupStats: new Map(this.clientGroupStats),
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
