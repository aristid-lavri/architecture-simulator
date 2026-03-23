import type { ComponentContentRenderer } from './types';

export const identityProviderRenderer: ComponentContentRenderer = {
  icon: '⊕',
  getContentLines(d) {
    const provider = d.providerType ?? 'keycloak';
    const protocol = d.protocol ?? 'oidc';
    const tokenFormat = d.tokenFormat as string | undefined;
    const mfa = d.mfaEnabled as boolean | undefined;
    const line1 = `${provider}  ${protocol}`;
    const parts: string[] = [];
    if (tokenFormat) parts.push(tokenFormat);
    if (mfa != null) parts.push(`MFA: ${mfa ? '✓' : '✕'}`);
    return parts.length > 0 ? [line1, parts.join('  ')] : [line1];
  },
};
