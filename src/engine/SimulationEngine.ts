import type { Node, Edge } from '@xyflow/react';
import type {
  Particle,
  ParticleType,
  SimulationState,
  ClientGroupNodeData,
  HttpServerNodeData as HttpServerNodeDataExtended,
  ServerResources,
  ResourceUtilization,
  LoadBalancerNodeData,
  CacheNodeData,
  DatabaseNodeData,
  ApiGatewayNodeData,
  MessageQueueNodeData,
  MessageQueueUtilization,
  ApiGatewayUtilization,
  IdentityProviderNodeData,
} from '@/types';
import type { HttpClientNodeData } from '@/components/nodes/HttpClientNode';
import type { HttpServerNodeData } from '@/components/nodes/HttpServerNode';
import {
  generateParticleId,
  createRequestSentEvent,
  createRequestReceivedEvent,
  createProcessingStartEvent,
  createProcessingEndEvent,
  createResponseSentEvent,
  createResponseReceivedEvent,
  createErrorEvent,
  createSpanStartEvent,
  createSpanEndEvent,
  createHandlerDecisionEvent,
  createQueueEnterEvent,
  createQueueExitEvent,
  createStateTransitionEvent,
  createResourceSnapshotEvent,
  simulationEvents,
} from './events';
import { MetricsCollector } from './metrics';
import { ResourceManager } from './ResourceManager';
import { VirtualClientManager } from './VirtualClientManager';
import { LoadBalancerManager } from './LoadBalancerManager';
import { CacheManager } from './CacheManager';
import { DatabaseManager } from './DatabaseManager';
import { ParticleManager } from './ParticleManager';
import { defaultServerResources, defaultDegradation, getParticleChainId } from '@/types';
import {
  HandlerRegistry,
  DefaultHandler,
  LoadBalancerHandler,
  CacheHandler,
  HttpServerHandler,
  ApiGatewayHandler,
  DatabaseHandler,
  MessageQueueHandler,
  CircuitBreakerHandler,
  CDNHandler,
  WAFHandler,
  FirewallHandler,
  ServerlessHandler,
  ContainerHandler,
  ServiceDiscoveryHandler,
  DNSHandler,
  CloudStorageHandler,
  CloudFunctionHandler,
  HostServerHandler,
  ApiServiceHandler,
  BackgroundJobHandler,
  IdentityProviderHandler,
  type RequestContext,
  type RequestDecision,
} from './handlers';
import { HierarchicalResourceManager } from './HierarchicalResourceManager';
import { TokenStore, type SimulatedToken } from './TokenStore';
import { criticalPathAnalyzer } from './CriticalPathAnalyzer';
import { BottleneckAnalyzer } from './BottleneckAnalyzer';
import type { BottleneckAnalysis } from '@/types';
import { pluginRegistry } from '@/plugins';

/**
 * Callbacks fournis par la couche React pour recevoir les mises a jour du moteur.
 * Le moteur ne modifie jamais les stores directement — il notifie via ces callbacks.
 */
interface SimulationCallbacks {
  onStateChange: (state: SimulationState) => void;
  onAddParticle: (particle: Particle) => void;
  onRemoveParticle: (particleId: string) => void;
  onUpdateParticle: (particleId: string, updates: Partial<Particle>) => void;
  onNodeStatusChange: (nodeId: string, status: import('@/types').NodeStatus) => void;
  onMetricsUpdate: (metrics: ReturnType<MetricsCollector['getMetrics']>) => void;
  onResourceUpdate?: (nodeId: string, utilization: ResourceUtilization) => void;
  onClientGroupUpdate?: (groupId: string, activeClients: number, requestsSent: number) => void;
  onMessageQueueUpdate?: (nodeId: string, utilization: MessageQueueUtilization) => void;
  onApiGatewayUpdate?: (nodeId: string, utilization: ApiGatewayUtilization) => void;
  onHierarchicalResourceUpdate?(parentId: string, aggregated: ResourceUtilization, children: { childId: string; utilization: ResourceUtilization }[]): void;
  onError?: (error: Error) => void;
  onTimeSeriesSnapshot?: (snapshot: import('@/types').TimeSeriesSnapshot) => void;
  onSimulationComplete?: () => void;
  onBottleneckUpdate?: (analysis: BottleneckAnalysis) => void;
  onExtendedMetricsUpdate?: (metrics: ReturnType<MetricsCollector['getExtendedMetrics']>) => void;
}

/** Etat interne d'un serveur HTTP pendant la simulation (ressources, utilisation, requetes actives). */
interface ServerState {
  nodeId: string;
  resources: ServerResources;
  utilization: ResourceUtilization;
  activeRequests: Map<string, ActiveRequest>;
}

/** Requete en cours de traitement sur un serveur. */
interface ActiveRequest {
  id: string;
  startedAt: number;
  estimatedCompletion: number;
}

/** Requete en file d'attente lorsque le serveur est a capacite maximale. */
interface QueuedRequest {
  id: string;
  clientGroupId?: string;
  virtualClientId?: number;
  queuedAt: number;
  edgeId: string;
  sourceNode: Node;
}

/**
 * Derive queryType from httpMethod.
 * GET → read, POST/PUT/DELETE → write.
 */
function deriveQueryType(method?: string): 'read' | 'write' | 'transaction' {
  if (!method || method === 'GET') return 'read';
  return 'write';
}

/**
 * Infer contentType from request path.
 * /static/** or known extensions → static, /api/** → dynamic, otherwise user-specific.
 */
function inferContentType(path?: string): 'static' | 'dynamic' | 'user-specific' {
  if (!path) return 'dynamic';
  if (path.startsWith('/static') || /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(path)) return 'static';
  if (path.startsWith('/api') || path.startsWith('/graphql')) return 'dynamic';
  return 'user-specific';
}

/**
 * Default payload size estimates based on HTTP method.
 */
function estimatePayloadSize(method?: string): number {
  if (!method || method === 'GET' || method === 'DELETE') return 0;
  return 1024; // 1KB default for POST/PUT
}

/**
 * Generate a pseudo-random IP for a virtual client.
 */
function generateSourceIP(virtualClientId?: number): string {
  if (virtualClientId != null) {
    // Deterministic IP per virtual client
    const octet3 = Math.floor(virtualClientId / 256) % 256;
    const octet4 = virtualClientId % 256;
    return `10.0.${octet3}.${octet4 || 1}`;
  }
  // Random IP for http-client nodes
  return `10.0.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 255) + 1}`;
}

/**
 * Suivi d'une chaine de requete a travers la topologie.
 * Enregistre le chemin complet (noeuds et aretes traverses) et l'etat cache-aside.
 */
interface RequestChain {
  id: string;
  originNodeId: string;           // Le node d'origine (client ou client-group)
  currentPath: string[];          // Liste des nodeIds traversés
  edgePath: string[];             // Liste des edgeIds traversés
  virtualClientId?: number;
  startTime: number;
  requestPath?: string;           // Path HTTP de la requête (ex: "/api/orders")
  // Enriched context (Issue #4)
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  queryType?: 'read' | 'write' | 'transaction';
  contentType?: 'static' | 'dynamic' | 'user-specific';
  payloadSizeBytes?: number;
  sourceIP?: string;
  // Cache-aside pattern tracking
  cacheHit?: boolean;             // True si cache hit, false si miss
  cacheNodeId?: string;           // ID du cache pour stockage après DB
  waitingForDb?: boolean;         // True si on attend la réponse DB après cache miss
  // Token d'authentification (Issue #52)
  authToken?: {
    tokenId: string;
    format: 'jwt' | 'opaque' | 'saml-assertion';
    issuerId: string;
    issuedAt: number;
    expiresAt: number;
  };
}

/**
 * Orchestrateur principal de la simulation.
 *
 * Coordonne le cycle de vie (start/pause/resume/stop), les managers specialises
 * (ressources, cache, DB, load balancer), les handlers de requetes (strategy pattern),
 * les particules d'animation et la collecte de metriques.
 *
 * Communique avec la couche React exclusivement via les SimulationCallbacks.
 */
export class SimulationEngine {
  private nodes: Node[] = [];
  private edges: Edge[] = [];
  private state: SimulationState = 'idle';
  private speed: number = 1;
  private callbacks: SimulationCallbacks;
  private metrics: MetricsCollector;

  // Animation and timers
  private particleManager: ParticleManager;
  private clientTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  // Stress testing - Resource management
  private virtualClientManager: VirtualClientManager = new VirtualClientManager();
  private serverStates: Map<string, ServerState> = new Map();
  private requestQueues: Map<string, QueuedRequest[]> = new Map();
  private resourceSamplingInterval: ReturnType<typeof setInterval> | null = null;
  private clientGroupTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  // Request chain tracking
  private activeChains: Map<string, RequestChain> = new Map();

  // Span tracking for distributed tracing (chainId:nodeId → spanId)
  private activeSpans: Map<string, string> = new Map();

  // Time-series snapshot interval
  private timeSeriesInterval: ReturnType<typeof setInterval> | null = null;

  // Throttled metrics update
  private lastMetricsUpdateTime: number = 0;
  private metricsUpdateTimer: ReturnType<typeof setTimeout> | null = null;

  // Extended metrics push interval (1s)
  private extendedMetricsInterval: ReturnType<typeof setInterval> | null = null;

  // Handler infrastructure
  private handlerRegistry: HandlerRegistry;
  private loadBalancerManager: LoadBalancerManager;
  private cacheManager: CacheManager;
  private databaseManager: DatabaseManager;
  private loadBalancerHandler: LoadBalancerHandler;
  private cacheHandler: CacheHandler;
  private httpServerHandler: HttpServerHandler;
  private messageQueueHandler: MessageQueueHandler;
  private apiGatewayHandler: ApiGatewayHandler;
  private databaseHandler: DatabaseHandler;
  private circuitBreakerHandler: CircuitBreakerHandler;

  // Hierarchical resource management
  private hierarchicalResourceManager: HierarchicalResourceManager;

  // Token store for authentication flow (Issue #52)
  private tokenStore: TokenStore = new TokenStore();

  // Bottleneck analysis
  private bottleneckAnalyzer: BottleneckAnalyzer = new BottleneckAnalyzer();
  private bottleneckTickCounter: number = 0;

  // Chaos mode — fault provider callback
  private faultProvider: (() => { faults: Map<string, 'down' | 'degraded'>; isolated: Set<string> }) | null = null;

