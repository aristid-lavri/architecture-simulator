import { describe, expect, it } from 'vitest';
import { buildContext } from '@/lib/rules-engine/core';
import type { Rule } from '@/lib/rules-engine/core';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ComponentType } from '@/types/index';
import type { DraftEdge } from '@/plugins/extensions/edge-creation';

import { coreSanityPack } from '../pack';

import dbCannotInitiate from '../rules/physical/db-cannot-initiate';
import cacheCannotInitiate from '../rules/physical/cache-cannot-initiate';
import cdnCannotTargetClient from '../rules/physical/cdn-cannot-target-client';
import cacheCannotTargetClient from '../rules/physical/cache-cannot-target-client';
import dbCannotTargetClient from '../rules/physical/db-cannot-target-client';
import clientCannotTargetClient from '../rules/physical/client-cannot-target-client';
import firewallCannotInitiate from '../rules/physical/firewall-cannot-initiate';
import dnsCannotBeTargetOfData from '../rules/physical/dns-cannot-be-target-of-data';
import identityProviderCannotInitiate from '../rules/physical/identity-provider-cannot-initiate';

import queueDirectToQueue from '../rules/routing/queue-direct-to-queue';
import clientDirectToDb from '../rules/routing/client-direct-to-db';
import clientDirectToCache from '../rules/routing/client-direct-to-cache';
import lbTargetsLb from '../rules/routing/lb-targets-lb';
import serverlessTargetsClient from '../rules/routing/serverless-targets-client';

import orphanCircuitBreaker from '../rules/topology/orphan-circuit-breaker';

// ----- Helpers -----

function node(id: string, type: ComponentType): GraphNode {
  return { id, type, position: { x: 0, y: 0 }, data: {} };
}

function edge(id: string, source: string, target: string): GraphEdge {
  return { id, source, target };
}

/** Build a minimal context with one draft edge between two newly created nodes. */
function draft(sourceType: ComponentType, targetType: ComponentType) {
  const nodes = [node('s', sourceType), node('t', targetType)];
  const draftEdge: DraftEdge = { id: 'e1', source: 's', target: 't' };
  return buildContext(nodes, [], draftEdge);
}

// ----- Pack-level checks -----

describe('coreSanityPack', () => {
  it('exports exactly 30 rules', () => {
    expect(coreSanityPack.rules).toHaveLength(30);
  });

  it('has unique rule IDs all starting with core-sanity/', () => {
    const ids = coreSanityPack.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith('core-sanity/')).toBe(true);
    }
  });

  it('all rules have packId === core-sanity', () => {
    for (const r of coreSanityPack.rules) {
      expect(r.packId).toBe('core-sanity');
    }
  });

  it('counts: 13 errors + 17 warnings', () => {
    // Errors: 9 physical + 1 routing (queue→queue) + 1 topology (container-missing-parent)
    //         + 2 exposure (db/cache exposed publicly) = 13
    // Warnings: 4 routing + 6 topology (orphan-cb, orphan-node, cycle, single-lb-spof,
    //           single-db-spof, mq-no-consumer) + 2 security + 2 performance + 3 hygiene = 17
    const errors = coreSanityPack.rules.filter((r) => r.severity === 'error');
    const warnings = coreSanityPack.rules.filter((r) => r.severity === 'warning');
    expect(errors).toHaveLength(13);
    expect(warnings).toHaveLength(17);
  });
});

// ----- Generic helpers for edge-rule testing -----

function expectFires(rule: Rule, source: ComponentType, target: ComponentType) {
  const ctx = draft(source, target);
  const v = rule.evaluate(ctx);
  expect(v).toHaveLength(1);
  expect(v[0].ruleId).toBe(rule.id);
  expect(v[0].severity).toBe(rule.severity);
}

function expectSilent(rule: Rule, source: ComponentType, target: ComponentType) {
  const ctx = draft(source, target);
  expect(rule.evaluate(ctx)).toEqual([]);
}

// ----- Physical rules (9 ERROR) -----

