import type { ComponentContentRenderer } from './types';
import { pluginRegistry } from '@/plugins/plugin-registry';

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
 * Construit un content renderer minimal à partir des hints `visual` d'un plugin.
 * - Variant `strict` : icône absente (glyph vide ' '), pas de content lines (le rendu est entièrement
 *   pris en charge par les hints de NodeRenderer pour la notation C4).
 * - Variant `instance` : glyph `↗` indique la référence vers un autre nœud.
 * - Variant `instrument` (default) : retombe sur le glyph fallback.
 */
function pluginVisualToRenderer(
  visual: NonNullable<ReturnType<typeof pluginRegistry.getNodeVisual>>,
): ComponentContentRenderer {
  const variant = visual.variant ?? 'instrument';
  const icon = variant === 'strict' ? ' ' : variant === 'instance' ? '↗' : '●';
  return {
    icon,
    getContentLines() { return []; },
  };
}

/**
 * Get the content renderer for a given component type.
 * Order:
 * 1. Hardcoded RENDERER_MAP (21 types CE natifs).
 * 2. Plugin-registered visual hints (any plugin type).
 * 3. Fallback no-op renderer.
 */
export function getComponentRenderer(type: string): ComponentContentRenderer {
  const native = RENDERER_MAP[type];
  if (native) return native;
  const pluginVisual = pluginRegistry.getNodeVisual(type);
  if (pluginVisual) return pluginVisualToRenderer(pluginVisual);
  return fallbackRenderer;
}
