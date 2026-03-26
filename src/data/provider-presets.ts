import type { LoadBalancerAlgorithm, ApiGatewayAuthType } from '@/types';

// ============================================
// Provider Types
// ============================================

export type LoadBalancerProvider =
  | 'generic'
  | 'nginx'
  | 'haproxy'
  | 'aws-alb'
  | 'aws-nlb'
  | 'traefik'
  | 'envoy';

export type ApiGatewayProvider =
  | 'generic'
  | 'kong'
  | 'aws-api-gateway'
  | 'nginx-plus'
  | 'azure-apim'
  | 'traefik';

export type ProviderHostingType = 'self-hosted' | 'managed' | 'configurable';

// ============================================
// Load Balancer Provider Presets
// ============================================

export interface LoadBalancerProviderPreset {
  label: string;
  hostingType: ProviderHostingType;
  layer: 'L4' | 'L7' | 'L4/L7';
  maxConnections: number;
  maxRPS: number;
  baseLatencyMs: number;
  algorithms: LoadBalancerAlgorithm[];
  supportsStickySession: boolean;
  description: string;
}

export const loadBalancerProviderPresets: Record<LoadBalancerProvider, LoadBalancerProviderPreset> = {
  generic: {
    label: 'Générique',
    hostingType: 'configurable',
    layer: 'L7',
    maxConnections: 10000,
    maxRPS: 5000,
    baseLatencyMs: 5,
    algorithms: ['round-robin', 'least-connections', 'ip-hash', 'weighted'],
    supportsStickySession: true,
    description: 'Configuration libre, tous algorithmes disponibles',
  },
  nginx: {
    label: 'NGINX',
    hostingType: 'self-hosted',
    layer: 'L7',
    maxConnections: 10000,
    maxRPS: 5000,
    baseLatencyMs: 3,
    algorithms: ['round-robin', 'least-connections', 'ip-hash', 'weighted'],
    supportsStickySession: true,
    description: 'Reverse proxy haute performance, nécessite un host-server',
  },
  haproxy: {
    label: 'HAProxy',
    hostingType: 'self-hosted',
    layer: 'L4/L7',
    maxConnections: 50000,
    maxRPS: 20000,
    baseLatencyMs: 1,
    algorithms: ['round-robin', 'least-connections', 'ip-hash', 'weighted'],
    supportsStickySession: true,
    description: 'Load balancer très haute performance L4/L7, nécessite un host-server',
  },
  'aws-alb': {
    label: 'AWS ALB',
    hostingType: 'managed',
    layer: 'L7',
    maxConnections: 100000,
    maxRPS: 25000,
    baseLatencyMs: 5,
    algorithms: ['round-robin', 'least-connections'],
    supportsStickySession: true,
    description: 'Application Load Balancer AWS, auto-scaling, standalone uniquement',
  },
  'aws-nlb': {
    label: 'AWS NLB',
    hostingType: 'managed',
    layer: 'L4',
    maxConnections: 1000000,
    maxRPS: 100000,
    baseLatencyMs: 1,
    algorithms: ['round-robin', 'ip-hash'],
    supportsStickySession: false,
    description: 'Network Load Balancer AWS, ultra-haute performance L4, standalone uniquement',
  },
  traefik: {
    label: 'Traefik',
    hostingType: 'self-hosted',
    layer: 'L7',
    maxConnections: 10000,
    maxRPS: 3000,
    baseLatencyMs: 5,
    algorithms: ['round-robin', 'weighted'],
    supportsStickySession: true,
    description: 'Reverse proxy cloud-native, nécessite un host-server',
  },
  envoy: {
    label: 'Envoy',
    hostingType: 'self-hosted',
    layer: 'L7',
    maxConnections: 20000,
    maxRPS: 10000,
    baseLatencyMs: 2,
    algorithms: ['round-robin', 'least-connections', 'ip-hash', 'weighted'],
    supportsStickySession: true,
    description: 'Service mesh proxy, nécessite un host-server',
  },
};

// ============================================
// API Gateway Provider Presets
// ============================================

export interface ApiGatewayProviderPreset {
  label: string;
  hostingType: ProviderHostingType;
  maxConnections: number;
  maxRPS: number;
  baseLatencyMs: number;
  supportedAuthTypes: ApiGatewayAuthType[];
  supportsPerRouteRateLimit: boolean;
  description: string;
}

