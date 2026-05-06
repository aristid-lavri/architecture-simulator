import type { GraphNode, GraphEdge } from '@/types/graph';
import type { Particle, ClientGroupNodeData } from '@/types';
import type { MetricsCollector } from './metrics';
import { ParticleManager } from './ParticleManager';
import { VirtualClientManager } from './VirtualClientManager';
import { ResourceManager } from './ResourceManager';
import {
  generateParticleId,
  createRequestSentEvent,
  createErrorEvent,
  createHandlerDecisionEvent,
  createStateTransitionEvent,
  simulationEvents,
} from './events';
import type { RequestChainManager, RequestChain } from './RequestChainManager';
import type { ServerStateManager } from './ServerStateManager';
import type { RequestDispatcher } from './RequestDispatcher';
import type { TokenStore, SimulatedToken } from './TokenStore';
import type {
  HttpServerNodeData,
  ApiGatewayNodeData,
} from '@/types';
import { defaultDegradation } from '@/types';

/** Derive queryType from httpMethod. */
function deriveQueryType(method?: string): 'read' | 'write' | 'transaction' {
  if (!method || method === 'GET') return 'read';
  return 'write';
}

/** Infer contentType from request path. */
function inferContentType(path?: string): 'static' | 'dynamic' | 'user-specific' {
  if (!path) return 'dynamic';
  if (path.startsWith('/static') || /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(path)) return 'static';
  if (path.startsWith('/api') || path.startsWith('/graphql')) return 'dynamic';
  return 'user-specific';
}

/** Default payload size estimates based on HTTP method. */
function estimatePayloadSize(method?: string): number {
  if (!method || method === 'GET' || method === 'DELETE') return 0;
  return 1024;
}

/** Generate a pseudo-random IP for a virtual client. */
function generateSourceIP(virtualClientId?: number): string {
  if (virtualClientId != null) {
    const octet3 = Math.floor(virtualClientId / 256) % 256;
    const octet4 = virtualClientId % 256;
    return `10.0.${octet3}.${octet4 || 1}`;
  }
  return `10.0.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 255) + 1}`;
}

/**
 * Callbacks dont le ClientGroupSimulator a besoin.
 */
export interface ClientGroupSimulatorCallbacks {
  onNodeStatusChange: (nodeId: string, status: import('@/types').NodeStatus) => void;
  onClientGroupUpdate?: (groupId: string, activeClients: number, requestsSent: number) => void;
  onMetricsUpdate: () => void;
}

/**
 * État d'authentification par client virtuel (Task 22).
 *
 * Pendant qu'un client virtuel acquiert un token, ses requêtes data sont
 * mises en queue pour être drainées (en parallèle) une fois le token reçu.
 */
interface PendingDataRequest {
  group: GraphNode;
  edge: GraphEdge;
  data: ClientGroupNodeData;
  virtualClientId: number;
}

interface VirtualClientAuthState {
  status: 'idle' | 'authenticating' | 'authenticated';
  pendingRequests: PendingDataRequest[];
  token?: SimulatedToken;
}

/**
 * Gere le stress testing avec les groupes de clients virtuels.
 *
 * Responsabilites :
 * - `startClientGroups()`, `scheduleGroupRequests()`
 * - `sendClientGroupRequest()`, `handleClientGroupRequestArrival()`
 * - Gestion des reponses virtuelles
 */
