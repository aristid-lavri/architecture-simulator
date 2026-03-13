/** Mode de l'application : edition du graphe ou simulation active. */
export type AppMode = 'edit' | 'simulation';

/** Types de composants disponibles dans l'architecture. */
export type ComponentType =
  | 'api-gateway'
  | 'microservice'
  | 'database'
  | 'cache'
  | 'load-balancer'
  | 'message-queue'
  | 'http-client'
  | 'http-server'
  | 'client-group'
  | 'network-zone'
  | 'circuit-breaker'
  | 'cdn'
  | 'waf'
  | 'firewall'
  | 'serverless'
  | 'container'
  | 'service-discovery'
  | 'dns'
  | 'cloud-storage'
  | 'cloud-function'
  | 'host-server'
  | 'api-service'
  | 'background-job';

// ============================================
// Hierarchy System
// ============================================

/** Niveau dans la hierarchie de nesting. */
export type HierarchyLevel = 'zone' | 'server' | 'container' | 'service';

/** Types de noeuds pouvant contenir des enfants. */
export const CONTAINER_TYPES: ComponentType[] = ['network-zone', 'host-server', 'container'];

/** Types de noeuds ne pouvant jamais etre enfants d'un autre noeud. */
export const NON_NESTABLE_TYPES: ComponentType[] = ['network-zone', 'host-server', 'http-server', 'http-client', 'client-group'];

/** Types consideres comme des services (peuvent etre heberges dans un server ou container). */
export const SERVICE_TYPES: ComponentType[] = [
  'api-service', 'background-job', 'database', 'cache', 'message-queue',
  'service-discovery', 'load-balancer', 'api-gateway', 'cdn', 'waf',
  'firewall', 'dns', 'circuit-breaker', 'serverless', 'cloud-function',
  'cloud-storage',
];

/** Retourne le niveau hierarchique d'un type de composant. */
export function getHierarchyLevel(type: ComponentType): HierarchyLevel {
  switch (type) {
    case 'network-zone': return 'zone';
    case 'host-server':
    case 'http-server': return 'server';
    case 'container': return 'container';
    default: return 'service';
  }
}

/**
 * Verifie si un type enfant peut etre place dans un type parent.
 * Regles :
 * - network-zone accepte : host-server + tous services
 * - host-server accepte : container + tous services (bare-metal)
 * - container accepte : services uniquement
 * - container ne peut etre enfant que d'un host-server
 * - NON_NESTABLE_TYPES ne peuvent jamais etre enfants (sauf host-server dans une zone)
 */
export function canBeChildOf(childType: ComponentType, parentType: ComponentType): boolean {
  // host-server peut aller dans une zone
  if (childType === 'host-server' && parentType === 'network-zone') return true;

  // Les non-nestables ne peuvent pas etre enfants (sauf host-server dans zone, traite ci-dessus)
  if (NON_NESTABLE_TYPES.includes(childType)) return false;

  // container ne peut etre que dans un host-server
  if (childType === 'container') return parentType === 'host-server';

  // Services dans network-zone, host-server, ou container
  if (SERVICE_TYPES.includes(childType)) {
    return parentType === 'network-zone' || parentType === 'host-server' || parentType === 'container';
  }

  return false;
}

/** Configuration d'un composant dans le catalogue (panneau lateral). */
export interface ComponentConfig {
  id: string;
  type: ComponentType;
  name: string;
  icon: string;
  description: string;
  properties: Record<string, unknown>;
}

/** Representation d'un noeud d'architecture avec sa position sur le canvas. */
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

/** Methode HTTP supportee. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Mode d'envoi des requetes : unique ou en boucle. */
export type RequestMode = 'single' | 'loop';

/** Configuration d'un noeud HTTP Client. */
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

/** Configuration de base d'un serveur HTTP (sans gestion de ressources). */
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

/** Etat du moteur de simulation. */
export type SimulationState = 'idle' | 'running' | 'paused';

/** Types d'evenements emis pendant la simulation. */
export type SimulationEventType =
  | 'REQUEST_SENT'
  | 'REQUEST_RECEIVED'
  | 'PROCESSING_START'
  | 'PROCESSING_END'
  | 'RESPONSE_SENT'
  | 'RESPONSE_RECEIVED'
  | 'ERROR';

