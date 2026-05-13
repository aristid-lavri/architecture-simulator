/**
 * Smoke tests for the basic architecture templates (A1.1).
 *
 * Each template is parsed at module load via `parseYamlArchitecture`. If
 * parsing fails for any of them, `architectureTemplates.find(...)` returns
 * `undefined` here — failing the test immediately surfaces the broken YAML.
 */
import { describe, it, expect } from 'vitest';
import { architectureTemplates, getTemplateById } from '@/data/architecture-templates';

describe('basic architecture templates load and parse', () => {
  const ids = ['monolith', 'load-balanced', 'microservices'] as const;
  for (const id of ids) {
    it(`template "${id}" parses with at least 1 node and 1 edge`, () => {
      const tpl = getTemplateById(id);
      expect(tpl, `template "${id}" not found`).toBeDefined();
      expect(tpl!.nodes.length).toBeGreaterThanOrEqual(1);
      expect(tpl!.edges.length).toBeGreaterThanOrEqual(1);
    });
  }
});

describe('new templates (A1.1 — Phase 0 Quick Wins)', () => {
  it('Event-Driven CQRS loads and has the expected services', () => {
    const tpl = getTemplateById('cqrs');
    expect(tpl, 'cqrs template not found').toBeDefined();
    expect(tpl!.nodes.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(tpl!.nodes.map((n) => n.id));
    expect(ids.has('command-service')).toBe(true);
    expect(ids.has('query-service')).toBe(true);
    expect(ids.has('event-bus')).toBe(true);
    expect(ids.has('read-db')).toBe(true);
    expect(ids.has('write-db')).toBe(true);
  });

  it('Serverless API loads and includes a cloud-function + cloud-storage', () => {
    const tpl = getTemplateById('serverless-api');
    expect(tpl, 'serverless-api template not found').toBeDefined();
    expect(tpl!.nodes.length).toBeGreaterThanOrEqual(1);
    const types = new Set(tpl!.nodes.map((n) => n.type));
    expect(types.has('cloud-function')).toBe(true);
    expect(types.has('cloud-storage')).toBe(true);
    expect(types.has('api-gateway')).toBe(true);
  });

  it('Monolith Decomposition loads with both legacy monolith and extracted service', () => {
    const tpl = getTemplateById('monolith-decomposition');
    expect(tpl, 'monolith-decomposition template not found').toBeDefined();
    expect(tpl!.nodes.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(tpl!.nodes.map((n) => n.id));
    expect(ids.has('monolith-legacy')).toBe(true);
    expect(ids.has('order-service')).toBe(true);
    expect(ids.has('legacy-db')).toBe(true);
    expect(ids.has('orders-db')).toBe(true);
  });

  it('BFF loads with mobile BFF + web BFF + shared backend services', () => {
    const tpl = getTemplateById('bff');
    expect(tpl, 'bff template not found').toBeDefined();
    expect(tpl!.nodes.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(tpl!.nodes.map((n) => n.id));
    expect(ids.has('mobile-bff')).toBe(true);
    expect(ids.has('web-bff')).toBe(true);
    expect(ids.has('user-service')).toBe(true);
    expect(ids.has('catalog-service')).toBe(true);
    expect(ids.has('order-service')).toBe(true);
  });

  it('all four new templates appear in the exported template list', () => {
    const seen = architectureTemplates.map((t) => t.id);
    for (const id of ['cqrs', 'serverless-api', 'monolith-decomposition', 'bff']) {
      expect(seen).toContain(id);
    }
  });
});
