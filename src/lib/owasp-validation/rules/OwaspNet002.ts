import type { OwaspRule, OwaspViolation } from '../types';

export const OwaspNet002: OwaspRule = {
  id: 'OWASP-NET-002',
  framework: 'OWASP-API-Top10-2023',
  category: 'Network',
  severity: 'CRITICAL',
  titleKey: 'owasp.rules.net002.title',
  descriptionKey: 'owasp.rules.net002.description',
  remediationKey: 'owasp.rules.net002.remediation',

  validate({ nodes }): OwaspViolation[] {
    const violations: OwaspViolation[] = [];
    const zoneById = new Map(
      nodes
        .filter((n) => n.type === 'network-zone')
        .map((n) => [n.id, (n.data as { zoneType?: string }).zoneType])
    );
    for (const node of nodes) {
      if (node.type !== 'database') continue;
      const parentId = node.parentId;
      if (!parentId) continue;
      const zoneType = zoneById.get(parentId);
      if (zoneType === 'dmz') {
        violations.push({
          ruleId: 'OWASP-NET-002',
          affectedNodeIds: [node.id],
          details: `Database ${node.id} placée en zone DMZ — risque d'exposition externe`,
        });
      }
    }
    return violations;
  },
};