/** Evenement de simulation avec source, cible et donnees contextuelles. */
export interface SimulationEvent {
  id: string;
  type: SimulationEventType;
  sourceNodeId: string;
  targetNodeId?: string;
  edgeId?: string;
  chainId?: string;
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

/** Type visuel de la particule animee sur une arete. */
export type ParticleType = 'request' | 'response-success' | 'response-error';

/** Sens de deplacement de la particule sur l'arete. */
export type ParticleDirection = 'forward' | 'backward';

/**
 * Particule animee representant une requete ou reponse en transit sur une arete.
 * Progresse lineairement de 0 a 1 sur la duree specifiee.
 */
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

/** Extract chainId from particle data safely. */
export function getParticleChainId(particle: Particle): string | undefined {
  if (particle.data && typeof particle.data.chainId === 'string') {
    return particle.data.chainId;
  }
  return undefined;
}

// ============================================
// Node Status Types
// ============================================

/** Statut visuel d'un noeud pendant la simulation. */
export type NodeStatus = 'idle' | 'processing' | 'success' | 'error' | 'down' | 'degraded';

/** Etat courant d'un noeud avec horodatage de la derniere mise a jour. */
export interface NodeState {
  nodeId: string;
  status: NodeStatus;
  lastUpdated: number;
}

// ============================================
// Metrics Types
// ============================================

/** Metriques de base collectees pendant la simulation (compteurs, latences, RPS). */
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

/** Locales supportees par l'application. */
export type Locale = 'fr' | 'en';

// ============================================
// Stress Testing - Load Distribution Types
// ============================================

/** Distribution temporelle des requetes envoyees par les clients virtuels. */
export type LoadDistribution = 'uniform' | 'random' | 'burst';

/** Courbe de montee en charge progressive des clients virtuels. */
export type RampUpCurve = 'linear' | 'exponential' | 'step';

/** Definition d'un type de requete avec un poids pour la selection aleatoire ponderee. */
export interface RequestTypeDistribution {
  method: HttpMethod;
  path: string;
  weight: number; // poids relatif (ex: 60 pour 60%)
  body?: string;
}

// ============================================
// Client Group Node Data
// ============================================

/**
 * Donnees d'un noeud Client Group pour le stress testing.
 * Configure 1 a 1000 clients virtuels avec distribution, ramp-up et concurrence.
 */
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
  path: string;                       // Path principal (rétrocompatibilité)
  paths?: string[];                   // Liste de paths pour sélection aléatoire
  requestBody?: string;

  // Distribution de types de requêtes (method + path + poids)
  // Si défini et non vide, chaque requête est choisie selon les poids
  requestDistribution?: RequestTypeDistribution[];

  // Statistiques runtime
  activeClients?: number;
  requestsSent?: number;

  [key: string]: unknown;
}

// ============================================
// Server Resources Configuration
// ============================================

/**
 * Configuration des ressources physiques d'un serveur HTTP.
 * Utilisee par le ResourceManager pour calculer l'utilisation et la degradation.
 */
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

/** Utilisation courante des ressources d'un serveur pendant la simulation (toutes les valeurs en %). */
export interface ResourceUtilization {
  cpu: number;                        // Utilisation CPU actuelle % (0-100)
  memory: number;                     // Utilisation mémoire % (0-100)
  network: number;                    // Utilisation réseau % (0-100)
  disk?: number;                      // Utilisation disque % (0-100)
  activeConnections: number;          // Connexions actives
  queuedRequests: number;             // Requêtes en file d'attente
  saturation?: number;                // Max de cpu/memory/network (0-100)
  throughput?: number;                // Requetes traitees/sec pour ce serveur
  errorRate?: number;                 // Taux d'erreur pour ce serveur (0-100%)
  parentId?: string;                  // ID du noeud parent (pour aggregation hierarchique)
  isAggregated?: boolean;             // True si les valeurs incluent les enfants
  childrenCount?: number;             // Nombre d'enfants contribuant a l'utilisation
}

// ============================================
// Degradation Settings
// ============================================

/**
 * Parametres de degradation de latence sous charge.
 * Formule appliquee : baseLatency * (1 + utilization^latencyPower).
 */
export interface DegradationSettings {
  enabled: boolean;
  formula: 'linear' | 'quadratic' | 'exponential';
  latencyPower: number;               // Puissance pour formule (défaut: 2)
}

// ============================================
// Extended HTTP Server Node Data
// ============================================

/** Niveau de complexite du code applicatif. Multiplie le temps de traitement par requete. */
export type ProcessingComplexity = 'light' | 'medium' | 'heavy' | 'very-heavy';

/** Multiplicateurs de temps de traitement selon la complexite du code. */
export const complexityMultipliers: Record<ProcessingComplexity, number> = {
  'light': 0.5,
  'medium': 1.0,
  'heavy': 2.5,
  'very-heavy': 5.0,
};

