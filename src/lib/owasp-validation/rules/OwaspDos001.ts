import type { OwaspRule, OwaspViolation } from '../types';

export const OwaspDos001: OwaspRule = {
  id: 'OWASP-DOS-001',
  framework: 'OWASP-ASVS-Subset',
  category: 'Configuration',
  severity: 'INFO',
  titleKey: 'owasp.rules.dos001.title',
  descriptionKey: 'owasp.rules.dos001.description',
  remediationKey: 'owasp.rules.dos001.remediation',

  validate({ nodes }): OwaspViolation[] {
    const violations: OwaspViolation[] = [];
    for (const node of nodes) {
      const authFailureRate = (node.data as { authFailureRate?: number }).authFailureRate;
      if (typeof authFailureRate === 'number' && authFailureRate > 5) {
        violations.push({
          ruleId: 'OWASP-DOS-001',
          affectedNodeIds: [node.id],
          details: `${node.id} a authFailureRate=${authFailureRate}% (>5%) — config peu réaliste, risque de DoS auth`,
        });
      }
    }
    return violations;
  },
};
