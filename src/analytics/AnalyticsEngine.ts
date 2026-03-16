import type { Node } from '@xyflow/react';
import type {
  ResourceUtilization,
  TimeSeriesSnapshot,
  MessageQueueUtilization,
  ApiGatewayUtilization,
  ComponentType,
} from '@/types';
import type { ComponentAnalytics, ComponentAnalyticsEvent, AnalyticsSynthesis } from './types';

const MAX_HISTORY = 60;
const THROTTLE_MS = 500;

/**
 * AnalyticsEngine — collecte les données analytiques per-composant.
 *
 * S'abonne aux callbacks SimulationCallbacks existants depuis FlowCanvas.
 * Zéro modification des handlers ou de SimulationEngine.
 *
 * Throttle les événements sortants à 1x/500ms/nœud pour éviter
 * de surcharger React (onResourceUpdate fire à ~100ms/nœud).
 */
export class AnalyticsEngine {
  private components = new Map<string, ComponentAnalytics>();
  private nodeLabels = new Map<string, string>();
  private nodeTypes = new Map<string, ComponentType>();
  private lastSnapshotRequests = new Map<string, number>();
  private lastFireTime = new Map<string, number>();
  private simulationStartTime = 0;

  constructor(
    private readonly onAnalyticsUpdate: (event: ComponentAnalyticsEvent) => void,
  ) {}

  /** Initialise les métadonnées nœud avant le démarrage de la simulation. */
  initialize(nodes: Node[]): void {
    this.components.clear();
    this.nodeLabels.clear();
    this.nodeTypes.clear();
    this.lastSnapshotRequests.clear();
    this.lastFireTime.clear();
    this.simulationStartTime = Date.now();

    for (const node of nodes) {
      const label = (node.data as { label?: string }).label ?? node.id.split('-')[0];
      this.nodeLabels.set(node.id, label);
      this.nodeTypes.set(node.id, node.type as ComponentType);
    }
  }

  /** Depuis onResourceUpdate — met à jour CPU/mem/réseau/queue. */
  handleResourceUpdate(nodeId: string, utilization: ResourceUtilization): void {
    const analytics = this.getOrCreate(nodeId);

    analytics.cpu = utilization.cpu;
    analytics.memory = utilization.memory;
    analytics.network = utilization.network;
    analytics.queueDepth = utilization.queuedRequests;
    analytics.activeConnections = utilization.activeConnections;

    if (utilization.throughput !== undefined) {
      analytics.rps = utilization.throughput;
    }
    if (utilization.errorRate !== undefined) {
      analytics.errorRate = utilization.errorRate;
    }

    analytics.cpuHistory = push(analytics.cpuHistory, utilization.cpu);
    analytics.memoryHistory = push(analytics.memoryHistory, utilization.memory);
    analytics.isAggregated = utilization.isAggregated;
    analytics.childrenCount = utilization.childrenCount;
    analytics.lastUpdated = Date.now();

    this.fireThrottled(nodeId, 'resource_update');
  }

  /** Depuis onTimeSeriesSnapshot — met à jour latence/RPS/erreurs par nœud. */
  handleTimeSeriesSnapshot(snapshot: TimeSeriesSnapshot): void {
    for (const [nodeId, data] of Object.entries(snapshot.perServer)) {
      const analytics = this.getOrCreate(nodeId);

      // Delta de requêtes depuis le dernier snapshot → RPS
      const prevRequests = this.lastSnapshotRequests.get(nodeId) ?? 0;
      const reqDelta = Math.max(0, data.requests - prevRequests);
      this.lastSnapshotRequests.set(nodeId, data.requests);

      // Intervalle depuis le début (snapshots tous les ~5s)
      const intervalSec = 5;
      const derivedRps = reqDelta / intervalSec;

      analytics.totalRequests = data.requests;
      analytics.totalErrors = data.errors;
      analytics.avgLatency = data.avgLatency;
      analytics.rps = derivedRps;
      analytics.errorRate = data.requests > 0
        ? (data.errors / data.requests) * 100
        : 0;

      analytics.latencyHistory = push(analytics.latencyHistory, data.avgLatency);
      analytics.rpsHistory = push(analytics.rpsHistory, derivedRps);
      analytics.errorHistory = push(analytics.errorHistory, analytics.errorRate);
      analytics.lastUpdated = Date.now();

      // Les snapshots ne sont pas throttlés (toutes les 5s, rares)
      this.fire(nodeId, 'latency_snapshot');
    }
  }

