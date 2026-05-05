import type { OwaspRule, OwaspViolation } from '../types';

export const OwaspAuth002: OwaspRule = {
  id: 'OWASP-AUTH-002',
  framework: 'OWASP-API-Top10-2023',
  category: 'Authentication',
  severity: 'HIGH',
  titleKey: 'owasp.rules.auth002.title',
  descriptionKey: 'owasp.rules.auth002.description',
  remediationKey: 'owasp.rules.auth002.remediation',

  validate({ nodes }): OwaspViolation[] {
    const violations: OwaspViolation[] = [];
    for (const node of nodes) {
      if (node.type !== 'identity-provider') continue;
      const mfa = (node.data as { mfaEnabled?: boolean }).mfaEnabled ?? false;
      if (!mfa) {
        violations.push({
          ruleId: 'OWASP-AUTH-002',
          affectedNodeIds: [node.id],
          details: `IDP ${node.id} sans MFA activé`,
        });
      }
    }
    return violations;
  },
};
