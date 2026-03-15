import type { Node, Edge } from '@xyflow/react';
import type {
  ResourceUtilization,
  ResourceSample,
  BottleneckInfo,
  BottleneckAnalysis,
  HeatmapLevel,
} from '@/types';
import type { CriticalPathAnalyzer } from './CriticalPathAnalyzer';

// ============================================
// Input types
// ============================================

/** Stats non-serveur pour l'analyse multi-composant */
export interface ApiGatewayStats { totalRequests: number; blockedRequests: number; rateLimitHits: number; authFailures: number }
export interface MessageQueueStats { queueDepth: number; messagesPublished: number; messagesConsumed: number; messagesDeadLettered: number; avgProcessingTime: number }
export interface DatabaseStats { activeConnections: number; connectionPoolUsage: number; queriesPerSecond: number; avgQueryTime: number }
export interface CircuitBreakerStats { state: string; failureCount: number }
export interface LoadBalancerStats { totalRequests: number; unhealthyBackends: number; totalBackends: number }
export interface CacheStats { hitCount: number; missCount: number; hitRatio: number }

export interface BottleneckInputs {
  serverStates: Map<string, { utilization: ResourceUtilization; resources: { connections: { maxConcurrent: number } } }>;
  perServerMetrics: Map<string, { requests: number; errors: number; totalLatency: number; rps: number }>;
  resourceHistory: ResourceSample[];
  edges: Edge[];
  nodes: Node[];
  criticalPathAnalyzer: CriticalPathAnalyzer;
  // Stats multi-composant
  apiGatewayStats?: Map<string, ApiGatewayStats>;
  messageQueueStats?: Map<string, MessageQueueStats>;
  databaseStats?: Map<string, DatabaseStats>;
  circuitBreakerStats?: Map<string, CircuitBreakerStats>;
  loadBalancerStats?: Map<string, LoadBalancerStats>;
  cacheStats?: Map<string, CacheStats>;
}

// ============================================
// BottleneckAnalyzer
// ============================================

/**
 * Analyseur de goulots d'étranglement.
 * Classe pure sans dépendance React/Zustand.
 *
 * 5 algorithmes de détection :
 * 1. P99 latency sur le chemin critique (via CriticalPathAnalyzer)
 * 2. Files d'attente croissantes (analyse de dérivée)
 * 3. Alerte utilisation > 80%
 * 4. Little's Law : L = λ × W → prédiction de saturation
 * 5. Détection SPOF (point unique de défaillance)
 */
export class BottleneckAnalyzer {
  // Cache SPOF — la topologie est statique pendant la simulation
  private spofCache: Map<string, boolean> | null = null;
  private lastTopologyHash: string = '';

