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
  createErrorEvent,
  simulationEvents,
} from './events';
import { MetricsCollector } from './metrics';
import { ResourceManager } from './ResourceManager';
import { VirtualClientManager } from './VirtualClientManager';
import { LoadBalancerManager } from './LoadBalancerManager';
import { CacheManager } from './CacheManager';
import { DatabaseManager } from './DatabaseManager';
import { ParticleManager } from './ParticleManager';
import { defaultServerResources, defaultDegradation } from '@/types';
import {
  HandlerRegistry,
  DefaultHandler,
  LoadBalancerHandler,
  CacheHandler,
  HttpServerHandler,
  ApiGatewayHandler,
  DatabaseHandler,
  MessageQueueHandler,
  type RequestContext,
  type RequestDecision,
} from './handlers';

/**
 * Callbacks fournis par la couche React pour recevoir les mises a jour du moteur.
 * Le moteur ne modifie jamais les stores directement — il notifie via ces callbacks.
 */
interface SimulationCallbacks {
  onStateChange: (state: SimulationState) => void;
  onAddParticle: (particle: Particle) => void;
  onRemoveParticle: (particleId: string) => void;
  onUpdateParticle: (particleId: string, updates: Partial<Particle>) => void;
  onNodeStatusChange: (nodeId: string, status: 'idle' | 'processing' | 'success' | 'error') => void;
  onMetricsUpdate: (metrics: ReturnType<MetricsCollector['getMetrics']>) => void;
  onResourceUpdate?: (nodeId: string, utilization: ResourceUtilization) => void;
  onClientGroupUpdate?: (groupId: string, activeClients: number, requestsSent: number) => void;
  onMessageQueueUpdate?: (nodeId: string, utilization: MessageQueueUtilization) => void;
  onError?: (error: Error) => void;
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
  // Cache-aside pattern tracking
  cacheHit?: boolean;             // True si cache hit, false si miss
  cacheNodeId?: string;           // ID du cache pour stockage après DB
  waitingForDb?: boolean;         // True si on attend la réponse DB après cache miss
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

  // Handler infrastructure
  private handlerRegistry: HandlerRegistry;
  private loadBalancerManager: LoadBalancerManager;
  private cacheManager: CacheManager;
  private databaseManager: DatabaseManager;
  private loadBalancerHandler: LoadBalancerHandler;
  private cacheHandler: CacheHandler;
  private httpServerHandler: HttpServerHandler;
  private messageQueueHandler: MessageQueueHandler;

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

    // Initialize handlers
    this.loadBalancerHandler = new LoadBalancerHandler(this.loadBalancerManager);
    this.cacheHandler = new CacheHandler(this.cacheManager);
    this.httpServerHandler = new HttpServerHandler();
    this.messageQueueHandler = new MessageQueueHandler();

    // Initialize handler registry
    this.handlerRegistry = new HandlerRegistry();
    this.handlerRegistry.setDefaultHandler(new DefaultHandler());
    this.handlerRegistry.registerAll([
      this.loadBalancerHandler,
      this.cacheHandler,
      this.httpServerHandler,
      new ApiGatewayHandler(),
      new DatabaseHandler(this.databaseManager),
      this.messageQueueHandler,
    ]);
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

    // Initialize handlers for all nodes
    this.handlerRegistry.initializeAll(this.nodes);

    // Initialize server states for stress testing
    this.initializeServerStates();

    // Start all HTTP clients
    this.startHttpClients();

    // Start client groups for stress testing
    this.startClientGroups();

    // Start resource sampling
    this.startResourceSampling();

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

    // Clear request queues and chains
    this.requestQueues.clear();
    this.serverStates.clear();
    this.activeChains.clear();

    // Cleanup handlers
    const nodeIds = this.nodes.map((n) => n.id);
    this.handlerRegistry.cleanupAll(nodeIds);

    // Stop animation and clear particles
    this.particleManager.stopAnimationLoop();
    this.particleManager.clearAll();

    // Reset node states
    this.nodes.forEach((node) => {
      this.callbacks.onNodeStatusChange(node.id, 'idle');
    });

