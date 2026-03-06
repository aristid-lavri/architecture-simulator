import type {
  LoadBalancerNodeData,
  LoadBalancerAlgorithm,
  LoadBalancerBackend,
  LoadBalancerUtilization,
} from '@/types';

interface BackendState {
  nodeId: string;
  weight: number;
  healthy: boolean;
  activeConnections: number;
  totalRequests: number;
  consecutiveFailures: number;
  lastHealthCheck: number;
}

interface LoadBalancerState {
  nodeId: string;
  config: LoadBalancerNodeData;
  backends: Map<string, BackendState>;
  roundRobinIndex: number;
  stickySessionMap: Map<string, string>; // clientId -> backendId
  totalRequests: number;
}

/**
 * Gere la repartition de charge entre backends.
 * Implemente 4 algorithmes : round-robin, least-connections, ip-hash, weighted.
 * Supporte les health checks, sticky sessions et le suivi des connexions actives.
 */
export class LoadBalancerManager {
  private lbStates: Map<string, LoadBalancerState> = new Map();

  /**
   * Initialize a load balancer
   */
  initializeLoadBalancer(nodeId: string, config: LoadBalancerNodeData): void {
    this.lbStates.set(nodeId, {
      nodeId,
      config,
      backends: new Map(),
      roundRobinIndex: 0,
      stickySessionMap: new Map(),
      totalRequests: 0,
    });
  }

  /**
   * Register a backend server for a load balancer
   */
  registerBackend(lbNodeId: string, backendNodeId: string, weight: number = 1): void {
    const state = this.lbStates.get(lbNodeId);
    if (!state) return;

    state.backends.set(backendNodeId, {
      nodeId: backendNodeId,
      weight,
      healthy: true,
      activeConnections: 0,
      totalRequests: 0,
      consecutiveFailures: 0,
      lastHealthCheck: Date.now(),
    });
  }

  /**
   * Unregister a backend server
   */
  unregisterBackend(lbNodeId: string, backendNodeId: string): void {
    const state = this.lbStates.get(lbNodeId);
    if (!state) return;

    state.backends.delete(backendNodeId);
  }

