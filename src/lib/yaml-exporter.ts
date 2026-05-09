import YAML from 'yaml';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NetworkZoneNodeData, HostServerNodeData } from '@/types';
import { yamlSchemaRegistry, type ProjectKindMeta } from '@/plugins/extensions';

interface YamlArchitecture {
  version: number;
  name: string;
  /** Métadonnées extensibles : kind du projet + champs additionnels apportés par les plugins. */
  metadata?: Record<string, unknown>;
  zones?: Record<string, Record<string, unknown>>;
  hosts?: Record<string, Record<string, unknown>>;
  components: Record<string, Record<string, unknown>>;
  connections: { from: string; to: string; protocol?: string; targetPort?: number; topic?: string; [key: string]: unknown }[];
}

const statusKeys = ['status', 'utilization', 'circuitState', 'failureCount', 'successCount', 'currentInstances'];

function cleanData(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (statusKeys.includes(key)) continue;
    if (key === 'label') continue;
    // Underscore-prefixed keys are transient runtime state (e.g. _waypoints from auto-layout)
    // and must never be serialised.
    if (key.startsWith('_')) continue;
    if (value === undefined || value === null) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export function exportToYaml(
  nodes: GraphNode[],
  edges: GraphEdge[],
  name = 'Architecture',
  projectMeta?: ProjectKindMeta,
): string {
  const arch: YamlArchitecture = {
    version: 1,
    name,
    components: {},
    connections: [],
  };

  // Metadata : kind + extensions des plugins.
  // Pour la rétrocompatibilité, on omet la metadata si kind === 'free' et qu'aucun plugin
  // n'ajoute de champ. Un YAML produit par un projet "libre" reste donc identique au format historique.
  if (projectMeta) {
    const pluginMeta = yamlSchemaRegistry.serializeMetadata(projectMeta);
    const kindMeta = projectMeta.kind && projectMeta.kind !== 'free' ? { kind: projectMeta.kind } : {};
    const merged = { ...kindMeta, ...pluginMeta };
    if (Object.keys(merged).length > 0) {
      arch.metadata = merged;
    }
  }

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
        ...(node.width != null && node.height != null ? { size: { width: node.width, height: node.height } } : {}),
      };
    }
  }

  // Export host servers
  const hostNodes = nodes.filter(n => n.type === 'host-server');
  if (hostNodes.length > 0) {
    arch.hosts = {};
    for (const node of hostNodes) {
      const data = node.data as HostServerNodeData;
      // Déterminer la zone parente éventuelle
      const parentZone = node.parentId?.replace('zone-', '');
      arch.hosts[node.id] = {
        ...(parentZone ? { zone: parentZone } : {}),
        ipAddress: data.ipAddress,
        ...(data.hostname ? { hostname: data.hostname } : {}),
        ...(data.portMappings?.length ? { portMappings: data.portMappings } : {}),
        config: {
          label: data.label,
          ...cleanData(data as unknown as Record<string, unknown>),
        },
        position: node.parentId
          ? { x: Math.round(node.position.x), y: Math.round(node.position.y) }
          : { x: Math.round(node.position.x), y: Math.round(node.position.y) },
        ...(node.width != null && node.height != null ? { size: { width: node.width, height: node.height } } : {}),
      };
    }
  }

  // Export components (exclude zones and host-servers)
  const componentNodes = nodes.filter(n => n.type !== 'network-zone' && n.type !== 'host-server');
  for (const node of componentNodes) {
    // Déterminer le parent : host-server, container, ou zone
    const parentNode = node.parentId ? nodes.find(n => n.id === node.parentId) : undefined;
    const parentIsHost = parentNode?.type === 'host-server';
    const parentIsContainer = parentNode?.type === 'container';
    const parentZone = (parentIsHost || parentIsContainer) ? undefined : node.parentId?.replace('zone-', '');
    const parentHost = parentIsHost ? node.parentId : undefined;
    const parentContainer = parentIsContainer ? node.parentId : undefined;

    const pluginNodeFields = yamlSchemaRegistry.serializeNode(node);
    arch.components[node.id] = {
      type: node.type as string,
      ...(parentZone ? { zone: parentZone } : {}),
      ...(parentHost ? { host: parentHost } : {}),
      ...(parentContainer ? { container: parentContainer } : {}),
      ...(!node.parentId ? { position: { x: Math.round(node.position.x), y: Math.round(node.position.y) } } : {}),
      ...pluginNodeFields,
      config: {
        label: (node.data as Record<string, unknown>).label,
        ...cleanData(node.data as Record<string, unknown>),
      },
    };
  }

  // Export connections
  arch.connections = edges.map(e => {
    const edgeData = e.data as Record<string, unknown> | undefined;
    const targetPort = edgeData?.targetPort as number | undefined;
    const protocol = edgeData?.protocol as string | undefined;
    const topic = edgeData?.topic as string | undefined;
    const pluginEdgeFields = yamlSchemaRegistry.serializeEdge(e);
    return {
      from: e.source,
      to: e.target,
      ...(protocol ? { protocol } : {}),
      ...(targetPort ? { targetPort } : {}),
      ...(topic ? { topic } : {}),
      ...pluginEdgeFields,
    };
  });

  return YAML.stringify(arch, { indent: 2, lineWidth: 120 });
}
