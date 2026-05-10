import type { ComponentType } from '@/types/index';

/**
 * Predicates over `ComponentType` used by rules to express their conditions
 * declaratively. Sets are kept frozen-by-convention (mutate at your peril).
 */

export const DATA_LAYER_TYPES = new Set<ComponentType>([
  'database',
  'cache',
  'cloud-storage',
]);

export const CLIENT_TYPES = new Set<ComponentType>([
  'http-client',
  'client-group',
]);

export const SERVER_TYPES = new Set<ComponentType>([
  'http-server',
  'api-service',
  'serverless',
  'cloud-function',
  'background-job',
]);

export const QUEUE_TYPES = new Set<ComponentType>(['message-queue']);

export const FILTER_TYPES = new Set<ComponentType>(['waf', 'firewall']);

export const ROUTING_TYPES = new Set<ComponentType>([
  'load-balancer',
  'api-gateway',
  'cdn',
]);

export const INFRA_PASSIVE_TYPES = new Set<ComponentType>([
  'dns',
  'service-discovery',
  'identity-provider',
]);

export const RESILIENCE_TYPES = new Set<ComponentType>(['circuit-breaker']);

export const isDataLayer = (t: ComponentType): boolean => DATA_LAYER_TYPES.has(t);
export const isClient = (t: ComponentType): boolean => CLIENT_TYPES.has(t);
export const isServer = (t: ComponentType): boolean => SERVER_TYPES.has(t);
export const isQueue = (t: ComponentType): boolean => QUEUE_TYPES.has(t);
export const isFilter = (t: ComponentType): boolean => FILTER_TYPES.has(t);
export const isRouting = (t: ComponentType): boolean => ROUTING_TYPES.has(t);
export const isInfraPassive = (t: ComponentType): boolean => INFRA_PASSIVE_TYPES.has(t);
export const isResilience = (t: ComponentType): boolean => RESILIENCE_TYPES.has(t);
