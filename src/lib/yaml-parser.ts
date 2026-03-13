import YAML from 'yaml';
import type { Node, Edge } from '@xyflow/react';
import type { ComponentType, NetworkZoneType } from '@/types';
import {
  defaultNetworkZoneData,
  defaultCircuitBreakerData,
  defaultCDNNodeData,
  defaultWAFNodeData,
  defaultFirewallData,
  defaultServerlessData,
  defaultCloudFunctionData,
  defaultContainerData,
  defaultServiceDiscoveryData,
  defaultDNSNodeData,
  defaultCloudStorageData,
  defaultClientGroupData,
  defaultServerResources,
  defaultDegradation,
  defaultDatabaseNodeData,
  defaultCacheNodeData,
  defaultLoadBalancerNodeData,
  defaultMessageQueueNodeData,
  defaultApiGatewayNodeData,
  defaultHostServerData,
  defaultApiServiceData,
  defaultBackgroundJobData,
  defaultIdentityProviderData,
  zoneColors,
} from '@/types';

interface YamlArchitecture {
  version: number;
  name: string;
  description?: string;
  zones?: Record<string, YamlZone>;
  hosts?: Record<string, YamlHost>;
  components: Record<string, YamlComponent>;
  connections: YamlConnection[];
}

interface YamlZone {
  type: NetworkZoneType;
  domain?: string;
  subdomains?: string[];
  interZoneLatency?: number;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface YamlHost {
  zone?: string;
  ipAddress?: string;
  hostname?: string;
  portMappings?: Array<{
    id: string;
    hostPort: number;
    containerNodeId: string;
    containerPort: number;
    protocol: 'tcp' | 'udp';
  }>;
  config?: Record<string, unknown>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface YamlComponent {
  type: ComponentType;
  zone?: string;
  host?: string;
  container?: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
}

interface YamlConnection {
  from: string;
  to: string;
  protocol?: 'rest' | 'grpc' | 'websocket' | 'graphql';
  targetPort?: number;
}

const defaultDataByType: Record<string, Record<string, unknown>> = {
  'http-client': { label: 'HTTP Client', method: 'GET', path: '/api/data', requestMode: 'single', interval: 1000 },
  'http-server': { label: 'HTTP Server', port: 8080, responseStatus: 200, responseBody: '{"success": true}', responseDelay: 100, errorRate: 0, resources: defaultServerResources, degradation: defaultDegradation },
  'client-group': { ...defaultClientGroupData },
  'database': { ...defaultDatabaseNodeData },
  'cache': { ...defaultCacheNodeData },
  'load-balancer': { ...defaultLoadBalancerNodeData },
  'message-queue': { ...defaultMessageQueueNodeData },
  'api-gateway': { ...defaultApiGatewayNodeData },
  'circuit-breaker': { ...defaultCircuitBreakerData },
  'cdn': { ...defaultCDNNodeData },
  'waf': { ...defaultWAFNodeData },
  'firewall': { ...defaultFirewallData },
  'serverless': { ...defaultServerlessData },
  'cloud-function': { ...defaultCloudFunctionData },
  'container': { ...defaultContainerData },
  'service-discovery': { ...defaultServiceDiscoveryData },
  'dns': { ...defaultDNSNodeData },
  'cloud-storage': { ...defaultCloudStorageData },
  'api-service': { ...defaultApiServiceData },
  'background-job': { ...defaultBackgroundJobData },
  'identity-provider': { ...defaultIdentityProviderData },
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object') {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function parseYamlArchitecture(yamlString: string): { nodes: Node[]; edges: Edge[] } | { error: string } {
  try {
    const arch = YAML.parse(yamlString) as YamlArchitecture;

    if (!arch || !arch.components) {
      return { error: 'YAML invalide : la section "components" est requise.' };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Zone layout tracking
    const zonePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
    const componentCountInZone: Record<string, number> = {};

    // Host layout tracking
    const hostPositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
    const componentCountInHost: Record<string, number> = {};

    // Create zone nodes
    if (arch.zones) {
      let zoneIndex = 0;
      for (const [zoneId, zone] of Object.entries(arch.zones)) {
        const pos = zone.position || { x: 50 + zoneIndex * 500, y: 50 };
        const size = zone.size || { width: 400, height: 300 };

        zonePositions[zoneId] = { ...pos, ...size };
        componentCountInZone[zoneId] = 0;

        nodes.push({
          id: `zone-${zoneId}`,
          type: 'network-zone',
          position: pos,
          style: { width: size.width, height: size.height },
          data: {
            ...defaultNetworkZoneData,
            label: zoneId.charAt(0).toUpperCase() + zoneId.slice(1),
            zoneType: zone.type || 'backend',
            domain: zone.domain,
            subdomains: zone.subdomains,
            color: zoneColors[zone.type || 'backend'],
            interZoneLatency: zone.interZoneLatency ?? 2,
          },
        });

        zoneIndex++;
      }
    }

    // Create host server nodes
    if (arch.hosts) {
      let hostIndex = 0;
      for (const [hostId, host] of Object.entries(arch.hosts)) {
        const parentId = host.zone ? `zone-${host.zone}` : undefined;

        let position: { x: number; y: number };
        if (host.position) {
          position = host.position;
        } else if (host.zone && zonePositions[host.zone]) {
          const count = componentCountInZone[host.zone] || 0;
          position = { x: 30 + count * 500, y: 50 };
          componentCountInZone[host.zone] = count + 1;
        } else {
          position = { x: 50 + hostIndex * 500, y: 400 };
        }

        const size = host.size || { width: 450, height: 300 };
        hostPositions[hostId] = { ...position, ...size };
        componentCountInHost[hostId] = 0;

        const hostData = host.config
          ? deepMerge({ ...defaultHostServerData } as Record<string, unknown>, host.config)
          : { ...defaultHostServerData };

        // Override with top-level host fields
        if (host.ipAddress) (hostData as Record<string, unknown>).ipAddress = host.ipAddress;
        if (host.hostname) (hostData as Record<string, unknown>).hostname = host.hostname;
        if (host.portMappings) (hostData as Record<string, unknown>).portMappings = host.portMappings;

        nodes.push({
          id: hostId,
          type: 'host-server',
          position,
          style: { width: size.width, height: size.height },
          data: hostData,
          ...(parentId ? { parentId, extent: 'parent' as const } : {}),
        });

        hostIndex++;
      }
    }

    // Create component nodes
    let freeX = 100;
    let freeY = 100;

    for (const [compId, comp] of Object.entries(arch.components)) {
      const defaults = defaultDataByType[comp.type] || { label: comp.type };
      const mergedData = comp.config
        ? deepMerge(defaults, comp.config)
        : { ...defaults };

      // Set label from component ID if not in config
      if (!comp.config?.label) {
        mergedData.label = compId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }

      mergedData.status = 'idle';

      // Calculate position
      let position: { x: number; y: number };
      let parentId: string | undefined;

      if (comp.position) {
        position = comp.position;
      } else if (comp.container) {
        // Auto-layout inside container
        const count = componentCountInHost[comp.container] || 0;
        const cols = 2;
        const col = count % cols;
        const row = Math.floor(count / cols);
        position = { x: 30 + col * 200, y: 50 + row * 120 };
        parentId = comp.container;
        componentCountInHost[comp.container] = (componentCountInHost[comp.container] || 0) + 1;
      } else if (comp.host && hostPositions[comp.host]) {
        // Auto-layout inside host server
        const count = componentCountInHost[comp.host] || 0;
        const cols = 2;
        const col = count % cols;
        const row = Math.floor(count / cols);
        position = { x: 30 + col * 200, y: 50 + row * 120 };
        parentId = comp.host;
        componentCountInHost[comp.host] = count + 1;
      } else if (comp.zone && zonePositions[comp.zone]) {
        // Auto-layout inside zone
        const count = componentCountInZone[comp.zone] || 0;
        const cols = 2;
        const col = count % cols;
        const row = Math.floor(count / cols);
        position = { x: 30 + col * 200, y: 50 + row * 120 };
        parentId = `zone-${comp.zone}`;
        componentCountInZone[comp.zone] = count + 1;
      } else {
        position = { x: freeX, y: freeY };
        freeX += 250;
        if (freeX > 1000) { freeX = 100; freeY += 150; }
      }

      nodes.push({
        id: compId,
        type: comp.type,
        position,
        data: mergedData,
        ...(parentId ? { parentId, extent: 'parent' as const } : {}),
      });
    }

    // Create edges from connections
    if (arch.connections) {
      for (const conn of arch.connections) {
        const edgeData: Record<string, unknown> = {};
        if (conn.protocol) edgeData.protocol = conn.protocol;
        if (conn.targetPort) edgeData.targetPort = conn.targetPort;

        edges.push({
          id: `edge-${conn.from}-${conn.to}`,
          source: conn.from,
          target: conn.to,
          type: 'animated',
          ...(Object.keys(edgeData).length > 0 ? { data: edgeData } : {}),
        });
      }
    }

    return { nodes, edges };
  } catch (e) {
    return { error: `Erreur de parsing YAML : ${e instanceof Error ? e.message : String(e)}` };
  }
}
