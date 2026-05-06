import type { GraphNode } from '@/types/graph';

/**
 * Identifie le mode d'auth modélisé par la stratégie.
 * Ajouter ici les nouvelles stratégies (extensions futures).
 */
export type AuthFlowKind = 'ropc' | 'oauth-code'; // 'oauth-code' réservé pour évolution

/**
 * Représente une requête d'authentification simulée à émettre par le client.
 * La stratégie décide ce qu'est cette requête (path, method, payload size).
 */
export interface AuthRequest {
  method: 'POST' | 'GET';
  path: string;
  payloadSizeBytes: number;
}

/**
 * Strategy pour le flow d'auth modélisé par le simulateur.
 * Le client utilise cette stratégie pour :
 * 1. Décider QUAND il faut s'authentifier (ex: pas de token)
 * 2. Construire la requête d'auth à envoyer
 * 3. Détecter quand un token a été acquis (via le chain)
 */
export interface AuthFlowStrategy {
  readonly kind: AuthFlowKind;

  /** True si ce flow nécessite que la 1ère requête soit une requête d'auth dédiée */
  readonly requiresAuthRequest: boolean;

  /** Construit la requête d'auth (POST /auth/login pour ROPC) */
  buildAuthRequest(client: GraphNode, idp: GraphNode): AuthRequest;

  /**
   * Vérifie si le path actuel correspond à une auth request (pour bypass côté gateway).
   * Le ApiGatewayHandler appelle cette méthode pour décider si le check JWT s'applique.
   */
  isAuthPath(requestPath: string): boolean;
}
