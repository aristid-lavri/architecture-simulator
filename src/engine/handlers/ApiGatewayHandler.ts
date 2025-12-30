import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { ApiGatewayNodeData, HttpServerNodeData } from '@/types';

/**
 * État runtime d'une API Gateway
 */
interface GatewayState {
  requestsInWindow: number;
  windowStartTime: number;
  totalRequests: number;
  blockedRequests: number;
  authFailures: number;
  rateLimitHits: number;
}

/**
 * Handler pour les nœuds API Gateway.
 * Gère le rate limiting et l'authentification.
 */
export class ApiGatewayHandler implements NodeRequestHandler {
  readonly nodeType = 'api-gateway';

  private gatewayStates: Map<string, GatewayState> = new Map();

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as ApiGatewayNodeData;
    return data.baseLatencyMs / speed;
  }

  initialize(node: Node): void {
    this.gatewayStates.set(node.id, this.createInitialState());
  }

  cleanup(nodeId: string): void {
    this.gatewayStates.delete(nodeId);
  }

  handleRequestArrival(
    node: Node,
    context: RequestContext,
    outgoingEdges: Edge[],
    allNodes: Node[]
  ): RequestDecision {
    const data = node.data as ApiGatewayNodeData;
    const state = this.getOrCreateState(node.id);

    state.totalRequests++;

    // Vérifier l'authentification (simulée via authFailureRate)
    if (data.authType !== 'none' && data.authFailureRate > 0) {
      if (Math.random() * 100 < data.authFailureRate) {
        state.authFailures++;
        state.blockedRequests++;
        return { action: 'reject', reason: 'auth-failure' };
      }
    }

    // Vérifier le rate limiting
    if (data.rateLimiting.enabled) {
      const rateLimitResult = this.checkRateLimit(state, data);
      if (!rateLimitResult.allowed) {
        state.rateLimitHits++;
        state.blockedRequests++;
        return { action: 'reject', reason: 'rate-limit' };
      }
    }

    // Simuler le taux d'erreur général
    if (data.errorRate > 0 && Math.random() * 100 < data.errorRate) {
      return { action: 'respond', isError: true };
    }

    // Si pas d'edges sortants, répondre directement
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    // Trouver la cible en fonction des règles de routage
    const targetEdge = this.findTargetEdge(data, outgoingEdges, allNodes, context);

    return {
      action: 'forward',
      targets: [
        {
          nodeId: targetEdge.target,
          edgeId: targetEdge.id,
        },
      ],
    };
  }

  /**
   * Trouve l'edge cible en fonction des règles de routage configurées
   */
  private findTargetEdge(
    data: ApiGatewayNodeData,
    outgoingEdges: Edge[],
    allNodes: Node[],
    context: RequestContext
  ): Edge {
    const routeRules = data.routeRules || [];
    const requestPath = context.requestPath || '/';

    // Si pas de règles, utiliser le premier edge
    if (routeRules.length === 0) {
      return outgoingEdges[0];
    }

    // Trier les règles par priorité
    const sortedRules = [...routeRules].sort((a, b) => a.priority - b.priority);

    // Créer un mapping des serviceName vers les edges
    const serviceToEdge = new Map<string, Edge>();
    for (const edge of outgoingEdges) {
      const targetNode = allNodes.find((n) => n.id === edge.target);
      if (targetNode && targetNode.type === 'http-server') {
        const serverData = targetNode.data as HttpServerNodeData;
        if (serverData.serviceName) {
          serviceToEdge.set(serverData.serviceName, edge);
        }
      }
    }

    // Chercher une règle dont le pattern match le requestPath
    for (const rule of sortedRules) {
      if (this.matchPath(requestPath, rule.pathPattern)) {
        const edge = serviceToEdge.get(rule.targetServiceName);
        if (edge) {
          return edge;
        }
      }
    }

    // Fallback: premier edge
    return outgoingEdges[0];
  }

  /**
   * Vérifie si un path correspond à un pattern
   * Supporte les wildcards: * (match tout segment), ** (match tous les segments restants)
   * Ex: "/api/users/*" match "/api/users/123"
   * Ex: "/api/**" match "/api/users/123/orders"
   */
  private matchPath(path: string, pattern: string): boolean {
    // Normaliser les paths
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedPattern = pattern.startsWith('/') ? pattern : `/${pattern}`;

    // Cas simple: pattern exact
    if (normalizedPattern === normalizedPath) {
      return true;
    }

    // Convertir le pattern en regex
    // * -> match un segment (tout sauf /)
    // ** -> match tout (y compris /)
    const regexPattern = normalizedPattern
      .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
      .replace(/\*/g, '[^/]+')
      .replace(/<<<DOUBLESTAR>>>/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(normalizedPath);
  }

  /**
   * Vérifie le rate limiting avec fenêtre glissante
   */
  private checkRateLimit(
    state: GatewayState,
    data: ApiGatewayNodeData
  ): { allowed: boolean } {
    const now = Date.now();
    const windowMs = data.rateLimiting.windowMs;

    // Reset de la fenêtre si nécessaire
    if (now - state.windowStartTime >= windowMs) {
      state.requestsInWindow = 0;
      state.windowStartTime = now;
    }

    // Vérifier si on peut accepter (avec burst)
    const maxRequests = data.rateLimiting.requestsPerSecond * (windowMs / 1000);
    const burstAllowance = data.rateLimiting.burstSize;

    if (state.requestsInWindow >= maxRequests + burstAllowance) {
      return { allowed: false };
    }

    state.requestsInWindow++;
    return { allowed: true };
  }

  /**
   * Récupère les statistiques d'une gateway
   */
  getStats(nodeId: string): {
    totalRequests: number;
    blockedRequests: number;
    authFailures: number;
    rateLimitHits: number;
  } | null {
    const state = this.gatewayStates.get(nodeId);
    if (!state) return null;

    return {
      totalRequests: state.totalRequests,
      blockedRequests: state.blockedRequests,
      authFailures: state.authFailures,
      rateLimitHits: state.rateLimitHits,
    };
  }

  private getOrCreateState(nodeId: string): GatewayState {
    let state = this.gatewayStates.get(nodeId);
    if (!state) {
      state = this.createInitialState();
      this.gatewayStates.set(nodeId, state);
    }
    return state;
  }

  private createInitialState(): GatewayState {
    return {
      requestsInWindow: 0,
      windowStartTime: Date.now(),
      totalRequests: 0,
      blockedRequests: 0,
      authFailures: 0,
      rateLimitHits: 0,
    };
  }
}
