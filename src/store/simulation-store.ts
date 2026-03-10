import { create } from 'zustand';
import type {
  SimulationState,
  SimulationMetrics,
  SimulationEvent,
  TimeSeriesSnapshot,
  Particle,
  NodeState,
  NodeStatus,
  ResourceUtilization,
  ResourceSample,
  ClientGroupMetrics,
} from '@/types';
import { simulationEvents } from '@/engine/events';

/** Rapport genere a l'arret de la simulation avec metriques finales et historique. */
export interface SimulationReport {
  duration: number; // actual duration in ms
  configuredDuration: number | null; // configured duration in ms (null = unlimited)
  metrics: SimulationMetrics;
  resourceUtilizations: Record<string, ResourceUtilization>;
  clientGroupStats: Record<string, ClientGroupMetrics>;
  endReason: 'manual' | 'timeout' | 'error' | 'completed';
  timestamp: number;
  events: SimulationEvent[]; // request traces captured at stop time
  timeSeries: TimeSeriesSnapshot[]; // metrics snapshots over time
}

/**
 * Etat runtime de la simulation : particules, metriques, etats des noeuds, rapport.
 * Non persiste — reinitialise au changement de mode ou a l'arret.
 */
interface SimulationStore {
  // Simulation state
  state: SimulationState;
  speed: number; // 0.5 to 4

  // Simulation duration (null = unlimited)
  duration: number | null; // in seconds
  elapsedTime: number; // in ms

  // Particles for animation
  particles: Particle[];

  // Node states
  nodeStates: Map<string, NodeState>;

  // Metrics
  metrics: SimulationMetrics;

  // Resource utilization for stress testing
  resourceUtilizations: Map<string, ResourceUtilization>;

  // Resource history for sparklines (last 60s)
  resourceHistory: ResourceSample[];

  // Client group stats for stress testing
  clientGroupStats: Map<string, ClientGroupMetrics>;

  // Time-series metrics snapshots
  metricsTimeSeries: TimeSeriesSnapshot[];

  // Hierarchical resource utilization (parent → aggregated + children)
  hierarchicalUtilizations: Record<string, { aggregated: ResourceUtilization; children: { childId: string; utilization: ResourceUtilization }[] }>;

  // Chaos mode — fault injections
  faultInjections: Map<string, 'down' | 'degraded'>;
  isolatedNodes: Set<string>;

  // Report
  report: SimulationReport | null;
  showReport: boolean;

  // Engine metrics provider (set by FlowCanvas to pull fresh metrics from engine)
  _engineMetricsProvider: (() => SimulationMetrics) | null;
  registerEngineMetricsProvider: (provider: (() => SimulationMetrics) | null) => void;

  // Actions - Simulation control
  start: () => void;
  pause: () => void;
  stop: (reason?: 'manual' | 'timeout' | 'error' | 'completed') => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  setDuration: (duration: number | null) => void;
  updateElapsedTime: (elapsed: number) => void;

  // Actions - Report
  setShowReport: (show: boolean) => void;
  clearReport: () => void;

  // Actions - Particles
  addParticle: (particle: Particle) => void;
  removeParticle: (particleId: string) => void;
  updateParticle: (particleId: string, updates: Partial<Particle>) => void;
  clearParticles: () => void;

  // Actions - Node states
  setNodeStatus: (nodeId: string, status: NodeStatus) => void;
  clearNodeStates: () => void;

  // Actions - Metrics
  incrementRequestsSent: () => void;
  recordResponse: (success: boolean, latency: number) => void;
  updateRequestsPerSecond: () => void;
  resetMetrics: () => void;
  setMetrics: (metrics: SimulationMetrics) => void;

  // Actions - Resource utilization
  setResourceUtilization: (nodeId: string, utilization: ResourceUtilization) => void;
  addResourceSample: (sample: ResourceSample) => void;
  clearResourceUtilizations: () => void;

