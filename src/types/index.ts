export type AppMode = 'edit' | 'simulation';

export type ComponentType =
  | 'api-gateway'
  | 'microservice'
  | 'database'
  | 'cache'
  | 'load-balancer'
  | 'message-queue'
  | 'http-client'
  | 'http-server'
  | 'client-group';

export interface ComponentConfig {
  id: string;
  type: ComponentType;
  name: string;
  icon: string;
  description: string;
  properties: Record<string, unknown>;
}

export interface ArchitectureNode {
  id: string;
  type: ComponentType;
  name: string;
  properties: Record<string, unknown>;
  position: { x: number; y: number };
}

// ============================================
// HTTP Client Configuration
// ============================================
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type RequestMode = 'single' | 'loop';

export interface HttpClientConfig {
  name: string;
  requestMethod: HttpMethod;
  requestPath: string;
  requestBody?: string;
  requestHeaders?: Record<string, string>;
  requestMode: RequestMode;
  requestInterval: number; // ms between requests (for loop mode)
  requestCount?: number; // number of requests to send (for loop mode, undefined = infinite)
}

// ============================================
// HTTP Server Configuration
// ============================================
export interface HttpServerConfig {
  name: string;
  port: number;
  responseStatus: number;
  responseBody: string;
  responseDelay: number; // ms
  errorRate: number; // 0-100%
  maxConcurrentRequests?: number;
}

// ============================================
// Simulation Types
// ============================================
export type SimulationState = 'idle' | 'running' | 'paused';

export type SimulationEventType =
  | 'REQUEST_SENT'
  | 'REQUEST_RECEIVED'
  | 'PROCESSING_START'
  | 'PROCESSING_END'
  | 'RESPONSE_SENT'
  | 'RESPONSE_RECEIVED'
  | 'ERROR';

export interface SimulationEvent {
  id: string;
  type: SimulationEventType;
  sourceNodeId: string;
  targetNodeId?: string;
  edgeId?: string;
  timestamp: number;
  data: {
    method?: HttpMethod;
    path?: string;
    status?: number;
    body?: string;
    error?: string;
    latency?: number;
  };
}

// ============================================
// Particle Animation Types
// ============================================
export type ParticleType = 'request' | 'response-success' | 'response-error';

export type ParticleDirection = 'forward' | 'backward';

export interface Particle {
  id: string;
  edgeId: string;
  type: ParticleType;
  direction: ParticleDirection; // forward = source→target, backward = target→source
  progress: number; // 0 to 1
  duration: number; // ms
  startTime: number;
  data?: Record<string, unknown>;
}

// ============================================
// Node Status Types
// ============================================
export type NodeStatus = 'idle' | 'processing' | 'success' | 'error';

export interface NodeState {
  nodeId: string;
  status: NodeStatus;
  lastUpdated: number;
}

// ============================================
// Metrics Types
// ============================================
export interface SimulationMetrics {
  requestsSent: number;
  responsesReceived: number;
  successCount: number;
  errorCount: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
  requestsPerSecond: number;
  startTime: number | null;
}

// ============================================
// i18n Types
// ============================================
export type Locale = 'fr' | 'en';

// ============================================
// Stress Testing - Load Distribution Types
// ============================================
export type LoadDistribution = 'uniform' | 'random' | 'burst';
export type RampUpCurve = 'linear' | 'exponential' | 'step';

// ============================================
// Client Group Node Data
// ============================================
export interface ClientGroupNodeData {
  label: string;
  status?: NodeStatus;

  // Configuration clients virtuels
  virtualClients: number;           // 1-1000 clients virtuels

  // Mode de requêtes
  requestMode: 'sequential' | 'parallel'; // Séquentiel ou parallèle
  concurrentRequests: number;       // Nombre de requêtes parallèles par client (1-100)

  // Timing des requêtes
  baseInterval: number;             // Intervalle de base entre requêtes (ms)
  intervalVariance: number;         // Variance % pour distribution random (0-100)
  distribution: LoadDistribution;   // uniform, random, burst

  // Configuration burst (si distribution === 'burst')
  burstSize?: number;               // Nombre de requêtes par burst
  burstInterval?: number;           // Temps entre bursts (ms)