    // Reset metrics
    this.metrics.reset();
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());
  }

  /** Reinitialise la simulation (alias de stop). */
  reset(): void {
    this.stop();
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

  private sendRequest(client: Node, edge: Edge): void {
    const data = client.data as HttpClientNodeData;
    const targetNode = this.nodes.find((n) => n.id === edge.target);

    if (!targetNode) {
      return;
    }

    // Update client status
    this.callbacks.onNodeStatusChange(client.id, 'processing');

    // Record metric
    this.metrics.recordRequestSent();
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());

    // Create request event
    const event = createRequestSentEvent(
      client.id,
      edge.target,
      edge.id,
      data.method,
      data.path
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
    };

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
    const chainId = requestParticle.data?.chainId as string || generateParticleId();
    let chain = this.activeChains.get(chainId);

    if (!chain) {
      // Get the path from the client node data
      const clientData = client.data as HttpClientNodeData;
      chain = {
        id: chainId,
        originNodeId: client.id,
        currentPath: [client.id],
        edgePath: [],
        startTime: Date.now(),
        requestPath: clientData.path,
      };
      this.activeChains.set(chainId, chain);
    }

    // Add current node and edge to path
    chain.currentPath.push(server.id);
    chain.edgePath.push(edge.id);

    // Update statuses
    this.callbacks.onNodeStatusChange(client.id, 'idle');
    this.callbacks.onNodeStatusChange(server.id, 'processing');

    // Emit REQUEST_RECEIVED event
    const clientData = client.data as HttpClientNodeData;
    simulationEvents.emit(createRequestReceivedEvent(
      client.id, server.id, clientData.method, clientData.path
    ));

    // Use handler pattern for consistent behavior
    const processingDelay = this.getNodeProcessingDelay(server);
    const outgoingEdges = this.edges.filter((e) => e.source === server.id);

    // Build request context for the handler
    const context: RequestContext = {
      chainId,
      originNodeId: chain.originNodeId,
      virtualClientId: chain.virtualClientId,
      startTime: chain.startTime,
      currentPath: chain.currentPath,
      edgePath: chain.edgePath,
      requestPath: chain.requestPath,
      cacheHit: chain.cacheHit,
      cacheNodeId: chain.cacheNodeId,
      waitingForDb: chain.waitingForDb,
    };

    // Emit PROCESSING_START event
    simulationEvents.emit(createProcessingStartEvent(server.id));

    // Get handler and decision
    const nodeType = server.type ?? 'default';
    const handler = this.handlerRegistry.getHandler(nodeType);
    const decision = handler.handleRequestArrival(server, context, outgoingEdges, this.nodes);

    // Execute decision after processing delay
    setTimeout(() => {
      if (this.state !== 'running') return;
      this.executeDecision(decision, server, chainId, context);
    }, processingDelay);
    } catch (error) {
      console.error('[SimulationEngine] Error in handleRequestArrival:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get processing delay for a node based on its type
   * Delegates to the appropriate handler
   */
  private getNodeProcessingDelay(node: Node): number {
    const nodeType = node.type ?? 'default';
    const handler = this.handlerRegistry.getHandler(nodeType);
    return handler.getProcessingDelay(node, this.speed);
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
      cacheHit: chain.cacheHit,
      cacheNodeId: chain.cacheNodeId,
      waitingForDb: chain.waitingForDb,
    };

    // Get handler decision
    const nodeType = sourceNode.type ?? 'default';
    const handler = this.handlerRegistry.getHandler(nodeType);
    const decision = handler.handleRequestArrival(sourceNode, context, outgoingEdges, this.nodes);

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
    simulationEvents.emit(createProcessingEndEvent(sourceNode.id));

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

          const requestDuration = (target.delay ?? 1500) / this.speed;
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
        this.metrics.recordRejection();
        this.callbacks.onMetricsUpdate(this.metrics.getMetrics());
        this.callbacks.onNodeStatusChange(sourceNode.id, 'error');
        simulationEvents.emit(createErrorEvent(sourceNode.id, decision.reason || 'rejected'));
        this.sendChainResponse(chainId, sourceNode);
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
    this.callbacks.onNodeStatusChange(targetNode.id, 'processing');

    // Emit REQUEST_RECEIVED event
    simulationEvents.emit(createRequestReceivedEvent(
      sourceNode.id, targetNode.id, 'GET', chain.requestPath || '/'
    ));

    const processingDelay = this.getNodeProcessingDelay(targetNode);

    // Build request context for the handler
    const context: RequestContext = {
      chainId,
      originNodeId: chain.originNodeId,
      virtualClientId: chain.virtualClientId,
      startTime: chain.startTime,
      currentPath: chain.currentPath,
      edgePath: chain.edgePath,
      requestPath: chain.requestPath,
      cacheHit: chain.cacheHit,
      cacheNodeId: chain.cacheNodeId,
      waitingForDb: chain.waitingForDb,
    };

    // Emit PROCESSING_START event
    simulationEvents.emit(createProcessingStartEvent(targetNode.id));

    // Get outgoing edges for this node
    const outgoingEdges = this.edges.filter((e) => e.source === targetNode.id);

    // Get handler and decision
    const nodeType = targetNode.type ?? 'default';
    const handler = this.handlerRegistry.getHandler(nodeType);
    const decision = handler.handleRequestArrival(targetNode, context, outgoingEdges, this.nodes);

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
  private sendChainResponse(chainId: string, terminalNode: Node): void {
    if (this.state !== 'running') return;

    const chain = this.activeChains.get(chainId);
    if (!chain) return;

    // Determine success/error based on terminal node
    const isError = this.shouldNodeError(terminalNode);

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
          this.callbacks.onMetricsUpdate(this.metrics.getMetrics());

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
      }
      return;
    }

    const currentNodeId = chain.currentPath[currentNodeIndex];
    const previousNodeId = chain.currentPath[currentNodeIndex - 1];
    const edgeId = chain.edgePath[currentEdgeIndex];

    const currentNode = this.nodes.find((n) => n.id === currentNodeId);
    const previousNode = this.nodes.find((n) => n.id === previousNodeId);

    if (!currentNode || !previousNode) return;

    // Create response particle
    const responseDuration = 1500 / this.speed;
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
      Date.now() - chain.startTime
    ));

    // Schedule arrival at previous node
    setTimeout(() => {
      if (this.state !== 'running') return;

      // Remove particle
      this.particleManager.remove(particle.id);

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
    const servers = this.nodes.filter((n) => n.type === 'http-server');

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
    virtualClientId: number
  ): void {
    const targetNode = this.nodes.find((n) => n.id === edge.target);
    if (!targetNode) return;

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
        this.callbacks.onMetricsUpdate(this.metrics.getMetrics());
        simulationEvents.emit(createErrorEvent(targetNode.id, 'capacity'));
        return;
      }

      if (decision === 'queue') {
        // Add to queue
        const queue = this.requestQueues.get(targetNode.id) || [];
        queue.push({
          id: generateParticleId(),
          clientGroupId: group.id,
          virtualClientId,
          queuedAt: Date.now(),
          edgeId: edge.id,
          sourceNode: group,
        });
        this.requestQueues.set(targetNode.id, queue);
        serverState.utilization.queuedRequests = queue.length;
        this.metrics.recordQueued(queue.length);
        return;
      }
    }

    // Update group status
    this.callbacks.onNodeStatusChange(group.id, 'processing');

    // Record metric
    this.metrics.recordRequestSent();
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());

    // Select a random path from the paths array, or use the default path
    const selectedPath = this.selectRandomPath(data);

    // Create request event
    const event = createRequestSentEvent(
      group.id,
      edge.target,
      edge.id,
      data.method,
      selectedPath
    );
    simulationEvents.emit(event);

    // Create a request chain for tracking
    const chainId = generateParticleId();
    const chain: RequestChain = {
      id: chainId,
      originNodeId: group.id,
      currentPath: [group.id],
      edgePath: [],
      virtualClientId,
      startTime: Date.now(),
      requestPath: selectedPath,
    };
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

    // Calculate processing delay
    let processingDelay = this.getNodeProcessingDelay(server);

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

      // Sample Message Queue stats
      const messageQueueNodes = this.nodes.filter((n) => n.type === 'message-queue');
      messageQueueNodes.forEach((node) => {
        const stats = this.messageQueueHandler.getStats(node.id);
        if (stats && this.callbacks.onMessageQueueUpdate) {
          const data = node.data as MessageQueueNodeData;
          const metrics = this.metrics.getMetrics();
          const elapsedSeconds = metrics.startTime ? (Date.now() - metrics.startTime) / 1000 : 1;
          const throughput = elapsedSeconds > 0 ? stats.messagesConsumed / elapsedSeconds : 0;

          const utilization: MessageQueueUtilization = {
            queueDepth: stats.queueDepth,
            messagesPublished: stats.messagesPublished,
            messagesConsumed: stats.messagesConsumed,
            messagesDeadLettered: stats.messagesDeadLettered,
            avgProcessingTime: data.performance.publishLatencyMs + data.performance.consumeLatencyMs,
            throughput,
          };

          this.callbacks.onMessageQueueUpdate(node.id, utilization);
        }
      });
    }, 100); // Sample every 100ms
  }
}
