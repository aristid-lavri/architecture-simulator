import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ConnectionProtocol } from '@/types';
import { getInterRegionLatency } from '@/data/latency-matrix';

/** Multiplicateurs de latence par protocole */
const protocolMultipliers: Record<ConnectionProtocol, number> = {
  grpc: 0.7,
  rest: 1.0,
  websocket: 0.5,
  graphql: 1.1,
};

/** Détail de latence pour un hop dans le chemin */
export interface LatencyHop {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  /** Latence de processing du noeud (ms) */
  processingLatency: number;
  /** Latence inter-zone si le hop traverse une frontière de zone (ms) */
  interZoneLatency: number;
  /** Multiplicateur protocole appliqué */
  protocolMultiplier: number;
  /** Protocole de l'edge entrant */
  protocol: ConnectionProtocol | null;
  /** Edge ID utilisé pour atteindre ce noeud */
  edgeId: string | null;
}

/** Résultat du calcul de latence pour un chemin */
export interface LatencyResult {
  hops: LatencyHop[];
  totalLatency: number;
  path: string[];   // node IDs
  edgePath: string[]; // edge IDs
}

/**
 * Extrait la latence de processing d'un noeud selon son type et ses données.
 */
function getNodeProcessingLatency(node: GraphNode): number {
  const data = node.data as Record<string, unknown>;
  const type = node.type;

  switch (type) {
    case 'http-server':
      return (data.responseDelay as number) ?? 100;

    case 'database': {
      const perf = data.performance as { readLatencyMs?: number } | undefined;
      return perf?.readLatencyMs ?? 5;
    }

    case 'cache': {
      const perf = data.performance as { getLatencyMs?: number } | undefined;
      return perf?.getLatencyMs ?? 1;
    }

    case 'load-balancer':
      return 1; // passthrough quasi-instantané

    case 'api-gateway':
      return (data.baseLatencyMs as number) ?? 5;

    case 'message-queue': {
      const perf = data.performance as { publishLatencyMs?: number; consumeLatencyMs?: number } | undefined;
      return (perf?.publishLatencyMs ?? 2) + (perf?.consumeLatencyMs ?? 5);
    }

    case 'cdn':
      return (data.edgeLatencyMs as number) ?? 5;

    case 'waf':
    case 'firewall':
      return (data.inspectionLatencyMs as number) ?? 2;

    case 'serverless':
    case 'cloud-function':
      return (data.coldStartMs as number) ?? 500;

    case 'container':
      return (data.responseDelayMs as number) ?? 20;

    case 'service-discovery':
      return (data.lookupLatencyMs as number) ?? 2;

    case 'dns':
      return (data.resolutionLatencyMs as number) ?? 5;

    case 'cloud-storage':
      return (data.readLatencyMs as number) ?? 20;

    case 'circuit-breaker':
      return 0; // pas de latence propre

    case 'http-client':
    case 'client-group':
      return 0; // source de requête

    default:
      return 0;
  }
}

/**
 * Récupère la latence inter-zone entre deux noeuds.
 */
function findContainingZoneId(node: GraphNode, allNodes: GraphNode[]): string | undefined {
  let currentId: string | undefined = node.parentId;
  while (currentId) {
    const parent = allNodes.find((n) => n.id === currentId);
    if (!parent) return undefined;
    if (parent.type === 'network-zone') return parent.id;
    currentId = parent.parentId;
  }
  return undefined;
}

function getZoneCrossingLatency(
  fromNode: GraphNode,
  toNode: GraphNode,
  allNodes: GraphNode[]
): number {
  // Remonter la chaîne parentId pour trouver les zones réseau
  const fromZoneId = findContainingZoneId(fromNode, allNodes);
  const toZoneId = findContainingZoneId(toNode, allNodes);

  // Même zone ou pas de zone
  if (fromZoneId === toZoneId) return 0;

  // Trouver les noeuds de zone pour leurs interZoneLatency et region
  const fromZone = fromZoneId ? allNodes.find((n) => n.id === fromZoneId) : null;
  const toZone = toZoneId ? allNodes.find((n) => n.id === toZoneId) : null;

  // Si les deux zones ont une région, utiliser la matrice géographique
  const fromRegion = (fromZone?.data as Record<string, unknown>)?.region as string | undefined;
  const toRegion = (toZone?.data as Record<string, unknown>)?.region as string | undefined;
  if (fromRegion && toRegion) {
    const geoLatency = getInterRegionLatency(fromRegion, toRegion);
    if (geoLatency !== null) return geoLatency;
  }

  // Sinon, utiliser la valeur interZoneLatency configurée
  const fromInterZone = (fromZone?.data as Record<string, unknown>)?.interZoneLatency as number | undefined;
  const toInterZone = (toZone?.data as Record<string, unknown>)?.interZoneLatency as number | undefined;
  return Math.max(fromInterZone ?? 2, toInterZone ?? 2);
}