/**
 * Donnees d'un noeud HTTP Server avec gestion des ressources et degradation.
 * Inclut la configuration microservice (serviceName, basePath) pour le routage API Gateway.
 */
export interface HttpServerNodeData {
  label: string;
  status?: NodeStatus;

  // Configuration de base (existante)
  port: number;
  responseStatus: number;
  responseBody?: string;
  responseDelay: number;
  errorRate: number;

  // Configuration microservice
  serviceName?: string;      // Nom du service pour le routage API Gateway (ex: "users", "orders")
  basePath?: string;         // Route de base du service (ex: "/api/users")

  // Configuration ressources
  resources: ServerResources;

  // Utilisation runtime
  utilization?: ResourceUtilization;

  // Paramètres dégradation
  degradation: DegradationSettings;

  // Complexite du code applicatif (multiplicateur de temps de traitement)
  processingComplexity?: ProcessingComplexity;

  [key: string]: unknown;
}

// ============================================
// Extended Simulation Metrics
// ============================================

/**
 * Metriques etendues pour le stress testing.
 * Ajoute percentiles de latence, metriques de file d'attente, rejets et historique ressources.
 */
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
  rejectionsByReason: Map<string, number>;

  // Historique ressources
  resourceHistory: ResourceSample[];

  // Stats par groupe de clients
  clientGroupStats: Map<string, ClientGroupMetrics>;

  // Stats par type de requête DB
  databaseQueryCounts: { read: number; write: number; transaction: number };
}

/** Snapshot temporel des metriques pour analyse par intervalle de temps. */
export interface TimeSeriesSnapshot {
  timestamp: number;
  elapsed: number; // ms since simulation start
  metrics: SimulationMetrics;
  perServer: Record<string, {
    requests: number;
    errors: number;
    avgLatency: number;
    cpu: number;
    memory: number;
  }>;
}

/** Echantillon de ressources a un instant T, enregistre toutes les 100ms. */
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

/** Metriques specifiques a un groupe de clients virtuels. */
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

/** Valeurs par defaut pour un noeud Client Group (10 clients, parallele, 1s d'intervalle). */
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

/** Ressources serveur par defaut : 4 cores, 4 Go RAM, 1 Gbps, 100 connexions max. */
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

/** Degradation par defaut : quadratique activee (latencyPower = 2). */
export const defaultDegradation: DegradationSettings = {
  enabled: true,
  formula: 'quadratic',
  latencyPower: 2,
};

/**
 * Presets de configuration serveur.
 * - small : 1 core, 512 Mo, 100 Mbps, 20 connexions
 * - medium : 4 cores, 8 Go, 1 Gbps, 200 connexions
 * - large : 16 cores, 32 Go, 10 Gbps, 1000 connexions
 */
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

// ============================================
// Database Node Types
// ============================================

/** Type de base de donnees simulee. */
export type DatabaseType = 'postgresql' | 'mysql' | 'mongodb';

/** Configuration du pool de connexions d'une base de donnees. */
export interface DatabaseConnectionPool {
  maxConnections: number;       // 1-100
  minConnections: number;       // 0-20
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
}

/** Latences par type d'operation (lecture, ecriture, transaction) en ms. */
export interface DatabasePerformance {
  readLatencyMs: number;        // 1-500ms
  writeLatencyMs: number;       // 5-1000ms
  transactionLatencyMs: number;
}

/** Limites de capacite de la base de donnees. */
export interface DatabaseCapacity {
  maxQueriesPerSecond: number;
}

/** Metriques d'utilisation runtime de la base de donnees. */
export interface DatabaseUtilization {
  activeConnections: number;
  queriesPerSecond: number;
  connectionPoolUsage: number;  // 0-100%
  avgQueryTime: number;
  queriesByType: { read: number; write: number; transaction: number };
}

/** Donnees d'un noeud Database avec pool de connexions, performance et capacite. */
export interface DatabaseNodeData {
  label: string;
  status?: NodeStatus;
  databaseType: DatabaseType;

  connectionPool: DatabaseConnectionPool;
  performance: DatabasePerformance;
  capacity: DatabaseCapacity;

  errorRate: number;            // 0-100%
  utilization?: DatabaseUtilization;

  [key: string]: unknown;
}

/** Valeurs par defaut pour un noeud Database (PostgreSQL, pool de 20 connexions). */
export const defaultDatabaseNodeData: DatabaseNodeData = {
  label: 'Database',
  databaseType: 'postgresql',
  connectionPool: {
    maxConnections: 20,
    minConnections: 2,
    connectionTimeoutMs: 5000,
    idleTimeoutMs: 30000,
  },
  performance: {
    readLatencyMs: 5,
    writeLatencyMs: 15,
    transactionLatencyMs: 30,
  },
  capacity: {
    maxQueriesPerSecond: 1000,
  },
  errorRate: 0,
};

