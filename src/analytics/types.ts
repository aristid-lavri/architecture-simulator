import type { ComponentType, MessageQueueUtilization, ApiGatewayUtilization } from '@/types';

/** Données analytiques per-composant accumulées pendant la simulation. */
export interface ComponentAnalytics {
  nodeId: string;
  nodeType: ComponentType;
  nodeName: string;

  // Latence (depuis TimeSeriesSnapshot.perServer[nodeId].avgLatency)
  avgLatency: number;
  latencyHistory: number[];       // 60 derniers points (1 par snapshot ~5s)

  // Throughput
  rps: number;
  rpsHistory: number[];

  // Erreurs
  totalRequests: number;
  totalErrors: number;
  errorRate: number;              // 0-100
  errorHistory: number[];

  // Resources (depuis onResourceUpdate)
  cpu?: number;
  memory?: number;
  network?: number;
  queueDepth?: number;
  activeConnections?: number;
  cpuHistory: number[];
  memoryHistory: number[];

  // Spécialisations optionnelles
  queueUtilization?: MessageQueueUtilization;
  gatewayUtilization?: ApiGatewayUtilization;

  // Hiérarchie
  isAggregated?: boolean;
  childrenCount?: number;

  lastUpdated: number;
  firstSeen: number;
}

/** Événement émis par l'AnalyticsEngine vers le store à chaque mise à jour. */
export interface ComponentAnalyticsEvent {
  type: 'resource_update' | 'latency_snapshot' | 'queue_update' | 'gateway_update' | 'hierarchy_update';
  nodeId: string;
  timestamp: number;
  payload: ComponentAnalytics;
}

/** Synthèse post-simulation générée par synthesize(). */
export interface AnalyticsSynthesis {
  generatedAt: number;
  durationMs: number;
  componentCount: number;
  topByLatency: { nodeId: string; nodeName: string; avgLatency: number }[];
  topByErrorRate: { nodeId: string; nodeName: string; errorRate: number }[];
  topByCpuUsage: { nodeId: string; nodeName: string; cpu: number }[];
  topByQueueDepth: { nodeId: string; nodeName: string; queueDepth: number }[];
  components: Record<string, ComponentAnalytics>;
  observations: string[];
}