  // Configuration ramp-up
  rampUpEnabled: boolean;
  rampUpDuration: number;           // Durée pour atteindre capacité max (ms)
  rampUpCurve: RampUpCurve;

  // Configuration HTTP
  method: HttpMethod;
  path: string;
  requestBody?: string;

  // Statistiques runtime
  activeClients?: number;
  requestsSent?: number;

  [key: string]: unknown;
}

// ============================================
// Server Resources Configuration
// ============================================
export interface ServerResources {
  // Configuration CPU
  cpu: {
    cores: number;                    // Nombre de cœurs (1-64)
    maxUtilization: number;           // Utilisation max par cœur % (0-100)
    processingTimePerRequest: number; // Temps CPU par requête (ms)
  };

  // Configuration Mémoire
  memory: {
    totalMB: number;                  // RAM totale en MB
    memoryPerRequestMB: number;       // Mémoire consommée par requête
    baseUsageMB: number;              // Utilisation mémoire de base
  };

  // Configuration Réseau
  network: {
    bandwidthMbps: number;            // Bande passante en Mbps
    baseLatencyMs: number;            // Latence réseau de base
    requestSizeKB: number;            // Taille moyenne requête
    responseSizeKB: number;           // Taille moyenne réponse
  };

  // Configuration Disque (optionnel)
  disk?: {
    totalGB: number;
    ioSpeedMBps: number;
    diskTimePerRequest: number;       // Temps I/O par requête (ms)
  };

  // Limites de connexions
  connections: {
    maxConcurrent: number;            // Connexions simultanées max
    queueSize: number;                // Taille file d'attente
    connectionTimeoutMs: number;      // Timeout connexion
  };
}

// ============================================
// Resource Utilization (Runtime)
// ============================================
export interface ResourceUtilization {
  cpu: number;                        // Utilisation CPU actuelle % (0-100)
  memory: number;                     // Utilisation mémoire % (0-100)
  network: number;                    // Utilisation réseau % (0-100)
  disk?: number;                      // Utilisation disque % (0-100)
  activeConnections: number;          // Connexions actives
  queuedRequests: number;             // Requêtes en file d'attente
}

// ============================================
// Degradation Settings
// ============================================
export interface DegradationSettings {
  enabled: boolean;
  formula: 'linear' | 'quadratic' | 'exponential';
  latencyPower: number;               // Puissance pour formule (défaut: 2)
}

// ============================================
// Extended HTTP Server Node Data
// ============================================
export interface HttpServerNodeData {
  label: string;
  status?: NodeStatus;

  // Configuration de base (existante)
  port: number;
  responseStatus: number;
  responseBody?: string;
  responseDelay: number;
  errorRate: number;

  // Configuration ressources
  resources: ServerResources;

  // Utilisation runtime
  utilization?: ResourceUtilization;

  // Paramètres dégradation
  degradation: DegradationSettings;

  [key: string]: unknown;
}

// ============================================
// Extended Simulation Metrics
// ============================================
export interface ExtendedSimulationMetrics extends SimulationMetrics {
  // Latences percentiles
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;

  // Métriques file d'attente
  requestsQueued: number;
  totalQueued: number;
  maxQueueDepth: number;
  avgQueueTime: number;

  // Métriques rejets
  requestsRejected: number;
  rejectionRate: number;

  // Historique ressources
  resourceHistory: ResourceSample[];

  // Stats par groupe de clients
  clientGroupStats: Map<string, ClientGroupMetrics>;
}

export interface ResourceSample {
  timestamp: number;
  nodeId: string;
  cpu: number;
  memory: number;
  network: number;
  disk?: number;
  activeConnections: number;
  queuedRequests: number;
}

export interface ClientGroupMetrics {
  groupId: string;
  requestsSent: number;
  responsesReceived: number;
  successCount: number;
  errorCount: number;
  avgLatency: number;
  p95Latency: number;
  activeClients: number;
}

