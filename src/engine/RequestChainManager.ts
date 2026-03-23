import type { GraphNode, GraphEdge } from '@/types/graph';
import type { Particle, ParticleType } from '@/types';
import type { MetricsCollector } from './metrics';
import { ParticleManager } from './ParticleManager';
import { VirtualClientManager } from './VirtualClientManager';
import {
  generateParticleId,
  createResponseSentEvent,
  createResponseReceivedEvent,
  simulationEvents,
} from './events';
import type { NodeRequestHandler } from './handlers/types';
import type { RequestContext } from './handlers/types';
import { getParticleChainId } from '@/types';

/**
 * Suivi d'une chaine de requete a travers la topologie.
 * Enregistre le chemin complet (noeuds et aretes traverses) et l'etat cache-aside.
 */
export interface RequestChain {
  id: string;
  originNodeId: string;
  currentPath: string[];
  edgePath: string[];
  virtualClientId?: number;
  startTime: number;
  requestPath?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  queryType?: 'read' | 'write' | 'transaction';
  contentType?: 'static' | 'dynamic' | 'user-specific';
  payloadSizeBytes?: number;
  sourceIP?: string;
  cacheHit?: boolean;
  cacheNodeId?: string;
  waitingForDb?: boolean;
  authToken?: {
    tokenId: string;
    format: 'jwt' | 'opaque' | 'saml-assertion';
    issuerId: string;
    issuedAt: number;
    expiresAt: number;
  };
}

/**
 * Callbacks dont le RequestChainManager a besoin pour notifier React et l'engine.
 */
export interface RequestChainCallbacks {
  onNodeStatusChange: (nodeId: string, status: import('@/types').NodeStatus) => void;
  onMetricsUpdate: () => void;
  onSimulationComplete?: () => void;
  /** Appele quand une chaine a fini (retour au noeud d'origine). */
  onChainCompleted: (chainId: string) => void;
}

/**
 * Gere le suivi des chaines de requetes a travers la topologie.
 *
 * Responsabilites :
 * - `activeChains` Map
 * - `sendChainResponse()`, `sendResponseHop()`, `shouldNodeError()`
 * - Cleanup des chaines terminees
 */
export class RequestChainManager {
  readonly activeChains: Map<string, RequestChain> = new Map();

  private nodes: GraphNode[] = [];
  private nodeMap: Map<string, GraphNode> = new Map();
  private metrics: MetricsCollector;
  private callbacks: RequestChainCallbacks;
  private particleManager: ParticleManager;
  private virtualClientManager: VirtualClientManager;
  private speed: number = 1;
  private getState: () => string;
  private getHierarchicalLatency: (sourceId: string, targetId: string) => number;
  private getHandlerForNode: (nodeType: string) => NodeRequestHandler;
  private serverStatesHas: (nodeId: string) => boolean;
  private getParticleCount: () => number;
  private clientTimersSize: () => number;
  private clientGroupTimersSize: () => number;

  constructor(
    metrics: MetricsCollector,
    callbacks: RequestChainCallbacks,
    particleManager: ParticleManager,
    virtualClientManager: VirtualClientManager,
    getState: () => string,
    getHierarchicalLatency: (sourceId: string, targetId: string) => number,
    getHandlerForNode: (nodeType: string) => NodeRequestHandler,
    serverStatesHas: (nodeId: string) => boolean,
    getParticleCount: () => number,
    clientTimersSize: () => number,
    clientGroupTimersSize: () => number,
  ) {
    this.metrics = metrics;
    this.callbacks = callbacks;
    this.particleManager = particleManager;
    this.virtualClientManager = virtualClientManager;
    this.getState = getState;
    this.getHierarchicalLatency = getHierarchicalLatency;
    this.getHandlerForNode = getHandlerForNode;
    this.serverStatesHas = serverStatesHas;
    this.getParticleCount = getParticleCount;
    this.clientTimersSize = clientTimersSize;
    this.clientGroupTimersSize = clientGroupTimersSize;
  }