/**
 * BFS pour trouver le plus court chemin (en nombre de hops) entre source et destination.
 */
function findShortestPath(
  sourceId: string,
  targetId: string,
  edges: GraphEdge[]
): { nodeIds: string[]; edgeIds: string[] } | null {
  const adjacency = new Map<string, { nodeId: string; edgeId: string }[]>();

  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push({ nodeId: edge.target, edgeId: edge.id });
  }

  const visited = new Set<string>();
  const queue: { nodeId: string; path: string[]; edgePath: string[] }[] = [
    { nodeId: sourceId, path: [sourceId], edgePath: [] },
  ];
  visited.add(sourceId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.nodeId === targetId) {
      return { nodeIds: current.path, edgeIds: current.edgePath };
    }

    const neighbors = adjacency.get(current.nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.nodeId)) {
        visited.add(neighbor.nodeId);
        queue.push({
          nodeId: neighbor.nodeId,
          path: [...current.path, neighbor.nodeId],
          edgePath: [...current.edgePath, neighbor.edgeId],
        });
      }
    }
  }

  return null;
}

/**
 * Calcule la latence théorique totale pour un chemin source → destination.
 * Utilise BFS pour trouver le chemin, puis somme les latences par hop.
 */
export function calculatePathLatency(
  sourceId: string,
  targetId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  protocolOverride?: ConnectionProtocol
): LatencyResult | null {
  const path = findShortestPath(sourceId, targetId, edges);
  if (!path) return null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(edges.map((e) => [e.id, e]));
  const hops: LatencyHop[] = [];
  let totalLatency = 0;

  for (let i = 0; i < path.nodeIds.length; i++) {
    const nodeId = path.nodeIds[i];
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const edgeId = path.edgeIds[i - 1] ?? null;
    const edge = edgeId ? edgeMap.get(edgeId) : null;

    // Protocole: override > edge data > null
    const edgeProtocol = (edge?.data as Record<string, unknown>)?.protocol as ConnectionProtocol | undefined;
    const protocol = protocolOverride ?? edgeProtocol ?? null;
    const multiplier = protocol ? protocolMultipliers[protocol] : 1.0;

    // Processing latency
    const processingLatency = getNodeProcessingLatency(node);

    // Inter-zone latency (entre noeud précédent et celui-ci)
    let interZoneLatency = 0;
    if (i > 0) {
      const prevNode = nodeMap.get(path.nodeIds[i - 1]);
      if (prevNode) {
        interZoneLatency = getZoneCrossingLatency(prevNode, node, nodes);
      }
    }

    const hopLatency = (processingLatency * multiplier) + interZoneLatency;
    totalLatency += hopLatency;

    hops.push({
      nodeId,
      nodeLabel: (node.data as Record<string, unknown>).label as string || nodeId,
      nodeType: node.type || 'unknown',
      processingLatency,
      interZoneLatency,
      protocolMultiplier: multiplier,
      protocol,
      edgeId,
    });
  }

  return {
    hops,
    totalLatency: Math.round(totalLatency * 100) / 100,
    path: path.nodeIds,
    edgePath: path.edgeIds,
  };
}

/**
 * Calcule la latence pour tous les protocoles (comparaison).
 */
export function compareProtocolLatencies(
  sourceId: string,
  targetId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): Record<ConnectionProtocol, number | null> {
  const protocols: ConnectionProtocol[] = ['rest', 'grpc', 'websocket', 'graphql'];
  const results: Record<string, number | null> = {};

  for (const proto of protocols) {
    const result = calculatePathLatency(sourceId, targetId, nodes, edges, proto);
    results[proto] = result?.totalLatency ?? null;
  }

  return results as Record<ConnectionProtocol, number | null>;
}
