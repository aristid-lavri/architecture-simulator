import { describe, expect, it } from 'vitest';
import { buildContext } from '@/lib/rules-engine/core';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ComponentType, NetworkZoneNodeData } from '@/types';

// Topology
import orphanNode from '../rules/topology/orphan-node';
import cycleDetected from '../rules/topology/cycle-detected';
import singleLbSpof from '../rules/topology/single-lb-spof';
import singleDbSpof from '../rules/topology/single-db-spof';
import mqNoConsumer from '../rules/topology/mq-no-consumer';
import containerMissingParent from '../rules/topology/container-missing-parent';

// Exposure
import dbExposedPublicly from '../rules/exposure/db-exposed-publicly';
import cacheExposedPublicly from '../rules/exposure/cache-exposed-publicly';

// Security
import crossZoneEdgeNoGateway from '../rules/security/cross-zone-edge-no-gateway';
import publicServiceNoAuth from '../rules/security/public-service-no-auth';

// Performance
import noCdnMultiClients from '../rules/performance/no-cdn-multi-clients';
import dbWithoutCache from '../rules/performance/db-without-cache';

// Hygiene
import duplicateNodeNames from '../rules/hygiene/duplicate-node-names';
import edgeNoProtocol from '../rules/hygiene/edge-no-protocol';
import duplicateEdge from '../rules/hygiene/duplicate-edge';

function node(
  id: string,
  type: ComponentType,
  data: Record<string, unknown> = {},
  parentId?: string,
): GraphNode {
  return { id, type, position: { x: 0, y: 0 }, data, parentId };
}

function edge(
  id: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {},
): GraphEdge {
  return { id, source, target, data };
}

function zoneNode(id: string, zoneType: NetworkZoneNodeData['zoneType']): GraphNode {
  return node(id, 'network-zone', { label: id, zoneType });
}