export class ClientGroupSimulator {
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private nodeMap: Map<string, GraphNode> = new Map();
  private speed: number = 1;
  private metrics: MetricsCollector;
  private callbacks: ClientGroupSimulatorCallbacks;
  private particleManager: ParticleManager;
  private virtualClientManager: VirtualClientManager;
  private chainManager: RequestChainManager;
  private serverStateManager: ServerStateManager;
  private dispatcher: RequestDispatcher;
  private tokenStore: TokenStore;
  private clientGroupTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  /**
   * État d'auth par client virtuel (clé = `${groupId}:${virtualClientId}`).
   * Permet de queuer les requêtes pendant l'acquisition du token, puis de
   * draîner la queue en parallèle quand le token arrive (Task 22).
   */
  private authStateByVirtualClient: Map<string, VirtualClientAuthState> = new Map();
  private getState: () => string;
  private getNodeProcessingDelay: (node: GraphNode, context?: import('./handlers/types').RequestContext) => number;
  private resolveAuthToken: (
    client: GraphNode,
    targetNode: GraphNode,
    virtualClientId: number | undefined
  ) => { needsAsync: false; token?: SimulatedToken } | { needsAsync: true; idp: GraphNode; idpEdge: GraphEdge };
  private acquireToken: (
    client: GraphNode,
    idpEdge: GraphEdge,
    idpNode: GraphNode,
    virtualClientId: number | undefined,
    callback: (token: SimulatedToken | null) => void
  ) => void;
  private validateTokenViaIdP: (
    gateway: GraphNode,
    idpNode: GraphNode,
    idpEdge: GraphEdge,
    chainId: string,
    context: import('./handlers/types').RequestContext,
    onValid: () => void,
    onInvalid: () => void
  ) => void;
  private findConnectedIdP: (nodeId: string) => { node: GraphNode; edge: GraphEdge } | null;
  private getNodeFault: (nodeId: string) => 'down' | 'degraded' | null;
  private isNodeIsolated: (nodeId: string) => boolean;
  private isParentFaulted: (nodeId: string) => 'down' | 'degraded' | null;

  constructor(
    metrics: MetricsCollector,
    callbacks: ClientGroupSimulatorCallbacks,
    particleManager: ParticleManager,
    virtualClientManager: VirtualClientManager,
    chainManager: RequestChainManager,
    serverStateManager: ServerStateManager,
    dispatcher: RequestDispatcher,
    tokenStore: TokenStore,
    getState: () => string,
    getNodeProcessingDelay: (node: GraphNode, context?: import('./handlers/types').RequestContext) => number,
    resolveAuthToken: (
      client: GraphNode,
      targetNode: GraphNode,
      virtualClientId: number | undefined
    ) => { needsAsync: false; token?: SimulatedToken } | { needsAsync: true; idp: GraphNode; idpEdge: GraphEdge },
    acquireToken: (
      client: GraphNode,
      idpEdge: GraphEdge,
      idpNode: GraphNode,
      virtualClientId: number | undefined,
      callback: (token: SimulatedToken | null) => void
    ) => void,
    validateTokenViaIdP: (
      gateway: GraphNode,
      idpNode: GraphNode,
      idpEdge: GraphEdge,
      chainId: string,
      context: import('./handlers/types').RequestContext,
      onValid: () => void,
      onInvalid: () => void
    ) => void,
    findConnectedIdP: (nodeId: string) => { node: GraphNode; edge: GraphEdge } | null,
    getNodeFault: (nodeId: string) => 'down' | 'degraded' | null,
    isNodeIsolated: (nodeId: string) => boolean,
    isParentFaulted: (nodeId: string) => 'down' | 'degraded' | null,
  ) {
    this.metrics = metrics;
    this.callbacks = callbacks;
    this.particleManager = particleManager;
    this.virtualClientManager = virtualClientManager;
    this.chainManager = chainManager;
    this.serverStateManager = serverStateManager;
    this.dispatcher = dispatcher;
    this.tokenStore = tokenStore;
    this.getState = getState;
    this.getNodeProcessingDelay = getNodeProcessingDelay;
    this.resolveAuthToken = resolveAuthToken;
    this.acquireToken = acquireToken;
    this.validateTokenViaIdP = validateTokenViaIdP;
    this.findConnectedIdP = findConnectedIdP;
    this.getNodeFault = getNodeFault;
    this.isNodeIsolated = isNodeIsolated;
    this.isParentFaulted = isParentFaulted;
  }

