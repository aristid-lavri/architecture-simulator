import type { OwaspRule, OwaspViolation } from '../types';
import { isReachableFrom, hasUpstreamOfType } from '../graph-utils';

export const OwaspNet001: OwaspRule = {
  id: 'OWASP-NET-001',
  framework: 'OWASP-API-Top10-2023',
  category: 'Network',
  severity: 'CRITICAL',
  titleKey: 'owasp.rules.net001.title',
  descriptionKey: 'owasp.rules.net001.description',
  remediationKey: 'owasp.rules.net001.remediation',

  validate({ nodes, edges }): OwaspViolation[] {
    const clients = nodes.filter((n) => n.type === 'client-group');
    const violations: OwaspViolation[] = [];
    const publicTypes = new Set(['api-gateway', 'http-server', 'api-service']);

    for (const node of nodes) {
      if (!publicTypes.has(node.type)) continue;
      const reachableFromClient = clients.some((c) => isReachableFrom(c.id, node.id, nodes, edges));
      if (!reachableFromClient) continue;
      if (!hasUpstreamOfType(node.id, 'waf', nodes, edges)) {
        violations.push({
          ruleId: 'OWASP-NET-001',
          affectedNodeIds: [node.id],
          details: `Endpoint public ${node.id} sans WAF en amont`,
        });
      }
    }
    return violations;
  },
};