  /**
   * Analyse principale — appelée toutes les ~1s par le SimulationEngine.
   */
  analyze(inputs: BottleneckInputs): BottleneckAnalysis {
    const { serverStates, perServerMetrics, resourceHistory, edges, nodes, criticalPathAnalyzer } = inputs;

    // Invalider le cache SPOF si la topologie a changé
    const topoHash = `${nodes.length}:${edges.length}`;
    if (topoHash !== this.lastTopologyHash) {
      this.spofCache = null;
      this.lastTopologyHash = topoHash;
    }

    // Calculer SPOF (une seule fois par topologie)
    if (!this.spofCache) {
      this.spofCache = this.computeAllSpof(nodes, edges);
    }

    // Agréger latencyContribution depuis les traces récentes
    const latencyContributions = this.aggregateLatencyContributions(criticalPathAnalyzer);

    // Collecter le chemin critique le plus fréquent
    const criticalPath = this.extractCriticalPath(criticalPathAnalyzer);

    // Analyser chaque nœud avec des données de serveur
    const allInfos: BottleneckInfo[] = [];

    for (const [nodeId, state] of serverStates) {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const util = state.utilization;
      const metrics = perServerMetrics.get(nodeId);
      const saturation = util.saturation ?? Math.max(util.cpu, util.memory, util.network);
      const utilization = saturation;

      // P99 latency approximée depuis les métriques par serveur
      const p99Latency = metrics && metrics.requests > 0
        ? Math.round(metrics.totalLatency / metrics.requests * 2.5) // approximation P99 ≈ 2.5× avg
        : 0;

      // Contribution latence (% du total e2e)
      const latencyContribution = latencyContributions.get(nodeId) ?? 0;

      // Croissance de la file d'attente (dérivée)
      const queueGrowthRate = this.computeQueueGrowthRate(nodeId, resourceHistory);

      // SPOF
      const isSpof = this.spofCache!.get(nodeId) ?? false;

      // Little's Law — prédiction de saturation
      const maxConnections = state.resources.connections.maxConcurrent;
      const predictedSaturationTime = this.predictSaturation(
        util.activeConnections,
        maxConnections,
        queueGrowthRate,
      );

      // Heatmap level
      const heatmapLevel = this.computeHeatmapLevel(saturation);

      // Score d'impact composite
      const normalizedQueueGrowth = Math.min(Math.abs(queueGrowthRate) * 10, 100);
      const impactScore = Math.round(
        0.40 * utilization +
        0.25 * latencyContribution +
        0.20 * normalizedQueueGrowth +
        0.15 * (isSpof ? 100 : 0)
      );

      // Raisons détaillées
      const reasons = this.buildReasons(util, queueGrowthRate, isSpof, saturation);

      allInfos.push({
        nodeId,
        nodeName: (node.data as Record<string, unknown>).label as string || nodeId,
        nodeType: node.type || 'unknown',
        impactScore,
        rank: 0, // assigné après tri
        saturation,
        p99Latency,
        latencyContribution,
        queueGrowthRate,
        utilization,
        isSpof,
        heatmapLevel,
        predictedSaturationTime,
        reasons,
      });
    }

    // Analyser les composants non-serveur
    this.analyzeNonServerComponents(inputs, allInfos, latencyContributions);

    // Trier par impactScore décroissant et assigner les rangs
    allInfos.sort((a, b) => b.impactScore - a.impactScore);
    allInfos.forEach((info, i) => { info.rank = i + 1; });

    const topBottlenecks = allInfos.slice(0, 3);
    const spofNodes = allInfos.filter((i) => i.isSpof).map((i) => i.nodeId);

    return {
      timestamp: Date.now(),
      topBottlenecks,
      allNodes: allInfos,
      spofNodes,
      criticalPath,
    };
  }

  /**
   * Réinitialise le cache SPOF (à appeler quand la topologie change).
   */
  resetCache(): void {
    this.spofCache = null;
    this.lastTopologyHash = '';
  }

  // ============================================
  // Algorithme 1 : Latency contribution
  // ============================================

  private aggregateLatencyContributions(analyzer: CriticalPathAnalyzer): Map<string, number> {
    const contributions = new Map<string, number>();
    const traces = analyzer.getTraces();

    // Analyser les 20 traces les plus récentes (complétées)
    const recentTraces = traces
      .filter((t) => t.status === 'completed')
      .slice(0, 20);

    if (recentTraces.length === 0) return contributions;

    // Agréger le % de temps par nœud sur toutes les traces
    const totalPerNode = new Map<string, number>();
    let traceCount = 0;

    for (const trace of recentTraces) {
      const analysis = analyzer.analyze(trace.chainId);
      if (!analysis) continue;
      traceCount++;

      for (const [nodeId, data] of analysis.timePerComponent) {
        totalPerNode.set(nodeId, (totalPerNode.get(nodeId) ?? 0) + data.percentage);
      }
    }

    if (traceCount > 0) {
      for (const [nodeId, total] of totalPerNode) {
        contributions.set(nodeId, Math.round((total / traceCount) * 100) / 100);
      }
    }

    return contributions;
  }

  // ============================================
  // Algorithme 2 : Queue growth (dérivée)
  // ============================================

  private computeQueueGrowthRate(nodeId: string, resourceHistory: ResourceSample[]): number {
    // Filtrer les échantillons pour ce nœud, 10 derniers
    const samples = resourceHistory
      .filter((s) => s.nodeId === nodeId)
      .slice(-10);

    if (samples.length < 3) return 0;

    // Régression linéaire simple sur queuedRequests
    const n = samples.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = samples[i].queuedRequests;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return 0;

    const slope = (n * sumXY - sumX * sumY) / denominator;

    // Convertir en req/s (échantillons à 100ms d'intervalle → ×10 pour /s)
    return Math.round(slope * 10 * 100) / 100;
  }

  // ============================================
  // Algorithme 3 : Heatmap levels
  // ============================================

  private computeHeatmapLevel(saturation: number): HeatmapLevel {
    if (saturation >= 90) return 'red';
    if (saturation >= 70) return 'orange';
    if (saturation >= 50) return 'yellow';
    return 'green';
  }