// ============================================
// Default Values & Presets
// ============================================
export const defaultClientGroupData: ClientGroupNodeData = {
  label: 'Client Group',
  virtualClients: 10,
  requestMode: 'parallel',
  concurrentRequests: 5,
  baseInterval: 1000,
  intervalVariance: 20,
  distribution: 'uniform',
  burstSize: 5,
  burstInterval: 5000,
  rampUpEnabled: false,
  rampUpDuration: 30000,
  rampUpCurve: 'linear',
  method: 'GET',
  path: '/api/data',
};

export const defaultServerResources: ServerResources = {
  cpu: {
    cores: 4,
    maxUtilization: 100,
    processingTimePerRequest: 50,
  },
  memory: {
    totalMB: 4096,
    memoryPerRequestMB: 10,
    baseUsageMB: 512,
  },
  network: {
    bandwidthMbps: 1000,
    baseLatencyMs: 5,
    requestSizeKB: 2,
    responseSizeKB: 10,
  },
  connections: {
    maxConcurrent: 100,
    queueSize: 50,
    connectionTimeoutMs: 30000,
  },
};

export const defaultDegradation: DegradationSettings = {
  enabled: true,
  formula: 'quadratic',
  latencyPower: 2,
};

// Server Presets
export const serverPresets = {
  small: {
    cpu: { cores: 1, maxUtilization: 100, processingTimePerRequest: 100 },
    memory: { totalMB: 512, memoryPerRequestMB: 5, baseUsageMB: 128 },
    network: { bandwidthMbps: 100, baseLatencyMs: 10, requestSizeKB: 2, responseSizeKB: 10 },
    connections: { maxConcurrent: 20, queueSize: 10, connectionTimeoutMs: 30000 },
  } as ServerResources,
  medium: {
    cpu: { cores: 4, maxUtilization: 100, processingTimePerRequest: 50 },
    memory: { totalMB: 8192, memoryPerRequestMB: 10, baseUsageMB: 1024 },
    network: { bandwidthMbps: 1000, baseLatencyMs: 5, requestSizeKB: 2, responseSizeKB: 10 },
    connections: { maxConcurrent: 200, queueSize: 100, connectionTimeoutMs: 30000 },
  } as ServerResources,
  large: {
    cpu: { cores: 16, maxUtilization: 100, processingTimePerRequest: 20 },
    memory: { totalMB: 32768, memoryPerRequestMB: 10, baseUsageMB: 2048 },
    network: { bandwidthMbps: 10000, baseLatencyMs: 1, requestSizeKB: 2, responseSizeKB: 10 },
    connections: { maxConcurrent: 1000, queueSize: 500, connectionTimeoutMs: 30000 },
  } as ServerResources,
};

// Load Scenario Presets
export const loadPresets = {
  light: {
    virtualClients: 10,
    requestMode: 'sequential' as const,
    concurrentRequests: 1,
    baseInterval: 2000,
    distribution: 'uniform' as LoadDistribution,
    rampUpEnabled: false,
  },
  medium: {
    virtualClients: 50,
    requestMode: 'parallel' as const,
    concurrentRequests: 5,
    baseInterval: 500,
    distribution: 'random' as LoadDistribution,
    intervalVariance: 30,
    rampUpEnabled: true,
    rampUpDuration: 30000,
    rampUpCurve: 'linear' as RampUpCurve,
  },
  heavy: {
    virtualClients: 200,
    requestMode: 'parallel' as const,
    concurrentRequests: 10,
    baseInterval: 100,
    distribution: 'random' as LoadDistribution,
    intervalVariance: 50,
    rampUpEnabled: true,
    rampUpDuration: 60000,
    rampUpCurve: 'exponential' as RampUpCurve,
  },
  spike: {
    virtualClients: 500,
    requestMode: 'parallel' as const,
    concurrentRequests: 20,
    baseInterval: 50,
    distribution: 'burst' as LoadDistribution,
    burstSize: 100,
    burstInterval: 10000,
    rampUpEnabled: false,
  },
  stress: {
    virtualClients: 1000,
    requestMode: 'parallel' as const,
    concurrentRequests: 50,
    baseInterval: 50,
    distribution: 'uniform' as LoadDistribution,
    rampUpEnabled: true,
    rampUpDuration: 120000,
    rampUpCurve: 'step' as RampUpCurve,
  },
};