// =========================================================================
// topology/orphan-node
// =========================================================================
describe('topology/orphan-node', () => {
  it('fires for a node with no edges', () => {
    const ctx = buildContext([node('x', 'http-server')], []);
    const v = orphanNode.evaluate(ctx);
    expect(v).toHaveLength(1);
    expect(v[0].ruleId).toBe(orphanNode.id);
    expect(v[0].nodeIds).toEqual(['x']);
  });

  it('does not fire for a connected node', () => {
    const ctx = buildContext(
      [node('a', 'http-client'), node('b', 'http-server')],
      [edge('e1', 'a', 'b')],
    );
    expect(orphanNode.evaluate(ctx)).toEqual([]);
  });

  it('exempts containers, passive infra and circuit-breaker', () => {
    const ctx = buildContext(
      [
        node('zone', 'network-zone'),
        node('host', 'host-server'),
        node('cont', 'container'),
        node('dns', 'dns'),
        node('sd', 'service-discovery'),
        node('idp', 'identity-provider'),
        node('cb', 'circuit-breaker'),
      ],
      [],
    );
    expect(orphanNode.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// topology/cycle-detected
// =========================================================================
describe('topology/cycle-detected', () => {
  it('fires for a simple A → B → A cycle', () => {
    const ctx = buildContext(
      [node('a', 'http-server'), node('b', 'http-server')],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')],
    );
    const v = cycleDetected.evaluate(ctx);
    expect(v.length).toBeGreaterThanOrEqual(1);
    expect(v[0].ruleId).toBe(cycleDetected.id);
  });

  it('fires for a self-loop', () => {
    const ctx = buildContext([node('a', 'http-server')], [edge('e1', 'a', 'a')]);
    const v = cycleDetected.evaluate(ctx);
    expect(v.length).toBeGreaterThanOrEqual(1);
    expect(v[0].edgeIds).toContain('e1');
  });

  it('does not fire for a DAG', () => {
    const ctx = buildContext(
      [node('a', 'http-client'), node('b', 'http-server'), node('c', 'database')],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    );
    expect(cycleDetected.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// topology/single-lb-spof
// =========================================================================
describe('topology/single-lb-spof', () => {
  it('fires when one LB load-balances 2+ backends', () => {
    const ctx = buildContext(
      [
        node('lb', 'load-balancer'),
        node('s1', 'http-server'),
        node('s2', 'http-server'),
      ],
      [edge('e1', 'lb', 's1'), edge('e2', 'lb', 's2')],
    );
    const v = singleLbSpof.evaluate(ctx);
    expect(v).toHaveLength(1);
    expect(v[0].nodeIds).toEqual(['lb']);
  });

  it('does not fire with 2 LBs', () => {
    const ctx = buildContext(
      [
        node('lb1', 'load-balancer'),
        node('lb2', 'load-balancer'),
        node('s1', 'http-server'),
        node('s2', 'http-server'),
      ],
      [edge('e1', 'lb1', 's1'), edge('e2', 'lb2', 's2')],
    );
    expect(singleLbSpof.evaluate(ctx)).toEqual([]);
  });

  it('does not fire if LB has only 1 backend', () => {
    const ctx = buildContext(
      [node('lb', 'load-balancer'), node('s1', 'http-server')],
      [edge('e1', 'lb', 's1')],
    );
    expect(singleLbSpof.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// topology/single-db-spof
// =========================================================================
describe('topology/single-db-spof', () => {
  it('fires when 1 DB has 2+ upstream services', () => {
    const ctx = buildContext(
      [
        node('db', 'database'),
        node('s1', 'http-server'),
        node('s2', 'http-server'),
      ],
      [edge('e1', 's1', 'db'), edge('e2', 's2', 'db')],
    );
    expect(singleDbSpof.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when there are 2 databases', () => {
    const ctx = buildContext(
      [
        node('db1', 'database'),
        node('db2', 'database'),
        node('s1', 'http-server'),
        node('s2', 'http-server'),
      ],
      [edge('e1', 's1', 'db1'), edge('e2', 's2', 'db2')],
    );
    expect(singleDbSpof.evaluate(ctx)).toEqual([]);
  });

  it('does not fire when the DB has just 1 upstream', () => {
    const ctx = buildContext(
      [node('db', 'database'), node('s1', 'http-server')],
      [edge('e1', 's1', 'db')],
    );
    expect(singleDbSpof.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// topology/mq-no-consumer
// =========================================================================
describe('topology/mq-no-consumer', () => {
  it('fires when MQ has a producer but no consumer', () => {
    const ctx = buildContext(
      [node('mq', 'message-queue'), node('s', 'http-server')],
      [edge('e', 's', 'mq')],
    );
    expect(mqNoConsumer.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when MQ has a consumer', () => {
    const ctx = buildContext(
      [
        node('mq', 'message-queue'),
        node('s', 'http-server'),
        node('w', 'background-job'),
      ],
      [edge('e1', 's', 'mq'), edge('e2', 'mq', 'w')],
    );
    expect(mqNoConsumer.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// topology/container-missing-parent
// =========================================================================
describe('topology/container-missing-parent', () => {
  it('fires for a container with no parent', () => {
    const ctx = buildContext([node('c', 'container')], []);
    const v = containerMissingParent.evaluate(ctx);
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('error');
  });

  it('fires when parent is not a host-server', () => {
    const ctx = buildContext(
      [
        zoneNode('zone', 'backend'),
        node('c', 'container', {}, 'zone'),
      ],
      [],
    );
    expect(containerMissingParent.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when parent is a host-server', () => {
    const ctx = buildContext(
      [
        node('host', 'host-server'),
        node('c', 'container', {}, 'host'),
      ],
      [],
    );
    expect(containerMissingParent.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// exposure/db-exposed-publicly
// =========================================================================
describe('exposure/db-exposed-publicly', () => {
  it('fires when http-client edges directly to a database', () => {
    const ctx = buildContext(
      [node('c', 'http-client'), node('db', 'database')],
      [edge('e1', 'c', 'db')],
    );
    const v = dbExposedPublicly.evaluate(ctx);
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('error');
  });

  it('fires when client-group edges directly to a database', () => {
    const ctx = buildContext(
      [node('c', 'client-group'), node('db', 'database')],
      [edge('e1', 'c', 'db')],
    );
    expect(dbExposedPublicly.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when an http-server fronts the DB', () => {
    const ctx = buildContext(
      [
        node('c', 'http-client'),
        node('s', 'http-server'),
        node('db', 'database'),
      ],
      [edge('e1', 'c', 's'), edge('e2', 's', 'db')],
    );
    expect(dbExposedPublicly.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// exposure/cache-exposed-publicly
// =========================================================================
describe('exposure/cache-exposed-publicly', () => {
  it('fires when client-group edges directly to a cache', () => {
    const ctx = buildContext(
      [node('c', 'client-group'), node('cache', 'cache')],
      [edge('e1', 'c', 'cache')],
    );
    expect(cacheExposedPublicly.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when an http-server fronts the cache', () => {
    const ctx = buildContext(
      [
        node('c', 'http-client'),
        node('s', 'http-server'),
        node('cache', 'cache'),
      ],
      [edge('e1', 'c', 's'), edge('e2', 's', 'cache')],
    );
    expect(cacheExposedPublicly.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// security/cross-zone-edge-no-gateway
// =========================================================================
describe('security/cross-zone-edge-no-gateway', () => {
  it('fires for public → backend without gateway', () => {
    const ctx = buildContext(
      [
        zoneNode('pub', 'public'),
        zoneNode('back', 'backend'),
        node('c', 'http-client', {}, 'pub'),
        node('s', 'http-server', {}, 'back'),
      ],
      [edge('e1', 'c', 's')],
    );
    expect(crossZoneEdgeNoGateway.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when target is an api-gateway', () => {
    const ctx = buildContext(
      [
        zoneNode('pub', 'public'),
        zoneNode('back', 'backend'),
        node('c', 'http-client', {}, 'pub'),
        node('gw', 'api-gateway', {}, 'back'),
      ],
      [edge('e1', 'c', 'gw')],
    );
    expect(crossZoneEdgeNoGateway.evaluate(ctx)).toEqual([]);
  });

  it('does not fire for edges that stay within public zone', () => {
    const ctx = buildContext(
      [
        zoneNode('pub', 'public'),
        node('c', 'http-client', {}, 'pub'),
        node('s', 'http-server', {}, 'pub'),
      ],
      [edge('e1', 'c', 's')],
    );
    expect(crossZoneEdgeNoGateway.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// security/public-service-no-auth
// =========================================================================
describe('security/public-service-no-auth', () => {
  it('fires for an http-server in public zone with no IdP in graph', () => {
    const ctx = buildContext(
      [
        zoneNode('pub', 'public'),
        node('c', 'http-client'),
        node('s', 'http-server', {}, 'pub'),
      ],
      [edge('e1', 'c', 's')],
    );
    expect(publicServiceNoAuth.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when graph has an identity-provider', () => {
    const ctx = buildContext(
      [
        zoneNode('pub', 'public'),
        node('idp', 'identity-provider'),
        node('c', 'http-client'),
        node('s', 'http-server', {}, 'pub'),
      ],
      [edge('e1', 'c', 's')],
    );
    expect(publicServiceNoAuth.evaluate(ctx)).toEqual([]);
  });

  it('does not fire when service is in backend zone', () => {
    const ctx = buildContext(
      [
        zoneNode('back', 'backend'),
        node('c', 'http-client'),
        node('s', 'http-server', {}, 'back'),
      ],
      [edge('e1', 'c', 's')],
    );
    expect(publicServiceNoAuth.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// performance/no-cdn-multi-clients
// =========================================================================
describe('performance/no-cdn-multi-clients', () => {
  it('fires when 2 client-groups hit same http-server with no CDN', () => {
    const ctx = buildContext(
      [
        node('cg1', 'client-group'),
        node('cg2', 'client-group'),
        node('s', 'http-server'),
      ],
      [edge('e1', 'cg1', 's'), edge('e2', 'cg2', 's')],
    );
    expect(noCdnMultiClients.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when graph has a CDN', () => {
    const ctx = buildContext(
      [
        node('cdn', 'cdn'),
        node('cg1', 'client-group'),
        node('cg2', 'client-group'),
        node('s', 'http-server'),
      ],
      [edge('e1', 'cg1', 's'), edge('e2', 'cg2', 's')],
    );
    expect(noCdnMultiClients.evaluate(ctx)).toEqual([]);
  });

  it('does not fire with a single client group', () => {
    const ctx = buildContext(
      [node('cg', 'client-group'), node('s', 'http-server')],
      [edge('e1', 'cg', 's')],
    );
    expect(noCdnMultiClients.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// performance/db-without-cache
// =========================================================================
describe('performance/db-without-cache', () => {
  it('fires when a DB has a service upstream and no cache in graph', () => {
    const ctx = buildContext(
      [node('s', 'http-server'), node('db', 'database')],
      [edge('e1', 's', 'db')],
    );
    expect(dbWithoutCache.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when a cache exists', () => {
    const ctx = buildContext(
      [
        node('s', 'http-server'),
        node('cache', 'cache'),
        node('db', 'database'),
      ],
      [edge('e1', 's', 'cache'), edge('e2', 's', 'db')],
    );
    expect(dbWithoutCache.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// hygiene/duplicate-node-names
// =========================================================================
describe('hygiene/duplicate-node-names', () => {
  it('fires when 2 nodes share the same label', () => {
    const ctx = buildContext(
      [
        node('a', 'http-server', { label: 'Auth' }),
        node('b', 'http-server', { label: 'auth' }),
      ],
      [],
    );
    const v = duplicateNodeNames.evaluate(ctx);
    expect(v).toHaveLength(1);
    expect(v[0].nodeIds).toEqual(['a', 'b']);
  });

  it('does not fire when labels differ', () => {
    const ctx = buildContext(
      [
        node('a', 'http-server', { label: 'Auth' }),
        node('b', 'http-server', { label: 'Billing' }),
      ],
      [],
    );
    expect(duplicateNodeNames.evaluate(ctx)).toEqual([]);
  });

  it('ignores empty/missing labels', () => {
    const ctx = buildContext(
      [
        node('a', 'http-server'),
        node('b', 'http-server', { label: '' }),
      ],
      [],
    );
    expect(duplicateNodeNames.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// hygiene/edge-no-protocol
// =========================================================================
describe('hygiene/edge-no-protocol', () => {
  it('fires for a client→server edge with no protocol', () => {
    const ctx = buildContext(
      [node('c', 'http-client'), node('s', 'http-server')],
      [edge('e1', 'c', 's')],
    );
    expect(edgeNoProtocol.evaluate(ctx)).toHaveLength(1);
  });

  it('does not fire when protocol is set', () => {
    const ctx = buildContext(
      [node('c', 'http-client'), node('s', 'http-server')],
      [edge('e1', 'c', 's', { protocol: 'rest' })],
    );
    expect(edgeNoProtocol.evaluate(ctx)).toEqual([]);
  });

  it('does not fire for infra edges (server→db)', () => {
    // database is not an app endpoint per the rule's definition.
    const ctx = buildContext(
      [node('s', 'http-server'), node('db', 'database')],
      [edge('e1', 's', 'db')],
    );
    expect(edgeNoProtocol.evaluate(ctx)).toEqual([]);
  });
});

// =========================================================================
// hygiene/duplicate-edge
// =========================================================================
describe('hygiene/duplicate-edge', () => {
  it('fires for 2 edges with same source/target/protocol', () => {
    const ctx = buildContext(
      [node('a', 'http-client'), node('b', 'http-server')],
      [
        edge('e1', 'a', 'b', { protocol: 'rest' }),
        edge('e2', 'a', 'b', { protocol: 'rest' }),
      ],
    );
    const v = duplicateEdge.evaluate(ctx);
    expect(v).toHaveLength(1);
    expect(v[0].edgeIds?.length).toBe(2);
  });

  it('does not fire when protocols differ', () => {
    const ctx = buildContext(
      [node('a', 'http-client'), node('b', 'http-server')],
      [
        edge('e1', 'a', 'b', { protocol: 'rest' }),
        edge('e2', 'a', 'b', { protocol: 'grpc' }),
      ],
    );
    expect(duplicateEdge.evaluate(ctx)).toEqual([]);
  });

  it('does not fire on a single edge', () => {
    const ctx = buildContext(
      [node('a', 'http-client'), node('b', 'http-server')],
      [edge('e1', 'a', 'b')],
    );
    expect(duplicateEdge.evaluate(ctx)).toEqual([]);
  });
});