describe('physical/db-cannot-initiate', () => {
  it('fires when source is database', () => {
    expectFires(dbCannotInitiate, 'database', 'http-server');
  });
  it('does not fire when source is not database', () => {
    expectSilent(dbCannotInitiate, 'http-server', 'database');
  });
});

describe('physical/cache-cannot-initiate', () => {
  it('fires when source is cache', () => {
    expectFires(cacheCannotInitiate, 'cache', 'http-server');
  });
  it('does not fire when source is not cache', () => {
    expectSilent(cacheCannotInitiate, 'http-server', 'cache');
  });
});

describe('physical/cdn-cannot-target-client', () => {
  it('fires when cdn → http-client', () => {
    expectFires(cdnCannotTargetClient, 'cdn', 'http-client');
  });
  it('fires when cdn → client-group', () => {
    expectFires(cdnCannotTargetClient, 'cdn', 'client-group');
  });
  it('does not fire when cdn → http-server', () => {
    expectSilent(cdnCannotTargetClient, 'cdn', 'http-server');
  });
});

describe('physical/cache-cannot-target-client', () => {
  it('fires when cache → http-client', () => {
    expectFires(cacheCannotTargetClient, 'cache', 'http-client');
  });
  it('does not fire when cache → http-server', () => {
    expectSilent(cacheCannotTargetClient, 'cache', 'http-server');
  });
});

describe('physical/db-cannot-target-client', () => {
  it('fires when database → http-client', () => {
    expectFires(dbCannotTargetClient, 'database', 'http-client');
  });
  it('fires when database → client-group', () => {
    expectFires(dbCannotTargetClient, 'database', 'client-group');
  });
  it('does not fire when database → http-server', () => {
    expectSilent(dbCannotTargetClient, 'database', 'http-server');
  });
});

describe('physical/client-cannot-target-client', () => {
  it('fires when http-client → http-client', () => {
    expectFires(clientCannotTargetClient, 'http-client', 'http-client');
  });
  it('fires when client-group → http-client', () => {
    expectFires(clientCannotTargetClient, 'client-group', 'http-client');
  });
  it('does not fire when http-client → http-server', () => {
    expectSilent(clientCannotTargetClient, 'http-client', 'http-server');
  });
});

describe('physical/firewall-cannot-initiate', () => {
  it('fires when source is firewall', () => {
    expectFires(firewallCannotInitiate, 'firewall', 'http-server');
  });
  it('fires when source is waf', () => {
    expectFires(firewallCannotInitiate, 'waf', 'http-server');
  });
  it('does not fire when source is http-client', () => {
    expectSilent(firewallCannotInitiate, 'http-client', 'firewall');
  });
});

describe('physical/dns-cannot-be-target-of-data', () => {
  it('fires when http-client → dns', () => {
    expectFires(dnsCannotBeTargetOfData, 'http-client', 'dns');
  });
  it('fires when api-service → dns', () => {
    expectFires(dnsCannotBeTargetOfData, 'api-service', 'dns');
  });
  it('does not fire when service-discovery → dns (passive infra source allowed)', () => {
    expectSilent(dnsCannotBeTargetOfData, 'service-discovery', 'dns');
  });
  it('does not fire when target is not dns', () => {
    expectSilent(dnsCannotBeTargetOfData, 'http-client', 'http-server');
  });
});

describe('physical/identity-provider-cannot-initiate', () => {
  it('fires when source is identity-provider', () => {
    expectFires(identityProviderCannotInitiate, 'identity-provider', 'http-server');
  });
  it('does not fire when source is anything else', () => {
    expectSilent(identityProviderCannotInitiate, 'http-server', 'identity-provider');
  });
});

// ----- Routing rules (1 ERROR + 4 WARNING) -----

describe('routing/queue-direct-to-queue', () => {
  it('fires when message-queue → message-queue', () => {
    expectFires(queueDirectToQueue, 'message-queue', 'message-queue');
  });
  it('does not fire when http-server → message-queue', () => {
    expectSilent(queueDirectToQueue, 'http-server', 'message-queue');
  });
});