  setNodesAndEdges(nodes: GraphNode[], edges: GraphEdge[], nodeMap?: Map<string, GraphNode>): void {
    this.nodes = nodes;
    this.edges = edges;
    if (nodeMap) this.nodeMap = nodeMap;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /** Retourne la Map des timers des client groups (pour permettre le cleanup). */
  getClientGroupTimers(): Map<string, ReturnType<typeof setInterval>> {
    return this.clientGroupTimers;
  }

  /**
   * Demarre tous les client groups de stress testing.
   */
  startClientGroups(): void {
    const clientGroups = this.nodes.filter((n) => n.type === 'client-group');

    clientGroups.forEach((group) => {
      const data = group.data as ClientGroupNodeData;
      const edges = this.edges.filter((e) => e.source === group.id);

      if (edges.length === 0) return;

      this.virtualClientManager.initializeGroup(group.id, data);
      this.scheduleGroupRequests(group, edges[0], data);
    });
  }

  /**
   * Planifie les requetes pour un client group.
   */
  private scheduleGroupRequests(
    group: GraphNode,
    edge: GraphEdge,
    data: ClientGroupNodeData,
  ): void {
    const checkInterval = 50;

    const timer = setInterval(() => {
      if (this.getState() !== 'running') return;

      const activeClients = this.virtualClientManager.getActiveClients(group.id);
      const stats = this.virtualClientManager.getGroupStats(group.id);

      this.callbacks.onClientGroupUpdate?.(
        group.id,
        stats.activeClients,
        stats.totalRequests
      );

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
   * Selectionne un chemin aleatoire depuis le tableau paths.
   */
  private selectRandomPath(data: ClientGroupNodeData): string {
    if (data.paths && data.paths.length > 0) {
      const randomIndex = Math.floor(Math.random() * data.paths.length);
      return data.paths[randomIndex];
    }
    return data.path;
  }

  /**
   * Selectionne un type de requete depuis la distribution configuree.
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
      const last = data.requestDistribution[data.requestDistribution.length - 1];
      return { method: last.method, path: last.path, body: last.body };
    }
    return { method: data.method, path: this.selectRandomPath(data) };
  }

  /**
   * Clé unique par client virtuel pour l'état d'auth.
   */
  private authStateKey(groupId: string, virtualClientId: number): string {
    return `${groupId}:${virtualClientId}`;
  }

  /**
   * Récupère ou crée l'état d'auth d'un client virtuel.
   */
  private getOrCreateAuthState(groupId: string, virtualClientId: number): VirtualClientAuthState {
    const key = this.authStateKey(groupId, virtualClientId);
    let state = this.authStateByVirtualClient.get(key);
    if (!state) {
      state = { status: 'idle', pendingRequests: [] };
      this.authStateByVirtualClient.set(key, state);
    }
    return state;
  }

  /**
   * Envoie une requete depuis un client group.
   *
   * Logique de queueing par client virtuel (Task 22) :
   * - Si l'auth est déjà acquise (token valide en cache) → envoi immédiat
   * - Si l'auth est en cours → queue la requête (sera drainée à la fin de l'auth)
   * - Sinon → kick off l'acquisition de token, queue la requête courante
   *
   * À la résolution du token (qui peut emprunter un chemin multi-hop via le
   * dispatcher), toutes les requêtes en attente du même client virtuel sont
   * envoyées en parallèle (concurrent burst).
   */
  sendClientGroupRequest(
    group: GraphNode,
    edge: GraphEdge,
    data: ClientGroupNodeData,
    virtualClientId: number,
    preAcquiredToken?: SimulatedToken,
  ): void {
    const targetNode = this.nodeMap.get(edge.target);
    if (!targetNode) return;

    if (!preAcquiredToken) {
      const authResult = this.resolveAuthToken(group, targetNode, virtualClientId);
      if (authResult.needsAsync) {
        // Logique de queueing par client virtuel (Task 22)
        const authState = this.getOrCreateAuthState(group.id, virtualClientId);

        if (authState.status === 'authenticated' && authState.token
            && authState.token.expiresAt > Date.now()) {
          // Token déjà acquis et valide → envoyer immédiatement
          preAcquiredToken = authState.token;
        } else if (authState.status === 'authenticating') {
          // Acquisition en cours → queue la requête, sera drainée plus tard
          authState.pendingRequests.push({ group, edge, data, virtualClientId });
          return;
        } else {
          // Premier client à demander un token → kick off l'acquisition
          authState.status = 'authenticating';
          authState.pendingRequests.push({ group, edge, data, virtualClientId });

          this.acquireToken(group, authResult.idpEdge, authResult.idp, virtualClientId, (token) => {
            this.handleAuthCompletion(group.id, virtualClientId, token);
          });
          return;
        }
      } else {
        preAcquiredToken = authResult.token;
      }
    }

    // Check server capacity
    const serverState = this.serverStateManager.serverStates.get(targetNode.id);
    if (serverState) {
      const decision = ResourceManager.canAcceptRequest(
        serverState.resources,
        serverState.utilization
      );

      if (decision === 'reject') {
        this.metrics.recordRejection();
        this.callbacks.onMetricsUpdate();
        simulationEvents.emit(createErrorEvent(targetNode.id, 'capacity', undefined));
        simulationEvents.emit(createHandlerDecisionEvent(
          targetNode.id, targetNode.type ?? 'default', 'reject', 'capacity-reject', { reason: 'capacity' }
        ));
        return;
      }

      if (decision === 'queue') {
        this.serverStateManager.enqueueRequest(
          targetNode.id,
          group,
          edge.id,
          group.id,
          virtualClientId,
        );
        return;
      }
    }

    this.callbacks.onNodeStatusChange(group.id, 'processing');
    this.metrics.recordRequestSent();
    this.callbacks.onMetricsUpdate();

    const reqType = this.selectRequestType(data);
    const chainId = generateParticleId();

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
    if (preAcquiredToken) {
      chain.authToken = {
        tokenId: preAcquiredToken.tokenId,
        format: preAcquiredToken.format,
        issuerId: preAcquiredToken.idpId,
        issuedAt: preAcquiredToken.issuedAt,
        expiresAt: preAcquiredToken.expiresAt,
      };
    }
    this.chainManager.createChain(chain);

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

    if (serverState) {
      serverState.activeRequests.set(particle.id, {
        id: particle.id,
        startedAt: Date.now(),
        estimatedCompletion: Date.now() + requestDuration,
      });
      serverState.utilization.activeConnections = serverState.activeRequests.size;
    }

    setTimeout(() => {
      this.handleClientGroupRequestArrival(particle, group, targetNode, edge, virtualClientId, chainId);
    }, requestDuration);
  }

  /**
   * Gere l'arrivee d'une requete de client group au serveur.
   */
  private handleClientGroupRequestArrival(
    requestParticle: Particle,
    clientGroup: GraphNode,
    server: GraphNode,
    edge: GraphEdge,
    virtualClientId: number,
    chainId: string,
  ): void {
    if (this.getState() !== 'running') return;

    this.particleManager.remove(requestParticle.id);

    const chain = this.chainManager.getChain(chainId);
    if (chain) {
      chain.currentPath.push(server.id);
      chain.edgePath.push(edge.id);
    }

    this.callbacks.onNodeStatusChange(clientGroup.id, 'idle');

    const serverState = this.serverStateManager.serverStates.get(server.id);

    // Chaos mode checks (mirrors RequestDispatcher.handleChainRequestArrival
    // and SimulationEngine.handleRequestArrival). Without this block, a node
    // directly connected to a client-group bypasses the fault check, since
    // ClientGroupSimulator owns the first-hop arrival flow.
    const serverFault = this.getNodeFault(server.id);
    const parentFault = this.isParentFaulted(server.id);
    if (serverFault === 'down' || this.isNodeIsolated(server.id) || parentFault === 'down') {
      this.callbacks.onNodeStatusChange(server.id, 'down');
      this.metrics.recordRejection();
      this.metrics.recordResponse(false, Date.now() - (chain?.startTime || Date.now()));
      this.callbacks.onMetricsUpdate();
      simulationEvents.emit(createErrorEvent(server.id, 'node-down', chainId));
      simulationEvents.emit(createStateTransitionEvent(server.id, 'node-down', 'processing', 'down', chainId));
      this.dispatcher.emitSpanStart(server.id, server.type ?? 'default', chainId);
      this.dispatcher.emitSpanEnd(server.id, chainId, true);
      // Symmetric cleanup: sendClientGroupRequest:455-461 added the request to
      // serverState.activeRequests; remove it here so the utilization gauge
      // doesn't drift up forever when the node is down/isolated.
      if (serverState) {
        serverState.activeRequests.delete(requestParticle.id);
        serverState.utilization.activeConnections = serverState.activeRequests.size;
      }
      this.sendChainResponseWithVirtualClient(chainId, server, virtualClientId);
      return;
    }

    const effectiveFault = serverFault === 'degraded' ? 'degraded' : parentFault === 'degraded' ? 'degraded' : null;
    if (effectiveFault === 'degraded') {
      simulationEvents.emit(createStateTransitionEvent(server.id, 'node-degraded', 'processing', 'degraded', chainId));
    }
    this.callbacks.onNodeStatusChange(server.id, effectiveFault === 'degraded' ? 'degraded' : 'processing');

    const edgeData = edge.data as Record<string, unknown> | undefined;
    const context: import('./handlers/types').RequestContext = {
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

    let processingDelay = this.getNodeProcessingDelay(server, context);

    const continueClientGroupFlow = () => {
      if (this.getState() !== 'running') return;

      if (serverState && server.type === 'http-server') {
        const serverData = server.data as HttpServerNodeData;
        const extendedData = server.data as HttpServerNodeData;
        const degradation = extendedData.degradation || defaultDegradation;

        processingDelay = ResourceManager.calculateDegradedLatency(
          serverData.responseDelay || 100,
          serverState.utilization,
          degradation
        ) / this.speed;
      }

      const outgoingEdges = this.edges.filter((e) => e.source === server.id);

      // Start span for this server node (mirrors SimulationEngine.handleRequestArrival)
      this.dispatcher.emitSpanStart(server.id, server.type ?? 'default', chainId);

      setTimeout(() => {
        if (this.getState() !== 'running') return;

        if (serverState) {
          serverState.activeRequests.delete(requestParticle.id);
          serverState.utilization.activeConnections = serverState.activeRequests.size;
          this.serverStateManager.processQueuedRequest(server.id);
        }

        if (outgoingEdges.length > 0) {
          // forwardRequest → executeDecision → emitSpanEnd is called automatically
          this.dispatcher.forwardRequest(server, outgoingEdges, chainId);
        } else {
          // Terminal node: end span explicitly before sending response
          this.dispatcher.emitSpanEnd(server.id, chainId, false);
          this.sendChainResponseWithVirtualClient(chainId, server, virtualClientId);
        }
      }, processingDelay);
    };

    // Validation du token via IdP connecte a la gateway
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
              this.callbacks.onMetricsUpdate();
              this.sendChainResponseWithVirtualClient(chainId, server, virtualClientId);
            }
          );
          return;
        }
      }
    }

    continueClientGroupFlow();
  }

