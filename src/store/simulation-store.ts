import { create } from 'zustand';
import type {
  SimulationState,
  SimulationMetrics,
  ExtendedSimulationMetrics,
  SimulationEvent,
  TimeSeriesSnapshot,
  Particle,
  NodeState,
  NodeStatus,
  ResourceUtilization,
  ResourceSample,
  ClientGroupMetrics,
  BottleneckAnalysis,
  RequestTrace,
  CacheUtilization,
  DatabaseUtilization,
  MessageQueueUtilization,
  ApiGatewayUtilization,
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

  // Extended data captured before cleanup
  extendedMetrics?: ExtendedSimulationMetrics;
  bottleneckAnalysis?: BottleneckAnalysis | null;
  hierarchicalUtilizations?: Record<string, { aggregated: ResourceUtilization; children: { childId: string; utilization: ResourceUtilization }[] }>;
  resourceHistory?: ResourceSample[];
  traces?: RequestTrace[];
  faultInjections?: Record<string, string>;
  apiGatewayStats?: Record<string, ApiGatewayUtilization>;
  messageQueueStats?: Record<string, MessageQueueUtilization>;
  cacheStats?: Record<string, CacheUtilization>;
  databaseStats?: Record<string, DatabaseUtilization>;
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

  // Extended metrics (percentiles, rejections, queue stats) — pushed every 1s
  extendedMetrics: ExtendedSimulationMetrics | null;

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

  // Bottleneck analysis
  bottleneckAnalysis: BottleneckAnalysis | null;

  // Chaos mode — fault injections
  faultInjections: Map<string, 'down' | 'degraded'>;
  isolatedNodes: Set<string>;

  // Report
  report: SimulationReport | null;
  showReport: boolean;

  // Analysis mode (full-screen post-simulation analysis)
  analysisMode: boolean;

  // Engine metrics provider (set by FlowCanvas to pull fresh metrics from engine)
  _engineMetricsProvider: (() => SimulationMetrics) | null;
  registerEngineMetricsProvider: (provider: (() => SimulationMetrics) | null) => void;

  // Engine report data provider (set by FlowCanvas to pull extended data before stop)
  _engineReportDataProvider: (() => {
    extendedMetrics: ExtendedSimulationMetrics;
    traces: RequestTrace[];
    resourceHistory: ResourceSample[];
    apiGatewayStats: Record<string, ApiGatewayUtilization>;
    messageQueueStats: Record<string, MessageQueueUtilization>;
    cacheStats: Record<string, CacheUtilization>;
    databaseStats: Record<string, DatabaseUtilization>;
  }) | null;
  registerEngineReportDataProvider: (provider: SimulationStore['_engineReportDataProvider']) => void;

  // Actions - Simulation control
  start: () => void;
  pause: () => void;
  stop: (reason?: 'manual' | 'timeout' | 'error' | 'completed') => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  setDuration: (duration: number | null) => void;
  updateElapsedTime: (elapsed: number) => void;

  // Actions - Report & Analysis
  setShowReport: (show: boolean) => void;
  clearReport: () => void;
  setAnalysisMode: (active: boolean) => void;
  /** Generate a live snapshot report from current running/paused state (without stopping). */
  generateLiveReport: () => SimulationReport | null;

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
  setExtendedMetrics: (extendedMetrics: ExtendedSimulationMetrics) => void;

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

  // Actions - Bottleneck analysis
  setBottleneckAnalysis: (analysis: BottleneckAnalysis | null) => void;

  // Actions - Chaos mode
  injectFault: (nodeId: string, fault: 'down' | 'degraded') => void;
  clearFault: (nodeId: string) => void;
  clearAllFaults: () => void;
  isolateNode: (nodeId: string) => void;
  restoreNode: (nodeId: string) => void;
}

// localStorage key for persisting the last simulation report
const REPORT_STORAGE_KEY = 'simulation-last-report';
const REPORT_MAX_SIZE = 2 * 1024 * 1024; // 2MB limit

/** Save report to localStorage (truncate if too large). */
function persistReport(report: SimulationReport): void {
  try {
    // Convert Maps to plain objects for JSON serialization
    const serializable = {
      ...report,
      extendedMetrics: report.extendedMetrics ? {
        ...report.extendedMetrics,
        rejectionsByReason: report.extendedMetrics.rejectionsByReason instanceof Map
          ? Object.fromEntries(report.extendedMetrics.rejectionsByReason)
          : report.extendedMetrics.rejectionsByReason,
        clientGroupStats: report.extendedMetrics.clientGroupStats instanceof Map
          ? Object.fromEntries(report.extendedMetrics.clientGroupStats)
          : report.extendedMetrics.clientGroupStats,
      } : undefined,
    };
    let json = JSON.stringify(serializable);
    // If too large, trim events and resourceHistory
    if (json.length > REPORT_MAX_SIZE) {
      serializable.events = serializable.events.slice(0, 500);
      serializable.resourceHistory = serializable.resourceHistory?.slice(-300) ?? [];
      json = JSON.stringify(serializable);
    }
    localStorage.setItem(REPORT_STORAGE_KEY, json);
  } catch {
    // localStorage may be full or unavailable
  }
}