describe('routing/client-direct-to-db', () => {
  it('fires when http-client → database', () => {
    expectFires(clientDirectToDb, 'http-client', 'database');
  });
  it('fires when client-group → database', () => {
    expectFires(clientDirectToDb, 'client-group', 'database');
  });
  it('does not fire when http-server → database', () => {
    expectSilent(clientDirectToDb, 'http-server', 'database');
  });
  it('does not fire when http-client → cloud-storage (Phase 1: only database)', () => {
    expectSilent(clientDirectToDb, 'http-client', 'cloud-storage');
  });
});

describe('routing/client-direct-to-cache', () => {
  it('fires when http-client → cache', () => {
    expectFires(clientDirectToCache, 'http-client', 'cache');
  });
  it('fires when client-group → cache', () => {
    expectFires(clientDirectToCache, 'client-group', 'cache');
  });
  it('does not fire when http-server → cache', () => {
    expectSilent(clientDirectToCache, 'http-server', 'cache');
  });
});

describe('routing/lb-targets-lb', () => {
  it('fires when load-balancer → load-balancer', () => {
    expectFires(lbTargetsLb, 'load-balancer', 'load-balancer');
  });
  it('does not fire when load-balancer → http-server', () => {
    expectSilent(lbTargetsLb, 'load-balancer', 'http-server');
  });
});

describe('routing/serverless-targets-client', () => {
  it('fires when serverless → http-client', () => {
    expectFires(serverlessTargetsClient, 'serverless', 'http-client');
  });
  it('fires when serverless → client-group', () => {
    expectFires(serverlessTargetsClient, 'serverless', 'client-group');
  });
  it('does not fire when serverless → http-server', () => {
    expectSilent(serverlessTargetsClient, 'serverless', 'http-server');
  });
});

// ----- Topology rule (graph-scope) -----

describe('topology/orphan-circuit-breaker', () => {
  it('fires for a circuit-breaker with exactly 1 edge', () => {
    const cb = node('cb', 'circuit-breaker');
    const s = node('s', 'http-server');
    const ctx = buildContext([cb, s], [edge('e', 's', 'cb')]);
    const violations = orphanCircuitBreaker.evaluate(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe(orphanCircuitBreaker.id);
    expect(violations[0].nodeIds).toEqual(['cb']);
  });

  it('does not fire for a circuit-breaker with 2+ edges', () => {
    const cb = node('cb', 'circuit-breaker');
    const a = node('a', 'http-server');
    const b = node('b', 'http-server');
    const ctx = buildContext(
      [cb, a, b],
      [edge('e1', 'a', 'cb'), edge('e2', 'cb', 'b')],
    );
    expect(orphanCircuitBreaker.evaluate(ctx)).toEqual([]);
  });

  it('does not fire for a circuit-breaker with 0 edges (degree < 1)', () => {
    const cb = node('cb', 'circuit-breaker');
    const ctx = buildContext([cb], []);
    expect(orphanCircuitBreaker.evaluate(ctx)).toEqual([]);
  });

  it('does not fire when there is no circuit-breaker in the graph', () => {
    const a = node('a', 'http-client');
    const b = node('b', 'http-server');
    const ctx = buildContext([a, b], [edge('e', 'a', 'b')]);
    expect(orphanCircuitBreaker.evaluate(ctx)).toEqual([]);
  });

  it('emits one violation per orphan circuit-breaker', () => {
    const cb1 = node('cb1', 'circuit-breaker');
    const cb2 = node('cb2', 'circuit-breaker');
    const a = node('a', 'http-server');
    const b = node('b', 'http-server');
    const ctx = buildContext(
      [cb1, cb2, a, b],
      [edge('e1', 'a', 'cb1'), edge('e2', 'b', 'cb2')],
    );
    const violations = orphanCircuitBreaker.evaluate(ctx);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.nodeIds?.[0]).sort()).toEqual(['cb1', 'cb2']);
  });
});