// ============================================
// Cache Node Types
// ============================================

/** Type de cache simulee. */
export type CacheType = 'redis' | 'memcached';

/** Politique d'eviction quand le cache est plein. */
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo';

/** Configuration du cache (memoire, cles, TTL, eviction). */
export interface CacheConfiguration {
  maxMemoryMB: number;
  maxKeys: number;
  defaultTTLSeconds: number;
  evictionPolicy: EvictionPolicy;
}

/** Latences des operations cache en ms. */
export interface CachePerformance {
  getLatencyMs: number;        // 0.1-10ms
  setLatencyMs: number;        // 0.1-20ms
}

/** Metriques d'utilisation runtime du cache (hit ratio, memoire, evictions). */
export interface CacheUtilization {
  memoryUsage: number;         // 0-100%
  keyCount: number;
  hitCount: number;
  missCount: number;
  hitRatio: number;            // 0-100%
  evictionCount: number;
}

/**
 * Donnees d'un noeud Cache avec configuration, performance et comportement de simulation.
 * Supporte le warm-up progressif et le hit ratio configurable.
 */
export interface CacheNodeData {
  label: string;
  status?: NodeStatus;
  cacheType: CacheType;

  configuration: CacheConfiguration;
  performance: CachePerformance;

  // Simulation comportement
  initialHitRatio: number;     // 0-100%
  hitRatioVariance: number;    // 0-30%
  warmUpEnabled: boolean;
  warmUpDurationMs: number;

  utilization?: CacheUtilization;

  [key: string]: unknown;
}

/** Valeurs par defaut pour un noeud Cache (Redis, LRU, 512 Mo, 80% hit ratio). */
export const defaultCacheNodeData: CacheNodeData = {
  label: 'Cache',
  cacheType: 'redis',
  configuration: {
    maxMemoryMB: 512,
    maxKeys: 100000,
    defaultTTLSeconds: 3600,
    evictionPolicy: 'lru',
  },
  performance: {
    getLatencyMs: 1,
    setLatencyMs: 2,
  },
  initialHitRatio: 80,
  hitRatioVariance: 10,
  warmUpEnabled: true,
  warmUpDurationMs: 30000,
};

// ============================================
// Load Balancer Node Types
// ============================================

/** Algorithme de repartition de charge. */
export type LoadBalancerAlgorithm = 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted';

/** Configuration du health check des backends. */
export interface LoadBalancerHealthCheck {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  unhealthyThreshold: number;
}

/** Etat d'un backend enregistre dans le load balancer. */
export interface LoadBalancerBackend {
  nodeId: string;
  weight: number;
  healthy: boolean;
  activeConnections: number;
}

/** Metriques d'utilisation runtime du load balancer. */
export interface LoadBalancerUtilization {
  totalRequests: number;
  activeConnections: number;
  backends: LoadBalancerBackend[];
}

/** Donnees d'un noeud Load Balancer avec algorithme, health check et sticky sessions. */
export interface LoadBalancerNodeData {
  label: string;
  status?: NodeStatus;
  algorithm: LoadBalancerAlgorithm;

  healthCheck: LoadBalancerHealthCheck;

  stickySessions: boolean;
  sessionTTLSeconds: number;

  utilization?: LoadBalancerUtilization;

  [key: string]: unknown;
}

/** Valeurs par defaut pour un noeud Load Balancer (round-robin, health check actif). */
export const defaultLoadBalancerNodeData: LoadBalancerNodeData = {
  label: 'Load Balancer',
  algorithm: 'round-robin',
  healthCheck: {
    enabled: true,
    intervalMs: 5000,
    timeoutMs: 2000,
    unhealthyThreshold: 3,
  },
  stickySessions: false,
  sessionTTLSeconds: 3600,
};

/**
 * Presets de scenarios de charge pour les Client Groups.
 * - light : 10 clients sequentiels, 2s d'intervalle
 * - medium : 50 clients paralleles, 500ms, ramp-up lineaire
 * - heavy : 200 clients paralleles, 100ms, ramp-up exponentiel
 * - spike : 500 clients en burst (100 requetes toutes les 10s)
 * - stress : 1000 clients paralleles, 50ms, ramp-up par paliers
 */
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

// ============================================
// Message Queue Node Types
// ============================================

/** Type de file de messages simulee. */
export type MessageQueueType = 'rabbitmq' | 'kafka' | 'sqs';

