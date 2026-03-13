/**
 * Token simulé pour le flux d'authentification (Issue #52)
 */
export interface SimulatedToken {
  tokenId: string;
  clientId: string;
  idpId: string;
  format: 'jwt' | 'opaque' | 'saml-assertion';
  issuedAt: number;
  expiresAt: number;
  virtualClientId?: number;
}

/**
 * Store en mémoire pour les tokens simulés.
 * Gère l'émission, le stockage et la validation des tokens
 * dans le cadre de la simulation d'authentification.
 */
export class TokenStore {
  private tokens: Map<string, SimulatedToken> = new Map();
  /** Cache des validations gateway → IdP : clé = gatewayId:tokenId, valeur = expiresAt */
  private validationCache: Map<string, number> = new Map();

  private makeKey(clientId: string, idpId: string, virtualClientId?: number): string {
    if (virtualClientId !== undefined) {
      return `${clientId}:${virtualClientId}:${idpId}`;
    }
    return `${clientId}:${idpId}`;
  }

  getValidToken(clientId: string, idpId: string, virtualClientId?: number): SimulatedToken | null {
    const key = this.makeKey(clientId, idpId, virtualClientId);
    const token = this.tokens.get(key);
    if (!token) return null;
    if (token.expiresAt <= Date.now()) {
      this.tokens.delete(key);
      return null;
    }
    return token;
  }

  storeToken(token: SimulatedToken): void {
    const key = this.makeKey(token.clientId, token.idpId, token.virtualClientId);
    this.tokens.set(key, token);
  }

  invalidate(clientId: string, idpId: string, virtualClientId?: number): void {
    const key = this.makeKey(clientId, idpId, virtualClientId);
    this.tokens.delete(key);
  }

  /** Marque un token comme validé par une gateway (évite de revalider via IdP). */
  markValidated(gatewayId: string, tokenId: string, expiresAt: number): void {
    this.validationCache.set(`${gatewayId}:${tokenId}`, expiresAt);
  }

  /** Vérifie si un token a déjà été validé par cette gateway et n'est pas expiré. */
  isValidated(gatewayId: string, tokenId: string): boolean {
    const key = `${gatewayId}:${tokenId}`;
    const expiresAt = this.validationCache.get(key);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      this.validationCache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.tokens.clear();
    this.validationCache.clear();
  }
}