/** Load report from localStorage. */
function loadPersistedReport(): SimulationReport | null {
  try {
    const json = localStorage.getItem(REPORT_STORAGE_KEY);
    if (!json) return null;
    const report = JSON.parse(json) as SimulationReport;
    // Restore Maps in extendedMetrics if they were serialized as plain objects
    if (report.extendedMetrics) {
      const ext = report.extendedMetrics as unknown as Record<string, unknown>;
      if (ext.rejectionsByReason && !(ext.rejectionsByReason instanceof Map)) {
        (report.extendedMetrics as unknown as Record<string, unknown>).rejectionsByReason =
          new Map(Object.entries(ext.rejectionsByReason as Record<string, number>));
      }
      if (ext.clientGroupStats && !(ext.clientGroupStats instanceof Map)) {
        (report.extendedMetrics as unknown as Record<string, unknown>).clientGroupStats =
          new Map(Object.entries(ext.clientGroupStats as Record<string, ClientGroupMetrics>));
      }
    }
    return report;
  } catch {
    return null;
  }
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
  extendedMetrics: null,
  resourceUtilizations: new Map(),
  resourceHistory: [],
  clientGroupStats: new Map(),
  metricsTimeSeries: [],
  hierarchicalUtilizations: {},
  bottleneckAnalysis: null,
  faultInjections: new Map(),
  isolatedNodes: new Set(),
  report: loadPersistedReport(),
  showReport: false,
  analysisMode: false,
  _engineMetricsProvider: null,
  _engineReportDataProvider: null,

  registerEngineMetricsProvider: (provider) => set({ _engineMetricsProvider: provider }),
  registerEngineReportDataProvider: (provider) => set({ _engineReportDataProvider: provider }),

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

  pause: () => {
    const state = get();
    // Capture extended metrics snapshot on pause so UI can display them
    const reportData = state._engineReportDataProvider ? state._engineReportDataProvider() : null;
    return set({
      state: 'paused',
      // Update extended metrics with latest data from engine
      extendedMetrics: reportData?.extendedMetrics ?? state.extendedMetrics,
    });
  },

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

    // Capture extended data from engine BEFORE cleanup
    const reportData = state._engineReportDataProvider ? state._engineReportDataProvider() : null;

    // Generate report with fresh engine metrics + all extended data
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

      // Extended data
      extendedMetrics: reportData?.extendedMetrics ?? state.extendedMetrics ?? undefined,
      bottleneckAnalysis: state.bottleneckAnalysis,
      hierarchicalUtilizations: { ...state.hierarchicalUtilizations },
      resourceHistory: [...state.resourceHistory],
      traces: reportData?.traces ?? [],
      faultInjections: Object.fromEntries(state.faultInjections),
      apiGatewayStats: reportData?.apiGatewayStats ?? {},
      messageQueueStats: reportData?.messageQueueStats ?? {},
      cacheStats: reportData?.cacheStats ?? {},
      databaseStats: reportData?.databaseStats ?? {},
    };

    // Persist report to localStorage for recovery after page refresh
    persistReport(report);

    set({
      state: 'idle',
      particles: [],
      nodeStates: new Map(),
      bottleneckAnalysis: null,
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
    extendedMetrics: null,
    resourceUtilizations: new Map(),
    resourceHistory: [],
    clientGroupStats: new Map(),
    metricsTimeSeries: [],
    hierarchicalUtilizations: {},
    bottleneckAnalysis: null,
    faultInjections: new Map(),
    isolatedNodes: new Set(),
  }),

  setSpeed: (speed) => set({ speed: Math.max(0.5, Math.min(4, speed)) }),

  setDuration: (duration) => set({ duration }),

  updateElapsedTime: (elapsed) => set({ elapsedTime: elapsed }),

  // Report & analysis actions
  setShowReport: (show) => set({ showReport: show }),
  setAnalysisMode: (active) => set({ analysisMode: active }),

  generateLiveReport: () => {
    const state = get();
    if (state.state === 'idle' && !state.report) return null;

    // If we already have a report (post-stop), return it
    if (state.report) return state.report;

    // Generate a live snapshot from current running/paused state
    const freshMetrics = state._engineMetricsProvider ? state._engineMetricsProvider() : state.metrics;
    const reportData = state._engineReportDataProvider ? state._engineReportDataProvider() : null;
    const capturedEvents = simulationEvents.getEvents();

    const duration = freshMetrics.startTime ? Date.now() - freshMetrics.startTime : state.elapsedTime;

    return {
      duration,
      configuredDuration: state.duration ? state.duration * 1000 : null,
      metrics: { ...freshMetrics },
      resourceUtilizations: Object.fromEntries(state.resourceUtilizations),
      clientGroupStats: Object.fromEntries(state.clientGroupStats),
      endReason: 'manual' as const,
      timestamp: Date.now(),
      events: capturedEvents,
      timeSeries: [...state.metricsTimeSeries],
      extendedMetrics: reportData?.extendedMetrics ?? state.extendedMetrics ?? undefined,
      bottleneckAnalysis: state.bottleneckAnalysis,
      hierarchicalUtilizations: { ...state.hierarchicalUtilizations },
      resourceHistory: [...state.resourceHistory],
      traces: reportData?.traces ?? [],
      faultInjections: Object.fromEntries(state.faultInjections),
      apiGatewayStats: reportData?.apiGatewayStats ?? {},
      messageQueueStats: reportData?.messageQueueStats ?? {},
      cacheStats: reportData?.cacheStats ?? {},
      databaseStats: reportData?.databaseStats ?? {},
    };
  },

  clearReport: () => {
    try { localStorage.removeItem(REPORT_STORAGE_KEY); } catch { /* ignore */ }
    return set({ report: null, showReport: false });
  },

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
  setExtendedMetrics: (extendedMetrics) => set({ extendedMetrics }),

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

  // Bottleneck analysis
  setBottleneckAnalysis: (analysis) => set({ bottleneckAnalysis: analysis }),

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
