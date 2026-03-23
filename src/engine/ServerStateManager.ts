import type { GraphNode, GraphEdge } from '@/types/graph';
import type {
  ServerResources,
  ResourceUtilization,
  ClientGroupNodeData,
  HttpServerNodeData as HttpServerNodeDataExtended,
  MessageQueueUtilization,
  ApiGatewayUtilization,
} from '@/types';
import { defaultServerResources } from '@/types';
import { ResourceManager } from './ResourceManager';
import {
  createQueueEnterEvent,
  createQueueExitEvent,
  createResourceSnapshotEvent,
  simulationEvents,
} from './events';
import type { MetricsCollector } from './metrics';
import type { MessageQueueHandler } from './handlers/MessageQueueHandler';
import type { ApiGatewayHandler } from './handlers/ApiGatewayHandler';
import type { DatabaseHandler } from './handlers/DatabaseHandler';
import type { CircuitBreakerHandler } from './handlers/CircuitBreakerHandler';
import type { LoadBalancerManager } from './LoadBalancerManager';
import type { CacheManager } from './CacheManager';
import type { BottleneckAnalyzer } from './BottleneckAnalyzer';
import { criticalPathAnalyzer } from './CriticalPathAnalyzer';
import { generateParticleId } from './events';

/** Etat interne d'un serveur HTTP pendant la simulation (ressources, utilisation, requetes actives). */
export interface ServerState {
  nodeId: string;
  resources: ServerResources;
  utilization: ResourceUtilization;
  activeRequests: Map<string, ActiveRequest>;
}

/** Requete en cours de traitement sur un serveur. */
export interface ActiveRequest {
  id: string;
  startedAt: number;
  estimatedCompletion: number;
}

/** Requete en file d'attente lorsque le serveur est a capacite maximale. */
export interface QueuedRequest {
  id: string;
  clientGroupId?: string;
  virtualClientId?: number;
  queuedAt: number;
  edgeId: string;
  sourceNode: GraphNode;
}

/**
 * Callbacks dont le ServerStateManager a besoin pour declencher des actions externes.
 */
export interface ServerStateCallbacks {
  onResourceUpdate?: (nodeId: string, utilization: ResourceUtilization) => void;
  onMessageQueueUpdate?: (nodeId: string, utilization: MessageQueueUtilization) => void;
  onApiGatewayUpdate?: (nodeId: string, utilization: ApiGatewayUtilization) => void;
  onBottleneckUpdate?: (analysis: import('@/types').BottleneckAnalysis) => void;
  /** Envoie une requete dequeued (appele par processQueuedRequest). */
  onSendQueuedRequest: (sourceNode: GraphNode, edge: GraphEdge, data: ClientGroupNodeData, virtualClientId: number) => void;
}

/**
 * Gere les etats des serveurs, les files d'attente de requetes et l'echantillonnage des ressources.
 *
 * Responsabilites :
 * - `serverStates` Map et `requestQueues` Map
 * - `initializeServerStates()`, `processQueuedRequest()`
 * - `startResourceSampling()` (boucle 100ms)
 * - Bottleneck analysis
 */
export class ServerStateManager {
  readonly serverStates: Map<string, ServerState> = new Map();
  readonly requestQueues: Map<string, QueuedRequest[]> = new Map();

  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private metrics: MetricsCollector;
  private callbacks: ServerStateCallbacks;
  private resourceSamplingInterval: ReturnType<typeof setInterval> | null = null;
  private bottleneckTickCounter: number = 0;

  // Cached node lists by type — rebuilt on setNodesAndEdges
  private nodesByType: Map<string, GraphNode[]> = new Map();

  // Handlers and managers needed for resource sampling
  private messageQueueHandler: MessageQueueHandler;
  private apiGatewayHandler: ApiGatewayHandler;
  private databaseHandler: DatabaseHandler;
  private circuitBreakerHandler: CircuitBreakerHandler;
  private loadBalancerManager: LoadBalancerManager;
  private cacheManager: CacheManager;
  private bottleneckAnalyzer: BottleneckAnalyzer;