  /**
   * Select a backend for the next request
   */
  selectBackend(lbNodeId: string, clientId?: string): string | null {
    const state = this.lbStates.get(lbNodeId);
    if (!state) return null;

    const healthyBackends = Array.from(state.backends.values()).filter(b => b.healthy);
    if (healthyBackends.length === 0) return null;

    // Check sticky sessions first
    if (state.config.stickySessions && clientId) {
      const stickyBackend = state.stickySessionMap.get(clientId);
      if (stickyBackend) {
        const backend = state.backends.get(stickyBackend);
        if (backend?.healthy) {
          return stickyBackend;
        }
        // Remove stale sticky session
        state.stickySessionMap.delete(clientId);
      }
    }

    let selectedBackend: string | null = null;

    switch (state.config.algorithm) {
      case 'round-robin':
        selectedBackend = this.selectRoundRobin(state, healthyBackends);
        break;
      case 'least-connections':
        selectedBackend = this.selectLeastConnections(healthyBackends);
        break;
      case 'ip-hash':
        selectedBackend = this.selectIpHash(healthyBackends, clientId || '');
        break;
      case 'weighted':
        selectedBackend = this.selectWeighted(state, healthyBackends);
        break;
      default:
        selectedBackend = this.selectRoundRobin(state, healthyBackends);
    }

    // Store sticky session
    if (state.config.stickySessions && clientId && selectedBackend) {
      state.stickySessionMap.set(clientId, selectedBackend);
    }

    return selectedBackend;
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(state: LoadBalancerState, healthyBackends: BackendState[]): string {
    const index = state.roundRobinIndex % healthyBackends.length;
    state.roundRobinIndex++;
    return healthyBackends[index].nodeId;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(healthyBackends: BackendState[]): string {
    const sorted = [...healthyBackends].sort((a, b) => a.activeConnections - b.activeConnections);
    return sorted[0].nodeId;
  }

  /**
   * IP hash selection (deterministic based on client ID)
   */
  private selectIpHash(healthyBackends: BackendState[], clientId: string): string {
    const hash = this.simpleHash(clientId);
    const index = Math.abs(hash) % healthyBackends.length;
    return healthyBackends[index].nodeId;
  }

  /**
   * Weighted selection
   */
  private selectWeighted(state: LoadBalancerState, healthyBackends: BackendState[]): string {
    const totalWeight = healthyBackends.reduce((sum, b) => sum + b.weight, 0);
    let random = Math.random() * totalWeight;

    for (const backend of healthyBackends) {
      random -= backend.weight;
      if (random <= 0) {
        return backend.nodeId;
      }
    }

    return healthyBackends[healthyBackends.length - 1].nodeId;
  }

  /**
   * Simple hash function for IP hash algorithm
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Record a request being sent to a backend
   */
  recordRequestSent(lbNodeId: string, backendNodeId: string): void {
    const state = this.lbStates.get(lbNodeId);
    if (!state) return;

    const backend = state.backends.get(backendNodeId);
    if (backend) {
      backend.activeConnections++;
      backend.totalRequests++;
    }
    state.totalRequests++;
  }

  /**
   * Record a request completion
   */
  recordRequestCompleted(lbNodeId: string, backendNodeId: string, success: boolean): void {
    const state = this.lbStates.get(lbNodeId);
    if (!state) return;

    const backend = state.backends.get(backendNodeId);
    if (backend) {
      backend.activeConnections = Math.max(0, backend.activeConnections - 1);

      if (success) {
        backend.consecutiveFailures = 0;
      } else {
        backend.consecutiveFailures++;
        // Check if backend should be marked unhealthy
        if (state.config.healthCheck.enabled &&
            backend.consecutiveFailures >= state.config.healthCheck.unhealthyThreshold) {
          backend.healthy = false;
        }
      }
    }
  }

  /**
   * Perform health check on all backends
   */
  performHealthCheck(lbNodeId: string): void {
    const state = this.lbStates.get(lbNodeId);
    if (!state || !state.config.healthCheck.enabled) return;

    const now = Date.now();
    state.backends.forEach((backend) => {
      if (now - backend.lastHealthCheck >= state.config.healthCheck.intervalMs) {
        backend.lastHealthCheck = now;
        // In a real implementation, this would actually check the backend
        // For simulation, we just maintain the current state
      }
    });
  }

  /**
   * Manually set backend health status
   */
  setBackendHealth(lbNodeId: string, backendNodeId: string, healthy: boolean): void {
    const state = this.lbStates.get(lbNodeId);
    if (!state) return;

    const backend = state.backends.get(backendNodeId);
    if (backend) {
      backend.healthy = healthy;
      if (healthy) {
        backend.consecutiveFailures = 0;
      }
    }
  }

  /**
   * Get current utilization for a load balancer
   */
  getUtilization(lbNodeId: string): LoadBalancerUtilization | null {
    const state = this.lbStates.get(lbNodeId);
    if (!state) return null;

    const backends: LoadBalancerBackend[] = Array.from(state.backends.values()).map(b => ({
      nodeId: b.nodeId,
      weight: b.weight,
      healthy: b.healthy,
      activeConnections: b.activeConnections,
    }));

    const activeConnections = backends.reduce((sum, b) => sum + b.activeConnections, 0);

    return {
      totalRequests: state.totalRequests,
      activeConnections,
      backends,
    };
  }

  /**
   * Update load balancer configuration
   */
  updateConfig(lbNodeId: string, config: LoadBalancerNodeData): void {
    const state = this.lbStates.get(lbNodeId);
    if (state) {
      state.config = config;
    }
  }

  /**
   * Clean up sticky sessions based on TTL
   */
  cleanupStickySessions(lbNodeId: string): void {
    const state = this.lbStates.get(lbNodeId);
    if (!state || !state.config.stickySessions) return;

    // In a real implementation, we would track session timestamps
    // For simplicity, this is a placeholder
  }

  /**
   * Cleanup load balancer state
   */
  cleanup(lbNodeId: string): void {
    this.lbStates.delete(lbNodeId);
  }

  /**
   * Cleanup all load balancer states
   */
  cleanupAll(): void {
    this.lbStates.clear();
  }

  /**
   * Get all load balancer node IDs
   */
  getLoadBalancerIds(): string[] {
    return Array.from(this.lbStates.keys());
  }

  /**
   * Get algorithm description
   */
  static getAlgorithmDescription(algorithm: LoadBalancerAlgorithm): string {
    switch (algorithm) {
      case 'round-robin':
        return 'Distributes requests evenly in circular order';
      case 'least-connections':
        return 'Routes to server with fewest active connections';
      case 'ip-hash':
        return 'Consistent routing based on client identifier';
      case 'weighted':
        return 'Distributes based on server weights';
      default:
        return algorithm;
    }
  }
}
