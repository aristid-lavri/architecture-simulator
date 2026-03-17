import type { Node, Edge } from '@xyflow/react';
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
  simulationEvents,
} from './events';
import type { RequestChainManager, RequestChain } from './RequestChainManager';
import type { ServerStateManager } from './ServerStateManager';
import type { RequestDispatcher } from './RequestDispatcher';
import type { TokenStore, SimulatedToken } from './TokenStore';
import type { HttpServerNodeData } from '@/components/nodes/HttpServerNode';
import type {
  HttpServerNodeData as HttpServerNodeDataExtended,
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
 * Gere le stress testing avec les groupes de clients virtuels.
 *
 * Responsabilites :
 * - `startClientGroups()`, `scheduleGroupRequests()`
 * - `sendClientGroupRequest()`, `handleClientGroupRequestArrival()`
 * - Gestion des reponses virtuelles
 */
export class ClientGroupSimulator {
  private nodes: Node[] = [];
  private edges: Edge[] = [];
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
  private getState: () => string;
  private getNodeProcessingDelay: (node: Node, context?: import('./handlers/types').RequestContext) => number;
  private resolveAuthToken: (
    client: Node,
    targetNode: Node,
    virtualClientId: number | undefined
  ) => { needsAsync: false; token?: SimulatedToken } | { needsAsync: true; idp: Node; idpEdge: Edge };
  private acquireToken: (
    client: Node,
    idpEdge: Edge,
    idpNode: Node,
    virtualClientId: number | undefined,
    callback: (token: SimulatedToken) => void
  ) => void;
  private validateTokenViaIdP: (
    gateway: Node,
    idpNode: Node,
    idpEdge: Edge,
    chainId: string,
    context: import('./handlers/types').RequestContext,
    onValid: () => void,
    onInvalid: () => void
  ) => void;
  private findConnectedIdP: (nodeId: string) => { node: Node; edge: Edge } | null;

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
    getNodeProcessingDelay: (node: Node, context?: import('./handlers/types').RequestContext) => number,
    resolveAuthToken: (
      client: Node,
      targetNode: Node,
      virtualClientId: number | undefined
    ) => { needsAsync: false; token?: SimulatedToken } | { needsAsync: true; idp: Node; idpEdge: Edge },
    acquireToken: (
      client: Node,
      idpEdge: Edge,
      idpNode: Node,
      virtualClientId: number | undefined,
      callback: (token: SimulatedToken) => void
    ) => void,
    validateTokenViaIdP: (
      gateway: Node,
      idpNode: Node,
      idpEdge: Edge,
      chainId: string,
      context: import('./handlers/types').RequestContext,
      onValid: () => void,
      onInvalid: () => void
    ) => void,
    findConnectedIdP: (nodeId: string) => { node: Node; edge: Edge } | null,
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
  }

  setNodesAndEdges(nodes: Node[], edges: Edge[]): void {
    this.nodes = nodes;
    this.edges = edges;
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
    group: Node,
    edge: Edge,
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
   * Envoie une requete depuis un client group.
   */
  sendClientGroupRequest(
    group: Node,
    edge: Edge,
    data: ClientGroupNodeData,
    virtualClientId: number,
    preAcquiredToken?: SimulatedToken,
  ): void {
    const targetNode = this.nodes.find((n) => n.id === edge.target);
    if (!targetNode) return;

    if (!preAcquiredToken) {
      const authResult = this.resolveAuthToken(group, targetNode, virtualClientId);
      if (authResult.needsAsync) {
        this.acquireToken(group, authResult.idpEdge, authResult.idp, virtualClientId, (token) => {
          this.sendClientGroupRequest(group, edge, data, virtualClientId, token);
        });
        return;
      }
      preAcquiredToken = authResult.token;
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
    clientGroup: Node,
    server: Node,
    edge: Edge,
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
    this.callbacks.onNodeStatusChange(server.id, 'processing');

    const serverState = this.serverStateManager.serverStates.get(server.id);

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
        const extendedData = server.data as HttpServerNodeDataExtended;
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
    terminalNode: Node,
    virtualClientId: number,
  ): void {
    if (this.getState() !== 'running') return;

    const chain = this.chainManager.getChain(chainId);
    if (!chain) return;

    chain.virtualClientId = virtualClientId;
    this.chainManager.sendChainResponse(chainId, terminalNode);
  }

  /** Arrete et nettoie tous les timers de client groups. */
  stop(): void {
    this.clientGroupTimers.forEach((timer) => clearInterval(timer));
    this.clientGroupTimers.clear();
  }
}
