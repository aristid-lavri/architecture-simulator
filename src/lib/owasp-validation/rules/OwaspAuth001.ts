import type { OwaspRule, OwaspViolation } from '../types';
import { isReachableFrom } from '../graph-utils';

export const OwaspAuth001: OwaspRule = {
  id: 'OWASP-AUTH-001',
  framework: 'OWASP-API-Top10-2023',
  category: 'Authentication',
  severity: 'CRITICAL',
  titleKey: 'owasp.rules.auth001.title',
  descriptionKey: 'owasp.rules.auth001.description',
  remediationKey: 'owasp.rules.auth001.remediation',

  validate({ nodes, edges }): OwaspViolation[] {
    const clientIds = nodes.filter((n) => n.type === 'client-group').map((n) => n.id);
    const violations: OwaspViolation[] = [];
    const publicEndpointTypes = new Set(['api-gateway', 'http-server', 'api-service']);

    for (const node of nodes) {
      if (!publicEndpointTypes.has(node.type)) continue;
      const isPublic = clientIds.some((cid) => isReachableFrom(cid, node.id, nodes, edges));
      if (!isPublic) continue;
      const authType = (node.data as { authType?: string }).authType ?? 'none';
      if (authType === 'none') {
        violations.push({
          ruleId: 'OWASP-AUTH-001',
          affectedNodeIds: [node.id],
          details: `Endpoint public ${node.id} (${node.type}) sans authentification`,
        });
      }
    }
    return violations;
  },
};
