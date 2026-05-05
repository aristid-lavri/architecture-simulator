import type { OwaspRule, OwaspViolation } from '../types';
import { getUpstreamPath } from '../graph-utils';

export const OwaspRes001: OwaspRule = {
  id: 'OWASP-RES-001',
  framework: 'OWASP-API-Top10-2023',
  category: 'Resilience',
  severity: 'HIGH',
  titleKey: 'owasp.rules.res001.title',
  descriptionKey: 'owasp.rules.res001.description',
  remediationKey: 'owasp.rules.res001.remediation',

  validate({ nodes, edges }): OwaspViolation[] {
    const externalIds = nodes
      .filter((n) => (n.type === 'http-server' || n.type === 'cloud-storage') && !n.parentId)
      .map((n) => n.id);

    const internalServices = nodes.filter(
      (n) => (n.type === 'api-service' || n.type === 'background-job') && n.parentId
    );

    const violations: OwaspViolation[] = [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const ext of externalIds) {
      for (const svc of internalServices) {
        const path = getUpstreamPath(ext, svc.id, nodes, edges);
        if (path.length === 0) continue;
        const hasCB = path.some((id) => nodeMap.get(id)?.type === 'circuit-breaker');
        if (!hasCB) {
          violations.push({
            ruleId: 'OWASP-RES-001',
            affectedNodeIds: [svc.id, ext],
            details: `Appel ${svc.id} → ${ext} (externe) sans circuit breaker en série`,
          });
        }
      }
    }
    return violations;
  },
};
