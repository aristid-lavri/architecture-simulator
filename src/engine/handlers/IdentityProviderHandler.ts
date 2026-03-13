import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { IdentityProviderNodeData } from '@/types';

interface SessionCacheEntry {
  expiresAt: number;
}

interface IdentityProviderState {
  /** Cache de tokens validés : clé = originNodeId */
  sessionCache: Map<string, SessionCacheEntry>;
  /** Compteur de logins par minute par source */
  loginAttempts: Map<string, { count: number; windowStart: number }>;
}

export class IdentityProviderHandler implements NodeRequestHandler {
  readonly nodeType = 'identity-provider';

  private states: Map<string, IdentityProviderState> = new Map();

  getProcessingDelay(node: Node, speed: number, context?: RequestContext): number {
    const data = node.data as IdentityProviderNodeData;
    const state = this.getOrCreateState(node.id);

    // Multiplicateur de latence selon le format de token
    // JWT = validation locale rapide, opaque = lookup serveur, SAML = parsing XML lourd
    const formatMultiplier = data.tokenFormat === 'opaque' ? 2.5
      : data.tokenFormat === 'saml-assertion' ? 3.0
      : 1.0; // jwt

    // Vérifier le cache de sessions
    if (data.sessionCacheEnabled && context) {
      const cacheKey = context.originNodeId;
      const cached = state.sessionCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        // Cache hit : validation rapide (pas de multiplicateur, déjà validé)
        return data.tokenValidationLatencyMs / speed;
      }
    }

    // Cache miss ou pas de cache : génération de token
    let latency = data.tokenGenerationLatencyMs * formatMultiplier;

    // Ajouter la latence MFA si activé
    if (data.mfaEnabled) {
      latency += data.mfaLatencyMs;
    }

    return latency / speed;
  }

  initialize(node: Node): void {
    this.states.set(node.id, {
      sessionCache: new Map(),
      loginAttempts: new Map(),
    });
  }

  cleanup(nodeId: string): void {
    this.states.delete(nodeId);
  }

  handleRequestArrival(
    node: Node,
    context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    const data = node.data as IdentityProviderNodeData;
    const state = this.getOrCreateState(node.id);

    // Rate limiting sur les tentatives de login
    const sourceKey = context.originNodeId;
    const now = Date.now();
    const rateEntry = state.loginAttempts.get(sourceKey);

    if (rateEntry) {
      // Réinitialiser la fenêtre si plus d'une minute
      if (now - rateEntry.windowStart > 60000) {
        rateEntry.count = 1;
        rateEntry.windowStart = now;
      } else {
        rateEntry.count++;
        if (rateEntry.count > data.loginRateLimitPerMinute) {
          return { action: 'reject', reason: 'rate-limit' };
        }
      }
    } else {
      state.loginAttempts.set(sourceKey, { count: 1, windowStart: now });
    }

    // Vérifier le taux d'erreur
    if (Math.random() * 100 < data.errorRate) {
      return { action: 'reject', reason: 'auth-failure' };
    }

    // Vérifier le cache de sessions
    if (data.sessionCacheEnabled) {
      const cached = state.sessionCache.get(sourceKey);
      if (cached && cached.expiresAt > now) {
        // Token en cache valide — forward directement
        if (outgoingEdges.length === 0) {
          return { action: 'respond', isError: false };
        }
        const edge = outgoingEdges[0];
        return {
          action: 'forward',
          targets: [{ nodeId: edge.target, edgeId: edge.id }],
        };
      }
    }

    // Générer et mettre en cache le token
    if (data.sessionCacheEnabled) {
      state.sessionCache.set(sourceKey, {
        expiresAt: now + data.sessionCacheTTLSeconds * 1000,
      });
    }

    // Forward vers le service en aval
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    const edge = outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id }],
    };
  }

  private getOrCreateState(nodeId: string): IdentityProviderState {
    let state = this.states.get(nodeId);
    if (!state) {
      state = {
        sessionCache: new Map(),
        loginAttempts: new Map(),
      };
      this.states.set(nodeId, state);
    }
    return state;
  }
}