/** Mode de distribution des messages. */
export type MessageQueueMode = 'fifo' | 'priority' | 'pubsub';

/** Configuration de la file de messages (taille, retention, delai). */
export interface MessageQueueConfiguration {
  maxQueueSize: number;           // Max messages in queue
  messageRetentionMs: number;     // Message retention time
  deliveryDelayMs: number;        // Delivery delay
}

/** Latences et debit de la file de messages en ms. */
export interface MessageQueuePerformance {
  publishLatencyMs: number;       // 1-100ms
  consumeLatencyMs: number;       // 1-100ms
  messagesPerSecond: number;      // Throughput limit
}

/** Metriques d'utilisation runtime de la file de messages. */
export interface MessageQueueUtilization {
  queueDepth: number;             // Current messages in queue
  messagesPublished: number;      // Total published
  messagesConsumed: number;       // Total consumed
  messagesDeadLettered: number;   // Failed messages
  avgProcessingTime: number;      // Average processing time
  throughput: number;             // Current msgs/sec
}

/**
 * Donnees d'un noeud Message Queue avec configuration consumers, retry et dead letter.
 * Supporte les modes FIFO, priorite et pub/sub.
 */
export interface MessageQueueNodeData {
  label: string;
  status?: NodeStatus;
  queueType: MessageQueueType;
  mode: MessageQueueMode;

  configuration: MessageQueueConfiguration;
  performance: MessageQueuePerformance;

  // Consumer configuration
  consumerCount: number;          // 1-100 consumers
  prefetchCount: number;          // Messages per consumer batch
  ackMode: 'auto' | 'manual';

  // Reliability
  retryEnabled: boolean;
  maxRetries: number;
  deadLetterEnabled: boolean;

  utilization?: MessageQueueUtilization;

  [key: string]: unknown;
}

/** Valeurs par defaut pour un noeud Message Queue (RabbitMQ, FIFO, 1 consumer). */
export const defaultMessageQueueNodeData: MessageQueueNodeData = {
  label: 'Message Queue',
  queueType: 'rabbitmq',
  mode: 'fifo',
  configuration: {
    maxQueueSize: 10000,
    messageRetentionMs: 86400000, // 24h
    deliveryDelayMs: 0,
  },
  performance: {
    publishLatencyMs: 2,
    consumeLatencyMs: 5,
    messagesPerSecond: 1000,
  },
  consumerCount: 1,
  prefetchCount: 10,
  ackMode: 'auto',
  retryEnabled: true,
  maxRetries: 3,
  deadLetterEnabled: true,
};

// ============================================
// API Gateway Node Types
// ============================================

/** Type d'authentification simulee par l'API Gateway. */
export type ApiGatewayAuthType = 'none' | 'api-key' | 'jwt' | 'oauth2';

/** Configuration du rate limiting avec fenetre glissante. */
export interface ApiGatewayRateLimiting {
  enabled: boolean;
  requestsPerSecond: number;
  burstSize: number;
  windowMs: number;
}

/** Configuration du routage de l'API Gateway. */
export interface ApiGatewayRouting {
  pathPrefix: string;
  stripPrefix: boolean;
  timeout: number;
}

/** Regle de routage vers un microservice, avec pattern matching (wildcard * et **). */
export interface ApiGatewayRouteRule {
  id: string;                 // Identifiant unique de la règle
  pathPattern: string;        // Pattern de route (ex: "/users/*", "/orders/*")
  targetServiceName: string;  // Nom du service cible (doit correspondre au serviceName d'un HTTP Server)
  priority: number;           // Priorité (plus petit = plus prioritaire)
}

/** Metriques d'utilisation runtime de l'API Gateway. */
export interface ApiGatewayUtilization {
  totalRequests: number;
  blockedRequests: number;
  authFailures: number;
  avgLatency: number;
  activeConnections: number;
  rateLimitHits: number;
}

/**
 * Donnees d'un noeud API Gateway avec authentification, rate limiting et routage.
 * Route les requetes vers les microservices selon les regles de routage configurees.
 */
export interface ApiGatewayNodeData {
  label: string;
  status?: NodeStatus;

  // Authentication
  authType: ApiGatewayAuthType;
  authFailureRate: number;        // 0-100% (simulated auth failures)

  // Rate limiting
  rateLimiting: ApiGatewayRateLimiting;

  // Routing
  routing: ApiGatewayRouting;

  // Règles de routage vers les services (microservices)
  routeRules: ApiGatewayRouteRule[];