  // ============================================
  // Algorithme 4 : Little's Law
  // ============================================

  private predictSaturation(
    activeConnections: number,
    maxConnections: number,
    queueGrowthRate: number,
  ): number | null {
    // Si la file ne croît pas, le système est stable
    if (queueGrowthRate <= 0.5) return null;

    // Si déjà saturé
    if (activeConnections >= maxConnections) return 0;

    // Temps estimé avant saturation = capacité restante / taux de croissance
    const remaining = maxConnections - activeConnections;
    const timeToSaturation = remaining / queueGrowthRate;

    // Ignorer les prédictions très lointaines (> 5 minutes)
    if (timeToSaturation > 300) return null;

    return Math.round(timeToSaturation * 10) / 10;
  }

  // ============================================
  // Algorithme 5 : SPOF detection
  // ============================================

  private computeAllSpof(nodes: Node[], edges: Edge[]): Map<string, boolean> {
    const spofMap = new Map<string, boolean>();

    // Construire la map des edges entrants par nœud
    const incomingByTarget = new Map<string, Edge[]>();
    for (const edge of edges) {
      const existing = incomingByTarget.get(edge.target) || [];
      existing.push(edge);
      incomingByTarget.set(edge.target, existing);
    }

    // Construire la map des edges sortants par nœud
    const outgoingBySource = new Map<string, Edge[]>();
    for (const edge of edges) {
      const existing = outgoingBySource.get(edge.source) || [];
      existing.push(edge);
      outgoingBySource.set(edge.source, existing);
    }

    // Types qui ne sont pas des composants de traitement
    const nonProcessingTypes = new Set(['http-client', 'client-group', 'network-zone']);

    for (const node of nodes) {
      if (nonProcessingTypes.has(node.type || '')) {
        spofMap.set(node.id, false);
        continue;
      }

      const incoming = incomingByTarget.get(node.id) || [];

      // Un nœud est SPOF si :
      // 1. Il a des connexions entrantes (il participe au flux)
      // 2. Il n'a pas de "sibling" derrière un load-balancer
      if (incoming.length === 0) {
        spofMap.set(node.id, false);
        continue;
      }

      let isSpof = false;

      for (const inEdge of incoming) {
        const sourceNode = nodes.find((n) => n.id === inEdge.source);
        if (!sourceNode) continue;

        // Si le source est un load-balancer, vérifier le nombre de targets
        if (sourceNode.type === 'load-balancer') {
          const lbOutgoing = outgoingBySource.get(sourceNode.id) || [];
          // Tous les targets du même type que ce nœud
          const sameTypeSiblings = lbOutgoing.filter((e) => {
            const target = nodes.find((n) => n.id === e.target);
            return target && target.type === node.type;
          });
          // Si seul derrière le LB pour ce type → SPOF
          if (sameTypeSiblings.length <= 1) {
            isSpof = true;
          }
        } else {
          // Source n'est pas un LB → vérifier si le source a un seul target de ce type
          const sourceOutgoing = outgoingBySource.get(sourceNode.id) || [];
          const sameTypeTargets = sourceOutgoing.filter((e) => {
            const target = nodes.find((n) => n.id === e.target);
            return target && target.type === node.type;
          });
          if (sameTypeTargets.length <= 1) {
            isSpof = true;
          }
        }
      }

      spofMap.set(node.id, isSpof);
    }

    return spofMap;
  }

  // ============================================
  // Chemin critique
  // ============================================

  private extractCriticalPath(analyzer: CriticalPathAnalyzer): string[] {
    const traces = analyzer.getTraces();
    const latestCompleted = traces.find((t) => t.status === 'completed');
    if (!latestCompleted) return [];

    // Retourner les nodeIds uniques dans l'ordre de la trace
    const seen = new Set<string>();
    const path: string[] = [];
    for (const span of latestCompleted.spans) {
      if (!seen.has(span.nodeId)) {
        seen.add(span.nodeId);
        path.push(span.nodeId);
      }
    }
    return path;
  }

  // ============================================
  // Analyse multi-composant (non-serveur)
  // ============================================

