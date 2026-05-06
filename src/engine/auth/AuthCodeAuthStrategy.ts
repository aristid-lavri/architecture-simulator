import type { AuthFlowStrategy, AuthRequest } from './AuthFlowStrategy';
import type { GraphNode } from '@/types/graph';

/**
 * STUB — OAuth 2.0 Authorization Code Flow (RFC 6749 Section 4.1).
 *
 * NOT YET IMPLEMENTED. Pour l'implémenter :
 * 1. Modéliser 2 round-trips :
 *    a. GET /authorize → redirige vers IDP, l'utilisateur authentifie + MFA, IDP renvoie un `code`
 *    b. POST /token { code } → IDP renvoie le JWT
 * 2. Étendre RequestContext avec un champ `authCode?: string`
 * 3. Le ClientGroupSimulator doit gérer 2 états transitoires (waiting-for-code, exchanging-code)
 * 4. Le ApiGatewayHandler doit bypass /authorize ET /token paths
 *
 * Voir EXTENSIONS-Auth-OIDC-OWASP.md pour le design complet.
 */
export class AuthCodeAuthStrategy implements AuthFlowStrategy {
  readonly kind = 'oauth-code' as const;
  readonly requiresAuthRequest = true;

  buildAuthRequest(_client: GraphNode, _idp: GraphNode): AuthRequest {
    throw new Error('AuthCodeAuthStrategy not implemented — see EXTENSIONS-Auth-OIDC-OWASP.md');
  }

  isAuthPath(requestPath: string): boolean {
    return requestPath.startsWith('/authorize') || requestPath === '/token';
  }
}