  // Performance
  baseLatencyMs: number;
  errorRate: number;              // 0-100%

  // Features
  corsEnabled: boolean;
  loggingEnabled: boolean;
  compressionEnabled: boolean;

  utilization?: ApiGatewayUtilization;

  [key: string]: unknown;
}

/** Valeurs par defaut pour un noeud API Gateway (sans auth, rate limit 100 req/s). */

// ============================================
// Network Zone Configuration
// ============================================

export type NetworkZoneType = 'public' | 'dmz' | 'backend' | 'data' | 'custom';

export interface NetworkZoneNodeData {
  label: string;
  zoneType: NetworkZoneType;
  domain?: string;
  subdomains?: string[];
  color: string;
  interZoneLatency: number;
  [key: string]: unknown;
}

export const zoneColors: Record<NetworkZoneType, string> = {
  public: 'oklch(0.70 0.15 220)',
  dmz: 'oklch(0.75 0.18 75)',
  backend: 'oklch(0.72 0.19 155)',
  data: 'oklch(0.68 0.18 290)',
  custom: 'oklch(0.65 0.10 0)',
};

export const defaultNetworkZoneData: NetworkZoneNodeData = {
  label: 'Zone',
  zoneType: 'backend',
  color: zoneColors.backend,
  interZoneLatency: 2,
};

// ============================================
// Host Server Configuration
// ============================================

/** Mapping de port entre le host et un container interne (style Docker -p). */
export interface HostPortMapping {
  id: string;
  hostPort: number;
  containerNodeId: string;
  containerPort: number;
  protocol: 'tcp' | 'udp';
}

/** Données d'un nœud Host Server : serveur physique/VM hébergeant des containers Docker. */
export interface HostServerNodeData {
  label: string;
  status?: NodeStatus;

  /** Adresse IP du serveur (ex: "192.168.1.10") */
  ipAddress: string;
  /** Nom d'hôte optionnel (ex: "web-server-01") */
  hostname?: string;

  /** Systeme d'exploitation (indicateur visuel) */
  os?: 'linux' | 'windows' | 'macos';

  /** Mappings de ports host → container (Docker -p) */
  portMappings: HostPortMapping[];

  /** Ressources physiques partagées entre tous les containers */
  resources: ServerResources;
  /** Utilisation courante (runtime, calculée par le moteur) */
  utilization?: ResourceUtilization;
  /** Paramètres de dégradation sous charge */
  degradation: DegradationSettings;

  /** Couleur du nœud */
  color: string;

  [key: string]: unknown;
}

export const hostServerColor = 'oklch(0.62 0.14 240)';

export const defaultHostServerData: HostServerNodeData = {
  label: 'Host Server',
  ipAddress: '192.168.1.10',
  portMappings: [],
  resources: defaultServerResources,
  degradation: defaultDegradation,
  color: hostServerColor,
};

// ============================================
// Circuit Breaker Configuration
// ============================================

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerNodeData {
  label: string;
  status?: NodeStatus;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenMaxRequests: number;
  monitoringWindow: number;
  circuitState?: CircuitBreakerState;
  failureCount?: number;
  successCount?: number;
  [key: string]: unknown;
}

export const defaultCircuitBreakerData: CircuitBreakerNodeData = {
  label: 'Circuit Breaker',
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
  halfOpenMaxRequests: 3,
  monitoringWindow: 60000,
  circuitState: 'closed',
  failureCount: 0,
  successCount: 0,
};

// ============================================
// CDN Configuration
// ============================================

export interface CDNNodeData {
  label: string;
  status?: NodeStatus;
  provider: 'cloudflare' | 'cloudfront' | 'akamai' | 'generic';
  cacheHitRatio: number;
  edgeLatencyMs: number;
  originLatencyMs: number;
  bandwidthMbps: number;
  cacheTTLSeconds: number;
  [key: string]: unknown;
}

export const defaultCDNNodeData: CDNNodeData = {
  label: 'CDN',
  provider: 'generic',
  cacheHitRatio: 85,
  edgeLatencyMs: 5,
  originLatencyMs: 50,
  bandwidthMbps: 1000,
  cacheTTLSeconds: 3600,
};

// ============================================
// WAF Configuration
// ============================================

export interface WAFNodeData {
  label: string;
  status?: NodeStatus;
  provider: 'aws-waf' | 'cloudflare' | 'azure-waf' | 'generic';
  inspectionLatencyMs: number;
  blockRate: number;
  rules: {
    sqlInjection: boolean;
    xss: boolean;
    rateLimiting: boolean;
    ipBlocking: boolean;
    geoBlocking: boolean;
  };
  requestsPerSecond: number;
  [key: string]: unknown;
}

