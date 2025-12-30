import type {
  DatabaseNodeData,
  DatabaseConnectionPool,
  DatabasePerformance,
  DatabaseUtilization,
} from '@/types';

interface ActiveQuery {
  id: string;
  type: 'read' | 'write' | 'transaction';
  startedAt: number;
  estimatedCompletion: number;
}

interface DatabaseState {
  nodeId: string;
  config: DatabaseNodeData;
  utilization: DatabaseUtilization;
  activeQueries: Map<string, ActiveQuery>;
  queriesLastSecond: number[];
}

export class DatabaseManager {
  private databaseStates: Map<string, DatabaseState> = new Map();

  /**
   * Initialize a database node
   */
  initializeDatabase(nodeId: string, config: DatabaseNodeData): void {
    this.databaseStates.set(nodeId, {
      nodeId,
      config,
      utilization: this.createInitialUtilization(),
      activeQueries: new Map(),
      queriesLastSecond: [],
    });
  }

  /**
   * Update database configuration
   */
  updateConfig(nodeId: string, config: DatabaseNodeData): void {
    const state = this.databaseStates.get(nodeId);
    if (state) {
      state.config = config;
    }
  }

  /**
   * Check if database can accept a new query
   */
  canAcceptQuery(nodeId: string): 'accept' | 'queue' | 'reject' {
    const state = this.databaseStates.get(nodeId);
    if (!state) return 'reject';

    const { connectionPool } = state.config;
    const activeConnections = state.activeQueries.size;

    if (activeConnections < connectionPool.maxConnections) {
      return 'accept';
    }

    // Databases don't typically queue - they reject when pool is full
    return 'reject';
  }

  /**
   * Execute a query on the database
   * Returns the latency for this query
   */
  executeQuery(
    nodeId: string,
    queryId: string,
    queryType: 'read' | 'write' | 'transaction' = 'read'
  ): { latency: number; accepted: boolean } {
    const state = this.databaseStates.get(nodeId);
    if (!state) return { latency: 0, accepted: false };

    const decision = this.canAcceptQuery(nodeId);
    if (decision === 'reject') {
      return { latency: 0, accepted: false };
    }

    const { performance, connectionPool } = state.config;

    // Calculate base latency based on query type
    let baseLatency: number;
    switch (queryType) {
      case 'write':
        baseLatency = performance.writeLatencyMs;
        break;
      case 'transaction':
        baseLatency = performance.transactionLatencyMs;
        break;
      case 'read':
      default:
        baseLatency = performance.readLatencyMs;
        break;
    }

    // Apply degradation based on connection pool usage
    const poolUsage = state.activeQueries.size / connectionPool.maxConnections;
    const degradedLatency = this.calculateDegradedLatency(baseLatency, poolUsage);

    // Record the query
    const now = Date.now();
    state.activeQueries.set(queryId, {
      id: queryId,
      type: queryType,
      startedAt: now,
      estimatedCompletion: now + degradedLatency,
    });

    // Record for QPS calculation
    state.queriesLastSecond.push(now);

    return { latency: degradedLatency, accepted: true };
  }

  /**
   * Complete a query
   */
  completeQuery(nodeId: string, queryId: string): void {
    const state = this.databaseStates.get(nodeId);
    if (!state) return;

    state.activeQueries.delete(queryId);
  }

  /**
   * Get current utilization for a database
   */
  getUtilization(nodeId: string): DatabaseUtilization | null {
    const state = this.databaseStates.get(nodeId);
    if (!state) return null;

    return this.calculateUtilization(state);
  }

  /**
   * Calculate current utilization
   */
  private calculateUtilization(state: DatabaseState): DatabaseUtilization {
    const now = Date.now();
    const { connectionPool } = state.config;

    // Clean up old QPS records (older than 1 second)
    state.queriesLastSecond = state.queriesLastSecond.filter(
      (timestamp) => now - timestamp < 1000
    );

    const activeConnections = state.activeQueries.size;
    const queriesPerSecond = state.queriesLastSecond.length;
    const connectionPoolUsage = (activeConnections / connectionPool.maxConnections) * 100;

    // Calculate average query time from active queries
    let avgQueryTime = 0;
    if (state.activeQueries.size > 0) {
      const totalTime = Array.from(state.activeQueries.values()).reduce(
        (sum, query) => sum + (now - query.startedAt),
        0
      );
      avgQueryTime = totalTime / state.activeQueries.size;
    }

    return {
      activeConnections,
      queriesPerSecond,
      connectionPoolUsage: Math.min(100, connectionPoolUsage),
      avgQueryTime,
    };
  }

  /**
   * Calculate degraded latency based on pool usage
   * Uses a quadratic curve to simulate contention
   */
  private calculateDegradedLatency(baseLatency: number, poolUsage: number): number {
    // Apply quadratic degradation when pool usage > 50%
    if (poolUsage < 0.5) {
      return baseLatency;
    }

    // Latency increases as pool fills up
    // At 100% usage, latency is 3x base
    const degradationFactor = 1 + Math.pow(poolUsage, 2) * 2;
    return baseLatency * degradationFactor;
  }

  /**
   * Create initial utilization state
   */
  private createInitialUtilization(): DatabaseUtilization {
    return {
      activeConnections: 0,
      queriesPerSecond: 0,
      connectionPoolUsage: 0,
      avgQueryTime: 0,
    };
  }

  /**
   * Check if a query should fail based on error rate
   */
  shouldQueryFail(nodeId: string): boolean {
    const state = this.databaseStates.get(nodeId);
    if (!state) return false;

    const { errorRate } = state.config;
    if (errorRate <= 0) return false;

    return Math.random() * 100 < errorRate;
  }

  /**
   * Cleanup database state
   */
  cleanup(nodeId: string): void {
    this.databaseStates.delete(nodeId);
  }

  /**
   * Cleanup all database states
   */
  cleanupAll(): void {
    this.databaseStates.clear();
  }

  /**
   * Get all database node IDs
   */
  getDatabaseIds(): string[] {
    return Array.from(this.databaseStates.keys());
  }

  /**
   * Calculate capacity usage percentage
   */
  static calculateCapacityUsage(
    config: DatabaseNodeData,
    currentQps: number
  ): number {
    const maxQps = config.capacity.maxQueriesPerSecond;
    return Math.min(100, (currentQps / maxQps) * 100);
  }

  /**
   * Get latency by query type
   */
  static getLatencyByType(
    performance: DatabasePerformance,
    queryType: 'read' | 'write' | 'transaction'
  ): number {
    switch (queryType) {
      case 'write':
        return performance.writeLatencyMs;
      case 'transaction':
        return performance.transactionLatencyMs;
      case 'read':
      default:
        return performance.readLatencyMs;
    }
  }
}