export const apiGatewayProviderPresets: Record<ApiGatewayProvider, ApiGatewayProviderPreset> = {
  generic: {
    label: 'Générique',
    hostingType: 'configurable',
    maxConnections: 10000,
    maxRPS: 5000,
    baseLatencyMs: 5,
    supportedAuthTypes: ['none', 'api-key', 'jwt', 'oauth2'],
    supportsPerRouteRateLimit: false,
    description: 'Configuration libre, tous types d\'auth disponibles',
  },
  kong: {
    label: 'Kong',
    hostingType: 'self-hosted',
    maxConnections: 10000,
    maxRPS: 5000,
    baseLatencyMs: 4,
    supportedAuthTypes: ['none', 'api-key', 'jwt', 'oauth2'],
    supportsPerRouteRateLimit: true,
    description: 'API Gateway extensible par plugins, nécessite un host-server',
  },
  'aws-api-gateway': {
    label: 'AWS API Gateway',
    hostingType: 'managed',
    maxConnections: 50000,
    maxRPS: 10000,
    baseLatencyMs: 10,
    supportedAuthTypes: ['none', 'api-key', 'jwt', 'oauth2'],
    supportsPerRouteRateLimit: true,
    description: 'API Gateway managé AWS avec throttling intégré, standalone uniquement',
  },
  'nginx-plus': {
    label: 'NGINX Plus',
    hostingType: 'self-hosted',
    maxConnections: 10000,
    maxRPS: 5000,
    baseLatencyMs: 3,
    supportedAuthTypes: ['none', 'api-key', 'jwt'],
    supportsPerRouteRateLimit: false,
    description: 'API Gateway basé sur NGINX, nécessite un host-server',
  },
  'azure-apim': {
    label: 'Azure APIM',
    hostingType: 'managed',
    maxConnections: 25000,
    maxRPS: 5000,
    baseLatencyMs: 8,
    supportedAuthTypes: ['none', 'api-key', 'jwt', 'oauth2'],
    supportsPerRouteRateLimit: true,
    description: 'API Management Azure, standalone uniquement',
  },
  traefik: {
    label: 'Traefik',
    hostingType: 'self-hosted',
    maxConnections: 5000,
    maxRPS: 2000,
    baseLatencyMs: 5,
    supportedAuthTypes: ['none', 'jwt'],
    supportsPerRouteRateLimit: false,
    description: 'Reverse proxy cloud-native avec gateway, nécessite un host-server',
  },
};

// ============================================
// Validation Helpers
// ============================================

/**
 * Vérifie si un provider de Load Balancer est compatible avec le placement actuel.
 * - Self-hosted : doit avoir un parentId (être dans un host-server ou container)
 * - Managed : ne doit PAS avoir de parentId
 * - Configurable : pas de restriction
 */
export function isLBProviderCompatibleWithPlacement(
  provider: LoadBalancerProvider,
  hasParent: boolean
): boolean {
  const preset = loadBalancerProviderPresets[provider];
  if (preset.hostingType === 'self-hosted' && !hasParent) return false;
  if (preset.hostingType === 'managed' && hasParent) return false;
  return true;
}

/**
 * Vérifie si un provider d'API Gateway est compatible avec le placement actuel.
 */
export function isGWProviderCompatibleWithPlacement(
  provider: ApiGatewayProvider,
  hasParent: boolean
): boolean {
  const preset = apiGatewayProviderPresets[provider];
  if (preset.hostingType === 'self-hosted' && !hasParent) return false;
  if (preset.hostingType === 'managed' && hasParent) return false;
  return true;
}

/**
 * Retourne les providers de LB disponibles selon le contexte de placement.
 */
export function getAvailableLBProviders(hasParent: boolean): LoadBalancerProvider[] {
  return (Object.keys(loadBalancerProviderPresets) as LoadBalancerProvider[]).filter(
    (provider) => isLBProviderCompatibleWithPlacement(provider, hasParent)
  );
}

/**
 * Retourne les providers de Gateway disponibles selon le contexte de placement.
 */
export function getAvailableGWProviders(hasParent: boolean): ApiGatewayProvider[] {
  return (Object.keys(apiGatewayProviderPresets) as ApiGatewayProvider[]).filter(
    (provider) => isGWProviderCompatibleWithPlacement(provider, hasParent)
  );
}
