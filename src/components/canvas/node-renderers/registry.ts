import type { ComponentContentRenderer } from './types';

// ── Simulation ──
import { httpClientRenderer, httpServerRenderer, clientGroupRenderer } from './simulation';
// ── Infrastructure ──
import {
  apiGatewayRenderer, loadBalancerRenderer, cdnRenderer,
  wafRenderer, firewallRenderer, serviceDiscoveryRenderer, dnsRenderer,
} from './infrastructure';
// ── Data ──
import { databaseRenderer, cacheRenderer, messageQueueRenderer } from './data';
// ── Resilience ──
import { circuitBreakerRenderer } from './resilience';
// ── Compute ──
import {
  hostServerRenderer, containerRenderer, apiServiceRenderer,
  backgroundJobRenderer, serverlessRenderer,
} from './compute';
// ── Cloud ──
import { cloudStorageRenderer, cloudFunctionRenderer } from './cloud';
// ── Security ──
import { identityProviderRenderer } from './security';

const RENDERER_MAP: Record<string, ComponentContentRenderer> = {
  // Simulation
  'http-client': httpClientRenderer,
  'http-server': httpServerRenderer,
  'client-group': clientGroupRenderer,
  // Infrastructure
  'api-gateway': apiGatewayRenderer,
  'load-balancer': loadBalancerRenderer,
  'cdn': cdnRenderer,
  'waf': wafRenderer,
  'firewall': firewallRenderer,
  'service-discovery': serviceDiscoveryRenderer,
  'dns': dnsRenderer,
  // Data
  'database': databaseRenderer,
  'cache': cacheRenderer,
  'message-queue': messageQueueRenderer,
  // Resilience
  'circuit-breaker': circuitBreakerRenderer,
  // Compute
  'host-server': hostServerRenderer,
  'container': containerRenderer,
  'api-service': apiServiceRenderer,
  'background-job': backgroundJobRenderer,
  'serverless': serverlessRenderer,
  // Cloud
  'cloud-storage': cloudStorageRenderer,
  'cloud-function': cloudFunctionRenderer,
  // Security
  'identity-provider': identityProviderRenderer,
};

/** Default fallback renderer for unknown types */
const fallbackRenderer: ComponentContentRenderer = {
  icon: '●',
  getContentLines() { return []; },
};

/**
 * Get the content renderer for a given component type.
 * Falls back to a no-op renderer for unknown types.
 */
export function getComponentRenderer(type: string): ComponentContentRenderer {
  return RENDERER_MAP[type] ?? fallbackRenderer;
}
