import { create } from 'zustand';
import type {
  SimulationState,
  SimulationMetrics,
  Particle,
  NodeState,
  NodeStatus,
  ResourceUtilization,
  ClientGroupMetrics,
} from '@/types';

/** Rapport genere a l'arret de la simulation avec metriques finales et historique. */
export interface SimulationReport {
  duration: number; // actual duration in ms
  configuredDuration: number | null; // configured duration in ms (null = unlimited)
  metrics: SimulationMetrics;
  resourceUtilizations: Record<string, ResourceUtilization>;
  clientGroupStats: Record<string, ClientGroupMetrics>;
  endReason: 'manual' | 'timeout' | 'error';
  timestamp: number;
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

  // Client group stats for stress testing
  clientGroupStats: Map<string, ClientGroupMetrics>;

  // Report
  report: SimulationReport | null;
  showReport: boolean;

  // Actions - Simulation control
  start: () => void;
  pause: () => void;
  stop: (reason?: 'manual' | 'timeout' | 'error') => void;
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
  clearResourceUtilizations: () => void;

  // Actions - Client group stats
  setClientGroupStats: (groupId: string, stats: ClientGroupMetrics) => void;
  updateClientGroupStats: (groupId: string, activeClients: number, requestsSent: number) => void;
  clearClientGroupStats: () => void;
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
  clientGroupStats: new Map(),
  report: null,
  showReport: false,

  // Simulation control
  start: () => set((state) => ({
    state: 'running',
    elapsedTime: 0,
    metrics: {
      ...state.metrics,
      startTime: state.metrics.startTime ?? Date.now(),
    },
  })),

  pause: () => set({ state: 'paused' }),

  stop: (reason = 'manual') => {
    const state = get();
    const actualDuration = state.metrics.startTime
      ? Date.now() - state.metrics.startTime
      : state.elapsedTime;

    // Generate report
    const report: SimulationReport = {
      duration: actualDuration,
      configuredDuration: state.duration ? state.duration * 1000 : null,
      metrics: { ...state.metrics },
      resourceUtilizations: Object.fromEntries(state.resourceUtilizations),
      clientGroupStats: Object.fromEntries(state.clientGroupStats),
      endReason: reason,
      timestamp: Date.now(),
    };

    set({
      state: 'idle',
      particles: [],
      nodeStates: new Map(),
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
    clientGroupStats: new Map(),
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

  clearResourceUtilizations: () => set({ resourceUtilizations: new Map() }),

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
