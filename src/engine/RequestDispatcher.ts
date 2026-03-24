import type { GraphNode, GraphEdge } from '@/types/graph';
import type { Particle } from '@/types';
import type { MetricsCollector } from './metrics';
import { ParticleManager } from './ParticleManager';
import {
  generateParticleId,
  createRequestReceivedEvent,
  createProcessingStartEvent,
  createProcessingEndEvent,
  createHandlerDecisionEvent,
  createErrorEvent,
  createStateTransitionEvent,
  createSpanStartEvent,
  createSpanEndEvent,
  simulationEvents,
} from './events';
import type { RequestContext, RequestDecision, NodeRequestHandler } from './handlers/types';
import type { RequestChainManager, RequestChain } from './RequestChainManager';
import type { ServerStateManager } from './ServerStateManager';
import type { ApiGatewayNodeData } from '@/types';
import { CacheManager } from './CacheManager';

/**
 * Callbacks dont le RequestDispatcher a besoin pour notifier React et l'engine.
 */
export interface RequestDispatcherCallbacks {
  onNodeStatusChange: (nodeId: string, status: import('@/types').NodeStatus) => void;
  onMetricsUpdate: () => void;
  onError?: (error: Error) => void;
}

/**
 * Gere le routage des decisions des handlers et l'arrivee des requetes aux noeuds intermediaires.
 *
 * Responsabilites :
 * - `executeDecision()` (switch 6 cas)
 * - `forwardRequest()` et `handleChainRequestArrival()`
 * - Gestion du chaos mode (faults, isolation)
 */
export class RequestDispatcher {
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private nodeMap: Map<string, GraphNode> = new Map();
  private speed: number = 1;
  private metrics: MetricsCollector;
  private callbacks: RequestDispatcherCallbacks;
  private particleManager: ParticleManager;
  private chainManager: RequestChainManager;
  private serverStateManager: ServerStateManager;
  private cacheManager: CacheManager;
  private getState: () => string;
  private getHandlerForNode: (nodeType: string) => NodeRequestHandler;
  private getNodeProcessingDelay: (node: GraphNode, context?: RequestContext) => number;
  private getHierarchicalLatency: (sourceId: string, targetId: string) => number;
  private getNodeFault: (nodeId: string) => 'down' | 'degraded' | null;
  private isNodeIsolated: (nodeId: string) => boolean;
  private isParentFaulted: (nodeId: string) => 'down' | 'degraded' | null;
  private findConnectedIdP: (nodeId: string) => { node: GraphNode; edge: GraphEdge } | null;
  private validateTokenViaIdP: (
    gateway: GraphNode,
    idpNode: GraphNode,
    idpEdge: GraphEdge,
    chainId: string,
    context: RequestContext,
    onValid: () => void,
    onInvalid: () => void
  ) => void;

  // Span tracking for distributed tracing (chainId:nodeId → spanId)
  private activeSpans: Map<string, string> = new Map();

  constructor(
    metrics: MetricsCollector,
    callbacks: RequestDispatcherCallbacks,
    particleManager: ParticleManager,
    chainManager: RequestChainManager,
    serverStateManager: ServerStateManager,
    cacheManager: CacheManager,
    getState: () => string,
    getHandlerForNode: (nodeType: string) => NodeRequestHandler,
    getNodeProcessingDelay: (node: GraphNode, context?: RequestContext) => number,
    getHierarchicalLatency: (sourceId: string, targetId: string) => number,
    getNodeFault: (nodeId: string) => 'down' | 'degraded' | null,
    isNodeIsolated: (nodeId: string) => boolean,
    isParentFaulted: (nodeId: string) => 'down' | 'degraded' | null,
    findConnectedIdP: (nodeId: string) => { node: GraphNode; edge: GraphEdge } | null,
    validateTokenViaIdP: (
      gateway: GraphNode,
      idpNode: GraphNode,
      idpEdge: GraphEdge,
      chainId: string,
      context: RequestContext,
      onValid: () => void,
      onInvalid: () => void
    ) => void,
  ) {
    this.metrics = metrics;
    this.callbacks = callbacks;
    this.particleManager = particleManager;
    this.chainManager = chainManager;
    this.serverStateManager = serverStateManager;
    this.cacheManager = cacheManager;
    this.getState = getState;
    this.getHandlerForNode = getHandlerForNode;
    this.getNodeProcessingDelay = getNodeProcessingDelay;
    this.getHierarchicalLatency = getHierarchicalLatency;
    this.getNodeFault = getNodeFault;
    this.isNodeIsolated = isNodeIsolated;
    this.isParentFaulted = isParentFaulted;
    this.findConnectedIdP = findConnectedIdP;
    this.validateTokenViaIdP = validateTokenViaIdP;
  }

