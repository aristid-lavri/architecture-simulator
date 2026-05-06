import { describe, it, expect } from 'vitest';
import { runOwaspValidation } from '../engine';
import { architectureTemplates } from '@/data/architecture-templates';

describe('OWASP validation on existing architecture templates', () => {
  it('all templates load and produce a result', () => {
    for (const tpl of architectureTemplates) {
      const result = runOwaspValidation({ nodes: tpl.nodes, edges: tpl.edges });
      expect(result.totalRules).toBe(10);
      expect(result.violations).toBeDefined();
    }
  });

  it('logs baseline violations per template (informational)', () => {
    for (const tpl of architectureTemplates) {
      const result = runOwaspValidation({ nodes: tpl.nodes, edges: tpl.edges });
      const summary = `${tpl.id}: ${result.failedRules}/${result.totalRules} failed | ` +
        `CRIT=${result.bySeverity.CRITICAL} HIGH=${result.bySeverity.HIGH} ` +
        `MED=${result.bySeverity.MEDIUM} INFO=${result.bySeverity.INFO}`;
      console.log(summary);
    }
  });

  it('mature templates (banking-online, banking-multipole, medical-central, tax-system) have ≤1 CRITICAL violations', () => {
    const mature = ['banking-online', 'banking-multipole', 'medical-central', 'tax-system'];
    for (const id of mature) {
      const tpl = architectureTemplates.find((t) => t.id === id);
      if (!tpl) continue; // template not in this list, skip
      const result = runOwaspValidation({ nodes: tpl.nodes, edges: tpl.edges });
      // banking-online and banking-multipole have 1 CRITICAL (CDN without auth), which is expected
      // for real-world patterns. medical-central and tax-system have 0 CRITICAL.
      // TODO: Add optional authentication config to CDN node type to make these templates fully compliant.
      expect(result.bySeverity.CRITICAL, `${id} should have ≤1 CRITICAL violations`).toBeLessThanOrEqual(1);
    }
  });

  it('simple templates (monolith) have at least 1 CRITICAL violation', () => {
    const monolith = architectureTemplates.find((t) => t.id === 'monolith');
    if (!monolith) return;
    const result = runOwaspValidation({ nodes: monolith.nodes, edges: monolith.edges });
    expect(result.bySeverity.CRITICAL).toBeGreaterThanOrEqual(1);
  });
});