  constructor(
    metrics: MetricsCollector,
    callbacks: ServerStateCallbacks,
    messageQueueHandler: MessageQueueHandler,
    apiGatewayHandler: ApiGatewayHandler,
    databaseHandler: DatabaseHandler,
    circuitBreakerHandler: CircuitBreakerHandler,
    loadBalancerManager: LoadBalancerManager,
    cacheManager: CacheManager,
    bottleneckAnalyzer: BottleneckAnalyzer,
  ) {
    this.metrics = metrics;
    this.callbacks = callbacks;
    this.messageQueueHandler = messageQueueHandler;
    this.apiGatewayHandler = apiGatewayHandler;
    this.databaseHandler = databaseHandler;
    this.circuitBreakerHandler = circuitBreakerHandler;
    this.loadBalancerManager = loadBalancerManager;
    this.cacheManager = cacheManager;
    this.bottleneckAnalyzer = bottleneckAnalyzer;
  }

  /** Met a jour le graphe (appele par l'engine quand setNodesAndEdges est appele). */
  setNodesAndEdges(nodes: GraphNode[], edges: GraphEdge[]): void {
    this.nodes = nodes;
    this.edges = edges;
    // Rebuild type-indexed cache for O(1) lookup during sampling
    this.nodesByType.clear();
    for (const node of nodes) {
      const type = node.type ?? 'default';
      let list = this.nodesByType.get(type);
      if (!list) { list = []; this.nodesByType.set(type, list); }
      list.push(node);
    }
  }

