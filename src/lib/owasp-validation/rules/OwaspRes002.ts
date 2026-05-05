import type { OwaspRule, OwaspViolation } from '../types';

export const OwaspRes002: OwaspRule = {
  id: 'OWASP-RES-002',
  framework: 'OWASP-ASVS-Subset',
  category: 'Resilience',
  severity: 'MEDIUM',
  titleKey: 'owasp.rules.res002.title',
  descriptionKey: 'owasp.rules.res002.description',
  remediationKey: 'owasp.rules.res002.remediation',

  validate({ nodes }): OwaspViolation[] {
    const violations: OwaspViolation[] = [];
    for (const node of nodes) {
      if (node.type !== 'database') continue;
      const pool = (node.data as { connectionPool?: { maxConnections?: number } }).connectionPool;
      if (!pool || !pool.maxConnections || pool.maxConnections <= 0) {
        violations.push({
          ruleId: 'OWASP-RES-002',
          affectedNodeIds: [node.id],
          details: `Database ${node.id} sans pool de connexions configuré`,
        });
      }
    }
    return violations;
  },
};
