import type { AuthFlowStrategy, AuthRequest } from './AuthFlowStrategy';
import type { GraphNode } from '@/types/graph';

/**
 * Resource Owner Password Credentials (RFC 6749 Section 4.3).
 * 1 round-trip : POST /auth/login → IDP → JWT en réponse.
 * Modèle simplifié, pédagogiquement clair pour la démo.
 */
export class ROPCAuthStrategy implements AuthFlowStrategy {
  readonly kind = 'ropc' as const;
  readonly requiresAuthRequest = true;

  buildAuthRequest(_client: GraphNode, _idp: GraphNode): AuthRequest {
    return {
      method: 'POST',
      path: '/auth/login',
      payloadSizeBytes: 256,
    };
  }

  isAuthPath(requestPath: string): boolean {
    return requestPath.startsWith('/auth/');
  }
}
