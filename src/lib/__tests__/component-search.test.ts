import { describe, it, expect } from 'vitest';
import {
  scoreMatch,
  searchComponents,
  highlightMatch,
  COMPONENT_ALIASES,
  getAliases,
  SCORE_THRESHOLD,
  type SearchableComponent,
} from '../component-search';

// ---------------------------------------------------------------------------
// scoreMatch
// ---------------------------------------------------------------------------

describe('scoreMatch', () => {
  it('returns 1 for exact match', () => {
    expect(scoreMatch('kafka', 'kafka')).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(scoreMatch('KAFKA', 'kafka')).toBe(1);
    expect(scoreMatch('Kafka', 'KAFKA')).toBe(1);
  });

  it('scores prefix match higher than substring match', () => {
    const prefix = scoreMatch('post', 'postgres');
    const substr = scoreMatch('gres', 'postgres');
    expect(prefix).toBeGreaterThan(substr);
  });

  it('scores substring match above threshold', () => {
    expect(scoreMatch('redis', 'cache (redis)')).toBeGreaterThan(SCORE_THRESHOLD);
  });

  it('returns 0 for empty inputs', () => {
    expect(scoreMatch('', 'anything')).toBe(0);
    expect(scoreMatch('foo', '')).toBe(0);
  });

  it('produces a partial fuzzy score when chars are in order', () => {
    // 'ka' is a substring of 'kafka' -> substring path, not fuzzy
    // Use chars only present out-of-sequence to exercise the fuzzy branch.
    const fuzzy = scoreMatch('mq', 'message-queue');
    expect(fuzzy).toBeGreaterThan(0);
    expect(fuzzy).toBeLessThan(0.8);
  });

  it('returns 0 when the query chars are not all present in order', () => {
    expect(scoreMatch('xyz', 'kafka')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// searchComponents
// ---------------------------------------------------------------------------

const items: SearchableComponent[] = [
  { type: 'database', displayName: 'Base de données' },
  { type: 'cache', displayName: 'Cache' },
  { type: 'message-queue', displayName: 'File de messages' },
  { type: 'api-gateway', displayName: 'API Gateway' },
  { type: 'load-balancer', displayName: 'Load Balancer' },
  { type: 'serverless', displayName: 'Serverless' },
  { type: 'host-server', displayName: 'Serveur Hôte' },
  { type: 'cdn', displayName: 'CDN' },
];

describe('searchComponents', () => {
  it('returns empty array for empty query', () => {
    expect(searchComponents(items, '')).toEqual([]);
    expect(searchComponents(items, '   ')).toEqual([]);
  });

  it('matches "kafka" alias to message-queue', () => {
    const results = searchComponents(items, 'kafka');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.type).toBe('message-queue');
    expect(results[0].matchedOn).toBe('alias');
    expect(results[0].matchedAlias).toBe('kafka');
  });

  it('matches "postgres" alias to database', () => {
    const results = searchComponents(items, 'postgres');
    expect(results[0].item.type).toBe('database');
    expect(results[0].matchedOn).toBe('alias');
  });

  it('matches "redis" alias to cache', () => {
    const results = searchComponents(items, 'redis');
    expect(results[0].item.type).toBe('cache');
  });

  it('matches "lambda" alias to serverless or cloud-function', () => {
    const results = searchComponents(items, 'lambda');
    expect(results.length).toBeGreaterThan(0);
    // serverless is in items list — it carries 'lambda' as alias
    expect(results.map(r => r.item.type)).toContain('serverless');
  });

  it('matches "ec2" alias to host-server', () => {
    const results = searchComponents(items, 'ec2');
    expect(results[0].item.type).toBe('host-server');
  });

  it('matches by display name', () => {
    const results = searchComponents(items, 'gateway');
    expect(results[0].item.type).toBe('api-gateway');
    expect(results[0].matchedOn).toBe('displayName');
  });

  it('matches by component type slug', () => {
    const results = searchComponents(items, 'cdn');
    expect(results[0].item.type).toBe('cdn');
  });

  it('sorts results by descending score', () => {
    const results = searchComponents(items, 'cache');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('respects the result limit', () => {
    const results = searchComponents(items, 'a', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('excludes items below the threshold', () => {
    // 'zzzzz' does not match anything
    expect(searchComponents(items, 'zzzzz')).toEqual([]);
  });

  it('uses the per-item aliases override when provided', () => {
    const customItems: SearchableComponent[] = [
      { type: 'custom-thing', displayName: 'Custom Thing', aliases: ['flux-capacitor'] },
    ];
    const results = searchComponents(customItems, 'flux-capacitor');
    expect(results.length).toBe(1);
    expect(results[0].matchedOn).toBe('alias');
  });
});

// ---------------------------------------------------------------------------
// highlightMatch
// ---------------------------------------------------------------------------

describe('highlightMatch', () => {
  it('splits text around the matched substring', () => {
    expect(highlightMatch('Base de données', 'données')).toEqual({
      before: 'Base de ',
      match: 'données',
      after: '',
    });
  });

  it('is case-insensitive but preserves casing of original text', () => {
    expect(highlightMatch('Load Balancer', 'load')).toEqual({
      before: '',
      match: 'Load',
      after: ' Balancer',
    });
  });

  it('returns null when no overlap (pure fuzzy hit)', () => {
    expect(highlightMatch('message-queue', 'mq')).toBeNull();
  });

  it('returns null for empty query', () => {
    expect(highlightMatch('something', '')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Catalog coverage
// ---------------------------------------------------------------------------

describe('COMPONENT_ALIASES', () => {
  it('declares aliases for every core component type', () => {
    const coreTypes = [
      'http-client', 'http-server', 'client-group',
      'api-gateway', 'load-balancer', 'database', 'cache', 'message-queue',
      'circuit-breaker', 'cdn', 'waf', 'firewall',
      'serverless', 'container', 'service-discovery', 'dns',
      'cloud-storage', 'cloud-function', 'host-server',
      'api-service', 'background-job', 'identity-provider',
      'network-zone',
    ] as const;
    for (const t of coreTypes) {
      const aliases = COMPONENT_ALIASES[t];
      expect(aliases, `aliases for ${t}`).toBeDefined();
      expect(aliases.length, `aliases for ${t}`).toBeGreaterThan(0);
    }
  });

  it('getAliases returns empty array for unknown types', () => {
    expect(getAliases('not-a-real-type')).toEqual([]);
  });
});
