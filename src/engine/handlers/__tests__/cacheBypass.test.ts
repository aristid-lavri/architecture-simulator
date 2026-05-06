import { describe, it, expect } from 'vitest';
import type { GraphNode, GraphEdge } from '@/types/graph';
import { filterCacheBypassEdges } from '../cacheBypass';

function node(id: string, type: string): GraphNode {
  return {
    id,
    type: type as GraphNode['type'],
    position: { x: 0, y: 0 },
    data: { label: id },
  };
}

function edge(source: string, target: string): GraphEdge {
  return { id: `${source}->${target}`, source, target };
}

describe('filterCacheBypassEdges', () => {
  it('returns all edges unchanged when no cache target is present', () => {
    const allNodes = [node('svc', 'api-service'), node('db', 'database')];
    const outgoing = [edge('svc', 'db')];
    const result = filterCacheBypassEdges(outgoing, allNodes, [...outgoing]);
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe('db');
  });

  it('keeps the cache edge and drops the direct edge to a node already in cache downstream', () => {
    // Topologie banking-online : svc → cache, cache → db, svc → db
    const allNodes = [
      node('svc', 'api-service'),
      node('cache', 'cache'),
      node('db', 'database'),
    ];
    const allEdges = [
      edge('svc', 'cache'),
      edge('cache', 'db'),
      edge('svc', 'db'),
    ];
    const outgoing = [edge('svc', 'cache'), edge('svc', 'db')];

    const result = filterCacheBypassEdges(outgoing, allNodes, allEdges);

    expect(result).toHaveLength(1);
    expect(result[0].target).toBe('cache');
  });

  it('keeps direct edges that are NOT redundant with the cache downstream', () => {
    // Le service écrit dans une queue indépendamment du flux read via cache
    const allNodes = [
      node('svc', 'api-service'),
      node('cache', 'cache'),
      node('db', 'database'),
      node('mq', 'message-queue'),
    ];
    const allEdges = [
      edge('svc', 'cache'),
      edge('cache', 'db'),
      edge('svc', 'mq'),
    ];
    const outgoing = [edge('svc', 'cache'), edge('svc', 'mq')];

    const result = filterCacheBypassEdges(outgoing, allNodes, allEdges);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.target).sort()).toEqual(['cache', 'mq']);
  });

  it('handles multiple caches and aggregates their downstream', () => {
    const allNodes = [
      node('svc', 'api-service'),
      node('cache-a', 'cache'),
      node('cache-b', 'cache'),
      node('db-a', 'database'),
      node('db-b', 'database'),
    ];
    const allEdges = [
      edge('svc', 'cache-a'),
      edge('svc', 'cache-b'),
      edge('cache-a', 'db-a'),
      edge('cache-b', 'db-b'),
      edge('svc', 'db-a'),
      edge('svc', 'db-b'),
    ];
    const outgoing = [
      edge('svc', 'cache-a'),
      edge('svc', 'cache-b'),
      edge('svc', 'db-a'),
      edge('svc', 'db-b'),
    ];

    const result = filterCacheBypassEdges(outgoing, allNodes, allEdges);

    expect(result.map((e) => e.target).sort()).toEqual(['cache-a', 'cache-b']);
  });

  it('returns outgoing edges unchanged when allEdges is missing', () => {
    const allNodes = [node('svc', 'api-service'), node('cache', 'cache')];
    const outgoing = [edge('svc', 'cache'), edge('svc', 'db')];
    const result = filterCacheBypassEdges(outgoing, allNodes, undefined);
    expect(result).toHaveLength(2);
  });
});