  /** Depuis onMessageQueueUpdate. */
  handleMessageQueueUpdate(nodeId: string, utilization: MessageQueueUtilization): void {
    const analytics = this.getOrCreate(nodeId);
    analytics.queueUtilization = utilization;
    analytics.queueDepth = utilization.queueDepth;
    analytics.lastUpdated = Date.now();
    this.fire(nodeId, 'queue_update');
  }

  /** Depuis onApiGatewayUpdate. */
  handleApiGatewayUpdate(nodeId: string, utilization: ApiGatewayUtilization): void {
    const analytics = this.getOrCreate(nodeId);
    analytics.gatewayUtilization = utilization;
    analytics.totalRequests = utilization.totalRequests;
    analytics.totalErrors = utilization.blockedRequests;
    analytics.errorRate = utilization.totalRequests > 0
      ? (utilization.blockedRequests / utilization.totalRequests) * 100
      : 0;
    analytics.avgLatency = utilization.avgLatency;
    analytics.activeConnections = utilization.activeConnections;
    analytics.lastUpdated = Date.now();
    this.fire(nodeId, 'gateway_update');
  }

  /** Depuis onHierarchicalResourceUpdate — met à jour le parent + les enfants. */
  handleHierarchicalResourceUpdate(
    parentId: string,
    aggregated: ResourceUtilization,
    children: { childId: string; utilization: ResourceUtilization }[],
  ): void {
    // Mettre à jour le parent
    const parent = this.getOrCreate(parentId);
    parent.cpu = aggregated.cpu;
    parent.memory = aggregated.memory;
    parent.network = aggregated.network;
    parent.isAggregated = true;
    parent.childrenCount = children.length;
    parent.cpuHistory = push(parent.cpuHistory, aggregated.cpu);
    parent.memoryHistory = push(parent.memoryHistory, aggregated.memory);
    parent.lastUpdated = Date.now();

    // Mettre à jour les enfants silencieusement (sans throttle individuel)
    for (const { childId, utilization } of children) {
      const child = this.getOrCreate(childId);
      child.cpu = utilization.cpu;
      child.memory = utilization.memory;
      child.network = utilization.network;
      child.queueDepth = utilization.queuedRequests;
      child.activeConnections = utilization.activeConnections;
      child.cpuHistory = push(child.cpuHistory, utilization.cpu);
      child.memoryHistory = push(child.memoryHistory, utilization.memory);
      child.lastUpdated = Date.now();
    }

    // Un seul événement pour le parent
    this.fireThrottled(parentId, 'hierarchy_update');
  }

  /**
   * Génère la synthèse post-simulation.
   * Appelé par FlowCanvas depuis onSimulationComplete.
   */
  synthesize(): AnalyticsSynthesis {
    const now = Date.now();
    const durationMs = now - this.simulationStartTime;
    const all = Array.from(this.components.values());

    const topByLatency = [...all]
      .filter(c => c.avgLatency > 0)
      .sort((a, b) => b.avgLatency - a.avgLatency)
      .slice(0, 5)
      .map(c => ({ nodeId: c.nodeId, nodeName: c.nodeName, avgLatency: c.avgLatency }));

    const topByErrorRate = [...all]
      .filter(c => c.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5)
      .map(c => ({ nodeId: c.nodeId, nodeName: c.nodeName, errorRate: c.errorRate }));

    const topByCpuUsage = [...all]
      .filter(c => c.cpu !== undefined)
      .sort((a, b) => (b.cpu ?? 0) - (a.cpu ?? 0))
      .slice(0, 5)
      .map(c => ({ nodeId: c.nodeId, nodeName: c.nodeName, cpu: c.cpu ?? 0 }));

    const topByQueueDepth = [...all]
      .filter(c => c.queueDepth !== undefined && c.queueDepth > 0)
      .sort((a, b) => (b.queueDepth ?? 0) - (a.queueDepth ?? 0))
      .slice(0, 3)
      .map(c => ({ nodeId: c.nodeId, nodeName: c.nodeName, queueDepth: c.queueDepth ?? 0 }));

    const observations = buildObservations(all);

    return {
      generatedAt: now,
      durationMs,
      componentCount: all.length,
      topByLatency,
      topByErrorRate,
      topByCpuUsage,
      topByQueueDepth,
      components: Object.fromEntries(this.components.entries()),
      observations,
    };
  }

