import type { ComponentType } from '@/types';
import {
  defaultServerResources, defaultDegradation,
  defaultDatabaseNodeData, defaultCacheNodeData,
  defaultLoadBalancerNodeData, defaultMessageQueueNodeData,
  defaultApiGatewayNodeData, defaultCircuitBreakerData,
  defaultCDNNodeData, defaultWAFNodeData, defaultFirewallData,
  defaultServerlessData, defaultContainerData,
  defaultServiceDiscoveryData, defaultDNSNodeData,
  defaultCloudStorageData, defaultCloudFunctionData,
  defaultNetworkZoneData, defaultHostServerData,
  defaultApiServiceData, defaultBackgroundJobData,
  defaultIdentityProviderData,
} from '@/types';

const defaultClientGroupData = {
  label: 'Client Group',
  clientCount: 10,
  rampUpDuration: 5000,
  rampUpCurve: 'linear' as const,
  distribution: 'uniform' as const,
  requestsPerSecond: 10,
  requestPath: '/api/data',
  requestMethod: 'GET' as const,
};

/**
 * Returns default node data for a given component type.
 * Extracted from PixiCanvas for reuse.
 */
export function getDefaultNodeData(type: ComponentType): Record<string, unknown> {
  switch (type) {
    case 'http-client':
      return {
        label: 'HTTP Client',
        method: 'GET',
        path: '/api/data',
        requestMode: 'single',
        interval: 1000,
        status: 'idle',
      };
    case 'http-server':
      return {
        label: 'HTTP Server',
        port: 8080,
        responseStatus: 200,
        responseBody: '{"success": true}',
        responseDelay: 100,
        errorRate: 0,
        authType: 'none',
        authFailureRate: 0,
        autoTokenMode: 'valid',
        status: 'idle',
        resources: defaultServerResources,
        degradation: defaultDegradation,
      };
    case 'client-group':
      return { ...defaultClientGroupData, status: 'idle' };
    case 'database':
      return { ...defaultDatabaseNodeData, status: 'idle' };
    case 'cache':
      return { ...defaultCacheNodeData, status: 'idle' };
    case 'load-balancer':
      return { ...defaultLoadBalancerNodeData, status: 'idle' };
    case 'message-queue':
      return { ...defaultMessageQueueNodeData, status: 'idle' };
    case 'api-gateway':
      return { ...defaultApiGatewayNodeData, status: 'idle' };
    case 'network-zone':
      return { ...defaultNetworkZoneData };
    case 'circuit-breaker':
      return { ...defaultCircuitBreakerData, status: 'idle' };
    case 'cdn':
      return { ...defaultCDNNodeData, status: 'idle' };
    case 'waf':
      return { ...defaultWAFNodeData, status: 'idle' };
    case 'firewall':
      return { ...defaultFirewallData, status: 'idle' };
    case 'serverless':
      return { ...defaultServerlessData, status: 'idle' };
    case 'cloud-function':
      return { ...defaultCloudFunctionData, status: 'idle' };
    case 'container':
      return { ...defaultContainerData, status: 'idle' };
    case 'service-discovery':
      return { ...defaultServiceDiscoveryData, status: 'idle' };
    case 'dns':
      return { ...defaultDNSNodeData, status: 'idle' };
    case 'cloud-storage':
      return { ...defaultCloudStorageData, status: 'idle' };
    case 'host-server':
      return { ...defaultHostServerData };
    case 'api-service':
      return { ...defaultApiServiceData, status: 'idle' };
    case 'background-job':
      return { ...defaultBackgroundJobData, status: 'idle' };
    case 'identity-provider':
      return { ...defaultIdentityProviderData, status: 'idle' };
    default:
      return { label: (type as string).replace(/-/g, ' ').toUpperCase(), status: 'idle' };
  }
}
