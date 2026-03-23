import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision, ResponseDecision } from './types';
import type { ApiGatewayNodeData } from '@/types';

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
  /** Nombre de requêtes actuellement en cours de traitement (forwarded, pas encore répondues) */
  activeRequests: number;
  /** True quand le rate limit a été atteint — bloque toutes nouvelles requêtes jusqu'à ce que activeRequests tombe à 0 */
  isRateLimited: boolean;
  /** Config tracking — détecte les changements mid-simulation pour reset l'état */
  lastSeenRateLimitRps?: number;
  lastSeenRateLimitWindowMs?: number;
  lastSeenRateLimitBurst?: number;
  lastSeenRateLimitEnabled?: boolean;
  lastSeenAuthType?: string;
}

/**
 * Handler pour les nœuds API Gateway.
 * Gère le rate limiting et l'authentification.
 */
export class ApiGatewayHandler implements NodeRequestHandler {
  readonly nodeType = 'api-gateway';

  private gatewayStates: Map<string, GatewayState> = new Map();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as ApiGatewayNodeData;
    return data.baseLatencyMs / speed;
  }

  initialize(node: GraphNode): void {
    this.gatewayStates.set(node.id, this.createInitialState());
  }

  cleanup(nodeId: string): void {
    this.gatewayStates.delete(nodeId);
  }

  handleRequestArrival(
    node: GraphNode,
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as ApiGatewayNodeData;
    const state = this.getOrCreateState(node.id);

    // Détecter les changements de config mid-simulation et reset l'état accumulé
    const rl = data.rateLimiting;
    if (state.lastSeenRateLimitRps !== undefined && (
      state.lastSeenRateLimitRps !== rl.requestsPerSecond ||
      state.lastSeenRateLimitWindowMs !== rl.windowMs ||
      state.lastSeenRateLimitBurst !== rl.burstSize ||
      state.lastSeenRateLimitEnabled !== rl.enabled
    )) {
      state.requestsInWindow = 0;
      state.windowStartTime = Date.now();
      state.isRateLimited = false;
    }
    state.lastSeenRateLimitRps = rl.requestsPerSecond;
    state.lastSeenRateLimitWindowMs = rl.windowMs;
    state.lastSeenRateLimitBurst = rl.burstSize;
    state.lastSeenRateLimitEnabled = rl.enabled;

    if (state.lastSeenAuthType !== undefined && state.lastSeenAuthType !== data.authType) {
      state.authFailures = 0;
    }
    state.lastSeenAuthType = data.authType;

    state.totalRequests++;

    // Vérifier l'authentification (Issue #52 — vrai contrôle de token)
    if (data.authType !== 'none') {
      // 1. Vérifier la présence du token
      if (!context.authToken) {
        state.authFailures++;
        state.blockedRequests++;
        return { action: 'reject', reason: 'no-token' };
      }

      // 2. Vérifier l'expiration du token
      if (context.authToken.expiresAt < Date.now()) {
        state.authFailures++;
        state.blockedRequests++;
        return { action: 'reject', reason: 'token-expired' };
      }

      // 3. authFailureRate reste comme couche additionnelle (simule des erreurs aléatoires)
      if (data.authFailureRate > 0 && Math.random() * 100 < data.authFailureRate) {
        state.authFailures++;
        state.blockedRequests++;
        return { action: 'reject', reason: 'auth-failure' };
      }
    }

    // Vérifier le rate limiting
    if (data.rateLimiting.enabled) {
      // Si le rate limiter est actif et qu'il y a encore des requêtes en cours,
      // rejeter immédiatement toute nouvelle requête (vrai comportement rate limiter)
      if (state.isRateLimited && state.activeRequests > 0) {
        state.rateLimitHits++;
        state.blockedRequests++;
        return { action: 'reject', reason: 'rate-limit' };
      }

      // Si on était rate limited mais que toutes les requêtes sont terminées, on reset
      if (state.isRateLimited && state.activeRequests === 0) {
        state.isRateLimited = false;
        state.requestsInWindow = 0;
        state.windowStartTime = Date.now();
      }

      const rateLimitResult = this.checkRateLimit(state, data);
      if (!rateLimitResult.allowed) {
        state.isRateLimited = true;
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

    // Incrémenter le compteur de requêtes actives (en vol)
    state.activeRequests++;

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
    outgoingEdges: GraphEdge[],
    allNodes: GraphNode[],
    context: RequestContext
  ): GraphEdge {
    const routeRules = data.routeRules || [];
    const requestPath = context.requestPath || '/';

    // Si pas de règles, utiliser le premier edge
    if (routeRules.length === 0) {
      return outgoingEdges[0];
    }

    // Trier les règles par priorité
    const sortedRules = [...routeRules].sort((a, b) => a.priority - b.priority);

    // Créer un mapping des serviceName vers les edges
    const serviceToEdge = new Map<string, GraphEdge>();
    for (const edge of outgoingEdges) {
      const targetNode = allNodes.find((n) => n.id === edge.target);
      if (targetNode && (targetNode.type === 'http-server' || targetNode.type === 'api-service')) {
        const serverData = targetNode.data as { serviceName?: string };
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
   * Gère le passthrough d'une réponse à travers la gateway.
   * Décrémente le compteur de requêtes actives.
   */
  handleResponsePassthrough(
    node: GraphNode,
    _context: RequestContext,
    isError: boolean
  ): ResponseDecision {
    const state = this.getOrCreateState(node.id);

    // Décrémenter le compteur de requêtes en vol
    if (state.activeRequests > 0) {
      state.activeRequests--;
    }

    return { action: 'passthrough', isError };
  }

  /**
   * Récupère les statistiques d'une gateway
   */
  getStats(nodeId: string): {
    totalRequests: number;
    blockedRequests: number;
    authFailures: number;
    rateLimitHits: number;
    activeRequests: number;
  } | null {
    const state = this.gatewayStates.get(nodeId);
    if (!state) return null;

    return {
      totalRequests: state.totalRequests,
      blockedRequests: state.blockedRequests,
      authFailures: state.authFailures,
      rateLimitHits: state.rateLimitHits,
      activeRequests: state.activeRequests,
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
      activeRequests: 0,
      isRateLimited: false,
    };
  }
}
