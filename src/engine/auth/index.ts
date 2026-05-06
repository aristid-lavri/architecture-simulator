import { ROPCAuthStrategy } from './ROPCAuthStrategy';
import type { AuthFlowKind, AuthFlowStrategy } from './AuthFlowStrategy';

export type { AuthFlowKind, AuthFlowStrategy, AuthRequest } from './AuthFlowStrategy';
export { ROPCAuthStrategy } from './ROPCAuthStrategy';

/**
 * Factory : retourne la stratégie par kind.
 * Default : ROPC (le seul implémenté en Phase 2).
 */
export function getAuthStrategy(kind: AuthFlowKind = 'ropc'): AuthFlowStrategy {
  switch (kind) {
    case 'ropc':
      return new ROPCAuthStrategy();
    case 'oauth-code':
      throw new Error('OAuth Authorization Code flow non implémenté — voir EXTENSIONS-Auth-OIDC-OWASP.md');
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
