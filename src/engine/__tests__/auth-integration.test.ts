import { describe, it, expect } from 'vitest';
import { IdentityProviderHandler } from '../handlers/IdentityProviderHandler';
import { ApiGatewayHandler } from '../handlers/ApiGatewayHandler';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type {
  IdentityProviderNodeData,
  ApiGatewayNodeData,
} from '@/types';
import type { RequestContext } from '../handlers/types';

/**
 * Tests d'intégration pour le flux d'authentification multi-hop avec queueing
 * (Task 22).
 *
 * Couvre :
 * 1. Le bypass auth d'API Gateway pour les requêtes d'acquisition de token
 *    (isAuthRequest=true) — la requête traverse la gateway sans token
 * 2. L'enrichissement de chain.authToken par le handler d'IdP via le mécanisme
 *    contextEnrichment, dans la décision 'respond' (cas terminal)
 * 3. La routing préférentielle de l'API Gateway vers un edge IdP quand
 *    isAuthRequest est vrai (sans nécessiter de routeRules configurées)
 *
 * Note : un test end-to-end complet (avec animation, timers, dispatcher complet)
 * nécessite un setup PixiJS + DOM lourd ; on couvre ici les invariants des
 * handlers pour garantir que le mécanisme de Task 22 reste fonctionnel.
 */

function createIdpNode(overrides: Partial<IdentityProviderNodeData> = {}): GraphNode {
  return {
    id: 'idp-1',
    type: 'identity-provider',
    position: { x: 0, y: 0 },
    data: {
      label: 'IdP',
      tokenFormat: 'jwt',
      tokenTTLSeconds: 3600,
      tokenGenerationLatencyMs: 50,
      tokenValidationLatencyMs: 20,
      mfaEnabled: false,
      mfaLatencyMs: 0,
      sessionCacheEnabled: false,
      sessionCacheTTLSeconds: 300,
      loginRateLimitPerMinute: 1000,
      errorRate: 0,
      ...overrides,
    } as IdentityProviderNodeData,
  } as GraphNode;
}

function createGatewayNode(overrides: Partial<ApiGatewayNodeData> = {}): GraphNode {
  return {
    id: 'gw-1',
    type: 'api-gateway',
    position: { x: 0, y: 0 },
    data: {
      label: 'Gateway',
      authType: 'jwt',
      authFailureRate: 0,
      autoTokenMode: 'valid',
      maxConnections: 1000,
      activeRequests: 0,
      rateLimiting: { enabled: false, requestsPerSecond: 100, burst: 200 },
      errorRate: 0,
      routeRules: [],
      ...overrides,
    } as ApiGatewayNodeData,
  } as GraphNode;
}

function createContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    chainId: 'chain-1',
    originNodeId: 'client-1',
    startTime: Date.now(),
    currentPath: ['client-1'],
    edgePath: [],
    requestPath: '/auth/login',
    httpMethod: 'POST',
    queryType: 'write',
    contentType: 'dynamic',
    payloadSizeBytes: 256,
    sourceIP: '10.0.0.1',
    ...overrides,
  };
}

