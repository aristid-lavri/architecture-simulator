import type { GraphNode, GraphEdge } from '@/types/graph';
import type {
  Particle,
  SimulationState,
  ResourceUtilization,
  MessageQueueUtilization,
  ApiGatewayUtilization,
  IdentityProviderNodeData,
  ApiGatewayNodeData,
  HttpClientNodeData,
} from '@/types';
import {
  generateParticleId,
  createRequestSentEvent,
  createRequestReceivedEvent,
  createProcessingStartEvent,
  createStateTransitionEvent,
  createErrorEvent,
  simulationEvents,
} from './events';
import { MetricsCollector } from './metrics';
import { VirtualClientManager } from './VirtualClientManager';
import { LoadBalancerManager } from './LoadBalancerManager';
import { CacheManager } from './CacheManager';
import { DatabaseManager } from './DatabaseManager';
import { ParticleManager } from './ParticleManager';
import { getParticleChainId } from '@/types';
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
} from './handlers';
import { HierarchicalResourceManager } from './HierarchicalResourceManager';
import { TokenStore, type SimulatedToken } from './TokenStore';
import { criticalPathAnalyzer } from './CriticalPathAnalyzer';
import { BottleneckAnalyzer } from './BottleneckAnalyzer';
import type { BottleneckAnalysis } from '@/types';
import { pluginRegistry } from '@/plugins';
import { ServerStateManager } from './ServerStateManager';
import { RequestChainManager, type RequestChain } from './RequestChainManager';
import { RequestDispatcher } from './RequestDispatcher';
import { ClientGroupSimulator } from './ClientGroupSimulator';

/**
 * Callbacks fournis par la couche React pour recevoir les mises a jour du moteur.
 * Le moteur ne modifie jamais les stores directement — il notifie via ces callbacks.
 */