export const defaultWAFNodeData: WAFNodeData = {
  label: 'WAF',
  provider: 'generic',
  inspectionLatencyMs: 2,
  blockRate: 5,
  rules: {
    sqlInjection: true,
    xss: true,
    rateLimiting: true,
    ipBlocking: false,
    geoBlocking: false,
  },
  requestsPerSecond: 10000,
};

// ============================================
// Firewall Configuration
// ============================================

export interface FirewallNodeData {
  label: string;
  status?: NodeStatus;
  inspectionLatencyMs: number;
  defaultAction: 'allow' | 'deny';
  allowedPorts: number[];
  blockedIPs: string[];
  [key: string]: unknown;
}

export const defaultFirewallData: FirewallNodeData = {
  label: 'Firewall',
  inspectionLatencyMs: 1,
  defaultAction: 'allow',
  allowedPorts: [80, 443, 8080],
  blockedIPs: [],
};

// ============================================
// Serverless / Cloud Function Configuration
// ============================================

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'generic';

export interface ServerlessNodeData {
  label: string;
  status?: NodeStatus;
  provider: CloudProvider;
  runtime: string;
  memoryMB: number;
  timeoutMs: number;
  coldStartMs: number;
  warmStartMs: number;
  concurrencyLimit: number;
  minInstances: number;
  maxInstances: number;
  currentInstances?: number;
  costPerInvocation?: number;
  [key: string]: unknown;
}

export const defaultServerlessData: ServerlessNodeData = {
  label: 'Lambda',
  provider: 'aws',
  runtime: 'nodejs20.x',
  memoryMB: 256,
  timeoutMs: 30000,
  coldStartMs: 500,
  warmStartMs: 5,
  concurrencyLimit: 100,
  minInstances: 0,
  maxInstances: 100,
  currentInstances: 0,
};

// ============================================
// Container Configuration
// ============================================

export interface ContainerNodeData {
  label: string;
  status?: NodeStatus;
  image: string;
  replicas: number;
  cpuLimit: string;
  memoryLimit: string;
  /** Limite CPU numerique en nombre de cores (ex: 2 = 2 cores). Pour Docker --cpus. */
  cpuLimitCores?: number;
  /** Limite memoire numerique en MB (ex: 512). Pour Docker --memory. */
  memoryLimitMB?: number;
  autoScaling: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPU: number;
  };
  healthCheck: {
    path: string;
    intervalMs: number;
    timeoutMs: number;
  };
  responseDelayMs: number;
  /** Couleur du noeud conteneur */
  color?: string;
  [key: string]: unknown;
}

export const containerColor = 'oklch(0.68 0.18 50)';

export const defaultContainerData: ContainerNodeData = {
  label: 'Container',
  image: 'app:latest',
  replicas: 2,
  cpuLimit: '500m',
  memoryLimit: '512Mi',
  cpuLimitCores: 2,
  memoryLimitMB: 512,
  autoScaling: {
    enabled: true,
    minReplicas: 1,
    maxReplicas: 10,
    targetCPU: 70,
  },
  healthCheck: {
    path: '/health',
    intervalMs: 10000,
    timeoutMs: 3000,
  },
  responseDelayMs: 20,
  color: containerColor,
};

// ============================================
// Service Discovery Configuration
// ============================================

export interface ServiceDiscoveryNodeData {
  label: string;
  status?: NodeStatus;
  provider: 'consul' | 'eureka' | 'kubernetes' | 'generic';
  registrationLatencyMs: number;
  lookupLatencyMs: number;
  healthCheckIntervalMs: number;
  cacheTTLMs: number;
  [key: string]: unknown;
}

export const defaultServiceDiscoveryData: ServiceDiscoveryNodeData = {
  label: 'Service Discovery',
  provider: 'consul',
  registrationLatencyMs: 10,
  lookupLatencyMs: 2,
  healthCheckIntervalMs: 10000,
  cacheTTLMs: 5000,
};

// ============================================
// DNS Configuration
// ============================================

export interface DNSNodeData {
  label: string;
  status?: NodeStatus;
  resolutionLatencyMs: number;
  ttlSeconds: number;
  records: { type: 'A' | 'CNAME' | 'AAAA'; name: string; value: string }[];
  failoverEnabled: boolean;
  [key: string]: unknown;
}

export const defaultDNSNodeData: DNSNodeData = {
  label: 'DNS',
  resolutionLatencyMs: 5,
  ttlSeconds: 300,
  records: [],
  failoverEnabled: false,
};

