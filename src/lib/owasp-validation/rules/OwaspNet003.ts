import type { OwaspRule, OwaspViolation } from '../types';

const SENSITIVE_TYPES = new Set(['database', 'cache', 'identity-provider']);

export const OwaspNet003: OwaspRule = {
  id: 'OWASP-NET-003',
  framework: 'OWASP-ASVS-Subset',
  category: 'Network',
  severity: 'MEDIUM',
  titleKey: 'owasp.rules.net003.title',
  descriptionKey: 'owasp.rules.net003.description',
  remediationKey: 'owasp.rules.net003.remediation',

  validate({ nodes }): OwaspViolation[] {
    const violations: OwaspViolation[] = [];
    for (const node of nodes) {
      if (!SENSITIVE_TYPES.has(node.type)) continue;
      if (!node.parentId) {
        violations.push({
          ruleId: 'OWASP-NET-003',
          affectedNodeIds: [node.id],
          details: `Composant sensible ${node.id} (${node.type}) hors zone réseau`,
        });
      }
    }
    return violations;
  },
};
