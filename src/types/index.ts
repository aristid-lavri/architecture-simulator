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
  | 'client-group';

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

// ============================================
// Node Status Types
// ============================================

/** Statut visuel d'un noeud pendant la simulation. */
export type NodeStatus = 'idle' | 'processing' | 'success' | 'error';

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

  // Historique ressources
  resourceHistory: ResourceSample[];

  // Stats par groupe de clients
  clientGroupStats: Map<string, ClientGroupMetrics>;
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