  /**
   * Initialise les etats serveurs avec la configuration de ressources.
   * Doit etre appele au debut de chaque simulation.
   */
  initializeServerStates(): void {
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
   * Traite la prochaine requete en file d'attente pour un serveur.
   * Appele apres qu'une requete active se termine.
   */
  processQueuedRequest(serverId: string): void {
    const queue = this.requestQueues.get(serverId);
    const serverState = this.serverStates.get(serverId);

    if (!queue || queue.length === 0 || !serverState) return;

    if (serverState.activeRequests.size >= serverState.resources.connections.maxConcurrent) {
      return;
    }

    const queuedRequest = queue.shift();
    if (!queuedRequest) return;

    serverState.utilization.queuedRequests = queue.length;

    const waitTime = Date.now() - queuedRequest.queuedAt;
    this.metrics.recordDequeued(waitTime);
    simulationEvents.emit(createQueueExitEvent(serverId, queuedRequest.id, waitTime, queue.length));

    const edge = this.edges.find((e) => e.id === queuedRequest.edgeId);

    if (edge && queuedRequest.clientGroupId) {
      const groupData = queuedRequest.sourceNode.data as ClientGroupNodeData;
      this.callbacks.onSendQueuedRequest(
        queuedRequest.sourceNode,
        edge,
        groupData,
        queuedRequest.virtualClientId || 0,
      );
    }
  }

  /**
   * Enregistre une requete en file d'attente pour un noeud.
   * Retourne l'ID de la requete enregistree, ou null si impossible.
   */
  enqueueRequest(
    serverId: string,
    sourceNode: GraphNode,
    edgeId: string,
    clientGroupId: string,
    virtualClientId: number,
  ): string | null {
    const serverState = this.serverStates.get(serverId);
    if (!serverState) return null;

    const queue = this.requestQueues.get(serverId) || [];
    const queuedRequestId = generateParticleId();
    queue.push({
      id: queuedRequestId,
      clientGroupId,
      virtualClientId,
      queuedAt: Date.now(),
      edgeId,
      sourceNode,
    });
    this.requestQueues.set(serverId, queue);
    serverState.utilization.queuedRequests = queue.length;
    this.metrics.recordQueued(queue.length);
    simulationEvents.emit(createQueueEnterEvent(serverId, queuedRequestId, queue.length));
    return queuedRequestId;
  }

  /**
   * Emet un RESOURCE_SNAPSHOT pour un noeud (utilise depuis executeDecision).
   */
  emitResourceSnapshot(sourceNodeId: string, chainId: string): void {
    const serverState = this.serverStates.get(sourceNodeId);
    if (!serverState) return;
    const queue = this.requestQueues.get(sourceNodeId) || [];
    const serverMetrics = this.metrics.getServerMetrics(sourceNodeId);
    simulationEvents.emit(createResourceSnapshotEvent(sourceNodeId, chainId, {
      cpu: serverState.utilization.cpu,
      memory: serverState.utilization.memory,
      activeConnections: serverState.utilization.activeConnections,
      queuedRequests: queue.length,
      throughput: serverMetrics.throughput,
      errorRate: serverMetrics.errorRate,
    }));
  }

  /**
   * Demarre la boucle d'echantillonnage des ressources (100ms).
   * Egalement responsable du tick MQ, stats API GW, cleanup des chaines orphelines
   * et de l'analyse bottleneck.
   */
  startResourceSampling(
    getState: () => string,
    activeChains: Map<string, { startTime: number }>,
    speed: number,
  ): void {
    // Adaptive sampling: scale interval with server count to reduce overhead
    const serverCount = this.serverStates.size;
    const samplingInterval = serverCount > 50 ? 500 : serverCount > 20 ? 200 : 100;
    this.resourceSamplingInterval = setInterval(() => {
      if (getState() !== 'running') return;

      // Sample HTTP server resources
      this.serverStates.forEach((state, nodeId) => {
        const queue = this.requestQueues.get(nodeId) || [];

        const utilization = ResourceManager.calculateUtilization(
          state.resources,
          state.activeRequests.size,
          queue.length,
          this.metrics.getMetrics().requestsPerSecond
        );

        const serverMetrics = this.metrics.getServerMetrics(nodeId);
        utilization.throughput = serverMetrics.throughput;
        utilization.errorRate = serverMetrics.errorRate;

        const prev = state.utilization;
        state.utilization = utilization;

        // Only push to React if values changed meaningfully (>1% delta)
        const changed = !prev
          || Math.abs(utilization.cpu - prev.cpu) > 1
          || Math.abs(utilization.memory - prev.memory) > 1
          || utilization.activeConnections !== prev.activeConnections
          || utilization.queuedRequests !== prev.queuedRequests;
        if (changed) {
          this.callbacks.onResourceUpdate?.(nodeId, utilization);
        }

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

      // Sample Message Queue stats
      const messageQueueNodes = (this.nodesByType.get('message-queue') || []);
      messageQueueNodes.forEach((node) => {
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
      const apiGatewayNodes = (this.nodesByType.get('api-gateway') || []);
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
      activeChains.forEach((chain, chainId) => {
        if (now - chain.startTime > chainTTL) {
          activeChains.delete(chainId);
        }
      });

      // Bottleneck analysis every 1s (every 10 ticks)
      this.bottleneckTickCounter++;
      if (this.bottleneckTickCounter % 10 === 0 && this.callbacks.onBottleneckUpdate) {
        const apiGatewayStats = new Map<string, { totalRequests: number; blockedRequests: number; rateLimitHits: number; authFailures: number }>();
        (this.nodesByType.get('api-gateway') || []).forEach((n) => {
          const s = this.apiGatewayHandler.getStats(n.id);
          if (s) apiGatewayStats.set(n.id, s);
        });

        const messageQueueStats = new Map<string, { queueDepth: number; messagesPublished: number; messagesConsumed: number; messagesDeadLettered: number; avgProcessingTime: number }>();
        (this.nodesByType.get('message-queue') || []).forEach((n) => {
          const s = this.messageQueueHandler.getStats(n.id);
          if (s) messageQueueStats.set(n.id, s);
        });

        const databaseStats = new Map<string, { activeConnections: number; connectionPoolUsage: number; queriesPerSecond: number; avgQueryTime: number }>();
        (this.nodesByType.get('database') || []).forEach((n) => {
          const u = this.databaseHandler.getUtilization(n.id);
          if (u) databaseStats.set(n.id, u);
        });

        const circuitBreakerStats = new Map<string, { state: string; failureCount: number }>();
        (this.nodesByType.get('circuit-breaker') || []).forEach((n) => {
          const s = this.circuitBreakerHandler.getNodeState(n.id);
          if (s) circuitBreakerStats.set(n.id, s);
        });

        const loadBalancerStats = new Map<string, { totalRequests: number; unhealthyBackends: number; totalBackends: number }>();
        (this.nodesByType.get('load-balancer') || []).forEach((n) => {
          const u = this.loadBalancerManager.getUtilization(n.id);
          if (u) {
            const unhealthy = u.backends.filter((b) => !b.healthy).length;
            loadBalancerStats.set(n.id, { totalRequests: u.totalRequests, unhealthyBackends: unhealthy, totalBackends: u.backends.length });
          }
        });

        const cacheStats = new Map<string, { hitCount: number; missCount: number; hitRatio: number }>();
        (this.nodesByType.get('cache') || []).forEach((n) => {
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
    }, samplingInterval);
  }

  /** Arrete l'echantillonnage des ressources. */
  stopResourceSampling(): void {
    if (this.resourceSamplingInterval) {
      clearInterval(this.resourceSamplingInterval);
      this.resourceSamplingInterval = null;
    }
  }

  /** Reinitialise toutes les donnees. */
  clear(): void {
    this.serverStates.clear();
    this.requestQueues.clear();
    this.bottleneckTickCounter = 0;
  }
}
