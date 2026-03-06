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
  zoneColors,
} from '@/types';

interface YamlArchitecture {
  version: number;
  name: string;
  description?: string;
  zones?: Record<string, YamlZone>;
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

interface YamlComponent {
  type: ComponentType;
  zone?: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
}

interface YamlConnection {
  from: string;
  to: string;
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
        edges.push({
          id: `edge-${conn.from}-${conn.to}`,
          source: conn.from,
          target: conn.to,
          type: 'animated',
        });
      }
    }

    return { nodes, edges };
  } catch (e) {
    return { error: `Erreur de parsing YAML : ${e instanceof Error ? e.message : String(e)}` };
  }
}
