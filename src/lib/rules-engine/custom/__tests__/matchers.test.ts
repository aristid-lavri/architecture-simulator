// __tests__/matchers.test.ts
import { describe, it, expect } from 'vitest';
import type { GraphNode, GraphEdge } from '@/types/graph';
import { matchNode, matchEdge, getAncestorZone, getDottedField } from '../matchers';

function node(id: string, type: string, opts: Partial<GraphNode> = {}): GraphNode {
  return {
    id, type: type as GraphNode['type'],
    position: { x: 0, y: 0 }, data: {},
    ...opts,
  };
}

describe('matchNode', () => {
  it('matches by single type', () => {
    expect(matchNode(node('a', 'database'), { type: 'database' })).toBe(true);
    expect(matchNode(node('a', 'cache'), { type: 'database' })).toBe(false);
  });

  it('matches by type array (OR)', () => {
    expect(matchNode(node('a', 'cache'), { type: ['database', 'cache'] })).toBe(true);
  });

  it('matches by tag (string)', () => {
    const n = node('a', 'database', { metadata: { tags: ['payment', 'critical'] } });
    expect(matchNode(n, { tag: 'payment' })).toBe(true);
    expect(matchNode(n, { tag: 'auth' })).toBe(false);
  });

  it('matches by tag array (OR)', () => {
    const n = node('a', 'database', { metadata: { tags: ['payment'] } });
    expect(matchNode(n, { tag: ['payment', 'auth'] })).toBe(true);
  });

  it('matches by owner_team', () => {
    const n = node('a', 'database', { metadata: { owner: { team: 'payments-team' } } });
    expect(matchNode(n, { owner_team: 'payments-team' })).toBe(true);
    expect(matchNode(n, { owner_team: 'auth-team' })).toBe(false);
  });

  it('empty matcher matches everything', () => {
    expect(matchNode(node('a', 'cache'), {})).toBe(true);
  });

  it('AND-combines multiple criteria', () => {
    const n = node('a', 'database', { metadata: { tags: ['payment'] } });
    expect(matchNode(n, { type: 'database', tag: 'payment' })).toBe(true);
    expect(matchNode(n, { type: 'database', tag: 'auth' })).toBe(false);
  });
});

describe('getAncestorZone', () => {
  it('finds the nearest ancestor zone via parentId chain', () => {
    const zone = node('zone-1', 'network-zone', { data: { zoneType: 'backend' } });
    const host = node('host-1', 'host-server', { parentId: 'zone-1' });
    const svc = node('svc-1', 'api-service', { parentId: 'host-1' });
    const nodes = [zone, host, svc];
    const map = new Map(nodes.map((n) => [n.id, n]));
    expect(getAncestorZone(svc, map)).toBe(zone);
  });

  it('returns undefined when no ancestor zone', () => {
    const host = node('host-1', 'host-server');
    const map = new Map([['host-1', host]]);
    expect(getAncestorZone(host, map)).toBeUndefined();
  });

  it('matches in_zone_type via ancestor', () => {
    const zone = node('z', 'network-zone', { data: { zoneType: 'dmz' } });
    const svc = node('s', 'api-service', { parentId: 'z' });
    const map = new Map([['z', zone], ['s', svc]]);
    expect(matchNode(svc, { in_zone_type: 'dmz' }, map)).toBe(true);
    expect(matchNode(svc, { in_zone_type: 'backend' }, map)).toBe(false);
  });
});

describe('getDottedField', () => {
  it('returns leaf string value', () => {
    const n = node('a', 'database', { metadata: { owner: { team: 'pay' } } });
    expect(getDottedField(n, 'metadata.owner.team')).toBe('pay');
  });

  it('returns undefined for missing path', () => {
    expect(getDottedField(node('a', 'database'), 'metadata.owner.team')).toBeUndefined();
  });

  it('returns undefined when leaf is empty string', () => {
    const n = node('a', 'database', { metadata: { owner: { team: '' } } });
    expect(getDottedField(n, 'metadata.owner.team')).toBeUndefined();
  });
});

describe('matchEdge', () => {
  function edge(id: string, source: string, target: string, data: Record<string, unknown> = {}): GraphEdge {
    return { id, source, target, data };
  }

  it('matches by protocol string', () => {
    const e = edge('e1', 'a', 'b', { protocol: 'https' });
    expect(matchEdge(e, { protocol: 'https' }, new Map())).toBe(true);
    expect(matchEdge(e, { protocol: 'http' }, new Map())).toBe(false);
  });

  it('matches by protocol array', () => {
    const e = edge('e1', 'a', 'b', { protocol: 'https' });
    expect(matchEdge(e, { protocol: ['https', 'grpc-tls'] }, new Map())).toBe(true);
  });

  it('matches by source predicate', () => {
    const src = node('a', 'cache');
    const tgt = node('b', 'http-client');
    const map = new Map([['a', src], ['b', tgt]]);
    const e = edge('e1', 'a', 'b');
    expect(matchEdge(e, { source: { type: 'cache' } }, map)).toBe(true);
    expect(matchEdge(e, { source: { type: 'database' } }, map)).toBe(false);
  });
});