interface SimulationCallbacks {
  onStateChange: (state: SimulationState) => void;
  onAddParticle: (particle: Particle) => void;
  onRemoveParticle: (particleId: string) => void;
  onBatchUpdateProgress: (updates: Map<string, number>) => void;
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

/**
 * Derives queryType from httpMethod.
 */
function deriveQueryType(method?: string): 'read' | 'write' | 'transaction' {
  if (!method || method === 'GET') return 'read';
  return 'write';
}

/**
 * Infers contentType from request path.
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
  return 1024;
}

/**
 * Generate a pseudo-random IP.
 */
function generateSourceIP(): string {
  return `10.0.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 255) + 1}`;
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
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private state: SimulationState = 'idle';
  private speed: number = 1;
  private callbacks: SimulationCallbacks;
  private metrics: MetricsCollector;

  // Animation
  private particleManager: ParticleManager;

  // HTTP client timers (loop mode)
  private clientTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  // Time-series and extended metrics intervals
  private timeSeriesInterval: ReturnType<typeof setInterval> | null = null;
  private extendedMetricsInterval: ReturnType<typeof setInterval> | null = null;

  // Throttled metrics update
  private lastMetricsUpdateTime: number = 0;
  private metricsUpdateTimer: ReturnType<typeof setTimeout> | null = null;

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

  // Token store for authentication flow
  private tokenStore: TokenStore = new TokenStore();

  // Bottleneck analysis
  private bottleneckAnalyzer: BottleneckAnalyzer = new BottleneckAnalyzer();

  // Chaos mode — fault provider callback
  private faultProvider: (() => { faults: Map<string, 'down' | 'degraded'>; isolated: Set<string> }) | null = null;

  // O(1) node lookup map — rebuilt on setNodesAndEdges
  private nodeMap: Map<string, GraphNode> = new Map();

  // Sub-modules
  private serverStateManager: ServerStateManager;
  private chainManager: RequestChainManager;
  private dispatcher: RequestDispatcher;
  private clientGroupSimulator: ClientGroupSimulator;
  private virtualClientManager: VirtualClientManager = new VirtualClientManager();

  constructor(callbacks: SimulationCallbacks) {
    this.callbacks = callbacks;
    this.metrics = new MetricsCollector();
    this.particleManager = new ParticleManager({
      onAddParticle: callbacks.onAddParticle,
      onRemoveParticle: callbacks.onRemoveParticle,
      onBatchUpdateProgress: callbacks.onBatchUpdateProgress,
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

    // Initialize sub-modules
    this.serverStateManager = new ServerStateManager(
      this.metrics,
      {
        onResourceUpdate: callbacks.onResourceUpdate,
        onMessageQueueUpdate: callbacks.onMessageQueueUpdate,
        onApiGatewayUpdate: callbacks.onApiGatewayUpdate,
        onBottleneckUpdate: callbacks.onBottleneckUpdate,
        onSendQueuedRequest: (sourceNode, edge, data, virtualClientId) => {
          this.clientGroupSimulator.sendClientGroupRequest(sourceNode, edge, data, virtualClientId);
        },
      },
      this.messageQueueHandler,
      this.apiGatewayHandler,
      this.databaseHandler,
      this.circuitBreakerHandler,
      this.loadBalancerManager,
      this.cacheManager,
      this.bottleneckAnalyzer,
    );

    this.chainManager = new RequestChainManager(
      this.metrics,
      {
        onNodeStatusChange: callbacks.onNodeStatusChange,
        onMetricsUpdate: () => this.pushMetricsUpdate(),
        onSimulationComplete: callbacks.onSimulationComplete,
        onChainCompleted: () => this.chainManager.checkCompletion(),
      },
      this.particleManager,
      this.virtualClientManager,
      () => this.state,
      (sourceId, targetId) => this.getHierarchicalLatency(sourceId, targetId),
      (nodeType) => this.handlerRegistry.getHandler(nodeType),
      (nodeId) => this.serverStateManager.serverStates.has(nodeId),
      () => this.particleManager.getCount(),
      () => this.clientTimers.size,
      () => this.clientGroupSimulator.getClientGroupTimers().size,
    );

    this.dispatcher = new RequestDispatcher(
      this.metrics,
      {
        onNodeStatusChange: callbacks.onNodeStatusChange,
        onMetricsUpdate: () => this.pushMetricsUpdate(),
        onError: callbacks.onError,
      },
      this.particleManager,
      this.chainManager,
      this.serverStateManager,
      this.cacheManager,
      () => this.state,
      (nodeType) => this.handlerRegistry.getHandler(nodeType),
      (node, context) => this.getNodeProcessingDelay(node, context),
      (sourceId, targetId) => this.getHierarchicalLatency(sourceId, targetId),
      (nodeId) => this.getNodeFault(nodeId),
      (nodeId) => this.isNodeIsolated(nodeId),
      (nodeId) => this.isParentFaulted(nodeId),
      (nodeId) => this.findConnectedIdP(nodeId),
      (gateway, idpNode, idpEdge, chainId, context, onValid, onInvalid) =>
        this.validateTokenViaIdP(gateway, idpNode, idpEdge, chainId, context, onValid, onInvalid),
    );

    this.clientGroupSimulator = new ClientGroupSimulator(
      this.metrics,
      {
        onNodeStatusChange: callbacks.onNodeStatusChange,
        onClientGroupUpdate: callbacks.onClientGroupUpdate,
        onMetricsUpdate: () => this.pushMetricsUpdate(),
      },
      this.particleManager,
      this.virtualClientManager,
      this.chainManager,
      this.serverStateManager,
      this.dispatcher,
      this.tokenStore,
      () => this.state,
      (node, context) => this.getNodeProcessingDelay(node, context),
      (client, targetNode, virtualClientId) => this.resolveAuthToken(client, targetNode, virtualClientId),
      (client, idpEdge, idpNode, virtualClientId, callback) =>
        this.acquireToken(client, idpEdge, idpNode, virtualClientId, callback),
      (gateway, idpNode, idpEdge, chainId, context, onValid, onInvalid) =>
        this.validateTokenViaIdP(gateway, idpNode, idpEdge, chainId, context, onValid, onInvalid),
      (nodeId) => this.findConnectedIdP(nodeId),
    );
  }

  // ============================================================
  // Fault injection helpers
  // ============================================================

  /** Configure le provider de fault injections. */
  setFaultProvider(provider: (() => { faults: Map<string, 'down' | 'degraded'>; isolated: Set<string> }) | null): void {
    this.faultProvider = provider;
  }

  private getNodeFault(nodeId: string): 'down' | 'degraded' | null {
    if (!this.faultProvider) return null;
    const { faults } = this.faultProvider();
    return faults.get(nodeId) ?? null;
  }

  private isNodeIsolated(nodeId: string): boolean {
    if (!this.faultProvider) return false;
    const { isolated } = this.faultProvider();
    if (isolated.has(nodeId)) return true;
    const node = this.nodeMap.get(nodeId);
    if (!node) return false;
    let currentId: string | undefined = node.parentId;
    while (currentId) {
      if (isolated.has(currentId)) return true;
      const parent = this.nodeMap.get(currentId);
      if (!parent) return false;
      currentId = parent.parentId;
    }
    return false;
  }

  private isParentFaulted(nodeId: string): 'down' | 'degraded' | null {
    const node = this.nodeMap.get(nodeId);
    if (!node) return null;
    let currentId: string | undefined = node.parentId;
    while (currentId) {
      const fault = this.getNodeFault(currentId);
      if (fault) return fault;
      if (this.isNodeIsolated(currentId)) return 'down';
      const parent = this.nodeMap.get(currentId);
      if (!parent) return null;
      currentId = parent.parentId;
    }
    return null;
  }

  // ============================================================
  // Hierarchical latency helpers
  // ============================================================

  private getHierarchicalLatency(sourceId: string, targetId: string): number {
    if (sourceId === targetId) return 0;
    const sourceContainer = this.hierarchicalResourceManager.findContainingContainer(sourceId);
    const targetContainer = this.hierarchicalResourceManager.findContainingContainer(targetId);
    if (sourceContainer && sourceContainer === targetContainer) return 0.05 / this.speed;
    const sourceServer = this.hierarchicalResourceManager.findContainingServer(sourceId);
    const targetServer = this.hierarchicalResourceManager.findContainingServer(targetId);
    if (sourceServer && sourceServer === targetServer) return 0.1 / this.speed;
    const sourceZoneId = this.hierarchicalResourceManager.findContainingZone(sourceId);
    const targetZoneId = this.hierarchicalResourceManager.findContainingZone(targetId);
    if (sourceZoneId && sourceZoneId === targetZoneId) return (1 + Math.random() * 4) / this.speed;
    if (sourceZoneId && targetZoneId && sourceZoneId !== targetZoneId) {
      const sourceZone = this.nodeMap.get(sourceZoneId);
      if (sourceZone) {
        const zoneData = sourceZone.data as { interZoneLatency?: number };
        return (zoneData.interZoneLatency || 10) / this.speed;
      }
    }
    return 5 / this.speed;
  }

  private getNodeProcessingDelay(node: GraphNode, context?: RequestContext): number {
    const nodeType = node.type ?? 'default';
    const handler = this.handlerRegistry.getHandler(nodeType);
    return handler.getProcessingDelay(node, this.speed, context);
  }

  // ============================================================
  // Authentication helpers
  // ============================================================

  private findConnectedIdP(nodeId: string): { node: GraphNode; edge: GraphEdge } | null {
    const edges = this.edges.filter((e) => e.source === nodeId);
    for (const edge of edges) {
      const target = this.nodeMap.get(edge.target);
      if (target && target.type === 'identity-provider') {
        return { node: target, edge };
      }
    }
    return null;
  }

  private createAutoToken(clientId: string): SimulatedToken {
    const token: SimulatedToken = {
      tokenId: `auto_${generateParticleId()}`,
      clientId,
      idpId: 'auto',
      format: 'jwt',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
    };
    this.tokenStore.storeToken(token);
    return token;
  }

  private resolveAuthToken(
    client: GraphNode,
    targetNode: GraphNode,
    virtualClientId: number | undefined
  ): { needsAsync: false; token?: SimulatedToken } | { needsAsync: true; idp: GraphNode; idpEdge: GraphEdge } {
    if (targetNode.type !== 'api-gateway') return { needsAsync: false };
    const gwData = targetNode.data as ApiGatewayNodeData;
    if (gwData.authType === 'none') return { needsAsync: false };
    const idp = this.findConnectedIdP(client.id);
    if (!idp) {
      const token = this.tokenStore.getValidToken(client.id, 'auto', virtualClientId)
        || this.createAutoToken(client.id);
      return { needsAsync: false, token };
    }
    const existingToken = this.tokenStore.getValidToken(client.id, idp.node.id, virtualClientId);
    if (existingToken) return { needsAsync: false, token: existingToken };
    return { needsAsync: true, idp: idp.node, idpEdge: idp.edge };
  }

  private acquireToken(
    client: GraphNode,
    idpEdge: GraphEdge,
    idpNode: GraphNode,
    virtualClientId: number | undefined,
    callback: (token: SimulatedToken) => void
  ): void {
    const idpData = idpNode.data as IdentityProviderNodeData;
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
          setTimeout(() => { this.particleManager.remove(errParticle.id); }, errParticle.duration);
          this.metrics.recordRejection();
          this.metrics.recordResponse(false, Date.now() - context.startTime);
          this.pushMetricsUpdate();
          return;
        }

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

  private validateTokenViaIdP(
    gateway: GraphNode,
    idpNode: GraphNode,
    idpEdge: GraphEdge,
    chainId: string,
    context: RequestContext,
    onValid: () => void,
    onInvalid: () => void
  ): void {
    if (context.authToken && this.tokenStore.isValidated(gateway.id, context.authToken.tokenId)) {
      onValid();
      return;
    }
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

      const idpHandler = this.handlerRegistry.getHandler('identity-provider');
      const processingDelay = idpHandler.getProcessingDelay(idpNode, this.speed, context);
      this.callbacks.onNodeStatusChange(idpNode.id, 'processing');

      setTimeout(() => {
        if (this.state !== 'running') return;
        const idpDecision = idpHandler.handleRequestArrival(idpNode, context, [], this.nodes);
        const isValid = idpDecision.action !== 'reject';
        this.callbacks.onNodeStatusChange(idpNode.id, 'idle');

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

  // ============================================================
  // Metrics helpers
  // ============================================================

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

  private flushMetricsUpdate(): void {
    if (this.metricsUpdateTimer) {
      clearTimeout(this.metricsUpdateTimer);
      this.metricsUpdateTimer = null;
    }
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());
    this.lastMetricsUpdateTime = Date.now();
  }

  // ============================================================
  // Public lifecycle API
  // ============================================================

  /** Met a jour le graphe de noeuds et aretes utilise par la simulation. */
  setNodesAndEdges(nodes: GraphNode[], edges: GraphEdge[]): void {
    this.nodes = nodes;
    this.edges = edges;
    // Build O(1) lookup map
    this.nodeMap.clear();
    for (const node of nodes) {
      this.nodeMap.set(node.id, node);
    }
    this.serverStateManager.setNodesAndEdges(nodes, edges);
    this.chainManager.setNodesAndEdges(nodes, edges, this.nodeMap);
    this.dispatcher.setNodesAndEdges(nodes, edges, this.nodeMap);
    this.clientGroupSimulator.setNodesAndEdges(nodes, edges, this.nodeMap);
  }

  /** Ajuste la vitesse de simulation. */
  setSpeed(speed: number): void {
    this.speed = Math.max(0.5, Math.min(4, speed));
    this.chainManager.setSpeed(this.speed);
    this.dispatcher.setSpeed(this.speed);
    this.clientGroupSimulator.setSpeed(this.speed);
  }

  /** Retourne l'etat courant. */
  getState(): SimulationState {
    return this.state;
  }

  /**
   * Demarre la simulation.
   */
  start(): void {
    if (this.state === 'running') return;

    this.state = 'running';
    this.callbacks.onStateChange('running');
    this.metrics.start();

    this.hierarchicalResourceManager.initialize(this.nodes);

    const nodeLabels = new Map<string, string>();
    for (const node of this.nodes) {
      const label = (node.data as { label?: string }).label || node.id.split('-')[0];
      nodeLabels.set(node.id, label);
    }
    criticalPathAnalyzer.start(nodeLabels);

    this.handlerRegistry.initializeAll(this.nodes);

    for (const hooks of pluginRegistry.getEngineHooks()) {
      hooks.onSimulationStart?.();
    }

    this.serverStateManager.initializeServerStates();
    this.startHttpClients();
    this.clientGroupSimulator.startClientGroups();
    this.serverStateManager.startResourceSampling(
      () => this.state,
      this.chainManager.activeChains,
      this.speed,
    );
    this.startTimeSeriesCapture();
    this.startExtendedMetricsPush();
    this.particleManager.startAnimationLoop(() => this.state);
  }

  /** Met en pause la simulation. */
  pause(): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.callbacks.onStateChange('paused');
    this.particleManager.stopAnimationLoop();
  }

  /** Reprend la simulation apres une pause. */
  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.callbacks.onStateChange('running');
    this.particleManager.startAnimationLoop(() => this.state);
  }

  /**
   * Arrete completement la simulation.
   */
  stop(): void {
    this.state = 'idle';
    this.callbacks.onStateChange('idle');

    this.clientTimers.forEach((timer) => clearInterval(timer));
    this.clientTimers.clear();

    this.clientGroupSimulator.stop();
    this.virtualClientManager.cleanupAll();

    this.serverStateManager.stopResourceSampling();

    if (this.timeSeriesInterval) {
      clearInterval(this.timeSeriesInterval);
      this.timeSeriesInterval = null;
    }
    if (this.extendedMetricsInterval) {
      clearInterval(this.extendedMetricsInterval);
      this.extendedMetricsInterval = null;
    }

    this.serverStateManager.clear();
    this.chainManager.clear();
    this.dispatcher.clearSpans();
    this.tokenStore.clear();

    criticalPathAnalyzer.stop();

    const nodeIds = this.nodes.map((n) => n.id);
    this.handlerRegistry.cleanupAll(nodeIds);

    for (const hooks of pluginRegistry.getEngineHooks()) {
      hooks.onSimulationStop?.();
    }

    this.particleManager.stopAnimationLoop();
    this.particleManager.clearAll();

    this.nodes.forEach((node) => {
      this.callbacks.onNodeStatusChange(node.id, 'idle');
    });

    this.flushMetricsUpdate();

    if (this.metricsUpdateTimer) {
      clearTimeout(this.metricsUpdateTimer);
      this.metricsUpdateTimer = null;
    }

    this.metrics.reset();
  }

  /** Reinitialise la simulation (alias de stop). */
  reset(): void {
    this.stop();
  }

  // ============================================================
  // HTTP client handling
  // ============================================================

  private startHttpClients(): void {
    const httpClients = this.nodes.filter((node) => node.type === 'http-client');

    httpClients.forEach((client) => {
      const data = client.data as unknown as HttpClientNodeData;
      const connectedEdges = this.edges.filter((edge) => edge.source === client.id);
      if (connectedEdges.length === 0) return;

      this.sendRequest(client, connectedEdges[0]);

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

  private sendRequest(client: GraphNode, edge: GraphEdge, preAcquiredToken?: SimulatedToken): void {
    const data = client.data as unknown as HttpClientNodeData;
    const targetNode = this.nodeMap.get(edge.target);
    if (!targetNode) return;

    if (!preAcquiredToken) {
      const authResult = this.resolveAuthToken(client, targetNode, undefined);
      if (authResult.needsAsync) {
        this.acquireToken(client, authResult.idpEdge, authResult.idp, undefined, (token) => {
          this.sendRequest(client, edge, token);
        });
        return;
      }
      preAcquiredToken = authResult.token;
    }

    this.callbacks.onNodeStatusChange(client.id, 'processing');
    this.metrics.recordRequestSent();
    this.pushMetricsUpdate();

    const chainId = generateParticleId();

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

    const requestDuration = 2000 / this.speed;
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
      this.chainManager.createChain(chain);
    }

    this.particleManager.add(particle);

    setTimeout(() => {
      this.handleRequestArrival(particle, client, targetNode, edge);
    }, requestDuration);
  }

  private handleRequestArrival(
    requestParticle: Particle,
    client: GraphNode,
    server: GraphNode,
    edge: GraphEdge
  ): void {
    if (this.state !== 'running') return;
    try {
      this.particleManager.remove(requestParticle.id);

      const chainId = getParticleChainId(requestParticle) || generateParticleId();
      let chain = this.chainManager.getChain(chainId);

      if (!chain) {
        const clientData = client.data as unknown as HttpClientNodeData;
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
        this.chainManager.createChain(chain);
      }

      chain.currentPath.push(server.id);
      chain.edgePath.push(edge.id);

      this.callbacks.onNodeStatusChange(client.id, 'idle');

      // Chaos mode checks
      const serverFault = this.getNodeFault(server.id);
      const parentFault = this.isParentFaulted(server.id);
      if (serverFault === 'down' || this.isNodeIsolated(server.id) || parentFault === 'down') {
        this.callbacks.onNodeStatusChange(server.id, 'down');
        this.metrics.recordRejection();
        this.metrics.recordResponse(false, Date.now() - chain.startTime);
        this.pushMetricsUpdate();
        simulationEvents.emit(createErrorEvent(server.id, 'node-down', chainId));
        simulationEvents.emit(createStateTransitionEvent(server.id, 'node-down', 'processing', 'down', chainId));
        this.dispatcher.emitSpanStart(server.id, server.type ?? 'default', chainId);
        this.dispatcher.emitSpanEnd(server.id, chainId, true);
        this.chainManager.sendChainResponse(chainId, server);
        return;
      }

      const effectiveFault = serverFault === 'degraded' ? 'degraded' : parentFault === 'degraded' ? 'degraded' : null;
      if (effectiveFault === 'degraded') {
        simulationEvents.emit(createStateTransitionEvent(server.id, 'node-degraded', 'processing', 'degraded', chainId));
      }
      this.callbacks.onNodeStatusChange(server.id, effectiveFault === 'degraded' ? 'degraded' : 'processing');

      const clientData = client.data as unknown as HttpClientNodeData;
      simulationEvents.emit(createRequestReceivedEvent(
        client.id, server.id, clientData.method, clientData.path, chainId
      ));

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

      let processingDelay = this.getNodeProcessingDelay(server, context);
      if (effectiveFault === 'degraded') processingDelay *= 3;

      const continueGatewayFlow = () => {
        if (this.state !== 'running') return;

        simulationEvents.emit(createProcessingStartEvent(server.id, chainId));

        const nodeType = server.type ?? 'default';
        this.dispatcher.emitSpanStart(server.id, nodeType, chainId);

        const handler = this.handlerRegistry.getHandler(nodeType);
        let decision = handler.handleRequestArrival(server, context, outgoingEdges, this.nodes);

        if (nodeType === 'database') {
          this.metrics.recordDatabaseQuery(context.queryType || 'read');
        }

        if (serverFault === 'degraded' && Math.random() < 0.5) {
          decision = { action: 'respond', isError: true };
        }

        setTimeout(() => {
          if (this.state !== 'running') return;
          this.dispatcher.executeDecision(decision, server, chainId, context);
        }, processingDelay);
      };

      if (server.type === 'api-gateway' && context.authToken) {
        const gwData = server.data as ApiGatewayNodeData;
        if (gwData.authType !== 'none') {
          const gwIdp = this.findConnectedIdP(server.id);
          if (gwIdp) {
            this.validateTokenViaIdP(server, gwIdp.node, gwIdp.edge, chainId, context,
              continueGatewayFlow,
              () => {
                this.dispatcher.executeDecision({ action: 'reject', reason: 'token-invalid' }, server, chainId, context);
              }
            );
            return;
          }
        }
      }

      continueGatewayFlow();
    } catch (error) {
      console.error('[SimulationEngine] Error in handleRequestArrival:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ============================================================
  // Time-series and extended metrics
  // ============================================================

  private startTimeSeriesCapture(): void {
    this.timeSeriesInterval = setInterval(() => {
      if (this.state !== 'running') return;
      const resourceUtils = new Map<string, { cpu: number; memory: number }>();
      this.serverStateManager.serverStates.forEach((state, nodeId) => {
        resourceUtils.set(nodeId, { cpu: state.utilization.cpu, memory: state.utilization.memory });
      });
      const snapshot = this.metrics.captureSnapshot(resourceUtils);
      this.callbacks.onTimeSeriesSnapshot?.(snapshot);
    }, 5000);
  }

  private startExtendedMetricsPush(): void {
    this.extendedMetricsInterval = setInterval(() => {
      if (this.state !== 'running') return;
      this.callbacks.onExtendedMetricsUpdate?.(this.metrics.getExtendedMetrics());
    }, 1000);
  }

  // ============================================================
  // Public data accessors
  // ============================================================

  /** Retourne les metriques finales. */
  getFinalMetrics(): {
    metrics: ReturnType<MetricsCollector['getMetrics']>;
    extendedMetrics: ReturnType<MetricsCollector['getExtendedMetrics']>;
  } {
    return {
      metrics: this.metrics.getMetrics(),
      extendedMetrics: this.metrics.getExtendedMetrics(),
    };
  }

  /** Retourne toutes les donnees enrichies pour le rapport final. */
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

  /** Get all captured time-series snapshots. */
  getTimeSeries(): import('@/types').TimeSeriesSnapshot[] {
    return this.metrics.getTimeSeries();
  }

  /** Retourne les noeuds en defaut (faulted). Utilise par le chaos mode. */
  setFaultedNodes(_faultedNodes: Map<string, 'down' | 'degraded'>): void {
    // Legacy method — fault state is now read via faultProvider
    // Keep this as a no-op to maintain public interface compatibility
  }
}