  private analyzeNonServerComponents(
    inputs: BottleneckInputs,
    allInfos: BottleneckInfo[],
    latencyContributions: Map<string, number>
  ): void {
    const { nodes, apiGatewayStats, messageQueueStats, databaseStats, circuitBreakerStats, loadBalancerStats, cacheStats } = inputs;
    const getLabel = (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      return (node?.data as Record<string, unknown>)?.label as string || nodeId;
    };
    const getType = (nodeId: string) => nodes.find((n) => n.id === nodeId)?.type || 'unknown';
    const isSpof = (nodeId: string) => this.spofCache?.get(nodeId) ?? false;

    // API Gateway — taux de rejet
    if (apiGatewayStats) {
      for (const [nodeId, stats] of apiGatewayStats) {
        if (stats.totalRequests < 5) continue;
        const rejectionRate = (stats.blockedRequests / stats.totalRequests) * 100;
        if (rejectionRate < 10) continue;

        const reasons: string[] = [];
        if (stats.rateLimitHits > 0) reasons.push(`Rate limit: ${stats.rateLimitHits} hits`);
        if (stats.authFailures > 0) reasons.push(`Auth: ${stats.authFailures} échecs`);
        reasons.push(`Taux rejet: ${rejectionRate.toFixed(1)}%`);
        if (isSpof(nodeId)) reasons.push('Point unique de défaillance');

        const saturation = rejectionRate;
        allInfos.push({
          nodeId, nodeName: getLabel(nodeId), nodeType: getType(nodeId),
          impactScore: Math.round(rejectionRate * 0.8 + (isSpof(nodeId) ? 15 : 0)),
          rank: 0, saturation, p99Latency: 0,
          latencyContribution: latencyContributions.get(nodeId) ?? 0,
          queueGrowthRate: 0, utilization: saturation,
          isSpof: isSpof(nodeId), heatmapLevel: this.computeHeatmapLevel(saturation),
          predictedSaturationTime: null, reasons,
        });
      }
    }

    // Message Queue — profondeur file, DLQ
    if (messageQueueStats) {
      for (const [nodeId, stats] of messageQueueStats) {
        const reasons: string[] = [];
        let saturation = 0;

        if (stats.queueDepth > 10) {
          reasons.push(`File: ${stats.queueDepth} messages`);
          saturation = Math.min(100, stats.queueDepth);
        }
        if (stats.messagesDeadLettered > 0) {
          reasons.push(`DLQ: ${stats.messagesDeadLettered} messages`);
          saturation = Math.max(saturation, 60);
        }
        if (stats.avgProcessingTime > 500) {
          reasons.push(`Latence: ${Math.round(stats.avgProcessingTime)}ms`);
          saturation = Math.max(saturation, 50);
        }
        if (isSpof(nodeId)) reasons.push('Point unique de défaillance');

        if (reasons.length === 0 || (reasons.length === 1 && isSpof(nodeId))) continue;

        allInfos.push({
          nodeId, nodeName: getLabel(nodeId), nodeType: getType(nodeId),
          impactScore: Math.round(saturation * 0.7 + (isSpof(nodeId) ? 15 : 0)),
          rank: 0, saturation, p99Latency: Math.round(stats.avgProcessingTime),
          latencyContribution: latencyContributions.get(nodeId) ?? 0,
          queueGrowthRate: 0, utilization: saturation,
          isSpof: isSpof(nodeId), heatmapLevel: this.computeHeatmapLevel(saturation),
          predictedSaturationTime: null, reasons,
        });
      }
    }

    // Database — pool connexions, latence
    if (databaseStats) {
      for (const [nodeId, stats] of databaseStats) {
        const reasons: string[] = [];
        const saturation = stats.connectionPoolUsage;

        if (saturation > 70) reasons.push(`Pool: ${Math.round(saturation)}%`);
        if (stats.avgQueryTime > 100) reasons.push(`Latence requête: ${Math.round(stats.avgQueryTime)}ms`);
        if (stats.queriesPerSecond > 0) reasons.push(`QPS: ${Math.round(stats.queriesPerSecond)}`);
        if (isSpof(nodeId)) reasons.push('Point unique de défaillance');

        if (saturation < 70 && stats.avgQueryTime <= 100) continue;

        allInfos.push({
          nodeId, nodeName: getLabel(nodeId), nodeType: getType(nodeId),
          impactScore: Math.round(saturation * 0.6 + (stats.avgQueryTime > 200 ? 20 : 0) + (isSpof(nodeId) ? 15 : 0)),
          rank: 0, saturation, p99Latency: Math.round(stats.avgQueryTime * 2.5),
          latencyContribution: latencyContributions.get(nodeId) ?? 0,
          queueGrowthRate: 0, utilization: saturation,
          isSpof: isSpof(nodeId), heatmapLevel: this.computeHeatmapLevel(saturation),
          predictedSaturationTime: null, reasons,
        });
      }
    }

    // Circuit Breaker — état open/half-open
    if (circuitBreakerStats) {
      for (const [nodeId, stats] of circuitBreakerStats) {
        if (stats.state === 'closed') continue;

        const saturation = stats.state === 'open' ? 100 : 50;
        const reasons = [
          stats.state === 'open' ? 'Circuit ouvert' : 'Circuit semi-ouvert',
          `${stats.failureCount} échecs`,
        ];
        if (isSpof(nodeId)) reasons.push('Point unique de défaillance');

        allInfos.push({
          nodeId, nodeName: getLabel(nodeId), nodeType: getType(nodeId),
          impactScore: stats.state === 'open' ? 90 : 45,
          rank: 0, saturation, p99Latency: 0,
          latencyContribution: latencyContributions.get(nodeId) ?? 0,
          queueGrowthRate: 0, utilization: saturation,
          isSpof: isSpof(nodeId), heatmapLevel: stats.state === 'open' ? 'red' : 'orange',
          predictedSaturationTime: null, reasons,
        });
      }
    }

    // Load Balancer — backends down
    if (loadBalancerStats) {
      for (const [nodeId, stats] of loadBalancerStats) {
        if (stats.unhealthyBackends === 0 || stats.totalBackends === 0) continue;

        const unhealthyRatio = (stats.unhealthyBackends / stats.totalBackends) * 100;
        const saturation = unhealthyRatio;
        const reasons = [`${stats.unhealthyBackends}/${stats.totalBackends} backends down`];
        if (isSpof(nodeId)) reasons.push('Point unique de défaillance');

        allInfos.push({
          nodeId, nodeName: getLabel(nodeId), nodeType: getType(nodeId),
          impactScore: Math.round(unhealthyRatio * 0.8 + (isSpof(nodeId) ? 15 : 0)),
          rank: 0, saturation, p99Latency: 0,
          latencyContribution: latencyContributions.get(nodeId) ?? 0,
          queueGrowthRate: 0, utilization: saturation,
          isSpof: isSpof(nodeId), heatmapLevel: this.computeHeatmapLevel(saturation),
          predictedSaturationTime: null, reasons,
        });
      }
    }

    // Cache — hit ratio faible
    if (cacheStats) {
      for (const [nodeId, stats] of cacheStats) {
        const total = stats.hitCount + stats.missCount;
        if (total < 10) continue;
        if (stats.hitRatio >= 50) continue;

        const saturation = 100 - stats.hitRatio;
        const reasons = [`Hit ratio: ${stats.hitRatio.toFixed(1)}%`];
        if (isSpof(nodeId)) reasons.push('Point unique de défaillance');

        allInfos.push({
          nodeId, nodeName: getLabel(nodeId), nodeType: getType(nodeId),
          impactScore: Math.round(saturation * 0.5 + (isSpof(nodeId) ? 15 : 0)),
          rank: 0, saturation, p99Latency: 0,
          latencyContribution: latencyContributions.get(nodeId) ?? 0,
          queueGrowthRate: 0, utilization: saturation,
          isSpof: isSpof(nodeId), heatmapLevel: this.computeHeatmapLevel(saturation),
          predictedSaturationTime: null, reasons,
        });
      }
    }
  }

  // ============================================
  // Raisons détaillées
  // ============================================

  private buildReasons(
    util: ResourceUtilization,
    queueGrowthRate: number,
    isSpof: boolean,
    saturation: number
  ): string[] {
    const reasons: string[] = [];

    if (util.cpu > 80) reasons.push(`CPU > ${Math.round(util.cpu)}%`);
    if (util.memory > 80) reasons.push(`Mémoire > ${Math.round(util.memory)}%`);
    if (util.network > 80) reasons.push(`Réseau > ${Math.round(util.network)}%`);
    if (saturation >= 90) reasons.push('Saturation critique');
    if (queueGrowthRate > 0.5) reasons.push(`File +${queueGrowthRate.toFixed(1)}/s`);
    if (isSpof) reasons.push('Point unique de défaillance');

    return reasons;
  }
}