describe('Auth flow integration — multi-hop with queueing (Task 22)', () => {
  describe('IdentityProviderHandler — token enrichment in respond case', () => {
    it('enriches chain.authToken via contextEnrichment when terminal (no outgoing edges)', () => {
      const handler = new IdentityProviderHandler();
      const idpNode = createIdpNode();
      handler.initialize?.(idpNode);
      const context = createContext({ isAuthRequest: true });

      const decision = handler.handleRequestArrival(idpNode, context, [], []);

      expect(decision.action).toBe('respond');
      if (decision.action === 'respond') {
        expect(decision.isError).toBe(false);
        expect(decision.contextEnrichment).toBeDefined();
        expect(decision.contextEnrichment?.authToken).toBeDefined();
        expect(decision.contextEnrichment?.authToken?.tokenId).toMatch(/^tok_/);
        expect(decision.contextEnrichment?.authToken?.format).toBe('jwt');
        expect(decision.contextEnrichment?.authToken?.issuerId).toBe(idpNode.id);
        expect(decision.contextEnrichment?.authToken?.expiresAt).toBeGreaterThan(Date.now());
      }
    });

    it('still enriches via forward when IdP has outgoing edges (existing behavior)', () => {
      const handler = new IdentityProviderHandler();
      const idpNode = createIdpNode();
      handler.initialize?.(idpNode);
      const downstreamEdge: GraphEdge = {
        id: 'e1',
        source: idpNode.id,
        target: 'downstream',
      } as GraphEdge;
      const context = createContext();

      const decision = handler.handleRequestArrival(idpNode, context, [downstreamEdge], []);

      expect(decision.action).toBe('forward');
      if (decision.action === 'forward') {
        expect(decision.targets[0].contextEnrichment?.authToken).toBeDefined();
      }
    });
  });

  describe('ApiGatewayHandler — bypass auth for isAuthRequest', () => {
    it('does not reject auth-request even without a token (no routeRules)', () => {
      const handler = new ApiGatewayHandler();
      const gw = createGatewayNode();
      handler.initialize?.(gw);

      // Edge sortant vers un IdP
      const idpEdge: GraphEdge = {
        id: 'e-gw-idp',
        source: gw.id,
        target: 'idp-1',
      } as GraphEdge;

      const idpNode = createIdpNode();
      const context = createContext({
        isAuthRequest: true,
        // Pas de authToken → comportement normal aurait été un reject 'no-token'
      });

      const decision = handler.handleRequestArrival(gw, context, [idpEdge], [idpNode]);

      // Ne doit pas rejeter avec 'no-token' grâce au bypass isAuthRequest
      expect(decision.action).not.toBe('reject');
    });

    it('routes auth-request preferentially to identity-provider edge', () => {
      const handler = new ApiGatewayHandler();
      const gw = createGatewayNode();
      handler.initialize?.(gw);

      // Deux edges sortants : 1 vers backend, 1 vers IdP
      const backendEdge: GraphEdge = {
        id: 'e-gw-backend',
        source: gw.id,
        target: 'backend-1',
      } as GraphEdge;
      const idpEdge: GraphEdge = {
        id: 'e-gw-idp',
        source: gw.id,
        target: 'idp-1',
      } as GraphEdge;

      const idpNode = createIdpNode();
      const backendNode: GraphNode = {
        id: 'backend-1',
        type: 'http-server',
        position: { x: 0, y: 0 },
        data: { label: 'Backend' },
      } as GraphNode;

      const context = createContext({ isAuthRequest: true });

      const decision = handler.handleRequestArrival(
        gw,
        context,
        [backendEdge, idpEdge],
        [backendNode, idpNode]
      );

      expect(decision.action).toBe('forward');
      if (decision.action === 'forward') {
        expect(decision.targets[0].nodeId).toBe('idp-1');
      }
    });

    it('still rejects non-auth-request without token (regression check)', () => {
      const handler = new ApiGatewayHandler();
      const gw = createGatewayNode();
      handler.initialize?.(gw);

      const downstreamEdge: GraphEdge = {
        id: 'e-gw-down',
        source: gw.id,
        target: 'backend-1',
      } as GraphEdge;
      const backendNode: GraphNode = {
        id: 'backend-1',
        type: 'http-server',
        position: { x: 0, y: 0 },
        data: { label: 'Backend' },
      } as GraphNode;

      const context = createContext({
        isAuthRequest: false, // Requête data normale
        requestPath: '/api/orders',
      });

      const decision = handler.handleRequestArrival(
        gw,
        context,
        [downstreamEdge],
        [backendNode]
      );

      expect(decision.action).toBe('reject');
      if (decision.action === 'reject') {
        expect(decision.reason).toBe('no-token');
      }
    });
  });

  describe('End-to-end auth flow (full SimulationEngine) — scaffold', () => {
    it.skip('TODO: client → WAF → CDN → APIGateway → IdP, multi-hop token acquisition', () => {
      // SCAFFOLD : un test end-to-end complet nécessite :
      // - Construire un graphe : client-group → WAF → CDN → APIGateway → IdP + un backend
      // - Démarrer SimulationEngine en mode running
      // - Avancer le temps virtuel (vi.advanceTimersByTime) pour faire propager les particles
      // - Vérifier que :
      //   1. Une chain isAuthRequest=true se propage vers l'IdP
      //   2. chain.authToken est enrichi par l'IdP
      //   3. Le client virtuel passe à 'authenticated' et envoie ses requêtes data
      //   4. Les requêtes data carryent le token et passent la gateway sans rejet
      //   5. Pendant l'auth, les requêtes générées par le timer sont queuées
      //      (pas de duplicate acquireToken kicked off)
      // Implémentation nécessite un mock complet du DOM/PixiJS pour ParticleManager,
      // raison du it.skip pour l'instant.
    });

    it.skip('TODO: concurrent queueing — N requests fire simultaneously during auth', () => {
      // SCAFFOLD :
      // - Configurer un client-group avec 5 virtual clients, baseInterval=100ms
      // - Pendant l'acquisition de token (durée > 100ms), plusieurs ticks
      //   doivent ajouter des requêtes à pendingRequests SANS kick off un nouvel
      //   acquireToken
      // - À la complétion : drain de la queue, toutes les requêtes parties en
      //   parallèle (concurrent burst)
    });
  });
});