// ============================================
// Cloud Storage (S3 / Blob / GCS)
// ============================================

export interface CloudStorageNodeData {
  label: string;
  status?: NodeStatus;
  provider: CloudProvider;
  storageClass: 'standard' | 'infrequent' | 'archive';
  readLatencyMs: number;
  writeLatencyMs: number;
  bandwidthMbps: number;
  maxRequestsPerSecond: number;
  [key: string]: unknown;
}

export const defaultCloudStorageData: CloudStorageNodeData = {
  label: 'S3 Bucket',
  provider: 'aws',
  storageClass: 'standard',
  readLatencyMs: 20,
  writeLatencyMs: 50,
  bandwidthMbps: 500,
  maxRequestsPerSecond: 5500,
};

// ============================================
// Cloud Function (wraps Serverless with cloud presets)
// ============================================

export interface CloudFunctionNodeData extends ServerlessNodeData {
  serviceType: 'aws-lambda' | 'azure-function' | 'gcp-cloud-function';
}

export const defaultCloudFunctionData: CloudFunctionNodeData = {
  ...defaultServerlessData,
  label: 'AWS Lambda',
  serviceType: 'aws-lambda',
  provider: 'aws',
};

export const defaultApiGatewayNodeData: ApiGatewayNodeData = {
  label: 'API Gateway',
  authType: 'none',
  authFailureRate: 0,
  rateLimiting: {
    enabled: true,
    requestsPerSecond: 100,
    burstSize: 20,
    windowMs: 1000,
  },
  routing: {
    pathPrefix: '/api',
    stripPrefix: true,
    timeout: 30000,
  },
  routeRules: [],
  baseLatencyMs: 5,
  errorRate: 0,
  corsEnabled: true,
  loggingEnabled: true,
  compressionEnabled: true,
};

// ============================================
// API Service Configuration
// ============================================

/** Protocole de communication du service API. */
export type ApiServiceProtocol = 'rest' | 'grpc' | 'graphql';

/** Donnees d'un noeud API Service heberge dans un server ou container. */
export interface ApiServiceNodeData {
  label: string;
  status?: NodeStatus;

  /** Nom du service (ex: "users-service", "orders-service") */
  serviceName: string;
  /** Route de base (ex: "/api/users") */
  basePath: string;
  /** Protocole de communication */
  protocol: ApiServiceProtocol;

  /** Temps de reponse en ms */
  responseTime: number;
  /** Taux d'erreur 0-100% */
  errorRate: number;
  /** Nombre max de requetes concurrentes */
  maxConcurrentRequests: number;

  [key: string]: unknown;
}

export const defaultApiServiceData: ApiServiceNodeData = {
  label: 'API Service',
  serviceName: 'my-service',
  basePath: '/api',
  protocol: 'rest',
  responseTime: 50,
  errorRate: 0,
  maxConcurrentRequests: 100,
};

// ============================================
// Background Job Configuration
// ============================================

/** Type de job en arriere-plan. */
export type BackgroundJobType = 'cron' | 'worker' | 'batch';

/** Donnees d'un noeud Background Job (cron, worker, batch processor). */
export interface BackgroundJobNodeData {
  label: string;
  status?: NodeStatus;

  /** Type de job */
  jobType: BackgroundJobType;
  /** Expression cron (pour type cron, ex: "0/5 * * * *") */
  schedule?: string;
  /** Nombre d'executions concurrentes max */
  concurrency: number;
  /** Duree moyenne d'execution en ms */
  processingTimeMs: number;
  /** Taux d'erreur 0-100% */
  errorRate: number;
  /** Taille du batch (pour type batch) */
  batchSize?: number;

  [key: string]: unknown;
}

export const defaultBackgroundJobData: BackgroundJobNodeData = {
  label: 'Background Job',
  jobType: 'worker',
  concurrency: 1,
  processingTimeMs: 500,
  errorRate: 0,
};

// ============================================
// Community Edition — Foundation Types
// ============================================

/** Protocole de communication sur un edge. */
export type ConnectionProtocol = 'rest' | 'grpc' | 'websocket' | 'graphql';

/** Snapshot d'une architecture pour undo/redo et versioning. */
export interface ArchitectureSnapshot {
  id: string;
  name: string;
  timestamp: number;
  nodes: import('@xyflow/react').Node[];
  edges: import('@xyflow/react').Edge[];
}

/** Mapping type de noeud vers protocoles supportes. */
export type ConnectorCompatibility = Record<ComponentType, ConnectionProtocol[]>;

/** Tier de licence pour le feature gating. */
export type LicenseTier = 'community' | 'enterprise';