  // Actions - Client group stats
  setClientGroupStats: (groupId: string, stats: ClientGroupMetrics) => void;
  updateClientGroupStats: (groupId: string, activeClients: number, requestsSent: number) => void;
  clearClientGroupStats: () => void;

  // Actions - Time series
  addTimeSeriesSnapshot: (snapshot: TimeSeriesSnapshot) => void;

  // Actions - Hierarchical utilization
  setHierarchicalUtilization: (parentId: string, data: { aggregated: ResourceUtilization; children: { childId: string; utilization: ResourceUtilization }[] }) => void;

  // Actions - Chaos mode
  injectFault: (nodeId: string, fault: 'down' | 'degraded') => void;
  clearFault: (nodeId: string) => void;
  clearAllFaults: () => void;
  isolateNode: (nodeId: string) => void;
  restoreNode: (nodeId: string) => void;
}

const initialMetrics: SimulationMetrics = {
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

/**
 * Store Zustand pour l'etat runtime de la simulation.
 * Gere les particules, metriques, etats des noeuds, utilisation des ressources et le rapport final.
 */
export const useSimulationStore = create<SimulationStore>((set, get) => ({
  // Initial state
  state: 'idle',
  speed: 1,
  duration: null,
  elapsedTime: 0,
  particles: [],
  nodeStates: new Map(),
  metrics: { ...initialMetrics },
  resourceUtilizations: new Map(),
  resourceHistory: [],
  clientGroupStats: new Map(),
  metricsTimeSeries: [],
  hierarchicalUtilizations: {},
  faultInjections: new Map(),
  isolatedNodes: new Set(),
  report: null,
  showReport: false,
  _engineMetricsProvider: null,

  registerEngineMetricsProvider: (provider) => set({ _engineMetricsProvider: provider }),

  // Simulation control
  start: () => {
    // Clear stored events from previous simulation
    simulationEvents.clearEvents();
    return set((state) => ({
      state: 'running',
      elapsedTime: 0,
      metrics: {
        ...state.metrics,
        startTime: state.metrics.startTime ?? Date.now(),
      },
    }));
  },

  pause: () => set({ state: 'paused' }),

  stop: (reason = 'manual') => {
    const state = get();

    // Pull fresh metrics from engine if available (source of truth)
    const freshMetrics = state._engineMetricsProvider ? state._engineMetricsProvider() : null;
    const metricsForReport = freshMetrics ?? state.metrics;

    const actualDuration = metricsForReport.startTime
      ? Date.now() - metricsForReport.startTime
      : state.elapsedTime;

    // Capture events from the emitter before clearing
    const capturedEvents = simulationEvents.getEvents();

    // Generate report with fresh engine metrics
    const report: SimulationReport = {
      duration: actualDuration,
      configuredDuration: state.duration ? state.duration * 1000 : null,
      metrics: { ...metricsForReport },
      resourceUtilizations: Object.fromEntries(state.resourceUtilizations),
      clientGroupStats: Object.fromEntries(state.clientGroupStats),
      endReason: reason,
      timestamp: Date.now(),
      events: capturedEvents,
      timeSeries: [...state.metricsTimeSeries],
    };

    set({
      state: 'idle',
      particles: [],
      nodeStates: new Map(),
      faultInjections: new Map(),
      isolatedNodes: new Set(),
      report,
      showReport: true,
    });
  },

  reset: () => set({
    state: 'idle',
    elapsedTime: 0,
    particles: [],
    nodeStates: new Map(),
    metrics: { ...initialMetrics },
    resourceUtilizations: new Map(),
    resourceHistory: [],
    clientGroupStats: new Map(),
    metricsTimeSeries: [],
    hierarchicalUtilizations: {},
    faultInjections: new Map(),
    isolatedNodes: new Set(),
  }),

  setSpeed: (speed) => set({ speed: Math.max(0.5, Math.min(4, speed)) }),

  setDuration: (duration) => set({ duration }),

  updateElapsedTime: (elapsed) => set({ elapsedTime: elapsed }),

  // Report actions
  setShowReport: (show) => set({ showReport: show }),

  clearReport: () => set({ report: null, showReport: false }),

  // Particles
  addParticle: (particle) => set((state) => ({
    particles: [...state.particles, particle],
  })),

  removeParticle: (particleId) => set((state) => ({
    particles: state.particles.filter((p) => p.id !== particleId),
  })),

  updateParticle: (particleId, updates) => set((state) => ({
    particles: state.particles.map((p) =>
      p.id === particleId ? { ...p, ...updates } : p
    ),
  })),

  clearParticles: () => set({ particles: [] }),

  // Node states
  setNodeStatus: (nodeId, status) => set((state) => {
    // Ne pas écraser le statut d'un noeud en panne — seuls clearFault/restoreNode peuvent le faire
    if (state.faultInjections.has(nodeId) || state.isolatedNodes.has(nodeId)) {
      return state;
    }
    const newNodeStates = new Map(state.nodeStates);
    newNodeStates.set(nodeId, {
      nodeId,
      status,
      lastUpdated: Date.now(),
    });
    return { nodeStates: newNodeStates };
  }),

  clearNodeStates: () => set({ nodeStates: new Map() }),

  // Metrics
  incrementRequestsSent: () => set((state) => ({
    metrics: {
      ...state.metrics,
      requestsSent: state.metrics.requestsSent + 1,
    },
  })),

  recordResponse: (success, latency) => set((state) => {
    const newMetrics = {
      ...state.metrics,
      responsesReceived: state.metrics.responsesReceived + 1,
      successCount: success
        ? state.metrics.successCount + 1
        : state.metrics.successCount,
      errorCount: success
        ? state.metrics.errorCount
        : state.metrics.errorCount + 1,
      totalLatency: state.metrics.totalLatency + latency,
      minLatency: Math.min(state.metrics.minLatency, latency),
      maxLatency: Math.max(state.metrics.maxLatency, latency),
    };
    return { metrics: newMetrics };
  }),

  updateRequestsPerSecond: () => set((state) => {
    const { startTime, requestsSent } = state.metrics;
    if (!startTime) return state;

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const rps = elapsedSeconds > 0 ? requestsSent / elapsedSeconds : 0;

    return {
      metrics: {
        ...state.metrics,
        requestsPerSecond: Math.round(rps * 100) / 100,
      },
    };
  }),

  resetMetrics: () => set({ metrics: { ...initialMetrics } }),

  setMetrics: (metrics) => set({ metrics }),

  // Resource utilization
  setResourceUtilization: (nodeId, utilization) => set((state) => {
    const newUtilizations = new Map(state.resourceUtilizations);
    newUtilizations.set(nodeId, utilization);
    return { resourceUtilizations: newUtilizations };
  }),

  addResourceSample: (sample) => set((state) => {
    const cutoff = Date.now() - 60000;
    const history = [...state.resourceHistory.filter((s) => s.timestamp > cutoff), sample];
    return { resourceHistory: history };
  }),

  clearResourceUtilizations: () => set({ resourceUtilizations: new Map(), resourceHistory: [] }),

  // Client group stats
  setClientGroupStats: (groupId, stats) => set((state) => {
    const newStats = new Map(state.clientGroupStats);
    newStats.set(groupId, stats);
    return { clientGroupStats: newStats };
  }),

  updateClientGroupStats: (groupId, activeClients, requestsSent) => set((state) => {
    const newStats = new Map(state.clientGroupStats);
    const existing = newStats.get(groupId) || {
      groupId,
      requestsSent: 0,
      responsesReceived: 0,
      successCount: 0,
      errorCount: 0,
      avgLatency: 0,
      p95Latency: 0,
      activeClients: 0,
    };
    newStats.set(groupId, {
      ...existing,
      activeClients,
      requestsSent,
    });
    return { clientGroupStats: newStats };
  }),

  clearClientGroupStats: () => set({ clientGroupStats: new Map() }),

  // Time series
  addTimeSeriesSnapshot: (snapshot) => set((state) => ({
    metricsTimeSeries: [...state.metricsTimeSeries, snapshot],
  })),

  // Hierarchical utilization
  setHierarchicalUtilization: (parentId, data) => set((state) => ({
    hierarchicalUtilizations: {
      ...state.hierarchicalUtilizations,
      [parentId]: data,
    },
  })),

  // Chaos mode
  injectFault: (nodeId, fault) => set((state) => {
    const newFaults = new Map(state.faultInjections);
    newFaults.set(nodeId, fault);
    const newNodeStates = new Map(state.nodeStates);
    newNodeStates.set(nodeId, { nodeId, status: fault, lastUpdated: Date.now() });
    return { faultInjections: newFaults, nodeStates: newNodeStates };
  }),

  clearFault: (nodeId) => set((state) => {
    const newFaults = new Map(state.faultInjections);
    newFaults.delete(nodeId);
    const newIsolated = new Set(state.isolatedNodes);
    newIsolated.delete(nodeId);
    const newNodeStates = new Map(state.nodeStates);
    newNodeStates.set(nodeId, { nodeId, status: 'idle', lastUpdated: Date.now() });
    return { faultInjections: newFaults, isolatedNodes: newIsolated, nodeStates: newNodeStates };
  }),

  clearAllFaults: () => set((state) => {
    const newNodeStates = new Map(state.nodeStates);
    for (const nodeId of state.faultInjections.keys()) {
      newNodeStates.set(nodeId, { nodeId, status: 'idle', lastUpdated: Date.now() });
    }
    for (const nodeId of state.isolatedNodes) {
      newNodeStates.set(nodeId, { nodeId, status: 'idle', lastUpdated: Date.now() });
    }
    return { faultInjections: new Map(), isolatedNodes: new Set(), nodeStates: newNodeStates };
  }),

  isolateNode: (nodeId) => set((state) => {
    const newIsolated = new Set(state.isolatedNodes);
    newIsolated.add(nodeId);
    const newFaults = new Map(state.faultInjections);
    newFaults.set(nodeId, 'down');
    const newNodeStates = new Map(state.nodeStates);
    newNodeStates.set(nodeId, { nodeId, status: 'down', lastUpdated: Date.now() });
    return { isolatedNodes: newIsolated, faultInjections: newFaults, nodeStates: newNodeStates };
  }),

  restoreNode: (nodeId) => set((state) => {
    const newFaults = new Map(state.faultInjections);
    newFaults.delete(nodeId);
    const newIsolated = new Set(state.isolatedNodes);
    newIsolated.delete(nodeId);
    const newNodeStates = new Map(state.nodeStates);
    newNodeStates.set(nodeId, { nodeId, status: 'idle', lastUpdated: Date.now() });
    return { faultInjections: newFaults, isolatedNodes: newIsolated, nodeStates: newNodeStates };
  }),
}));

/**
 * Selecteur derive : latence moyenne des reponses recues (en ms, arrondi).
 * @returns 0 si aucune reponse recue.
 */
export const selectAverageLatency = (state: SimulationStore): number => {
  const { responsesReceived, totalLatency } = state.metrics;
  if (responsesReceived === 0) return 0;
  return Math.round(totalLatency / responsesReceived);
};

/**
 * Selecteur derive : taux de succes en pourcentage (0-100).
 * @returns 0 si aucune reponse recue.
 */
export const selectSuccessRate = (state: SimulationStore): number => {
  const { responsesReceived, successCount } = state.metrics;
  if (responsesReceived === 0) return 0;
  return Math.round((successCount / responsesReceived) * 100);
};
