import type { OwaspRule, OwaspViolation } from '../types';

export const OwaspDlq001: OwaspRule = {
  id: 'OWASP-DLQ-001',
  framework: 'OWASP-ASVS-Subset',
  category: 'Reliability',
  severity: 'MEDIUM',
  titleKey: 'owasp.rules.dlq001.title',
  descriptionKey: 'owasp.rules.dlq001.description',
  remediationKey: 'owasp.rules.dlq001.remediation',

  validate({ nodes }): OwaspViolation[] {
    const violations: OwaspViolation[] = [];
    for (const node of nodes) {
      if (node.type !== 'message-queue') continue;
      const dlq = (node.data as { deadLetterEnabled?: boolean }).deadLetterEnabled;
      if (!dlq) {
        violations.push({
          ruleId: 'OWASP-DLQ-001',
          affectedNodeIds: [node.id],
          details: `MQ ${node.id} sans Dead Letter Queue — risque de perte de message`,
        });
      }
    }
    return violations;
  },
};