  constructor(callbacks: SimulationCallbacks) {
    this.callbacks = callbacks;
    this.metrics = new MetricsCollector();
    this.particleManager = new ParticleManager({
      onAddParticle: callbacks.onAddParticle,
      onRemoveParticle: callbacks.onRemoveParticle,
      onUpdateParticle: callbacks.onUpdateParticle,
    });

    // Initialize managers
    this.loadBalancerManager = new LoadBalancerManager();
    this.cacheManager = new CacheManager();
    this.databaseManager = new DatabaseManager();
    this.hierarchicalResourceManager = new HierarchicalResourceManager();

    // Initialize handlers
    this.loadBalancerHandler = new LoadBalancerHandler(this.loadBalancerManager);
    this.cacheHandler = new CacheHandler(this.cacheManager);
    this.httpServerHandler = new HttpServerHandler();
    this.messageQueueHandler = new MessageQueueHandler();
    this.apiGatewayHandler = new ApiGatewayHandler();
    this.databaseHandler = new DatabaseHandler(this.databaseManager);
    this.circuitBreakerHandler = new CircuitBreakerHandler();

    // Initialize handler registry
    this.handlerRegistry = new HandlerRegistry();
    this.handlerRegistry.setDefaultHandler(new DefaultHandler());
    this.handlerRegistry.registerAll([
      this.loadBalancerHandler,
      this.cacheHandler,
      this.httpServerHandler,
      this.apiGatewayHandler,
      this.databaseHandler,
      this.messageQueueHandler,
      this.circuitBreakerHandler,
      new CDNHandler(),
      new WAFHandler(),
      new FirewallHandler(),
      new ServerlessHandler(),
      new ContainerHandler(),
      new ServiceDiscoveryHandler(),
      new DNSHandler(),
      new CloudStorageHandler(),
      new CloudFunctionHandler(),
      new HostServerHandler(),
      new ApiServiceHandler(),
      new BackgroundJobHandler(),
      new IdentityProviderHandler(),
    ]);

    // Register plugin handlers
    for (const { handler } of pluginRegistry.getNodeHandlers()) {
      this.handlerRegistry.register(handler);
    }
  }

  /** Emet un SPAN_START pour un noeud dans une chaine et retourne le spanId. */
  private emitSpanStart(nodeId: string, nodeType: string, chainId: string, parentSpanId?: string): string {
    const spanId = `span_${chainId}_${nodeId}_${Date.now()}`;
    this.activeSpans.set(`${chainId}:${nodeId}`, spanId);
    simulationEvents.emit(createSpanStartEvent(nodeId, nodeType, chainId, spanId, parentSpanId));
    return spanId;
  }

  /** Emet un SPAN_END pour un noeud dans une chaine. */
  private emitSpanEnd(nodeId: string, chainId: string, isError: boolean = false): void {
    const key = `${chainId}:${nodeId}`;
    const spanId = this.activeSpans.get(key);
    if (spanId) {
      simulationEvents.emit(createSpanEndEvent(nodeId, chainId, spanId, isError));
      this.activeSpans.delete(key);
    }
  }

  /** Retourne le spanId actif pour un noeud dans une chaine (pour lier parent-enfant). */
  private getActiveSpanId(nodeId: string, chainId: string): string | undefined {
    return this.activeSpans.get(`${chainId}:${nodeId}`);
  }

  /** Pousse les metriques vers le callback avec throttle (200ms max). */
  private pushMetricsUpdate(): void {
    const now = Date.now();
    if (now - this.lastMetricsUpdateTime >= 200) {
      this.callbacks.onMetricsUpdate(this.metrics.getMetrics());
      this.lastMetricsUpdateTime = now;
      if (this.metricsUpdateTimer) {
        clearTimeout(this.metricsUpdateTimer);
        this.metricsUpdateTimer = null;
      }
    } else if (!this.metricsUpdateTimer) {
      this.metricsUpdateTimer = setTimeout(() => {
        this.callbacks.onMetricsUpdate(this.metrics.getMetrics());
        this.lastMetricsUpdateTime = Date.now();
        this.metricsUpdateTimer = null;
      }, 200 - (now - this.lastMetricsUpdateTime));
    }
  }

