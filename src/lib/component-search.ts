/**
 * Component palette search.
 *
 * Lightweight fuzzy matcher with alias support: every catalog entry has a list of
 * popular product names (e.g. "kafka" maps to message-queue). The score combines
 * substring, prefix and ordered-character matches across the display name, the
 * type and all aliases. No external dependency — keeps the bundle size flat.
 */
import type { ComponentType } from '@/types';

export const SCORE_THRESHOLD = 0.3;
export const MAX_RESULTS = 20;

/**
 * Aliases per component type. These are the popular product/vendor names users
 * search for ("kafka" instead of "Message Queue", "postgres" instead of
 * "Database"). Keep entries lower-case — the matcher normalizes input.
 */
export const COMPONENT_ALIASES: Record<ComponentType, string[]> = {
  'http-client': ['client', 'browser', 'mobile app', 'mobile', 'http'],
  'http-server': ['web server', 'http', 'nginx', 'apache', 'web'],
  'client-group': ['users', 'load test', 'simulated traffic', 'stress test', 'k6', 'jmeter', 'locust'],
  'api-gateway': ['kong', 'apigee', 'tyk', 'aws apigw', 'envoy', 'apigateway', 'krakend'],
  'load-balancer': ['nginx', 'haproxy', 'alb', 'nlb', 'elb', 'traefik', 'lb', 'aws lb'],
  'database': ['postgres', 'postgresql', 'mysql', 'rds', 'aurora', 'sql', 'oracle', 'sqlserver', 'mongodb', 'dynamodb', 'cosmos', 'spanner', 'db'],
  'cache': ['redis', 'memcached', 'elasticache', 'hazelcast', 'momento', 'in-memory'],
  'message-queue': ['kafka', 'rabbitmq', 'sqs', 'pubsub', 'eventhub', 'kinesis', 'mq', 'nats', 'pulsar', 'queue', 'broker'],
  'network-zone': ['vpc', 'subnet', 'dmz', 'zone', 'network'],
  'circuit-breaker': ['hystrix', 'resilience4j', 'breaker', 'fault tolerance'],
  'cdn': ['cloudfront', 'fastly', 'cloudflare', 'akamai', 'edge cache'],
  'waf': ['aws waf', 'cloudflare waf', 'firewall', 'web firewall', 'modsecurity'],
  'firewall': ['iptables', 'ufw', 'security group', 'network firewall'],
  'serverless': ['lambda', 'cloud function', 'azure function', 'cloud run', 'faas', 'function'],
  'container': ['docker', 'pod', 'task', 'kubernetes', 'k8s', 'ecs'],
  'service-discovery': ['consul', 'eureka', 'kubernetes dns', 'k8s dns', 'etcd', 'discovery'],
  'dns': ['route53', 'cloudflare dns', 'name server', 'name resolution'],
  'cloud-storage': ['s3', 'blob storage', 'gcs', 'object storage', 'bucket', 'azure blob'],
  'cloud-function': ['lambda', 'cloud run', 'azure function', 'gcp function', 'faas'],
  'host-server': ['ec2', 'vm', 'compute instance', 'physical server', 'bare metal', 'virtual machine'],
  'api-service': ['microservice', 'service', 'rest api', 'grpc service', 'graphql service'],
  'background-job': ['worker', 'cronjob', 'scheduled task', 'batch', 'sidekiq', 'celery'],
  'identity-provider': ['keycloak', 'auth0', 'cognito', 'okta', 'idp', 'sso', 'oidc', 'oauth'],
};

/**
 * Returns the alias list for a component type. Plugin-provided types may not
 * have aliases — falls back to an empty array.
 */
export function getAliases(type: string): string[] {
  return COMPONENT_ALIASES[type as ComponentType] ?? [];
}

/**
 * Computes a [0, 1] score expressing how well `candidate` matches the user
 * `query`. Higher is better.
 *
 * - 1.0 — exact match
 * - 0.95 — candidate starts with query
 * - 0.8 — query is a substring of candidate
 * - 0.0–0.5 — fuzzy ordered-character match (every char of the query appears
 *   in candidate in order). Score scales with how compactly the chars matched.
 *
 * Both inputs are lower-cased and trimmed before comparison.
 */
export function scoreMatch(query: string, candidate: string): number {
  const q = query.trim().toLowerCase();
  const c = candidate.trim().toLowerCase();
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.startsWith(q)) return 0.95;
  if (c.includes(q)) return 0.8;

  // Fuzzy: every char of q must appear in c, in order.
  let qi = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      if (firstMatch === -1) firstMatch = ci;
      lastMatch = ci;
      qi++;
    }
  }
  if (qi < q.length) return 0;

  // Compactness ratio: query length / span of matches.
  const span = lastMatch - firstMatch + 1;
  const compactness = q.length / span;
  return 0.5 * compactness;
}

/** Searchable item passed to {@link searchComponents}. */
export interface SearchableComponent {
  type: string;
  displayName: string;
  /** Optional override; defaults to {@link getAliases}(type). */
  aliases?: string[];
}

/** Result of a single search hit, sorted by descending {@link score}. */
export interface ComponentSearchResult<T extends SearchableComponent> {
  item: T;
  score: number;
  /** Which field produced the best match — useful for UI highlighting. */
  matchedOn: 'displayName' | 'type' | 'alias';
  /** Best matching alias (only set when matchedOn === 'alias'). */
  matchedAlias?: string;
}

/**
 * Filters `items` by `query` using fuzzy matching across name/type/aliases.
 * Returns up to `limit` results sorted by descending score. Empty query →
 * empty array (caller handles the "no search" branch).
 */
export function searchComponents<T extends SearchableComponent>(
  items: T[],
  query: string,
  limit: number = MAX_RESULTS,
): ComponentSearchResult<T>[] {
  const q = query.trim();
  if (!q) return [];

  const results: ComponentSearchResult<T>[] = [];
  for (const item of items) {
    const nameScore = scoreMatch(q, item.displayName);
    const typeScore = scoreMatch(q, item.type);

    let bestAliasScore = 0;
    let bestAlias: string | undefined;
    const aliases = item.aliases ?? getAliases(item.type);
    for (const alias of aliases) {
      const s = scoreMatch(q, alias);
      if (s > bestAliasScore) {
        bestAliasScore = s;
        bestAlias = alias;
      }
    }

    const best = Math.max(nameScore, typeScore, bestAliasScore);
    if (best < SCORE_THRESHOLD) continue;

    let matchedOn: 'displayName' | 'type' | 'alias' = 'displayName';
    let matchedAlias: string | undefined;
    if (nameScore >= typeScore && nameScore >= bestAliasScore) {
      matchedOn = 'displayName';
    } else if (typeScore >= bestAliasScore) {
      matchedOn = 'type';
    } else {
      matchedOn = 'alias';
      matchedAlias = bestAlias;
    }

    results.push({ item, score: best, matchedOn, matchedAlias });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Splits `text` around the first occurrence of `query` (case-insensitive) so
 * the UI can render the matched substring in bold. Returns null when there is
 * no substring overlap (e.g. pure fuzzy hit) — the caller falls back to the
 * unhighlighted label.
 */
export function highlightMatch(
  text: string,
  query: string,
): { before: string; match: string; after: string } | null {
  const q = query.trim();
  if (!q) return null;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length),
  };
}
