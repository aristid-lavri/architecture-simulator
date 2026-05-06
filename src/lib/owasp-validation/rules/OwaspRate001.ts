import type { OwaspRule, OwaspViolation } from '../types';
import { isReachableFrom } from '../graph-utils';

export const OwaspRate001: OwaspRule = {
  id: 'OWASP-RATE-001',
  framework: 'OWASP-API-Top10-2023',
  category: 'Resource Limits',
  severity: 'CRITICAL',
  titleKey: 'owasp.rules.rate001.title',
  descriptionKey: 'owasp.rules.rate001.description',
  remediationKey: 'owasp.rules.rate001.remediation',

  validate({ nodes, edges }): OwaspViolation[] {
    const clients = nodes.filter((n) => n.type === 'client-group');
    const violations: OwaspViolation[] = [];
    for (const node of nodes) {
      if (node.type !== 'api-gateway') continue;
      const reachable = clients.some((c) => isReachableFrom(c.id, node.id, nodes, edges));
      if (!reachable) continue;
      const rl = (node.data as { rateLimiting?: { enabled?: boolean } }).rateLimiting;
      if (!rl || !rl.enabled) {
        violations.push({
          ruleId: 'OWASP-RATE-001',
          affectedNodeIds: [node.id],
          details: `Gateway publique ${node.id} sans rate limiting actif`,
        });
      }
    }
    return violations;
  },
};