  reset(): void {
    this.components.clear();
    this.nodeLabels.clear();
    this.nodeTypes.clear();
    this.lastSnapshotRequests.clear();
    this.lastFireTime.clear();
    this.simulationStartTime = 0;
  }

  getAll(): Map<string, ComponentAnalytics> {
    return this.components;
  }

  getComponent(nodeId: string): ComponentAnalytics | undefined {
    return this.components.get(nodeId);
  }

  // ─── Helpers privés ───────────────────────────────────────────────────────

  private getOrCreate(nodeId: string): ComponentAnalytics {
    let a = this.components.get(nodeId);
    if (!a) {
      const now = Date.now();
      a = {
        nodeId,
        nodeType: this.nodeTypes.get(nodeId) ?? ('api-service' as ComponentType),
        nodeName: this.nodeLabels.get(nodeId) ?? nodeId,
        avgLatency: 0,
        latencyHistory: [],
        rps: 0,
        rpsHistory: [],
        totalRequests: 0,
        totalErrors: 0,
        errorRate: 0,
        errorHistory: [],
        cpuHistory: [],
        memoryHistory: [],
        firstSeen: now,
        lastUpdated: now,
      };
      this.components.set(nodeId, a);
    }
    return a;
  }

  private fire(
    nodeId: string,
    type: ComponentAnalyticsEvent['type'],
  ): void {
    const analytics = this.components.get(nodeId);
    if (!analytics) return;
    this.lastFireTime.set(nodeId, Date.now());
    this.onAnalyticsUpdate({ type, nodeId, timestamp: Date.now(), payload: { ...analytics } });
  }

  private fireThrottled(
    nodeId: string,
    type: ComponentAnalyticsEvent['type'],
  ): void {
    const now = Date.now();
    const last = this.lastFireTime.get(nodeId) ?? 0;
    if (now - last >= THROTTLE_MS) {
      this.fire(nodeId, type);
    }
    // Sinon, l'état interne est à jour mais on ne notifie pas React
  }
}

// ─── Règles d'observation ───────────────────────────────────────────────────

function buildObservations(components: ComponentAnalytics[]): string[] {
  const obs: string[] = [];

  const highError = components.filter(c => c.errorRate > 10);
  if (highError.length > 0) {
    const names = highError.map(c => c.nodeName).join(', ');
    obs.push(`Taux d'erreur élevé (>10%) sur ${highError.length} composant(s) : ${names}`);
  }

  const highCpu = components.filter(c => (c.cpu ?? 0) > 85);
  if (highCpu.length > 0) {
    const names = highCpu.map(c => c.nodeName).join(', ');
    obs.push(`Saturation CPU détectée (>85%) sur : ${names}`);
  }

  const highLatency = components.filter(c => c.avgLatency > 500);
  if (highLatency.length > 0) {
    const names = highLatency.map(c => c.nodeName).join(', ');
    obs.push(`Latence élevée (>500ms) observée sur : ${names}`);
  }

  const deepQueues = components.filter(
    c => c.queueUtilization && c.queueUtilization.queueDepth > 50,
  );
  if (deepQueues.length > 0) {
    const names = deepQueues.map(c => c.nodeName).join(', ');
    obs.push(`File d'attente profonde (>50 messages) sur : ${names}`);
  }

  if (obs.length === 0) {
    obs.push('Aucune anomalie détectée — tous les composants semblent stables.');
  }

  return obs;
}

/** Ajoute une valeur à un tableau en maintenant MAX_HISTORY éléments. */
function push(arr: number[], value: number): number[] {
  const next = [...arr, value];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}
