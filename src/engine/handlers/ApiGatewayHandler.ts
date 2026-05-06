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
  /** Rejets pour dépassement de capacité (maxConnections) */
  capacityRejections: number;
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
    const state = this.gatewayStates.get(node.id);
    const baseLatency = data.baseLatencyMs;

    // Dégradation de latence sous charge (formule quadratique)
    if (state && data.maxConnections > 0 && state.activeRequests > 0) {
      const utilization = state.activeRequests / data.maxConnections;
      const degradationFactor = 1 + Math.pow(Math.min(utilization, 1), 2);
      return (baseLatency * degradationFactor) / speed;
    }

    return baseLatency / speed;
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

    // Vérifier la capacité (maxConnections) — la gateway a des limites physiques/cloud
    if (data.maxConnections > 0 && state.activeRequests >= data.maxConnections) {
      state.capacityRejections++;
      state.blockedRequests++;
      return { action: 'reject', reason: 'capacity' };
    }

    // Vérifier l'authentification (Issue #52 — vrai contrôle de token)
    if (data.authType !== 'none') {
      // Bypass auth pour les routes ciblant un identity-provider (login flow)
      const requestPath = context.requestPath ?? '/';
      const targetingIdP = this.routeTargetsIdentityProvider(data, requestPath, outgoingEdges, allNodes);
      // Bypass aussi pour les requêtes d'acquisition de token (Task 22) — pas besoin de routeRule
      const isAuthRequest = context.isAuthRequest === true;
      if (!targetingIdP && !isAuthRequest) {
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
      // Si targetingIdP, on saute les checks et on laisse passer (login flow)
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

    // Si des routeRules existent mais qu'aucune ne matche, rejeter au lieu de
    // tomber aveuglément sur outgoingEdges[0] (qui peut être un IdP voisin et
    // produire un routage incorrect).
    if (!targetEdge) {
      state.blockedRequests++;
      return { action: 'reject', reason: 'no-route' };
    }

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
   * Trouve l'edge cible en fonction des règles de routage configurées.
   * Retourne `null` si des `routeRules` sont définies mais qu'aucune ne matche
   * — le caller doit alors transformer en `reject { reason: 'no-route' }`.
   */
  private findTargetEdge(
    data: ApiGatewayNodeData,
    outgoingEdges: GraphEdge[],
    allNodes: GraphNode[],
    context: RequestContext
  ): GraphEdge | null {
    const routeRules = data.routeRules || [];
    const requestPath = context.requestPath || '/';

    // Pour une requête d'acquisition de token (Task 22), router en priorité vers un IdP connecté
    if (context.isAuthRequest === true) {
      for (const edge of outgoingEdges) {
        const target = allNodes.find((n) => n.id === edge.target);
        if (target?.type === 'identity-provider') {
          return edge;
        }
      }
      // Fallback : passthrough infrastructure (waf/cdn/...) qui peut mener à un IdP
      const PASSTHROUGH = new Set(['waf', 'cdn', 'api-gateway', 'load-balancer', 'firewall', 'dns']);
      for (const edge of outgoingEdges) {
        const target = allNodes.find((n) => n.id === edge.target);
        if (target && PASSTHROUGH.has(target.type)) {
          return edge;
        }
      }
    }

    // Si aucune règle n'est configurée, conserver le comportement legacy (1er edge)
    if (routeRules.length === 0) {
      return outgoingEdges[0] ?? null;
    }

    // Trier les règles par priorité
    const sortedRules = [...routeRules].sort((a, b) => a.priority - b.priority);

    // Créer un mapping des serviceName vers les edges
    const serviceToEdge = new Map<string, GraphEdge>();
    for (const edge of outgoingEdges) {
      const targetNode = allNodes.find((n) => n.id === edge.target);
      if (targetNode && (
        targetNode.type === 'http-server' ||
        targetNode.type === 'api-service' ||
        targetNode.type === 'identity-provider'
      )) {
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

    // Aucune routeRule ne matche : ne PAS fallback aveuglément.
    return null;
  }

  /**
   * Vérifie si une route rule du gateway, qui matche le requestPath, cible
   * un nœud de type identity-provider. Utilisé pour bypass l'auth check sur
   * les routes /auth/* (login flow OIDC).
   */
  private routeTargetsIdentityProvider(
    data: ApiGatewayNodeData,
    requestPath: string,
    outgoingEdges: GraphEdge[],
    allNodes: GraphNode[]
  ): boolean {
    const routeRules = data.routeRules ?? [];
    const sortedRules = [...routeRules].sort((a, b) => a.priority - b.priority);
    for (const rule of sortedRules) {
      if (this.matchPath(requestPath, rule.pathPattern)) {
        // Trouver le nœud cible par serviceName parmi les outgoingEdges
        for (const edge of outgoingEdges) {
          const target = allNodes.find((n) => n.id === edge.target);
          if (!target) continue;
          const tName = (target.data as { serviceName?: string }).serviceName;
          if (tName === rule.targetServiceName && target.type === 'identity-provider') {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Vérifie si un path correspond à un pattern.
   * Supporte les wildcards : `*` (un segment), `**` (zero ou plusieurs segments).
   * Convention Spring/Express : "/foo/**" matche "/foo", "/foo/", et "/foo/bar/baz".
   */
  private matchPath(path: string, pattern: string): boolean {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedPattern = pattern.startsWith('/') ? pattern : `/${pattern}`;

    if (normalizedPattern === normalizedPath) {
      return true;
    }

    // Ordre de substitution :
    //   1. "/**" (préfixé par /) → suffixe optionnel "(?:/.*)?" — matche aussi le path nu
    //   2. "**" orphelin (rare)  → ".*"
    //   3. "*" simple             → "[^/]+" (un segment, sans /)
    const regexPattern = normalizedPattern
      .replace(/\/\*\*/g, '<<<SLASHDOUBLESTAR>>>')
      .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
      .replace(/\*/g, '[^/]+')
      .replace(/<<<SLASHDOUBLESTAR>>>/g, '(?:/.*)?')
      .replace(/<<<DOUBLESTAR>>>/g, '.*');

    return new RegExp(`^${regexPattern}$`).test(normalizedPath);
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
    capacityRejections: number;
    activeRequests: number;
  } | null {
    const state = this.gatewayStates.get(nodeId);
    if (!state) return null;

    return {
      totalRequests: state.totalRequests,
      blockedRequests: state.blockedRequests,
      authFailures: state.authFailures,
      rateLimitHits: state.rateLimitHits,
      capacityRejections: state.capacityRejections,
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
      capacityRejections: 0,
      activeRequests: 0,
      isRateLimited: false,
    };
  }
}