  setNodesAndEdges(nodes: GraphNode[], edges: GraphEdge[], nodeMap?: Map<string, GraphNode>): void {
    this.nodes = nodes;
    this.edges = edges;
    if (nodeMap) this.nodeMap = nodeMap;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  // ============================================================
  // Span helpers
  // ============================================================

  emitSpanStart(nodeId: string, nodeType: string, chainId: string, parentSpanId?: string): string {
    const spanId = `span_${chainId}_${nodeId}_${Date.now()}`;
    this.activeSpans.set(`${chainId}:${nodeId}`, spanId);
    simulationEvents.emit(createSpanStartEvent(nodeId, nodeType, chainId, spanId, parentSpanId));
    return spanId;
  }

  emitSpanEnd(nodeId: string, chainId: string, isError: boolean = false): void {
    const key = `${chainId}:${nodeId}`;
    const spanId = this.activeSpans.get(key);
    if (spanId) {
      simulationEvents.emit(createSpanEndEvent(nodeId, chainId, spanId, isError));
      this.activeSpans.delete(key);
    }
  }

  getActiveSpanId(nodeId: string, chainId: string): string | undefined {
    return this.activeSpans.get(`${chainId}:${nodeId}`);
  }

  clearSpans(): void {
    this.activeSpans.clear();
  }

  // ============================================================
  // Core dispatch methods
  // ============================================================

  /**
   * Transmet la requete depuis un noeud intermediaire vers ses cibles.
   * Utilise les handlers pour determiner la strategie de forwarding.
   */
  forwardRequest(sourceNode: GraphNode, outgoingEdges: GraphEdge[], chainId: string): void {
    if (this.getState() !== 'running') return;

    const chain = this.chainManager.getChain(chainId);
    if (!chain) return;

    const context: RequestContext = this.buildContextFromChain(chain);

    const nodeType = sourceNode.type ?? 'default';
    const handler = this.getHandlerForNode(nodeType);
    const decision = handler.handleRequestArrival(sourceNode, context, outgoingEdges, this.nodes);

    if (nodeType === 'database') {
      this.metrics.recordDatabaseQuery(context.queryType || 'read');
    }

    this.executeDecision(decision, sourceNode, chainId, context);
  }

  /**
   * Execute une decision retournee par un handler.
   */
  executeDecision(
    decision: RequestDecision,
    sourceNode: GraphNode,
    chainId: string,
    context: RequestContext,
  ): void {
    const chain = this.chainManager.getChain(chainId);

    simulationEvents.emit(createProcessingEndEvent(sourceNode.id, chainId));

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

    this.serverStateManager.emitResourceSnapshot(sourceNode.id, chainId);

    const isErrorDecision = decision.action === 'reject' || (decision.action === 'respond' && decision.isError);
    this.emitSpanEnd(sourceNode.id, chainId, isErrorDecision);

    switch (decision.action) {
      case 'forward':
        decision.targets.forEach((target, index) => {
          const targetNode = this.nodeMap.get(target.nodeId);
          if (!targetNode) return;

          let effectiveChainId = chainId;
          if (index > 0 && chain) {
            const forkedChainId = `${chainId}-fork-${index}`;
            const forkedChain: RequestChain = {
              id: forkedChainId,
              originNodeId: sourceNode.id,
              currentPath: [sourceNode.id],
              edgePath: [],
              virtualClientId: chain.virtualClientId,
              startTime: Date.now(),
              requestPath: chain.requestPath,
            };
            this.chainManager.createChain(forkedChain);
            effectiveChainId = forkedChainId;
          }

          // Propager le contextEnrichment du handler sur la chain (ex: authToken de l'IdP)
          if (target.contextEnrichment) {
            const effectiveChain = this.chainManager.getChain(effectiveChainId);
            if (effectiveChain) {
              if (target.contextEnrichment.authToken) {
                effectiveChain.authToken = target.contextEnrichment.authToken;
              }
            }
          }

          const zoneLatency = this.getHierarchicalLatency(sourceNode.id, targetNode.id);
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
              { id: target.edgeId } as GraphEdge, effectiveChainId);
          }, requestDuration);
        });
        break;