  /**
   * Envoie la reponse de chaine avec tracking du client virtuel.
   */
  private sendChainResponseWithVirtualClient(
    chainId: string,
    terminalNode: GraphNode,
    virtualClientId: number,
  ): void {
    if (this.getState() !== 'running') return;

    const chain = this.chainManager.getChain(chainId);
    if (!chain) return;

    chain.virtualClientId = virtualClientId;
    this.chainManager.sendChainResponse(chainId, terminalNode);
  }

  /**
   * Appelé quand l'acquisition d'un token se termine (Task 22).
   *
   * Met à jour l'état d'auth du client virtuel et draîne la queue des requêtes
   * en attente en parallèle (concurrent burst).
   *
   * Si le token est null (échec d'acquisition), enregistre une rejection pour
   * chaque requête en attente et n'envoie rien (sinon le drain provoquerait
   * une réacquisition en boucle).
   */
  private handleAuthCompletion(
    groupId: string,
    virtualClientId: number,
    token: SimulatedToken | null,
  ): void {
    const key = this.authStateKey(groupId, virtualClientId);
    const authState = this.authStateByVirtualClient.get(key);
    if (!authState) return;

    const queued = authState.pendingRequests;
    authState.pendingRequests = [];

    if (token) {
      authState.status = 'authenticated';
      authState.token = token;
      // Draîner la queue : envoyer toutes les requêtes en parallèle (concurrent burst)
      for (const req of queued) {
        this.sendClientGroupRequest(req.group, req.edge, req.data, req.virtualClientId, token);
      }
    } else {
      // Échec d'acquisition : enregistrer rejection pour chaque requête en attente
      // Retour à 'idle' pour permettre une nouvelle tentative au prochain tick
      authState.status = 'idle';
      authState.token = undefined;
      for (const _req of queued) {
        this.metrics.recordRejection('auth-failure');
      }
      this.callbacks.onMetricsUpdate();
    }
  }

  /** Arrete et nettoie tous les timers de client groups. */
  stop(): void {
    this.clientGroupTimers.forEach((timer) => clearInterval(timer));
    this.clientGroupTimers.clear();
    this.authStateByVirtualClient.clear();
  }
}