  /** Flush immediat des metriques (utilise avant stop). */
  private flushMetricsUpdate(): void {
    if (this.metricsUpdateTimer) {
      clearTimeout(this.metricsUpdateTimer);
      this.metricsUpdateTimer = null;
    }
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());
    this.lastMetricsUpdateTime = Date.now();
  }

  /** Retourne les metriques finales, resourceUtilizations et clientGroupStats. */
  getFinalMetrics(): {
    metrics: ReturnType<MetricsCollector['getMetrics']>;
    extendedMetrics: ReturnType<MetricsCollector['getExtendedMetrics']>;
  } {
    return {
      metrics: this.metrics.getMetrics(),
      extendedMetrics: this.metrics.getExtendedMetrics(),
    };
  }

  /** Retourne toutes les donnees enrichies pour le rapport final (appeler AVANT stop). */
  getReportData(): {
    extendedMetrics: ReturnType<MetricsCollector['getExtendedMetrics']>;
    traces: import('@/types').RequestTrace[];
    resourceHistory: import('@/types').ResourceSample[];
    apiGatewayStats: Record<string, import('@/types').ApiGatewayUtilization>;
    messageQueueStats: Record<string, import('@/types').MessageQueueUtilization>;
    cacheStats: Record<string, import('@/types').CacheUtilization>;
    databaseStats: Record<string, import('@/types').DatabaseUtilization>;
  } {
    const apiGatewayStats: Record<string, import('@/types').ApiGatewayUtilization> = {};
    const messageQueueStats: Record<string, import('@/types').MessageQueueUtilization> = {};
    const cacheStats: Record<string, import('@/types').CacheUtilization> = {};
    const databaseStats: Record<string, import('@/types').DatabaseUtilization> = {};

    for (const node of this.nodes) {
      if (node.type === 'api-gateway') {
        const stats = this.apiGatewayHandler.getStats(node.id);
        if (stats) {
          apiGatewayStats[node.id] = {
            totalRequests: stats.totalRequests,
            blockedRequests: stats.blockedRequests,
            authFailures: stats.authFailures,
            rateLimitHits: stats.rateLimitHits,
            activeConnections: stats.activeRequests,
            avgLatency: 0,
          };
        }
      } else if (node.type === 'message-queue') {
        const stats = this.messageQueueHandler.getStats(node.id);
        if (stats) {
          messageQueueStats[node.id] = { ...stats, throughput: 0 };
        }
      } else if (node.type === 'cache') {
        const util = this.cacheManager.getUtilization(node.id);
        if (util) cacheStats[node.id] = util;
      } else if (node.type === 'database') {
        const util = this.databaseManager.getUtilization(node.id);
        if (util) databaseStats[node.id] = util;
      }
    }

    return {
      extendedMetrics: this.metrics.getExtendedMetrics(),
      traces: criticalPathAnalyzer.getTraces(),
      resourceHistory: this.metrics.getResourceHistory(),
      apiGatewayStats,
      messageQueueStats,
      cacheStats,
      databaseStats,
    };
  }

  /** Configure le provider de fault injections (lit depuis le store via callback). */
  setFaultProvider(provider: (() => { faults: Map<string, 'down' | 'degraded'>; isolated: Set<string> }) | null): void {
    this.faultProvider = provider;
  }

  /** Retourne le fault actif pour un noeud, ou null si aucun. */
  private getNodeFault(nodeId: string): 'down' | 'degraded' | null {
    if (!this.faultProvider) return null;
    const { faults } = this.faultProvider();
    return faults.get(nodeId) ?? null;
  }

  /** Verifie si un noeud est isole du reseau (directement ou via un parent isolé). */
  private isNodeIsolated(nodeId: string): boolean {
    if (!this.faultProvider) return false;
    const { isolated } = this.faultProvider();
    if (isolated.has(nodeId)) return true;

    // Check if any ancestor is isolated
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return false;
    let currentId: string | undefined = node.parentId;
    while (currentId) {
      if (isolated.has(currentId)) return true;
      const parent = this.nodes.find((n) => n.id === currentId);
      if (!parent) return false;
      currentId = parent.parentId;
    }
    return false;
  }

  /**
   * Remonte la chaîne parentId et vérifie si un ancêtre est down, dégradé ou isolé.
   * Retourne le fault du premier ancêtre faulté, ou null si aucun.
   */
  private isParentFaulted(nodeId: string): 'down' | 'degraded' | null {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    let currentId: string | undefined = node.parentId;
    while (currentId) {
      // Check if parent is faulted
      const fault = this.getNodeFault(currentId);
      if (fault) return fault;

      // Check if parent is isolated
      if (this.isNodeIsolated(currentId)) return 'down';

      // Move up the chain
      const parent = this.nodes.find((n) => n.id === currentId);
      if (!parent) return null;
      currentId = parent.parentId;
    }
    return null;
  }

  /** Retourne les edges filtrees (exclut les edges vers/depuis des noeuds isoles). */
  private getActiveEdges(nodeId: string): Edge[] {
    return this.edges.filter((e) => {
      if (e.source === nodeId || e.target === nodeId) {
        // If source or target is isolated, exclude the edge
        const otherId = e.source === nodeId ? e.target : e.source;
        if (this.isNodeIsolated(otherId)) return false;
      }
      return e.source === nodeId;
    });
  }

  /** Met a jour le graphe de noeuds et aretes utilise par la simulation. */
  setNodesAndEdges(nodes: Node[], edges: Edge[]): void {
    this.nodes = nodes;
    this.edges = edges;
  }

  /** Ajuste la vitesse de simulation (clampee entre 0.5x et 4x). */
  setSpeed(speed: number): void {
    this.speed = Math.max(0.5, Math.min(4, speed));
  }

  /** Retourne l'etat courant de la simulation (idle, running, paused). */
  getState(): SimulationState {
    return this.state;
  }

  /**
   * Demarre la simulation.
   * Initialise les handlers, les etats serveurs, les clients HTTP, les client groups,
   * l'echantillonnage des ressources et la boucle d'animation.
   */
  start(): void {
    if (this.state === 'running') return;

    this.state = 'running';
    this.callbacks.onStateChange('running');
    this.metrics.start();

    // Initialize hierarchical resource manager
    this.hierarchicalResourceManager.initialize(this.nodes);

    // Initialize critical path analyzer with node labels
    const nodeLabels = new Map<string, string>();
    for (const node of this.nodes) {
      const label = (node.data as { label?: string }).label || node.id.split('-')[0];
      nodeLabels.set(node.id, label);
    }
    criticalPathAnalyzer.start(nodeLabels);

    // Initialize handlers for all nodes
    this.handlerRegistry.initializeAll(this.nodes);

    // Notify plugin engine hooks
    for (const hooks of pluginRegistry.getEngineHooks()) {
      hooks.onSimulationStart?.();
    }

    // Initialize server states for stress testing
    this.initializeServerStates();

    // Start all HTTP clients
    this.startHttpClients();

    // Start client groups for stress testing
    this.startClientGroups();

    // Start resource sampling
    this.startResourceSampling();

    // Start time-series snapshot capture (every 5s)
    this.startTimeSeriesCapture();

    // Start extended metrics push (every 1s) for percentiles, rejections, etc.
    this.startExtendedMetricsPush();

    // Start animation loop
    this.particleManager.startAnimationLoop(() => this.state);
  }

  /** Met en pause la simulation en arretant l'animation, tout en conservant l'etat. */
  pause(): void {
    if (this.state !== 'running') return;

    this.state = 'paused';
    this.callbacks.onStateChange('paused');

    // Stop animation but keep state
    this.particleManager.stopAnimationLoop();
  }

  /** Reprend la simulation apres une pause. */
  resume(): void {
    if (this.state !== 'paused') return;

    this.state = 'running';
    this.callbacks.onStateChange('running');

    // Resume animation
    this.particleManager.startAnimationLoop(() => this.state);
  }

  /**
   * Arrete completement la simulation.
   * Nettoie les timers, particules, chaines de requetes, etats serveurs et handlers.
   */
  stop(): void {
    this.state = 'idle';
    this.callbacks.onStateChange('idle');

    // Clear all timers
    this.clientTimers.forEach((timer) => clearInterval(timer));
    this.clientTimers.clear();

    // Clear client group timers
    this.clientGroupTimers.forEach((timer) => clearInterval(timer));
    this.clientGroupTimers.clear();

    // Cleanup virtual client manager
    this.virtualClientManager.cleanupAll();

    // Stop resource sampling
    if (this.resourceSamplingInterval) {
      clearInterval(this.resourceSamplingInterval);
      this.resourceSamplingInterval = null;
    }

    // Stop time-series capture
    if (this.timeSeriesInterval) {
      clearInterval(this.timeSeriesInterval);
      this.timeSeriesInterval = null;
    }

    // Stop extended metrics push
    if (this.extendedMetricsInterval) {
      clearInterval(this.extendedMetricsInterval);
      this.extendedMetricsInterval = null;
    }

    // Clear request queues, chains, spans and tokens
    this.requestQueues.clear();
    this.serverStates.clear();
    this.activeChains.clear();
    this.activeSpans.clear();
    this.tokenStore.clear();

    // Stop critical path analyzer
    criticalPathAnalyzer.stop();

    // Cleanup handlers
    const nodeIds = this.nodes.map((n) => n.id);
    this.handlerRegistry.cleanupAll(nodeIds);

    // Notify plugin engine hooks
    for (const hooks of pluginRegistry.getEngineHooks()) {
      hooks.onSimulationStop?.();
    }

    // Stop animation and clear particles
    this.particleManager.stopAnimationLoop();
    this.particleManager.clearAll();

    // Reset node states
    this.nodes.forEach((node) => {
      this.callbacks.onNodeStatusChange(node.id, 'idle');
    });

    // Flush final metrics before clearing
    this.flushMetricsUpdate();

    // Note: Do NOT clear simulationEvents handlers here.
    // The useSimulationEvents hook manages its own subscription lifecycle.
    // Clearing handlers here would break the hook's subscription without re-subscribing.

    // Clear throttle timer
    if (this.metricsUpdateTimer) {
      clearTimeout(this.metricsUpdateTimer);
      this.metricsUpdateTimer = null;
    }

    // Reset metrics
    this.metrics.reset();
  }

  /** Reinitialise la simulation (alias de stop). */
  reset(): void {
    this.stop();
  }

  /**
   * Verifie si toutes les requetes finies sont terminees.
   * Si aucune source continue (loop clients, client groups) n'existe
   * et qu'il n'y a plus de chaines actives ni de particules, arrete la simulation.
   */
  private checkCompletion(): void {
    if (this.state !== 'running') return;

    // Don't auto-stop if there are continuous request sources
    if (this.clientTimers.size > 0 || this.clientGroupTimers.size > 0) return;

    // Check if all requests have completed (no active chains, no particles in flight)
    if (this.activeChains.size === 0 && this.particleManager.getCount() === 0) {
      this.callbacks.onSimulationComplete?.();
    }
  }

  private startHttpClients(): void {
    const httpClients = this.nodes.filter((node) => node.type === 'http-client');

    httpClients.forEach((client) => {
      const data = client.data as HttpClientNodeData;
      const connectedEdges = this.edges.filter((edge) => edge.source === client.id);

      if (connectedEdges.length === 0) {
        return;
      }

      // Send initial request
      this.sendRequest(client, connectedEdges[0]);

      // If loop mode, set up interval
      if (data.requestMode === 'loop') {
        const interval = (data.interval || 1000) / this.speed;
        const timer = setInterval(() => {
          if (this.state === 'running') {
            this.sendRequest(client, connectedEdges[0]);
          }
        }, interval);

        this.clientTimers.set(client.id, timer);
      }
    });
  }

  /**
   * Trouve un Identity Provider connecté à un nœud (via edge sortant).
   */
  private findConnectedIdP(nodeId: string): { node: Node; edge: Edge } | null {
    const edges = this.edges.filter((e) => e.source === nodeId);
    for (const edge of edges) {
      const target = this.nodes.find((n) => n.id === edge.target);
      if (target && target.type === 'identity-provider') {
        return { node: target, edge };
      }
    }
    return null;
  }

  /**
   * Crée un token auto-généré (quand pas d'IdP connecté au client).
   */
  private createAutoToken(clientId: string): SimulatedToken {
    const token: SimulatedToken = {
      tokenId: `auto_${generateParticleId()}`,
      clientId,
      idpId: 'auto',
      format: 'jwt',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600_000, // 1h
    };
    this.tokenStore.storeToken(token);
    return token;
  }

  /**
   * Acquiert un token auprès d'un Identity Provider via une particule visible,
   * puis exécute le callback avec le token obtenu.
   */
  private acquireToken(
    client: Node,
    idpEdge: Edge,
    idpNode: Node,
    virtualClientId: number | undefined,
    callback: (token: SimulatedToken) => void
  ): void {
    const idpData = idpNode.data as IdentityProviderNodeData;

    // Particule token-request : client → IdP (couleur dorée)
    const duration = 2000 / this.speed;
    const tokenChainId = generateParticleId();
    const particle: Particle = {
      id: generateParticleId(),
      edgeId: idpEdge.id,
      type: 'token-request',
      direction: 'forward',
      progress: 0,
      duration,
      startTime: Date.now(),
      data: { chainId: tokenChainId },
    };
    this.particleManager.add(particle);

    setTimeout(() => {
      if (this.state !== 'running') return;
      this.particleManager.remove(particle.id);

      // Appeler le handler IdP pour vérifier rate-limit, erreur, etc.
      const handler = this.handlerRegistry.getHandler('identity-provider');
      const context: RequestContext = {
        chainId: tokenChainId,
        originNodeId: client.id,
        virtualClientId,
        startTime: Date.now(),
        currentPath: [client.id, idpNode.id],
        edgePath: [idpEdge.id],
      };
      const processingDelay = handler.getProcessingDelay(idpNode, this.speed, context);

      this.callbacks.onNodeStatusChange(idpNode.id, 'processing');

      setTimeout(() => {
        if (this.state !== 'running') return;

        const outgoing = this.edges.filter((e) => e.source === idpNode.id);
        const decision = handler.handleRequestArrival(idpNode, context, outgoing, this.nodes);

        this.callbacks.onNodeStatusChange(idpNode.id, 'idle');

        if (decision.action === 'reject') {
          // Token refusé — envoyer particule d'erreur retour
          const errParticle: Particle = {
            id: generateParticleId(),
            edgeId: idpEdge.id,
            type: 'response-error',
            direction: 'backward',
            progress: 0,
            duration: 1500 / this.speed,
            startTime: Date.now(),
            data: { chainId: tokenChainId },
          };
          this.particleManager.add(errParticle);
          setTimeout(() => {
            this.particleManager.remove(errParticle.id);
          }, errParticle.duration);
          // Pas de callback — la requête n'est pas envoyée
          this.metrics.recordRejection();
          this.metrics.recordResponse(false, Date.now() - context.startTime);
          this.pushMetricsUpdate();
          return;
        }

        // Token accordé — stocker et envoyer particule token-response retour
        const token: SimulatedToken = {
          tokenId: `tok_${generateParticleId()}`,
          clientId: client.id,
          idpId: idpNode.id,
          format: idpData.tokenFormat as 'jwt' | 'opaque' | 'saml-assertion',
          issuedAt: Date.now(),
          expiresAt: Date.now() + idpData.tokenTTLSeconds * 1000,
          virtualClientId,
        };
        this.tokenStore.storeToken(token);

        const respParticle: Particle = {
          id: generateParticleId(),
          edgeId: idpEdge.id,
          type: 'token-response',
          direction: 'backward',
          progress: 0,
          duration: 1500 / this.speed,
          startTime: Date.now(),
          data: { chainId: tokenChainId },
        };
        this.particleManager.add(respParticle);

        setTimeout(() => {
          if (this.state !== 'running') return;
          this.particleManager.remove(respParticle.id);
          callback(token);
        }, respParticle.duration);
      }, processingDelay);
    }, duration);
  }

  /**
   * Résout le token d'authentification de manière synchrone si possible.
   * Retourne:
   * - { needsAsync: false, token?: SimulatedToken } si le token est dispo ou pas d'auth requise
   * - { needsAsync: true, idp, idpEdge } si un acquireToken async est nécessaire
   */
  private resolveAuthToken(
    client: Node,
    targetNode: Node,
    virtualClientId: number | undefined
  ): { needsAsync: false; token?: SimulatedToken } | { needsAsync: true; idp: Node; idpEdge: Edge } {
    // Vérifier si la cible est un API Gateway avec auth activée
    if (targetNode.type !== 'api-gateway') {
      return { needsAsync: false };
    }
    const gwData = targetNode.data as ApiGatewayNodeData;
    if (gwData.authType === 'none') {
      return { needsAsync: false };
    }

    // Auth requise — chercher un IdP connecté au client
    const idp = this.findConnectedIdP(client.id);
    if (!idp) {
      // Pas d'IdP — auto-générer un token
      const token = this.tokenStore.getValidToken(client.id, 'auto', virtualClientId)
        || this.createAutoToken(client.id);
      return { needsAsync: false, token };
    }

    // Vérifier si un token valide existe déjà
    const existingToken = this.tokenStore.getValidToken(client.id, idp.node.id, virtualClientId);
    if (existingToken) {
      return { needsAsync: false, token: existingToken };
    }

    // Token non disponible — acquireToken async nécessaire
    return { needsAsync: true, idp: idp.node, idpEdge: idp.edge };
  }

  /**
   * Valide un token auprès de l'IdP avec des particules visibles.
   * Gateway → IdP (bleue + cadenas), puis IdP → Gateway (verte/rouge + cadenas).
   */
  private validateTokenViaIdP(
    gateway: Node,
    idpNode: Node,
    idpEdge: Edge,
    chainId: string,
    context: RequestContext,
    onValid: () => void,
    onInvalid: () => void
  ): void {
    // Vérifier si ce token a déjà été validé par cette gateway (pas de re-validation pendant la durée de vie)
    if (context.authToken && this.tokenStore.isValidated(gateway.id, context.authToken.tokenId)) {
      onValid();
      return;
    }

    // 1. Particule bleue + cadenas : Gateway → IdP
    const duration = 1500 / this.speed;
    const validationParticle: Particle = {
      id: generateParticleId(),
      edgeId: idpEdge.id,
      type: 'request',
      direction: 'forward',
      progress: 0,
      duration,
      startTime: Date.now(),
      data: { chainId, authenticated: true },
    };
    this.particleManager.add(validationParticle);

    setTimeout(() => {
      if (this.state !== 'running') return;
      this.particleManager.remove(validationParticle.id);

      // 2. IdP traite la validation
      const idpHandler = this.handlerRegistry.getHandler('identity-provider');
      const processingDelay = idpHandler.getProcessingDelay(idpNode, this.speed, context);
      this.callbacks.onNodeStatusChange(idpNode.id, 'processing');

      setTimeout(() => {
        if (this.state !== 'running') return;

        const idpDecision = idpHandler.handleRequestArrival(idpNode, context, [], this.nodes);
        const isValid = idpDecision.action !== 'reject';
        this.callbacks.onNodeStatusChange(idpNode.id, 'idle');

        // 3. Particule retour : IdP → Gateway (verte + cadenas si valide, rouge + cadenas si invalide)
        const responseDuration = 1500 / this.speed;
        const responseParticle: Particle = {
          id: generateParticleId(),
          edgeId: idpEdge.id,
          type: isValid ? 'response-success' : 'response-error',
          direction: 'backward',
          progress: 0,
          duration: responseDuration,
          startTime: Date.now(),
          data: { chainId, authenticated: true },
        };
        this.particleManager.add(responseParticle);

        setTimeout(() => {
          if (this.state !== 'running') return;
          this.particleManager.remove(responseParticle.id);

          if (isValid) {
            // Marquer le token comme validé pour ne pas revalider pendant sa durée de vie
            if (context.authToken) {
              this.tokenStore.markValidated(gateway.id, context.authToken.tokenId, context.authToken.expiresAt);
            }
            onValid();
          } else {
            onInvalid();
          }
        }, responseDuration);
      }, processingDelay);
    }, duration);
  }

  private sendRequest(client: Node, edge: Edge, preAcquiredToken?: SimulatedToken): void {
    const data = client.data as HttpClientNodeData;
    const targetNode = this.nodes.find((n) => n.id === edge.target);

    if (!targetNode) {
      return;
    }

    // Si pas de token pré-acquis, vérifier si auth requise (peut déclencher acquireToken async)
    if (!preAcquiredToken) {
      const authResult = this.resolveAuthToken(client, targetNode, undefined);
      if (authResult.needsAsync) {
        // Acquérir un token via l'IdP (async), puis relancer sendRequest
        this.acquireToken(client, authResult.idpEdge, authResult.idp, undefined, (token) => {
          this.sendRequest(client, edge, token);
        });
        return;
      }
      preAcquiredToken = authResult.token;
    }

    // Update client status
    this.callbacks.onNodeStatusChange(client.id, 'processing');

    // Record metric
    this.metrics.recordRequestSent();
    this.pushMetricsUpdate();

    // Generate chainId early so it can be tracked from the first event
    const chainId = generateParticleId();

    // Create request event (enriched with full context)
    const event = createRequestSentEvent(
      client.id,
      edge.target,
      edge.id,
      data.method,
      data.path,
      undefined,
      chainId,
      {
        queryType: deriveQueryType(data.method),
        contentType: inferContentType(data.path),
        payloadSizeBytes: estimatePayloadSize(data.method),
        sourceIP: generateSourceIP(),
        authToken: preAcquiredToken ? {
          tokenId: preAcquiredToken.tokenId,
          format: preAcquiredToken.format,
          issuerId: preAcquiredToken.idpId,
        } : undefined,
      }
    );
    simulationEvents.emit(event);

    // Create request particle (forward: client → server)
    const requestDuration = 2000 / this.speed; // Base duration adjusted by speed (2 seconds)
    const particle: Particle = {
      id: generateParticleId(),
      edgeId: edge.id,
      type: 'request',
      direction: 'forward',
      progress: 0,
      duration: requestDuration,
      startTime: Date.now(),
      data: { chainId, authenticated: !!preAcquiredToken },
    };

    // Pré-créer la chain avec le token si disponible
    if (preAcquiredToken) {
      const chain: RequestChain = {
        id: chainId,
        originNodeId: client.id,
        currentPath: [client.id],
        edgePath: [],
        startTime: Date.now(),
        requestPath: data.path,
        httpMethod: data.method,
        queryType: deriveQueryType(data.method),
        contentType: inferContentType(data.path),
        payloadSizeBytes: estimatePayloadSize(data.method),
        sourceIP: generateSourceIP(),
        authToken: {
          tokenId: preAcquiredToken.tokenId,
          format: preAcquiredToken.format,
          issuerId: preAcquiredToken.idpId,
          issuedAt: preAcquiredToken.issuedAt,
          expiresAt: preAcquiredToken.expiresAt,
        },
      };
      this.activeChains.set(chainId, chain);
    }

    this.particleManager.add(particle);

    // Schedule request arrival
    setTimeout(() => {
      this.handleRequestArrival(particle, client, targetNode, edge);
    }, requestDuration);
  }

  private handleRequestArrival(
    requestParticle: Particle,
    client: Node,
    server: Node,
    edge: Edge
  ): void {
    if (this.state !== 'running') return;
    try {

    // Remove request particle
    this.particleManager.remove(requestParticle.id);

    // Get or create request chain
    const chainId = getParticleChainId(requestParticle) || generateParticleId();
    let chain = this.activeChains.get(chainId);

    if (!chain) {
      // Get the path from the client node data
      const clientData = client.data as HttpClientNodeData;
      const method = clientData.method;
      chain = {
        id: chainId,
        originNodeId: client.id,
        currentPath: [client.id],
        edgePath: [],
        startTime: Date.now(),
        requestPath: clientData.path,
        httpMethod: method,
        queryType: deriveQueryType(method),
        contentType: inferContentType(clientData.path),
        payloadSizeBytes: estimatePayloadSize(method),
        sourceIP: generateSourceIP(),
      };
      this.activeChains.set(chainId, chain);
    }

    // Add current node and edge to path
    chain.currentPath.push(server.id);
    chain.edgePath.push(edge.id);

    // Update statuses
    this.callbacks.onNodeStatusChange(client.id, 'idle');

    // --- Chaos mode: check fault on server and its parent chain ---
    const serverFault = this.getNodeFault(server.id);
    const parentFault = this.isParentFaulted(server.id);
    if (serverFault === 'down' || this.isNodeIsolated(server.id) || parentFault === 'down') {
      this.callbacks.onNodeStatusChange(server.id, 'down');
      this.metrics.recordRejection();
      this.metrics.recordResponse(false, Date.now() - chain.startTime);
      this.pushMetricsUpdate();
      simulationEvents.emit(createErrorEvent(server.id, 'node-down', chainId));
      simulationEvents.emit(createStateTransitionEvent(server.id, 'node-down', 'processing', 'down', chainId));
      // Emit error span for tracing
      this.emitSpanStart(server.id, server.type ?? 'default', chainId);
      this.emitSpanEnd(server.id, chainId, true);
      this.sendChainResponse(chainId, server);
      return;
    }

    const effectiveFault = serverFault === 'degraded' ? 'degraded' : parentFault === 'degraded' ? 'degraded' : null;
    if (effectiveFault === 'degraded') {
      simulationEvents.emit(createStateTransitionEvent(server.id, 'node-degraded', 'processing', 'degraded', chainId));
    }
    this.callbacks.onNodeStatusChange(server.id, effectiveFault === 'degraded' ? 'degraded' : 'processing');

    // Emit REQUEST_RECEIVED event
    const clientData = client.data as HttpClientNodeData;
    simulationEvents.emit(createRequestReceivedEvent(
      client.id, server.id, clientData.method, clientData.path, chainId
    ));

    // Build request context for the handler
    const outgoingEdges = this.edges.filter((e) => e.source === server.id);
    const edgeData = edge.data as Record<string, unknown> | undefined;
    const context: RequestContext = {
      chainId,
      originNodeId: chain.originNodeId,
      virtualClientId: chain.virtualClientId,
      startTime: chain.startTime,
      currentPath: chain.currentPath,
      edgePath: chain.edgePath,
      requestPath: chain.requestPath,
      targetPort: (edgeData?.targetPort as number) ?? undefined,
      httpMethod: chain.httpMethod,
      queryType: chain.queryType,
      contentType: chain.contentType,
      payloadSizeBytes: chain.payloadSizeBytes,
      sourceIP: chain.sourceIP,
      cacheHit: chain.cacheHit,
      cacheNodeId: chain.cacheNodeId,
      waitingForDb: chain.waitingForDb,
      authToken: chain.authToken,
    };

    // Use handler pattern for consistent behavior
    let processingDelay = this.getNodeProcessingDelay(server, context);
    if (effectiveFault === 'degraded') processingDelay *= 3;

    // Callback pour continuer le flow normal après validation (ou sans validation)
    const continueGatewayFlow = () => {
      if (this.state !== 'running') return;

      // Emit PROCESSING_START event
      simulationEvents.emit(createProcessingStartEvent(server.id, chainId));

      // Emit SPAN_START for distributed tracing
      const nodeType = server.type ?? 'default';
      this.emitSpanStart(server.id, nodeType, chainId);

      // Get handler and decision
      const handler = this.handlerRegistry.getHandler(nodeType);
      let decision = handler.handleRequestArrival(server, context, outgoingEdges, this.nodes);

      // Track database query type metrics
      if (nodeType === 'database') {
        this.metrics.recordDatabaseQuery(context.queryType || 'read');
      }

      // Chaos: degraded nodes have 50% chance of error
      if (serverFault === 'degraded' && Math.random() < 0.5) {
        decision = { action: 'respond', isError: true };
      }

      // Execute decision after processing delay
      setTimeout(() => {
        if (this.state !== 'running') return;
        this.executeDecision(decision, server, chainId, context);
      }, processingDelay);
    };

    // Validation du token via IdP connecté à la gateway (Issue #52)
    if (server.type === 'api-gateway' && context.authToken) {
      const gwData = server.data as ApiGatewayNodeData;
      if (gwData.authType !== 'none') {
        const gwIdp = this.findConnectedIdP(server.id);
        if (gwIdp) {
          this.validateTokenViaIdP(server, gwIdp.node, gwIdp.edge, chainId, context,
            continueGatewayFlow,
            () => {
              this.executeDecision({ action: 'reject', reason: 'token-invalid' }, server, chainId, context);
            }
          );
          return;
        }
      }
    }

    // Pas de validation IdP nécessaire — continuer directement
    continueGatewayFlow();
    } catch (error) {
      console.error('[SimulationEngine] Error in handleRequestArrival:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get processing delay for a node based on its type
   * Delegates to the appropriate handler
   */
  private getNodeProcessingDelay(node: Node, context?: RequestContext): number {
    const nodeType = node.type ?? 'default';
    const handler = this.handlerRegistry.getHandler(nodeType);
    return handler.getProcessingDelay(node, this.speed, context);
  }

  /**
   * Calcule la latence inter-zone entre deux noeuds.
   * Remonte la chaîne parentId pour trouver la zone réseau contenante.
   * Containers sur le même host-server : latence ~0ms (loopback).
   */
  private getInterZoneLatency(sourceNode: Node, targetNode: Node): number {
    // Deleguer au calcul hierarchique
    return this.getHierarchicalLatency(sourceNode.id, targetNode.id);
  }

  /**
   * Remonte la chaîne parentId pour trouver la network-zone ancêtre.
   */
  private findContainingZone(node: Node): string | undefined {
    return this.hierarchicalResourceManager.findContainingZone(node.id);
  }

  /**
   * Remonte la chaîne parentId pour trouver le host-server ancêtre.
   */
  private findContainingServer(nodeId: string): string | undefined {
    return this.hierarchicalResourceManager.findContainingServer(nodeId);
  }

  /**
   * Calcule la latence hierarchique entre deux noeuds.
   *
   * Regles de latence :
   * - Meme container → ~0.05ms
   * - Meme server, containers differents → ~0.1ms
   * - Meme server, bare-metal → ~0.1ms
   * - Meme zone, servers differents → 1-5ms
   * - Zones differentes → interZoneLatency (config de la zone)
   * - Pas de zone → 5ms par defaut
   */
  private getHierarchicalLatency(sourceId: string, targetId: string): number {
    // Meme noeud → pas de latence
    if (sourceId === targetId) return 0;

    // Verifier le container parent
    const sourceContainer = this.hierarchicalResourceManager.findContainingContainer(sourceId);
    const targetContainer = this.hierarchicalResourceManager.findContainingContainer(targetId);

    // Meme container → latence tres faible (loopback)
    if (sourceContainer && sourceContainer === targetContainer) {
      return 0.05 / this.speed;
    }

    // Verifier le host-server parent
    const sourceServer = this.findContainingServer(sourceId);
    const targetServer = this.findContainingServer(targetId);

    // Meme server (containers differents ou bare-metal) → latence locale
    if (sourceServer && sourceServer === targetServer) {
      return 0.1 / this.speed;
    }

    // Verifier la zone reseau
    const sourceZoneId = this.hierarchicalResourceManager.findContainingZone(sourceId);
    const targetZoneId = this.hierarchicalResourceManager.findContainingZone(targetId);

    // Meme zone, servers differents → latence LAN (1-5ms)
    if (sourceZoneId && sourceZoneId === targetZoneId) {
      return (1 + Math.random() * 4) / this.speed;
    }

    // Zones differentes → utiliser la latence inter-zone configuree
    if (sourceZoneId && targetZoneId && sourceZoneId !== targetZoneId) {
      const sourceZone = this.nodes.find((n) => n.id === sourceZoneId);
      if (sourceZone) {
        const zoneData = sourceZone.data as { interZoneLatency?: number };
        return (zoneData.interZoneLatency || 10) / this.speed;
      }
    }

    // Pas de zone → latence par defaut de 5ms
    if (!sourceZoneId && !targetZoneId) {
      return 5 / this.speed;
    }

    // Un des deux n'a pas de zone → latence inter-zone par defaut
    return 5 / this.speed;
  }

  /**
   * Select a random path from the client group's paths array
   * Falls back to the default path if no paths array is defined
   */
  private selectRandomPath(data: ClientGroupNodeData): string {
    // If paths array is defined and has items, pick one randomly
    if (data.paths && data.paths.length > 0) {
      const randomIndex = Math.floor(Math.random() * data.paths.length);
      return data.paths[randomIndex];
    }
    // Fallback to the default path
    return data.path;
  }

  /**
   * Selectionne un type de requete (method + path) depuis la distribution configuree.
   * Utilise une selection aleatoire ponderee si requestDistribution est defini,
   * sinon retourne method + selectRandomPath par defaut.
   */
  private selectRequestType(data: ClientGroupNodeData): { method: import('@/types').HttpMethod; path: string; body?: string } {
    if (data.requestDistribution && data.requestDistribution.length > 0) {
      const totalWeight = data.requestDistribution.reduce((sum, d) => sum + d.weight, 0);
      let random = Math.random() * totalWeight;
      for (const dist of data.requestDistribution) {
        random -= dist.weight;
        if (random <= 0) {
          return { method: dist.method, path: dist.path, body: dist.body };
        }
      }
      // Fallback to last entry
      const last = data.requestDistribution[data.requestDistribution.length - 1];
      return { method: last.method, path: last.path, body: last.body };
    }
    return { method: data.method, path: this.selectRandomPath(data) };
  }

  /**
   * Forward a request from an intermediary node to downstream nodes
   * Uses handlers to determine the forwarding strategy
   */
  private forwardRequest(sourceNode: Node, outgoingEdges: Edge[], chainId: string): void {
    if (this.state !== 'running') return;

    const chain = this.activeChains.get(chainId);
    if (!chain) return;

    // Build request context for the handler
    const context: RequestContext = {
      chainId,
      originNodeId: chain.originNodeId,
      virtualClientId: chain.virtualClientId,
      startTime: chain.startTime,
      currentPath: chain.currentPath,
      edgePath: chain.edgePath,
      requestPath: chain.requestPath,
      httpMethod: chain.httpMethod,
      queryType: chain.queryType,
      contentType: chain.contentType,
      payloadSizeBytes: chain.payloadSizeBytes,
      sourceIP: chain.sourceIP,
      cacheHit: chain.cacheHit,
      cacheNodeId: chain.cacheNodeId,
      waitingForDb: chain.waitingForDb,
      authToken: chain.authToken,
    };

    // Get handler decision
    const nodeType = sourceNode.type ?? 'default';
    const handler = this.handlerRegistry.getHandler(nodeType);
    const decision = handler.handleRequestArrival(sourceNode, context, outgoingEdges, this.nodes);

    // Track database query type metrics
    if (nodeType === 'database') {
      this.metrics.recordDatabaseQuery(context.queryType || 'read');
    }

    // Execute the decision
    this.executeDecision(decision, sourceNode, chainId, context);
  }

  /**
   * Execute a handler decision
   */
  private executeDecision(
    decision: RequestDecision,
    sourceNode: Node,
    chainId: string,
    context: RequestContext
  ): void {
    const chain = this.activeChains.get(chainId);

    // Emit PROCESSING_END event
    simulationEvents.emit(createProcessingEndEvent(sourceNode.id, chainId));

    // --- Emit HANDLER_DECISION event (traces every handler action) ---
    const nodeType = sourceNode.type ?? 'default';
    const decisionTargets = decision.action === 'forward' || decision.action === 'notify'
      ? decision.targets.map((t) => t.nodeId) : undefined;
    const decisionReason = decision.action === 'reject' ? decision.reason : undefined;
    simulationEvents.emit(createHandlerDecisionEvent(
      sourceNode.id, nodeType, decision.action, chainId, {
        reason: decisionReason,
        targets: decisionTargets,
        httpMethod: context.httpMethod,
        queryType: context.queryType,
        contentType: context.contentType,
        sourceIP: context.sourceIP,
        virtualClientId: context.virtualClientId,
      }
    ));

    // --- Emit RESOURCE_SNAPSHOT if server has tracked resources ---
    const serverState = this.serverStates.get(sourceNode.id);
    if (serverState) {
      const queue = this.requestQueues.get(sourceNode.id) || [];
      const serverMetrics = this.metrics.getServerMetrics(sourceNode.id);
      simulationEvents.emit(createResourceSnapshotEvent(sourceNode.id, chainId, {
        cpu: serverState.utilization.cpu,
        memory: serverState.utilization.memory,
        activeConnections: serverState.utilization.activeConnections,
        queuedRequests: queue.length,
        throughput: serverMetrics.throughput,
        errorRate: serverMetrics.errorRate,
      }));
    }

    // Emit SPAN_END for distributed tracing
    const isErrorDecision = decision.action === 'reject' || (decision.action === 'respond' && decision.isError);
    this.emitSpanEnd(sourceNode.id, chainId, isErrorDecision);

    switch (decision.action) {
      case 'forward':
        // Forward to the targets
        // First target uses the main chain, additional targets get forked chains (fire-and-forget)
        decision.targets.forEach((target, index) => {
          const targetNode = this.nodes.find((n) => n.id === target.nodeId);
          if (!targetNode) return;

          // For additional targets (index > 0), create a forked chain for fire-and-forget
          let effectiveChainId = chainId;
          if (index > 0 && chain) {
            const forkedChainId = `${chainId}-fork-${index}`;
            const forkedChain: RequestChain = {
              id: forkedChainId,
              originNodeId: sourceNode.id, // Fork starts from current node
              currentPath: [sourceNode.id],
              edgePath: [],
              virtualClientId: chain.virtualClientId,
              startTime: Date.now(),
              requestPath: chain.requestPath,
            };
            this.activeChains.set(forkedChainId, forkedChain);
            effectiveChainId = forkedChainId;
          }

          const zoneLatency = this.getInterZoneLatency(sourceNode, targetNode);
          const requestDuration = (target.delay ?? 1500) / this.speed + zoneLatency;
          const particle: Particle = {
            id: generateParticleId(),
            edgeId: target.edgeId,
            type: 'request',
            direction: 'forward',
            progress: 0,
            duration: requestDuration,
            startTime: Date.now(),
            data: { chainId: effectiveChainId },
          };

          this.particleManager.add(particle);
          this.callbacks.onNodeStatusChange(sourceNode.id, 'processing');

          setTimeout(() => {
            this.handleChainRequestArrival(particle, sourceNode, targetNode,
              { id: target.edgeId } as Edge, effectiveChainId);
          }, requestDuration);
        });
        break;

      case 'respond':
        // Send response back through the chain
        if (decision.delay) {
          setTimeout(() => {
            this.callbacks.onNodeStatusChange(sourceNode.id, decision.isError ? 'error' : 'success');
            this.sendChainResponse(chainId, sourceNode);
          }, decision.delay / this.speed);
        } else {
          this.callbacks.onNodeStatusChange(sourceNode.id, decision.isError ? 'error' : 'success');
          this.sendChainResponse(chainId, sourceNode);
        }
        break;

      case 'reject':
        // Record rejection and send error response
        this.metrics.recordRejection(decision.reason);
        this.pushMetricsUpdate();
        this.callbacks.onNodeStatusChange(sourceNode.id, 'error');
        simulationEvents.emit(createErrorEvent(sourceNode.id, decision.reason || 'rejected', chainId));
        this.sendChainResponse(chainId, sourceNode, true);
        // Reset rapide du statut après rejet (le rejet est instantané, pas besoin d'attendre le response hop)
        setTimeout(() => {
          if (this.state === 'running') {
            this.callbacks.onNodeStatusChange(sourceNode.id, 'idle');
          }
        }, 300 / this.speed);
        break;

      case 'queue':
        // For now, treat queue as pending - can be enhanced later
        this.callbacks.onNodeStatusChange(sourceNode.id, 'processing');
        break;

      case 'cache-miss':
        // Update chain state for cache miss
        if (chain) {
          chain.waitingForDb = true;
          chain.cacheNodeId = decision.cacheNodeId;
        }
        // Forward to database
        const dbTarget = decision.dbTarget;
        const dbNode = this.nodes.find((n) => n.id === dbTarget.nodeId);
        if (dbNode) {
          const requestDuration = 1500 / this.speed;
          const particle: Particle = {
            id: generateParticleId(),
            edgeId: dbTarget.edgeId,
            type: 'request',
            direction: 'forward',
            progress: 0,
            duration: requestDuration,
            startTime: Date.now(),
            data: { chainId },
          };

          this.particleManager.add(particle);

          setTimeout(() => {
            this.handleChainRequestArrival(particle, sourceNode, dbNode,
              { id: dbTarget.edgeId } as Edge, chainId);
          }, requestDuration);
        }
        break;

      case 'notify':
        // Fire-and-forget: respond immediately to producer, notify consumers async
        // 1. Send response back to producer
        this.callbacks.onNodeStatusChange(sourceNode.id, 'success');
        this.sendChainResponse(chainId, sourceNode);

        // 2. Notify consumers asynchronously (fire-and-forget with forked chains)
        decision.targets.forEach((target, index) => {
          const targetNode = this.nodes.find((n) => n.id === target.nodeId);
          if (!targetNode) return;

          // Create a forked chain for each notification (fire-and-forget)
          const notifyChainId = `${chainId}-notify-${index}`;
          const notifyChain: RequestChain = {
            id: notifyChainId,
            originNodeId: sourceNode.id,
            currentPath: [sourceNode.id],
            edgePath: [],
            startTime: Date.now(),
            requestPath: context.requestPath,
          };
          this.activeChains.set(notifyChainId, notifyChain);

          const requestDuration = (target.delay ?? 1500) / this.speed;
          const particle: Particle = {
            id: generateParticleId(),
            edgeId: target.edgeId,
            type: 'request',
            direction: 'forward',
            progress: 0,
            duration: requestDuration,
            startTime: Date.now(),
            data: { chainId: notifyChainId },
          };

          this.particleManager.add(particle);

          setTimeout(() => {
            this.handleChainRequestArrival(particle, sourceNode, targetNode,
              { id: target.edgeId } as Edge, notifyChainId);
          }, requestDuration);
        });
        break;
    }
  }

  /**
   * Handle request arrival at any node in the chain
   * Uses handlers to determine the processing behavior
   */
  private handleChainRequestArrival(
    requestParticle: Particle,
    sourceNode: Node,
    targetNode: Node,
    edge: Edge,
    chainId: string
  ): void {
    if (this.state !== 'running') return;
    try {

    // Remove request particle
    this.particleManager.remove(requestParticle.id);

    const chain = this.activeChains.get(chainId);
    if (!chain) return;

    // Add to path
    chain.currentPath.push(targetNode.id);
    chain.edgePath.push(edge.id);

    // Update statuses
    this.callbacks.onNodeStatusChange(sourceNode.id, 'idle');

    // --- Chaos mode: check fault before processing (including parent chain) ---
    const targetFault = this.getNodeFault(targetNode.id);
    const targetParentFault = this.isParentFaulted(targetNode.id);
    if (targetFault === 'down' || this.isNodeIsolated(targetNode.id) || targetParentFault === 'down') {
      // Node is down, isolated, or parent is down — reject 100%
      this.callbacks.onNodeStatusChange(targetNode.id, 'down');
      this.metrics.recordRejection();
      this.metrics.recordResponse(false, Date.now() - chain.startTime);
      this.pushMetricsUpdate();
      simulationEvents.emit(createErrorEvent(targetNode.id, 'node-down', chainId));
      simulationEvents.emit(createStateTransitionEvent(targetNode.id, 'node-down', 'processing', 'down', chainId));
      // Emit error span for tracing
      this.emitSpanStart(targetNode.id, targetNode.type ?? 'default', chainId);
      this.emitSpanEnd(targetNode.id, chainId, true);
      this.sendChainResponse(chainId, targetNode);
      return;
    }

    const effectiveTargetFault = targetFault === 'degraded' ? 'degraded' : targetParentFault === 'degraded' ? 'degraded' : null;
    if (effectiveTargetFault === 'degraded') {
      simulationEvents.emit(createStateTransitionEvent(targetNode.id, 'node-degraded', 'processing', 'degraded', chainId));
    }
    this.callbacks.onNodeStatusChange(targetNode.id, effectiveTargetFault === 'degraded' ? 'degraded' : 'processing');

    // Emit REQUEST_RECEIVED event
    simulationEvents.emit(createRequestReceivedEvent(
      sourceNode.id, targetNode.id, 'GET', chain.requestPath || '/', chainId
    ));

    // Build request context for the handler
    const fullEdge = this.edges.find((e) => e.id === edge.id);
    const chainEdgeData = fullEdge?.data as Record<string, unknown> | undefined;
    const context: RequestContext = {
      chainId,
      originNodeId: chain.originNodeId,
      virtualClientId: chain.virtualClientId,
      startTime: chain.startTime,
      currentPath: chain.currentPath,
      edgePath: chain.edgePath,
      requestPath: chain.requestPath,
      targetPort: (chainEdgeData?.targetPort as number) ?? undefined,
      httpMethod: chain.httpMethod,
      queryType: chain.queryType,
      contentType: chain.contentType,
      payloadSizeBytes: chain.payloadSizeBytes,
      sourceIP: chain.sourceIP,
      cacheHit: chain.cacheHit,
      cacheNodeId: chain.cacheNodeId,
      waitingForDb: chain.waitingForDb,
    };

    let processingDelay = this.getNodeProcessingDelay(targetNode, context);

    // Chaos: degraded nodes (or with degraded parent) have 3x latency and 50% error injection
    if (effectiveTargetFault === 'degraded') {
      processingDelay *= 3;
    }

    // Emit PROCESSING_START event
    simulationEvents.emit(createProcessingStartEvent(targetNode.id, chainId));

    // Emit SPAN_START for distributed tracing (parent span = previous node in chain)
    const nodeType = targetNode.type ?? 'default';
    const previousNodeId = chain.currentPath.length >= 2 ? chain.currentPath[chain.currentPath.length - 2] : undefined;
    const parentSpanId = previousNodeId ? this.getActiveSpanId(previousNodeId, chainId) : undefined;
    this.emitSpanStart(targetNode.id, nodeType, chainId, parentSpanId);

    // Get outgoing edges for this node (filtered by isolation)
    const outgoingEdges = this.isNodeIsolated(targetNode.id)
      ? []
      : this.edges.filter((e) => e.source === targetNode.id);

    // Get handler and decision
    const handler = this.handlerRegistry.getHandler(nodeType);
    let decision = handler.handleRequestArrival(targetNode, context, outgoingEdges, this.nodes);

    // Track database query type metrics
    if (nodeType === 'database') {
      this.metrics.recordDatabaseQuery(context.queryType || 'read');
    }

    // Chaos: degraded nodes have 50% chance of error
    if (targetFault === 'degraded' && Math.random() < 0.5) {
      decision = { action: 'respond', isError: true };
    }

    // Execute decision after processing delay
    setTimeout(() => {
      if (this.state !== 'running') return;

      // Handle special case for cache-miss with database response
      if (decision.action === 'respond' && chain.waitingForDb && chain.cacheNodeId) {
        // After DB responds, store in cache
        const cacheNode = this.nodes.find((n) => n.id === chain.cacheNodeId);
        if (cacheNode) {
          this.callbacks.onNodeStatusChange(targetNode.id, 'success');
          this.callbacks.onNodeStatusChange(cacheNode.id, 'processing');

          // Stocker la valeur dans le cache via le CacheManager
          const cacheKey = `resource:${chain.originNodeId}`;
          this.cacheManager.set(chain.cacheNodeId, cacheKey, `db_response_${Date.now()}`);

          const cacheStoreDelay = this.getNodeProcessingDelay(cacheNode);
          setTimeout(() => {
            if (this.state !== 'running') return;
            this.callbacks.onNodeStatusChange(cacheNode.id, 'success');
            this.sendChainResponse(chainId, targetNode);
          }, cacheStoreDelay);
          return;
        }
      }

      this.executeDecision(decision, targetNode, chainId, context);
    }, processingDelay);
    } catch (error) {
      console.error('[SimulationEngine] Error in handleChainRequestArrival:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Send response back through the chain
   */
  private sendChainResponse(chainId: string, terminalNode: Node, forceError?: boolean): void {
    if (this.state !== 'running') return;

    const chain = this.activeChains.get(chainId);
    if (!chain) return;

    // Determine success/error based on terminal node (forceError overrides for reject cases)
    const isError = forceError ?? this.shouldNodeError(terminalNode);

    // Update terminal node status
    this.callbacks.onNodeStatusChange(terminalNode.id, isError ? 'error' : 'success');

    // Start sending response back through the path
    this.sendResponseHop(chainId, chain.currentPath.length - 1, chain.edgePath.length - 1, isError);
  }

  /**
   * Check if a node should return an error
   */
  private shouldNodeError(node: Node): boolean {
    const data = node.data as { errorRate?: number };
    return data.errorRate ? Math.random() * 100 < data.errorRate : false;
  }

  /**
   * Send a response hop backward through the chain
   */
  private sendResponseHop(
    chainId: string,
    currentNodeIndex: number,
    currentEdgeIndex: number,
    isError: boolean
  ): void {
    if (this.state !== 'running') return;

    const chain = this.activeChains.get(chainId);
    if (!chain || currentEdgeIndex < 0) {
      // Reached the origin - cleanup
      if (chain) {
        const originNode = this.nodes.find((n) => n.id === chain.originNodeId);
        if (originNode) {
          this.callbacks.onNodeStatusChange(originNode.id, isError ? 'error' : 'success');

          // Record final metrics
          const latency = Date.now() - chain.startTime;
          this.metrics.recordResponse(!isError, latency);
          this.pushMetricsUpdate();

          // Emit RESPONSE_RECEIVED event at origin
          const lastServerInPath = chain.currentPath.length > 1 ? chain.currentPath[1] : originNode.id;
          simulationEvents.emit(createResponseReceivedEvent(
            lastServerInPath,
            originNode.id,
            isError ? 500 : 200,
            latency,
            chainId
          ));

          // Record per-server metrics for all servers in the chain
          for (const nodeId of chain.currentPath) {
            if (this.serverStates.has(nodeId)) {
              this.metrics.recordServerResponse(nodeId, !isError, latency);
            }
          }

          // If this was a client group request, mark virtual client as completed
          if (originNode.type === 'client-group' && chain.virtualClientId !== undefined) {
            this.virtualClientManager.recordRequestCompleted(originNode.id, chain.virtualClientId);
          }

          // Reset origin status after delay
          setTimeout(() => {
            if (this.state === 'running') {
              this.callbacks.onNodeStatusChange(originNode.id, 'idle');
            }
          }, 300 / this.speed);
        }
        this.activeChains.delete(chainId);

        // Check if all finite requests have completed
        this.checkCompletion();
      }
      return;
    }

    const currentNodeId = chain.currentPath[currentNodeIndex];
    const previousNodeId = chain.currentPath[currentNodeIndex - 1];
    const edgeId = chain.edgePath[currentEdgeIndex];

    const currentNode = this.nodes.find((n) => n.id === currentNodeId);
    const previousNode = this.nodes.find((n) => n.id === previousNodeId);

    if (!currentNode || !previousNode) return;

    // Create response particle with hierarchical latency
    const hierarchicalLatency = this.getHierarchicalLatency(currentNodeId, previousNodeId);
    const responseDuration = 1500 / this.speed + hierarchicalLatency;
    const particleType: ParticleType = isError ? 'response-error' : 'response-success';

    const particle: Particle = {
      id: generateParticleId(),
      edgeId: edgeId,
      type: particleType,
      direction: 'backward',
      progress: 0,
      duration: responseDuration,
      startTime: Date.now(),
      data: { chainId },
    };

    this.particleManager.add(particle);

    // Emit RESPONSE_SENT event
    simulationEvents.emit(createResponseSentEvent(
      currentNodeId, previousNodeId, edgeId, isError ? 500 : 200, undefined,
      Date.now() - chain.startTime, chainId
    ));

    // Schedule arrival at previous node
    setTimeout(() => {
      if (this.state !== 'running') return;

      // Remove particle
      this.particleManager.remove(particle.id);

      // Appeler handleResponsePassthrough si le handler du nœud courant le supporte
      if (currentNode) {
        const nodeType = currentNode.type ?? 'default';
        const handler = this.handlerRegistry.getHandler(nodeType);
        if (handler.handleResponsePassthrough && chain) {
          const responseContext: RequestContext = {
            chainId,
            originNodeId: chain.originNodeId,
            virtualClientId: chain.virtualClientId,
            startTime: chain.startTime,
            currentPath: chain.currentPath,
            edgePath: chain.edgePath,
            requestPath: chain.requestPath,
            httpMethod: chain.httpMethod,
            queryType: chain.queryType,
            contentType: chain.contentType,
            payloadSizeBytes: chain.payloadSizeBytes,
            sourceIP: chain.sourceIP,
          };
          handler.handleResponsePassthrough(currentNode, responseContext, isError);
        }
      }

      // Update statuses
      this.callbacks.onNodeStatusChange(currentNodeId, 'idle');
      this.callbacks.onNodeStatusChange(previousNodeId, isError ? 'error' : 'success');

      // Continue backward
      this.sendResponseHop(chainId, currentNodeIndex - 1, currentEdgeIndex - 1, isError);
    }, responseDuration);
  }

  // ============================================
  // Stress Testing Methods
  // ============================================

  /**
   * Initialize server states with resource configuration
   */
  private initializeServerStates(): void {
    // Types that should NOT be tracked as resource-consuming servers
    const excludedTypes = new Set([
      'http-client', 'client-group', 'network-zone',
      'api-gateway', 'load-balancer', 'cdn', 'waf',
      'service-discovery', 'dns', 'firewall',
      'circuit-breaker', 'cache', 'message-queue',
    ]);

    const servers = this.nodes.filter((n) => n.type && !excludedTypes.has(n.type as string));

    servers.forEach((server) => {
      const data = server.data as HttpServerNodeDataExtended;
      const resources = data.resources || defaultServerResources;

      this.serverStates.set(server.id, {
        nodeId: server.id,
        resources,
        utilization: ResourceManager.createInitialUtilization(),
        activeRequests: new Map(),
      });
      this.requestQueues.set(server.id, []);
    });
  }

  /**
   * Start all client groups for stress testing
   */
  private startClientGroups(): void {
    const clientGroups = this.nodes.filter((n) => n.type === 'client-group');

    clientGroups.forEach((group) => {
      const data = group.data as ClientGroupNodeData;
      const edges = this.edges.filter((e) => e.source === group.id);

      if (edges.length === 0) return;

      // Initialize the group
      this.virtualClientManager.initializeGroup(group.id, data);

      // Start request scheduling for this group
      this.scheduleGroupRequests(group, edges[0], data);
    });
  }

  /**
   * Schedule requests for a client group
   */
  private scheduleGroupRequests(
    group: Node,
    edge: Edge,
    data: ClientGroupNodeData
  ): void {
    const checkInterval = 50; // Check every 50ms

    const timer = setInterval(() => {
      if (this.state !== 'running') return;

      const activeClients = this.virtualClientManager.getActiveClients(group.id);
      const stats = this.virtualClientManager.getGroupStats(group.id);

      // Update client group stats
      this.callbacks.onClientGroupUpdate?.(
        group.id,
        stats.activeClients,
        stats.totalRequests
      );

      // For each active client, check if they should send a request
      activeClients.forEach((client) => {
        if (this.virtualClientManager.shouldSendRequest(group.id, client.id, data)) {
          this.sendClientGroupRequest(group, edge, data, client.id);
          this.virtualClientManager.recordRequestSent(group.id, client.id);
        }
      });
    }, checkInterval);

    this.clientGroupTimers.set(group.id, timer);
  }

  /**
   * Send a request from a client group
   */
  private sendClientGroupRequest(
    group: Node,
    edge: Edge,
    data: ClientGroupNodeData,
    virtualClientId: number,
    preAcquiredToken?: SimulatedToken
  ): void {
    const targetNode = this.nodes.find((n) => n.id === edge.target);
    if (!targetNode) return;

    // Si pas de token pré-acquis, vérifier si auth requise
    if (!preAcquiredToken) {
      const authResult = this.resolveAuthToken(group, targetNode, virtualClientId);
      if (authResult.needsAsync) {
        // Acquérir un token via l'IdP (async), puis relancer sendClientGroupRequest
        this.acquireToken(group, authResult.idpEdge, authResult.idp, virtualClientId, (token) => {
          this.sendClientGroupRequest(group, edge, data, virtualClientId, token);
        });
        return;
      }
      preAcquiredToken = authResult.token;
    }

    // Check server capacity
    const serverState = this.serverStates.get(targetNode.id);
    if (serverState) {
      const decision = ResourceManager.canAcceptRequest(
        serverState.resources,
        serverState.utilization
      );

      if (decision === 'reject') {
        // Record rejection
        this.metrics.recordRejection();
        this.pushMetricsUpdate();
        simulationEvents.emit(createErrorEvent(targetNode.id, 'capacity', undefined));
        simulationEvents.emit(createHandlerDecisionEvent(
          targetNode.id, targetNode.type ?? 'default', 'reject', 'capacity-reject', { reason: 'capacity' }
        ));
        return;
      }

      if (decision === 'queue') {
        // Add to queue
        const queue = this.requestQueues.get(targetNode.id) || [];
        const queuedRequestId = generateParticleId();
        queue.push({
          id: queuedRequestId,
          clientGroupId: group.id,
          virtualClientId,
          queuedAt: Date.now(),
          edgeId: edge.id,
          sourceNode: group,
        });
        this.requestQueues.set(targetNode.id, queue);
        serverState.utilization.queuedRequests = queue.length;
        this.metrics.recordQueued(queue.length);
        // Emit QUEUE_ENTER event
        simulationEvents.emit(createQueueEnterEvent(targetNode.id, queuedRequestId, queue.length));
        return;
      }
    }

    // Update group status
    this.callbacks.onNodeStatusChange(group.id, 'processing');

    // Record metric
    this.metrics.recordRequestSent();
    this.pushMetricsUpdate();

    // Select request type (method + path) from distribution or defaults
    const reqType = this.selectRequestType(data);

    // Create a request chain for tracking
    const chainId = generateParticleId();

    // Create request event (enriched with full context)
    const event = createRequestSentEvent(
      group.id,
      edge.target,
      edge.id,
      reqType.method,
      reqType.path,
      reqType.body,
      chainId,
      {
        queryType: deriveQueryType(reqType.method),
        contentType: inferContentType(reqType.path),
        payloadSizeBytes: estimatePayloadSize(reqType.method),
        sourceIP: generateSourceIP(virtualClientId),
        virtualClientId,
        authToken: preAcquiredToken ? {
          tokenId: preAcquiredToken.tokenId,
          format: preAcquiredToken.format,
          issuerId: preAcquiredToken.idpId,
        } : undefined,
      }
    );
    simulationEvents.emit(event);
    const chain: RequestChain = {
      id: chainId,
      originNodeId: group.id,
      currentPath: [group.id],
      edgePath: [],
      virtualClientId,
      startTime: Date.now(),
      requestPath: reqType.path,
      httpMethod: reqType.method,
      queryType: deriveQueryType(reqType.method),
      contentType: inferContentType(reqType.path),
      payloadSizeBytes: estimatePayloadSize(reqType.method),
      sourceIP: generateSourceIP(virtualClientId),
    };
    // Attacher le token si disponible
    if (preAcquiredToken) {
      chain.authToken = {
        tokenId: preAcquiredToken.tokenId,
        format: preAcquiredToken.format,
        issuerId: preAcquiredToken.idpId,
        issuedAt: preAcquiredToken.issuedAt,
        expiresAt: preAcquiredToken.expiresAt,
      };
    }
    this.activeChains.set(chainId, chain);

    // Create request particle with client group info and chain
    const requestDuration = 2000 / this.speed;
    const particle: Particle = {
      id: generateParticleId(),
      edgeId: edge.id,
      type: 'request',
      direction: 'forward',
      progress: 0,
      duration: requestDuration,
      startTime: Date.now(),
      data: {
        clientGroupId: group.id,
        virtualClientId,
        chainId,
        authenticated: !!preAcquiredToken,
      },
    };

    this.particleManager.add(particle);

    // Track active request on server
    if (serverState) {
      serverState.activeRequests.set(particle.id, {
        id: particle.id,
        startedAt: Date.now(),
        estimatedCompletion: Date.now() + requestDuration,
      });
      serverState.utilization.activeConnections = serverState.activeRequests.size;
    }

    // Schedule request arrival
    setTimeout(() => {
      this.handleClientGroupRequestArrival(particle, group, targetNode, edge, virtualClientId, chainId);
    }, requestDuration);
  }

  /**
   * Handle client group request arrival at server (with chain support)
   */
  private handleClientGroupRequestArrival(
    requestParticle: Particle,
    clientGroup: Node,
    server: Node,
    edge: Edge,
    virtualClientId: number,
    chainId: string
  ): void {
    if (this.state !== 'running') return;

    // Remove request particle
    this.particleManager.remove(requestParticle.id);

    // Update chain path
    const chain = this.activeChains.get(chainId);
    if (chain) {
      chain.currentPath.push(server.id);
      chain.edgePath.push(edge.id);
    }

    // Update statuses
    this.callbacks.onNodeStatusChange(clientGroup.id, 'idle');
    this.callbacks.onNodeStatusChange(server.id, 'processing');

    const serverState = this.serverStates.get(server.id);

    // Build minimal context for processing delay calculation
    const edgeData = edge.data as Record<string, unknown> | undefined;
    const context: RequestContext = {
      chainId,
      originNodeId: chain?.originNodeId || clientGroup.id,
      virtualClientId,
      startTime: chain?.startTime || Date.now(),
      currentPath: chain?.currentPath || [server.id],
      edgePath: chain?.edgePath || [edge.id],
      requestPath: chain?.requestPath,
      targetPort: (edgeData?.targetPort as number) ?? undefined,
      httpMethod: chain?.httpMethod,
      queryType: chain?.queryType,
      contentType: chain?.contentType,
      payloadSizeBytes: chain?.payloadSizeBytes,
      sourceIP: chain?.sourceIP,
      authToken: chain?.authToken,
    };

    // Calculate processing delay
    let processingDelay = this.getNodeProcessingDelay(server, context);

    // Callback pour continuer le flow normal après validation (ou sans validation)
    const continueClientGroupFlow = () => {
      if (this.state !== 'running') return;

      if (serverState && server.type === 'http-server') {
        const serverData = server.data as HttpServerNodeData;
        const extendedData = server.data as HttpServerNodeDataExtended;
        const degradation = extendedData.degradation || defaultDegradation;

        processingDelay = ResourceManager.calculateDegradedLatency(
          serverData.responseDelay || 100,
          serverState.utilization,
          degradation
        ) / this.speed;
      }

      // Check if this node has outgoing edges
      const outgoingEdges = this.edges.filter((e) => e.source === server.id);

      setTimeout(() => {
        if (this.state !== 'running') return;

        // Remove from active requests
        if (serverState) {
          serverState.activeRequests.delete(requestParticle.id);
          serverState.utilization.activeConnections = serverState.activeRequests.size;
          this.processQueuedRequest(server.id);
        }

        if (outgoingEdges.length > 0) {
          // Forward to downstream nodes
          this.forwardRequest(server, outgoingEdges, chainId);
        } else {
          // Terminal node - send response back
          this.sendChainResponseWithVirtualClient(chainId, server, virtualClientId);
        }
      }, processingDelay);
    };

    // Validation du token via IdP connecté à la gateway (Issue #52)
    if (server.type === 'api-gateway' && context.authToken) {
      const gwData = server.data as ApiGatewayNodeData;
      if (gwData.authType !== 'none') {
        const gwIdp = this.findConnectedIdP(server.id);
        if (gwIdp) {
          this.validateTokenViaIdP(server, gwIdp.node, gwIdp.edge, chainId, context,
            continueClientGroupFlow,
            () => {
              if (serverState) {
                serverState.activeRequests.delete(requestParticle.id);
                serverState.utilization.activeConnections = serverState.activeRequests.size;
              }
              this.metrics.recordRejection();
              this.metrics.recordResponse(false, Date.now() - (chain?.startTime || Date.now()));
              this.pushMetricsUpdate();
              this.sendChainResponseWithVirtualClient(chainId, server, virtualClientId);
            }
          );
          return;
        }
      }
    }

    // Pas de validation IdP nécessaire — continuer directement
    continueClientGroupFlow();
  }

  /**
   * Send chain response with virtual client tracking
   */
  private sendChainResponseWithVirtualClient(
    chainId: string,
    terminalNode: Node,
    virtualClientId: number
  ): void {
    if (this.state !== 'running') return;

    const chain = this.activeChains.get(chainId);
    if (!chain) return;

    // Store virtual client info in chain for response handling
    chain.virtualClientId = virtualClientId;

    // Use regular chain response
    this.sendChainResponse(chainId, terminalNode);
  }

  /**
   * Process the next queued request for a server
   */
  private processQueuedRequest(serverId: string): void {
    const queue = this.requestQueues.get(serverId);
    const serverState = this.serverStates.get(serverId);

    if (!queue || queue.length === 0 || !serverState) return;

    // Check if server can accept more requests
    if (serverState.activeRequests.size >= serverState.resources.connections.maxConcurrent) {
      return;
    }

    // Dequeue the oldest request
    const queuedRequest = queue.shift();
    if (!queuedRequest) return;

    serverState.utilization.queuedRequests = queue.length;

    // Record queue time
    const waitTime = Date.now() - queuedRequest.queuedAt;
    this.metrics.recordDequeued(waitTime);
    // Emit QUEUE_EXIT event
    simulationEvents.emit(createQueueExitEvent(serverId, queuedRequest.id, waitTime, queue.length));

    // Find the edge and send the request
    const edge = this.edges.find((e) => e.id === queuedRequest.edgeId);
    const server = this.nodes.find((n) => n.id === serverId);

    if (edge && server && queuedRequest.clientGroupId) {
      const groupData = queuedRequest.sourceNode.data as ClientGroupNodeData;
      this.sendClientGroupRequest(
        queuedRequest.sourceNode,
        edge,
        groupData,
        queuedRequest.virtualClientId || 0
      );
    }
  }

  /**
   * Start periodic time-series snapshot capture (every 5 seconds).
   */
  private startTimeSeriesCapture(): void {
    this.timeSeriesInterval = setInterval(() => {
      if (this.state !== 'running') return;

      // Build resource utilization map for snapshot
      const resourceUtils = new Map<string, { cpu: number; memory: number }>();
      this.serverStates.forEach((state, nodeId) => {
        resourceUtils.set(nodeId, {
          cpu: state.utilization.cpu,
          memory: state.utilization.memory,
        });
      });

      const snapshot = this.metrics.captureSnapshot(resourceUtils);
      this.callbacks.onTimeSeriesSnapshot?.(snapshot);
    }, 5000);
  }

  /** Get all captured time-series snapshots. */
  getTimeSeries(): import('@/types').TimeSeriesSnapshot[] {
    return this.metrics.getTimeSeries();
  }

  /**
   * Start periodic extended metrics push (every 1s) for percentiles, rejections, etc.
   */
  private startExtendedMetricsPush(): void {
    this.extendedMetricsInterval = setInterval(() => {
      if (this.state !== 'running') return;
      this.callbacks.onExtendedMetricsUpdate?.(this.metrics.getExtendedMetrics());
    }, 1000);
  }

  /**
   * Start periodic resource sampling
   */
  private startResourceSampling(): void {
    this.resourceSamplingInterval = setInterval(() => {
      if (this.state !== 'running') return;

      // Sample HTTP server resources
      this.serverStates.forEach((state, nodeId) => {
        const queue = this.requestQueues.get(nodeId) || [];

        // Calculate current utilization
        const utilization = ResourceManager.calculateUtilization(
          state.resources,
          state.activeRequests.size,
          queue.length,
          this.metrics.getMetrics().requestsPerSecond
        );

        // Enrich with per-server throughput and error rate
        const serverMetrics = this.metrics.getServerMetrics(nodeId);
        utilization.throughput = serverMetrics.throughput;
        utilization.errorRate = serverMetrics.errorRate;

        state.utilization = utilization;

        // Notify callback
        this.callbacks.onResourceUpdate?.(nodeId, utilization);

        // Record sample for metrics
        this.metrics.recordResourceSample({
          timestamp: Date.now(),
          nodeId,
          cpu: utilization.cpu,
          memory: utilization.memory,
          network: utilization.network,
          disk: utilization.disk,
          activeConnections: utilization.activeConnections,
          queuedRequests: utilization.queuedRequests,
        });
      });

      // Sample Message Queue stats (tick visibility timeouts + collect metrics)
      const messageQueueNodes = this.nodes.filter((n) => n.type === 'message-queue');
      messageQueueNodes.forEach((node) => {
        // Tick: check visibility timeouts, handle retries and DLQ
        this.messageQueueHandler.tick(node.id);

        const stats = this.messageQueueHandler.getStats(node.id);
        if (stats && this.callbacks.onMessageQueueUpdate) {
          const metrics = this.metrics.getMetrics();
          const elapsedSeconds = metrics.startTime ? (Date.now() - metrics.startTime) / 1000 : 1;
          const throughput = elapsedSeconds > 0 ? stats.messagesConsumed / elapsedSeconds : 0;

          const utilization: MessageQueueUtilization = {
            queueDepth: stats.queueDepth,
            messagesPublished: stats.messagesPublished,
            messagesConsumed: stats.messagesConsumed,
            messagesDeadLettered: stats.messagesDeadLettered,
            avgProcessingTime: stats.avgProcessingTime,
            throughput,
            messagesInFlight: stats.messagesInFlight,
            messagesRetried: stats.messagesRetried,
          };

          this.callbacks.onMessageQueueUpdate(node.id, utilization);
        }
      });

      // Sample API Gateway stats
      const apiGatewayNodes = this.nodes.filter((n) => n.type === 'api-gateway');
      apiGatewayNodes.forEach((node) => {
        const stats = this.apiGatewayHandler.getStats(node.id);
        if (stats && this.callbacks.onApiGatewayUpdate) {
          const utilization: ApiGatewayUtilization = {
            totalRequests: stats.totalRequests,
            blockedRequests: stats.blockedRequests,
            authFailures: stats.authFailures,
            rateLimitHits: stats.rateLimitHits,
            avgLatency: 0,
            activeConnections: stats.activeRequests,
          };
          this.callbacks.onApiGatewayUpdate(node.id, utilization);
        }
      });

      // Cleanup orphaned chains (TTL: 30s)
      const chainTTL = 30000;
      const now = Date.now();
      this.activeChains.forEach((chain, chainId) => {
        if (now - chain.startTime > chainTTL) {
          this.activeChains.delete(chainId);
        }
      });

      // Bottleneck analysis every 1s (every 10 ticks)
      this.bottleneckTickCounter++;
      if (this.bottleneckTickCounter % 10 === 0 && this.callbacks.onBottleneckUpdate) {
        // Collecter les stats multi-composant
        const apiGatewayStats = new Map<string, { totalRequests: number; blockedRequests: number; rateLimitHits: number; authFailures: number }>();
        this.nodes.filter((n) => n.type === 'api-gateway').forEach((n) => {
          const s = this.apiGatewayHandler.getStats(n.id);
          if (s) apiGatewayStats.set(n.id, s);
        });

        const messageQueueStats = new Map<string, { queueDepth: number; messagesPublished: number; messagesConsumed: number; messagesDeadLettered: number; avgProcessingTime: number }>();
        this.nodes.filter((n) => n.type === 'message-queue').forEach((n) => {
          const s = this.messageQueueHandler.getStats(n.id);
          if (s) messageQueueStats.set(n.id, s);
        });

        const databaseStats = new Map<string, { activeConnections: number; connectionPoolUsage: number; queriesPerSecond: number; avgQueryTime: number }>();
        this.nodes.filter((n) => n.type === 'database').forEach((n) => {
          const u = this.databaseHandler.getUtilization(n.id);
          if (u) databaseStats.set(n.id, u);
        });

        const circuitBreakerStats = new Map<string, { state: string; failureCount: number }>();
        this.nodes.filter((n) => n.type === 'circuit-breaker').forEach((n) => {
          const s = this.circuitBreakerHandler.getNodeState(n.id);
          if (s) circuitBreakerStats.set(n.id, s);
        });

        const loadBalancerStats = new Map<string, { totalRequests: number; unhealthyBackends: number; totalBackends: number }>();
        this.nodes.filter((n) => n.type === 'load-balancer').forEach((n) => {
          const u = this.loadBalancerManager.getUtilization(n.id);
          if (u) {
            const unhealthy = u.backends.filter((b) => !b.healthy).length;
            loadBalancerStats.set(n.id, { totalRequests: u.totalRequests, unhealthyBackends: unhealthy, totalBackends: u.backends.length });
          }
        });

        const cacheStats = new Map<string, { hitCount: number; missCount: number; hitRatio: number }>();
        this.nodes.filter((n) => n.type === 'cache').forEach((n) => {
          const u = this.cacheManager.getUtilization(n.id);
          if (u) cacheStats.set(n.id, { hitCount: u.hitCount, missCount: u.missCount, hitRatio: u.hitRatio });
        });

        const analysis = this.bottleneckAnalyzer.analyze({
          serverStates: this.serverStates,
          perServerMetrics: this.metrics.getAllServerMetrics(),
          resourceHistory: this.metrics.getResourceHistory(),
          edges: this.edges,
          nodes: this.nodes,
          criticalPathAnalyzer,
          apiGatewayStats,
          messageQueueStats,
          databaseStats,
          circuitBreakerStats,
          loadBalancerStats,
          cacheStats,
        });
        this.callbacks.onBottleneckUpdate(analysis);
      }
    }, 100); // Sample every 100ms
  }
}