  /** Met a jour le graphe et la vitesse. */
  setNodesAndEdges(nodes: GraphNode[], edges: GraphEdge[], nodeMap?: Map<string, GraphNode>): void {
    this.nodes = nodes;
    if (nodeMap) this.nodeMap = nodeMap;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /** Cree ou retourne une chaine a partir d'un chainId issu d'une particule. */
  getOrCreateChain(chainId: string, defaultChain: RequestChain): RequestChain {
    const existing = this.activeChains.get(chainId);
    if (existing) return existing;
    this.activeChains.set(chainId, defaultChain);
    return defaultChain;
  }

  /** Retourne une chaine existante. */
  getChain(chainId: string): RequestChain | undefined {
    return this.activeChains.get(chainId);
  }

  /** Cree et enregistre une nouvelle chaine. */
  createChain(chain: RequestChain): void {
    this.activeChains.set(chain.id, chain);
  }

  /** Supprime une chaine. */
  deleteChain(chainId: string): void {
    this.activeChains.delete(chainId);
  }

  /** Verifie si un noeud doit retourner une erreur (en fonction de son errorRate). */
  shouldNodeError(node: GraphNode): boolean {
    const data = node.data as { errorRate?: number };
    return data.errorRate ? Math.random() * 100 < data.errorRate : false;
  }

  /**
   * Envoie une reponse en retour a travers la chaine depuis le noeud terminal.
   */
  sendChainResponse(chainId: string, terminalNode: GraphNode, forceError?: boolean): void {
    if (this.getState() !== 'running') return;

    const chain = this.activeChains.get(chainId);
    if (!chain) return;

    const isError = forceError ?? this.shouldNodeError(terminalNode);

    this.callbacks.onNodeStatusChange(terminalNode.id, isError ? 'error' : 'success');

    this.sendResponseHop(chainId, chain.currentPath.length - 1, chain.edgePath.length - 1, isError);
  }

  /**
   * Envoie un hop de reponse en retour dans la chaine.
   * Recursive : appele sendResponseHop jusqu'a atteindre l'origine.
   */
  sendResponseHop(
    chainId: string,
    currentNodeIndex: number,
    currentEdgeIndex: number,
    isError: boolean,
  ): void {
    if (this.getState() !== 'running') return;

    const chain = this.activeChains.get(chainId);
    if (!chain || currentEdgeIndex < 0) {
      // Reached the origin - cleanup
      if (chain) {
        const originNode = this.nodeMap.get(chain.originNodeId);
        if (originNode) {
          this.callbacks.onNodeStatusChange(originNode.id, isError ? 'error' : 'success');

          const latency = Date.now() - chain.startTime;
          this.metrics.recordResponse(!isError, latency);
          this.callbacks.onMetricsUpdate();

          const lastServerInPath = chain.currentPath.length > 1 ? chain.currentPath[1] : originNode.id;
          simulationEvents.emit(createResponseReceivedEvent(
            lastServerInPath,
            originNode.id,
            isError ? 500 : 200,
            latency,
            chainId
          ));

          for (const nodeId of chain.currentPath) {
            if (this.serverStatesHas(nodeId)) {
              this.metrics.recordServerResponse(nodeId, !isError, latency);
            }
          }

          if (originNode.type === 'client-group' && chain.virtualClientId !== undefined) {
            this.virtualClientManager.recordRequestCompleted(originNode.id, chain.virtualClientId);
          }

          setTimeout(() => {
            if (this.getState() === 'running') {
              this.callbacks.onNodeStatusChange(originNode.id, 'idle');
            }
          }, 300 / this.speed);
        }
        this.activeChains.delete(chainId);

        this.callbacks.onChainCompleted(chainId);
      }
      return;
    }

    const currentNodeId = chain.currentPath[currentNodeIndex];
    const previousNodeId = chain.currentPath[currentNodeIndex - 1];
    const edgeId = chain.edgePath[currentEdgeIndex];

    const currentNode = this.nodeMap.get(currentNodeId);
    const previousNode = this.nodeMap.get(previousNodeId);

    if (!currentNode || !previousNode) return;

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

    simulationEvents.emit(createResponseSentEvent(
      currentNodeId, previousNodeId, edgeId, isError ? 500 : 200, undefined,
      Date.now() - chain.startTime, chainId
    ));

    setTimeout(() => {
      if (this.getState() !== 'running') return;

      this.particleManager.remove(particle.id);

      if (currentNode) {
        const nodeType = currentNode.type ?? 'default';
        const handler = this.getHandlerForNode(nodeType);
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

      this.callbacks.onNodeStatusChange(currentNodeId, 'idle');
      this.callbacks.onNodeStatusChange(previousNodeId, isError ? 'error' : 'success');

      this.sendResponseHop(chainId, currentNodeIndex - 1, currentEdgeIndex - 1, isError);
    }, responseDuration);
  }

  /**
   * Verifie si la simulation peut etre marquee comme terminee.
   * Appele apres chaque fin de chaine.
   */
  checkCompletion(): void {
    if (this.getState() !== 'running') return;

    if (this.clientTimersSize() > 0 || this.clientGroupTimersSize() > 0) return;

    if (this.activeChains.size === 0 && this.getParticleCount() === 0) {
      this.callbacks.onSimulationComplete?.();
    }
  }

  /** Reinitialise les chaines actives. */
  clear(): void {
    this.activeChains.clear();
  }

  /**
   * Extrait le chainId d'une particule (delegue a getParticleChainId).
   */
  getChainIdFromParticle(particle: Particle): string | undefined {
    return getParticleChainId(particle) ?? undefined;
  }
}