      case 'respond':
        if (decision.delay) {
          setTimeout(() => {
            this.callbacks.onNodeStatusChange(sourceNode.id, decision.isError ? 'error' : 'success');
            this.chainManager.sendChainResponse(chainId, sourceNode);
          }, decision.delay / this.speed);
        } else {
          this.callbacks.onNodeStatusChange(sourceNode.id, decision.isError ? 'error' : 'success');
          this.chainManager.sendChainResponse(chainId, sourceNode);
        }
        break;

      case 'reject':
        this.metrics.recordRejection(decision.reason);
        this.callbacks.onMetricsUpdate();
        this.callbacks.onNodeStatusChange(sourceNode.id, 'error');
        simulationEvents.emit(createErrorEvent(sourceNode.id, decision.reason || 'rejected', chainId));
        this.chainManager.sendChainResponse(chainId, sourceNode, true);
        setTimeout(() => {
          if (this.getState() === 'running') {
            this.callbacks.onNodeStatusChange(sourceNode.id, 'idle');
          }
        }, 300 / this.speed);
        break;

      case 'queue':
        this.callbacks.onNodeStatusChange(sourceNode.id, 'processing');
        break;

      case 'cache-miss':
        if (chain) {
          chain.waitingForDb = true;
          chain.cacheNodeId = decision.cacheNodeId;
        }
        const dbTarget = decision.dbTarget;
        const dbNode = this.nodeMap.get(dbTarget.nodeId);
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
              { id: dbTarget.edgeId } as GraphEdge, chainId);
          }, requestDuration);
        }
        break;

      case 'notify':
        this.callbacks.onNodeStatusChange(sourceNode.id, 'success');
        this.chainManager.sendChainResponse(chainId, sourceNode);

        decision.targets.forEach((target, index) => {
          const targetNode = this.nodeMap.get(target.nodeId);
          if (!targetNode) return;

          const notifyChainId = `${chainId}-notify-${index}`;
          const notifyChain: RequestChain = {
            id: notifyChainId,
            originNodeId: sourceNode.id,
            currentPath: [sourceNode.id],
            edgePath: [],
            startTime: Date.now(),
            requestPath: context.requestPath,
          };
          this.chainManager.createChain(notifyChain);

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
              { id: target.edgeId } as GraphEdge, notifyChainId);
          }, requestDuration);
        });
        break;
    }
  }

  /**
   * Gere l'arrivee d'une requete a un noeud intermediaire dans la chaine.
   */
  handleChainRequestArrival(
    requestParticle: Particle,
    sourceNode: GraphNode,
    targetNode: GraphNode,
    edge: GraphEdge,
    chainId: string,
  ): void {
    if (this.getState() !== 'running') return;
    try {
      this.particleManager.remove(requestParticle.id);

      const chain = this.chainManager.getChain(chainId);
      if (!chain) return;

      chain.currentPath.push(targetNode.id);
      chain.edgePath.push(edge.id);

      this.callbacks.onNodeStatusChange(sourceNode.id, 'idle');

      // Chaos mode checks
      const targetFault = this.getNodeFault(targetNode.id);
      const targetParentFault = this.isParentFaulted(targetNode.id);
      if (targetFault === 'down' || this.isNodeIsolated(targetNode.id) || targetParentFault === 'down') {
        this.callbacks.onNodeStatusChange(targetNode.id, 'down');
        this.metrics.recordRejection();
        this.metrics.recordResponse(false, Date.now() - chain.startTime);
        this.callbacks.onMetricsUpdate();
        simulationEvents.emit(createErrorEvent(targetNode.id, 'node-down', chainId));
        simulationEvents.emit(createStateTransitionEvent(targetNode.id, 'node-down', 'processing', 'down', chainId));
        this.emitSpanStart(targetNode.id, targetNode.type ?? 'default', chainId);
        this.emitSpanEnd(targetNode.id, chainId, true);
        this.chainManager.sendChainResponse(chainId, targetNode);
        return;
      }

      const effectiveTargetFault = targetFault === 'degraded' ? 'degraded' : targetParentFault === 'degraded' ? 'degraded' : null;
      if (effectiveTargetFault === 'degraded') {
        simulationEvents.emit(createStateTransitionEvent(targetNode.id, 'node-degraded', 'processing', 'degraded', chainId));
      }
      this.callbacks.onNodeStatusChange(targetNode.id, effectiveTargetFault === 'degraded' ? 'degraded' : 'processing');

      simulationEvents.emit(createRequestReceivedEvent(
        sourceNode.id, targetNode.id, 'GET', chain.requestPath || '/', chainId
      ));

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
      if (effectiveTargetFault === 'degraded') processingDelay *= 3;

      simulationEvents.emit(createProcessingStartEvent(targetNode.id, chainId));

      const nodeType = targetNode.type ?? 'default';
      const previousNodeId = chain.currentPath.length >= 2 ? chain.currentPath[chain.currentPath.length - 2] : undefined;
      const parentSpanId = previousNodeId ? this.getActiveSpanId(previousNodeId, chainId) : undefined;
      this.emitSpanStart(targetNode.id, nodeType, chainId, parentSpanId);

      const outgoingEdges = this.isNodeIsolated(targetNode.id)
        ? []
        : this.edges.filter((e) => e.source === targetNode.id);

      const handler = this.getHandlerForNode(nodeType);
      let decision = handler.handleRequestArrival(targetNode, context, outgoingEdges, this.nodes);

      if (nodeType === 'database') {
        this.metrics.recordDatabaseQuery(context.queryType || 'read');
      }

      if (targetFault === 'degraded' && Math.random() < 0.5) {
        decision = { action: 'respond', isError: true };
      }

      setTimeout(() => {
        if (this.getState() !== 'running') return;

        // Handle cache-aside pattern: after DB responds, store in cache
        if (decision.action === 'respond' && chain.waitingForDb && chain.cacheNodeId) {
          const cacheNode = this.nodeMap.get(chain.cacheNodeId);
          if (cacheNode) {
            this.callbacks.onNodeStatusChange(targetNode.id, 'success');
            this.callbacks.onNodeStatusChange(cacheNode.id, 'processing');

            const cacheKey = `resource:${chain.originNodeId}`;
            this.cacheManager.set(chain.cacheNodeId, cacheKey, `db_response_${Date.now()}`);

            const cacheStoreDelay = this.getNodeProcessingDelay(cacheNode);
            setTimeout(() => {
              if (this.getState() !== 'running') return;
              this.callbacks.onNodeStatusChange(cacheNode.id, 'success');
              this.chainManager.sendChainResponse(chainId, targetNode);
            }, cacheStoreDelay);
            return;
          }
        }

        this.executeDecision(decision, targetNode, chainId, context);
      }, processingDelay);
    } catch (error) {
      console.error('[RequestDispatcher] Error in handleChainRequestArrival:', error);
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private buildContextFromChain(chain: RequestChain): RequestContext {
    return {
      chainId: chain.id,
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
  }
}
