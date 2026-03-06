import YAML from 'yaml';
import type { Node, Edge } from '@xyflow/react';
import type { NetworkZoneNodeData } from '@/types';

interface YamlArchitecture {
  version: number;
  name: string;
  zones?: Record<string, Record<string, unknown>>;
  components: Record<string, Record<string, unknown>>;
  connections: { from: string; to: string }[];
}

const statusKeys = ['status', 'utilization', 'circuitState', 'failureCount', 'successCount', 'currentInstances'];

function cleanData(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (statusKeys.includes(key)) continue;
    if (key === 'label') continue;
    if (value === undefined || value === null) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export function exportToYaml(nodes: Node[], edges: Edge[], name = 'Architecture'): string {
  const arch: YamlArchitecture = {
    version: 1,
    name,
    components: {},
    connections: [],
  };

  // Export zones
  const zoneNodes = nodes.filter(n => n.type === 'network-zone');
  if (zoneNodes.length > 0) {
    arch.zones = {};
    for (const node of zoneNodes) {
      const data = node.data as NetworkZoneNodeData;
      const zoneId = node.id.replace('zone-', '');
      arch.zones[zoneId] = {
        type: data.zoneType,
        ...(data.domain ? { domain: data.domain } : {}),
        ...(data.subdomains?.length ? { subdomains: data.subdomains } : {}),
        interZoneLatency: data.interZoneLatency,
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
        ...(node.style ? { size: { width: (node.style as Record<string, number>).width, height: (node.style as Record<string, number>).height } } : {}),
      };
    }
  }

  // Export components
  const componentNodes = nodes.filter(n => n.type !== 'network-zone');
  for (const node of componentNodes) {
    const parentZone = node.parentId?.replace('zone-', '');
    arch.components[node.id] = {
      type: node.type as string,
      ...(parentZone ? { zone: parentZone } : {}),
      ...(!node.parentId ? { position: { x: Math.round(node.position.x), y: Math.round(node.position.y) } } : {}),
      config: {
        label: (node.data as Record<string, unknown>).label,
        ...cleanData(node.data as Record<string, unknown>),
      },
    };
  }

  // Export connections
  arch.connections = edges.map(e => ({ from: e.source, to: e.target }));

  return YAML.stringify(arch, { indent: 2, lineWidth: 120 });
}
