'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  reconnectEdge,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '@/store/app-store';
import { useSimulationStore } from '@/store/simulation-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { useTranslation } from '@/i18n';
import { SimulationEngine } from '@/engine/SimulationEngine';
import HttpClientNode from '@/components/nodes/HttpClientNode';
import HttpServerNode from '@/components/nodes/HttpServerNode';
import ClientGroupNode from '@/components/nodes/ClientGroupNode';
import DatabaseNode from '@/components/nodes/DatabaseNode';
import CacheNode from '@/components/nodes/CacheNode';
import LoadBalancerNode from '@/components/nodes/LoadBalancerNode';
import MessageQueueNode from '@/components/nodes/MessageQueueNode';
import ApiGatewayNode from '@/components/nodes/ApiGatewayNode';
import NetworkZoneNode from '@/components/nodes/NetworkZoneNode';
import CircuitBreakerNode from '@/components/nodes/CircuitBreakerNode';
import CDNNode from '@/components/nodes/CDNNode';
import WAFNode from '@/components/nodes/WAFNode';
import ServerlessNode from '@/components/nodes/ServerlessNode';
import ContainerNode from '@/components/nodes/ContainerNode';
import ServiceDiscoveryNode from '@/components/nodes/ServiceDiscoveryNode';
import DNSNode from '@/components/nodes/DNSNode';
import CloudStorageNode from '@/components/nodes/CloudStorageNode';
import FirewallNode from '@/components/nodes/FirewallNode';
import HostServerNode from '@/components/nodes/HostServerNode';
import ApiServiceNode from '@/components/nodes/ApiServiceNode';
import BackgroundJobNode from '@/components/nodes/BackgroundJobNode';
import AnimatedEdge from '@/components/edges/AnimatedEdge';
import { MetricsPanel } from '@/components/simulation/MetricsPanel';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, Maximize2, Lock, Unlock, LayoutGrid } from 'lucide-react';
import type { ComponentType } from '@/types';
import { CONTAINER_TYPES, canBeChildOf } from '@/types';
import { suggestProtocol } from '@/data/connector-compatibility';
import { applyAutoLayout } from '@/lib/auto-layout';
import { defaultClientGroupData, defaultServerResources, defaultDegradation, defaultDatabaseNodeData, defaultCacheNodeData, defaultLoadBalancerNodeData, defaultMessageQueueNodeData, defaultApiGatewayNodeData, defaultNetworkZoneData, defaultCircuitBreakerData, defaultCDNNodeData, defaultWAFNodeData, defaultServerlessData, defaultServiceDiscoveryData, defaultCloudStorageData, defaultCloudFunctionData, defaultFirewallData, defaultContainerData, defaultDNSNodeData, defaultHostServerData, defaultApiServiceData, defaultBackgroundJobData } from '@/types';
import type { HttpClientNodeData } from '@/components/nodes/HttpClientNode';
import type { HttpServerNodeData } from '@/components/nodes/HttpServerNode';
import type { ClientGroupNodeData } from '@/components/nodes/ClientGroupNode';
import type { DatabaseNodeData } from '@/components/nodes/DatabaseNode';
import type { CacheNodeData } from '@/components/nodes/CacheNode';
import type { LoadBalancerNodeData } from '@/components/nodes/LoadBalancerNode';
import type { MessageQueueNodeData } from '@/components/nodes/MessageQueueNode';
import type { ApiGatewayNodeData } from '@/components/nodes/ApiGatewayNode';
import type { ApiServiceNodeData } from '@/components/nodes/ApiServiceNode';
import type { BackgroundJobNodeData } from '@/components/nodes/BackgroundJobNode';
import { pluginRegistry } from '@/plugins';
import { LatencyPathPanel } from '@/components/simulation/LatencyPathPanel';
import { NodeContextMenu } from '@/components/flow/NodeContextMenu';

// Built-in node types
const builtinNodeTypes = {
  'http-client': HttpClientNode,
  'http-server': HttpServerNode,
  'client-group': ClientGroupNode,
  'database': DatabaseNode,
  'cache': CacheNode,
  'load-balancer': LoadBalancerNode,
  'message-queue': MessageQueueNode,
  'api-gateway': ApiGatewayNode,
  'network-zone': NetworkZoneNode,
  'circuit-breaker': CircuitBreakerNode,
  'cdn': CDNNode,
  'waf': WAFNode,
  'serverless': ServerlessNode,
  'cloud-function': ServerlessNode,
  'container': ContainerNode,
  'service-discovery': ServiceDiscoveryNode,
  'dns': DNSNode,
  'cloud-storage': CloudStorageNode,
  'firewall': FirewallNode,
  'host-server': HostServerNode,
  'api-service': ApiServiceNode,
  'background-job': BackgroundJobNode,
};

// Custom edge types
const edgeTypes = {
  animated: AnimatedEdge,
};

// Default data for new nodes
function getDefaultNodeData(type: ComponentType): HttpClientNodeData | HttpServerNodeData | ClientGroupNodeData | DatabaseNodeData | CacheNodeData | LoadBalancerNodeData | MessageQueueNodeData | ApiGatewayNodeData | Record<string, unknown> {
  switch (type) {
    case 'http-client':
      return {
        label: 'HTTP Client',
        method: 'GET',
        path: '/api/data',
        requestMode: 'single',
        interval: 1000,
        status: 'idle',
      } satisfies HttpClientNodeData;
    case 'http-server':
      return {
        label: 'HTTP Server',
        port: 8080,
        responseStatus: 200,
        responseBody: '{"success": true}',
        responseDelay: 100,
        errorRate: 0,
        status: 'idle',
        resources: defaultServerResources,
        degradation: defaultDegradation,
      } satisfies HttpServerNodeData;
    case 'client-group':
      return {
        ...defaultClientGroupData,
        status: 'idle',
      } satisfies ClientGroupNodeData;
    case 'database':
      return {
        ...defaultDatabaseNodeData,
        status: 'idle',
      } satisfies DatabaseNodeData;
    case 'cache':
      return {
        ...defaultCacheNodeData,
        status: 'idle',
      } satisfies CacheNodeData;
    case 'load-balancer':
      return {
        ...defaultLoadBalancerNodeData,
        status: 'idle',
      } satisfies LoadBalancerNodeData;
    case 'message-queue':
      return {
        ...defaultMessageQueueNodeData,
        status: 'idle',
      } satisfies MessageQueueNodeData;
    case 'api-gateway':
      return {
        ...defaultApiGatewayNodeData,
        status: 'idle',
      } satisfies ApiGatewayNodeData;
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
      return { ...defaultApiServiceData, status: 'idle' } satisfies ApiServiceNodeData;
    case 'background-job':
      return { ...defaultBackgroundJobData, status: 'idle' } satisfies BackgroundJobNodeData;
    default: {
      // Chercher dans les plugins enregistrés
      const pluginData = pluginRegistry.getDefaultNodeData(type);
      if (pluginData) {
        return { ...pluginData, status: 'idle' };
      }
      return { label: type.replace('-', ' ').toUpperCase() };
    }
  }
}

// Zoom controls component - must be inside ReactFlow context
function ZoomControls({ isEditable }: { isEditable: boolean }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel position="bottom-left">
      <div className="flex items-center gap-px bg-card border border-border" style={{ borderRadius: '3px' }}>
        <button
          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => zoomOut()}
          title="Zoom arrière"
        >
          <ZoomOut className="h-3 w-3" />
        </button>
        <button
          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => zoomIn()}
          title="Zoom avant"
        >
          <ZoomIn className="h-3 w-3" />
        </button>
        <button
          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => fitView({ padding: 0.2 })}
          title="Ajuster"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
        <div className="h-7 w-7 flex items-center justify-center text-muted-foreground/50">
          {isEditable ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        </div>
      </div>
    </Panel>
  );
}

/**
 * Trouve le conteneur le plus profond à une position donnée qui accepte le type droppé.
 * Priorise les conteneurs les plus imbriqués (profondeur maximale).
 */
function findContainerAtPosition(
  nodes: Node[],
  position: { x: number; y: number },
  droppedType: ComponentType
): Node | null {
  // Calcule la profondeur d'un noeud (nombre de parents dans la chaîne parentId)
  function getDepth(node: Node): number {
    let depth = 0;
    let current = node;
    while (current.parentId) {
      depth++;
      const parent = nodes.find((n) => n.id === current.parentId);
      if (!parent) break;
      current = parent;
    }
    return depth;
  }

  // Calcule la position absolue d'un noeud (somme des positions de la chaîne parentId)
  function getAbsolutePosition(node: Node): { x: number; y: number } {
    let absX = node.position.x;
    let absY = node.position.y;
    let current = node;
    while (current.parentId) {
      const parent = nodes.find((n) => n.id === current.parentId);
      if (!parent) break;
      absX += parent.position.x;
      absY += parent.position.y;
      current = parent;
    }
    return { x: absX, y: absY };
  }

  const containerNodes = nodes.filter(
    (n) => CONTAINER_TYPES.includes(n.type as ComponentType)
  );

  let bestMatch: Node | null = null;
  let bestDepth = -1;

  for (const container of containerNodes) {
    const parentType = container.type as ComponentType;
    if (!canBeChildOf(droppedType, parentType)) continue;

    const absPos = getAbsolutePosition(container);
    const width = container.measured?.width ?? container.style?.width as number ?? 400;
    const height = container.measured?.height ?? container.style?.height as number ?? 250;

    if (
      position.x >= absPos.x &&
      position.x <= absPos.x + width &&
      position.y >= absPos.y &&
      position.y <= absPos.y + height
    ) {
      const depth = getDepth(container);
      if (depth > bestDepth) {
        bestDepth = depth;
        bestMatch = container;
      }
    }
  }

  return bestMatch;
}

/**
 * Tri topologique des noeuds : les parents sont toujours avant leurs enfants.
 * React Flow exige cet ordre pour le rendu correct des groupes.
 */
function ensureNodeOrdering(nodes: Node[]): Node[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const result: Node[] = [];

  function visit(node: Node) {
    if (visited.has(node.id)) return;
    // Si le noeud a un parent, s'assurer que le parent est ajouté d'abord
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) visit(parent);
    }
    visited.add(node.id);
    result.push(node);
  }

  for (const node of nodes) {
    visit(node);
  }

  return result;
}

/**
 * Calcule la position absolue d'un noeud en remontant la chaîne parentId.
 */
function getNodeAbsolutePosition(node: Node, nodes: Node[]): { x: number; y: number } {
  let absX = node.position.x;
  let absY = node.position.y;
  let current = node;
  while (current.parentId) {
    const parent = nodes.find((n) => n.id === current.parentId);
    if (!parent) break;
    absX += parent.position.x;
    absY += parent.position.y;
    current = parent;
  }
  return { x: absX, y: absY };
}

export function FlowCanvas() {
  const { t } = useTranslation();
  const { mode, setSelectedNodeId, setSelectedEdgeId } = useAppStore();

  // Merge built-in node types with plugin node types (réactif aux changements de plugins)
  const pluginSnapshot = useSyncExternalStore(
    (cb) => pluginRegistry.subscribe(cb),
    () => pluginRegistry.getRegisteredPlugins().length,
    () => 0,
  );
  const nodeTypes = useMemo(
    () => ({ ...builtinNodeTypes, ...pluginRegistry.getNodeTypes() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pluginSnapshot],
  );
  // Use individual selectors to avoid re-rendering FlowCanvas on every metrics update
  const simulationState = useSimulationStore((s) => s.state);
  const nodeStates = useSimulationStore((s) => s.nodeStates);
  const addParticle = useSimulationStore((s) => s.addParticle);
  const removeParticle = useSimulationStore((s) => s.removeParticle);
  const updateParticle = useSimulationStore((s) => s.updateParticle);
  const setNodeStatus = useSimulationStore((s) => s.setNodeStatus);
  const incrementRequestsSent = useSimulationStore((s) => s.incrementRequestsSent);
  const recordResponse = useSimulationStore((s) => s.recordResponse);
  const setMetrics = useSimulationStore((s) => s.setMetrics);
  const setResourceUtilization = useSimulationStore((s) => s.setResourceUtilization);
  const addResourceSample = useSimulationStore((s) => s.addResourceSample);
  const updateClientGroupStats = useSimulationStore((s) => s.updateClientGroupStats);
  const addTimeSeriesSnapshot = useSimulationStore((s) => s.addTimeSeriesSnapshot);
  const stopSimulation = useSimulationStore((s) => s.stop);
  const faultInjections = useSimulationStore((s) => s.faultInjections);
  const isolatedNodes = useSimulationStore((s) => s.isolatedNodes);

  // Chaos mode — context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const registerEngineMetricsProvider = useSimulationStore((s) => s.registerEngineMetricsProvider);

  // Get persisted nodes and edges from architecture store
  const {
    nodes: storedNodes,
    edges: storedEdges,
    setNodesAndEdges: saveNodesAndEdges,
    undo,
    redo,
    _syncVersion,
  } = useArchitectureStore();

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'edit') return;
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, undo, redo]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const initializedRef = useRef(false);

  // Tracks the last _syncVersion we processed (undo/redo/restore/clear/template)
  const lastSyncVersionRef = useRef(_syncVersion);
  // Counts how many store-to-local syncs are pending (save effect skips while > 0)
  const pendingSyncsRef = useRef(0);

  // Initialize from store only once after hydration
  useEffect(() => {
    if (!initializedRef.current && (storedNodes.length > 0 || storedEdges.length > 0)) {
      setNodes(storedNodes);
      setEdges(storedEdges);
      initializedRef.current = true;
      pendingSyncsRef.current++;
    } else if (!initializedRef.current) {
      initializedRef.current = true;
    }
  }, [storedNodes, storedEdges, setNodes, setEdges]);

  // Full replacement when store changes via undo/redo/restore/clear (_syncVersion changes)
  useEffect(() => {
    if (!initializedRef.current) return;
    if (_syncVersion === lastSyncVersionRef.current) return;

    lastSyncVersionRef.current = _syncVersion;
    pendingSyncsRef.current++;
    setNodes(storedNodes);
    setEdges(storedEdges);
  }, [_syncVersion, storedNodes, storedEdges, setNodes, setEdges]);

  // Detect template loads (all IDs change at once, without _syncVersion bump)
  const prevStoredNodesRef = useRef<Node[]>([]);
  useEffect(() => {
    if (!initializedRef.current) return;

    const storedNodeIds = new Set(storedNodes.map(n => n.id));
    const prevNodeIds = new Set(prevStoredNodesRef.current.map(n => n.id));
    const isTemplateLoad = storedNodes.length > 0 && (
      prevStoredNodesRef.current.length === 0 ||
      ![...storedNodeIds].some(id => prevNodeIds.has(id))
    );

    if (isTemplateLoad) {
      pendingSyncsRef.current++;
      setNodes(storedNodes);
      setEdges(storedEdges);
    }

    prevStoredNodesRef.current = storedNodes;
  }, [storedNodes, storedEdges, setNodes, setEdges]);

  // Sync node data changes from store to local (PropertiesPanel updates, deletions)
  useEffect(() => {
    if (!initializedRef.current) return;

    setNodes((currentNodes) => {
      const storedNodeIds = new Set(storedNodes.map((n) => n.id));
      const currentNodeIds = new Set(currentNodes.map((n) => n.id));
      let hasChanges = false;

      // Remove nodes that no longer exist in the store
      let updatedNodes = currentNodes;
      if (currentNodes.some((n) => !storedNodeIds.has(n.id))) {
        updatedNodes = currentNodes.filter((n) => storedNodeIds.has(n.id));
        hasChanges = true;
      }

      // Add nodes that exist in store but not locally
      const newNodes = storedNodes.filter((n) => !currentNodeIds.has(n.id));
      if (newNodes.length > 0) {
        updatedNodes = [...updatedNodes, ...newNodes];
        hasChanges = true;
      }

      // Update data for existing nodes
      updatedNodes = updatedNodes.map((node) => {
        const storedNode = storedNodes.find((n) => n.id === node.id);
        if (storedNode) {
          const dataChanged = Object.keys(storedNode.data).some((key) => {
            if (key === 'status') return false;
            return node.data[key] !== storedNode.data[key];
          });

          if (dataChanged) {
            hasChanges = true;
            return {
              ...node,
              data: { ...storedNode.data, status: node.data.status },
            };
          }
        }
        return node;
      });

      if (hasChanges) {
        pendingSyncsRef.current++;
        return updatedNodes;
      }
      return currentNodes;
    });
  }, [storedNodes, setNodes]);

  // Sync edge data changes from store to local (PropertiesPanel updates, deletions)
  useEffect(() => {
    if (!initializedRef.current) return;

    setEdges((currentEdges) => {
      const storedEdgeIds = new Set(storedEdges.map((e) => e.id));
      const currentEdgeIds = new Set(currentEdges.map((e) => e.id));
      let hasChanges = false;

      let updatedEdges = currentEdges;
      if (currentEdges.some((e) => !storedEdgeIds.has(e.id))) {
        updatedEdges = currentEdges.filter((e) => storedEdgeIds.has(e.id));
        hasChanges = true;
      }

      const newEdges = storedEdges.filter((e) => !currentEdgeIds.has(e.id));
      if (newEdges.length > 0) {
        updatedEdges = [...updatedEdges, ...newEdges];
        hasChanges = true;
      }

      updatedEdges = updatedEdges.map((edge) => {
        const storedEdge = storedEdges.find((e) => e.id === edge.id);
        if (storedEdge) {
          if (JSON.stringify(edge.data) !== JSON.stringify(storedEdge.data)) {
            hasChanges = true;
            return { ...edge, data: storedEdge.data };
          }
        }
        return edge;
      });

      if (hasChanges) {
        pendingSyncsRef.current++;
        return updatedEdges;
      }
      return currentEdges;
    });
  }, [storedEdges, setEdges]);

  // Persist local changes to store (uses single setNodesAndEdges to push history once)
  useEffect(() => {
    if (!initializedRef.current) return;
    // Skip save-back when we're processing a store-initiated sync
    if (pendingSyncsRef.current > 0) {
      pendingSyncsRef.current--;
      return;
    }
    saveNodesAndEdges(nodes, edges);
  }, [nodes, edges, saveNodesAndEdges]);

  // Sync node statuses from simulation store to node data
  useEffect(() => {
    if (nodeStates.size === 0) return;

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const nodeState = nodeStates.get(node.id);
        if (nodeState && node.data.status !== nodeState.status) {
          // Set className on React Flow node wrapper for CSS-based fault visuals
          const faultClass =
            nodeState.status === 'down'
              ? 'node-fault-down'
              : nodeState.status === 'degraded'
              ? 'node-fault-degraded'
              : '';
          return {
            ...node,
            className: faultClass,
            data: { ...node.data, status: nodeState.status },
          };
        }
        return node;
      })
    );
  }, [nodeStates, setNodes]);

  // Simulation engine ref
  const engineRef = useRef<SimulationEngine | null>(null);

  // Keep refs to callbacks to avoid stale closures
  const callbacksRef = useRef({
    addParticle,
    removeParticle,
    updateParticle,
    setNodeStatus,
    incrementRequestsSent,
    recordResponse,
    setMetrics,
    setResourceUtilization,
    addResourceSample,
    updateClientGroupStats,
    addTimeSeriesSnapshot,
    stopSimulation,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      addParticle,
      removeParticle,
      updateParticle,
      setNodeStatus,
      incrementRequestsSent,
      recordResponse,
      setMetrics,
      setResourceUtilization,
      addResourceSample,
      updateClientGroupStats,
      addTimeSeriesSnapshot,
      stopSimulation,
    };
  }, [addParticle, removeParticle, updateParticle, setNodeStatus, incrementRequestsSent, recordResponse, setMetrics, setResourceUtilization, addResourceSample, updateClientGroupStats, addTimeSeriesSnapshot, stopSimulation]);

  // Initialize simulation engine once
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new SimulationEngine({
        onStateChange: () => {
          // Don't sync back to store - store controls engine, not vice versa
        },
        onAddParticle: (particle) => {
          console.log('Adding particle:', particle);
          callbacksRef.current.addParticle(particle);
        },
        onRemoveParticle: (id) => {
          console.log('Removing particle:', id);
          callbacksRef.current.removeParticle(id);
        },
        onUpdateParticle: (id, updates) => {
          callbacksRef.current.updateParticle(id, updates);
        },
        onNodeStatusChange: (nodeId, status) => {
          callbacksRef.current.setNodeStatus(nodeId, status);
        },
        onMetricsUpdate: (metrics) => {
          console.log('Metrics update:', metrics);
          callbacksRef.current.setMetrics(metrics);
        },
        onResourceUpdate: (nodeId, utilization) => {
          callbacksRef.current.setResourceUtilization(nodeId, utilization);
          callbacksRef.current.addResourceSample({
            timestamp: Date.now(),
            nodeId,
            cpu: utilization.cpu,
            memory: utilization.memory,
            network: utilization.network,
            disk: utilization.disk,
            activeConnections: utilization.activeConnections,
            queuedRequests: utilization.queuedRequests,
          });
        },
        onClientGroupUpdate: (groupId, activeClients, requestsSent) => {
          callbacksRef.current.updateClientGroupStats(groupId, activeClients, requestsSent);
        },
        onMessageQueueUpdate: (nodeId, utilization) => {
          // Update the node's data with the new utilization
          setNodes((prevNodes) =>
            prevNodes.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, utilization } }
                : node
            )
          );
        },
        onTimeSeriesSnapshot: (snapshot) => {
          callbacksRef.current.addTimeSeriesSnapshot(snapshot);
        },
        onSimulationComplete: () => {
          callbacksRef.current.stopSimulation('completed');
        },
      });

      // Register metrics provider so store.stop() can pull fresh metrics from engine
      registerEngineMetricsProvider(() => engineRef.current!.getFinalMetrics().metrics);
    }

    return () => {
      registerEngineMetricsProvider(null);
    };
  }, [registerEngineMetricsProvider]);

  // Update engine with current nodes and edges
  useEffect(() => {
    if (engineRef.current) {
      console.log('Setting nodes and edges to engine:', { nodes, edges });
      engineRef.current.setNodesAndEdges(nodes, edges);
    }
  }, [nodes, edges]);

  // Chaos mode — keep fault provider synced with store
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setFaultProvider(() => ({
        faults: useSimulationStore.getState().faultInjections,
        isolated: useSimulationStore.getState().isolatedNodes,
      }));
    }
  }, [faultInjections, isolatedNodes]);

  // Keep a ref of nodes/edges for the simulation effect
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Handle simulation state changes
  useEffect(() => {
    if (!engineRef.current) return;

    console.log('Simulation state effect:', { mode, simulationState });

    // Only run simulation in simulation mode
    if (mode !== 'simulation') {
      engineRef.current.stop();
      return;
    }

    // Make sure engine has latest nodes and edges before starting
    engineRef.current.setNodesAndEdges(nodesRef.current, edgesRef.current);

    // React to simulation state changes
    if (simulationState === 'running') {
      const engineState = engineRef.current.getState();
      console.log('Starting engine, current state:', engineState);
      if (engineState === 'idle') {
        engineRef.current.start();
      } else if (engineState === 'paused') {
        engineRef.current.resume();
      }
    } else if (simulationState === 'paused') {
      engineRef.current.pause();
    } else if (simulationState === 'idle') {
      engineRef.current.stop();
    }
  }, [mode, simulationState]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      // Detect node types for protocol suggestion
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      const sourceType = sourceNode?.type as ComponentType | undefined;
      const targetType = targetNode?.type as ComponentType | undefined;

      // Auto-assign protocol if both types support it
      let protocol: import('@/types').ConnectionProtocol | undefined;
      if (sourceType && targetType) {
        const suggested = suggestProtocol(sourceType, targetType);
        if (suggested) protocol = suggested;
      }

      const newEdge: Edge = {
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle ?? undefined,
        targetHandle: params.targetHandle ?? undefined,
        type: 'animated',
        ...(protocol ? { data: { protocol } } : {}),
      };
      setEdges((eds) => [...eds, newEdge]);
    },
    [setEdges, nodes]
  );

  // Handle edge reconnection - allows dragging edge endpoints to new nodes
  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [setEdges]
  );

  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        // If reconnection failed (dropped on empty space), remove the edge
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      }
      edgeReconnectSuccessful.current = true;
    },
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as ComponentType;
      if (!type) return;

      const position = {
        x: event.clientX - 250,
        y: event.clientY - 100,
      };

      // Use the component type directly as node type (all types are registered in nodeTypes)
      const nodeType = type in nodeTypes ? type : 'default';

      // Chercher un conteneur parent à la position de drop
      const parent = findContainerAtPosition(nodes, position, type);

      let finalPosition = position;
      const parentProps: { parentId?: string; extent?: 'parent' } = {};

      if (parent) {
        // Convertir la position en relative au parent
        const parentAbsPos = getNodeAbsolutePosition(parent, nodes);
        finalPosition = {
          x: position.x - parentAbsPos.x,
          y: position.y - parentAbsPos.y,
        };
        parentProps.parentId = parent.id;
        parentProps.extent = 'parent';
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: nodeType,
        position: finalPosition,
        data: getDefaultNodeData(type),
        ...parentProps,
        ...((type === 'network-zone' || type === 'host-server') ? { style: { width: type === 'host-server' ? 450 : 400, height: type === 'host-server' ? 300 : 250 } } : {}),
      };

      setNodes((nds) => ensureNodeOrdering(nds.concat(newNode)));
    },
    [setNodes, nodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const { reparentNode } = useArchitectureStore();

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      const nodeType = draggedNode.type as ComponentType;

      // Calculer la position absolue du noeud draggé
      const absPos = getNodeAbsolutePosition(draggedNode, nodes);

      // Chercher un conteneur à cette position (exclure le noeud lui-même)
      const otherNodes = nodes.filter((n) => n.id !== draggedNode.id);
      const newParent = findContainerAtPosition(otherNodes, absPos, nodeType);

      const currentParentId = draggedNode.parentId ?? null;
      const newParentId = newParent?.id ?? null;

      // Rien à faire si le parent n'a pas changé
      if (currentParentId === newParentId) return;

      // Reparenter via le store
      reparentNode(draggedNode.id, newParentId);

      // Mettre à jour aussi l'état local React Flow
      setNodes((nds) => {
        const updatedNodes = nds.map((n) => {
          if (n.id !== draggedNode.id) return n;

          if (newParentId && newParent) {
            // Convertir position absolue en relative au nouveau parent
            const parentAbsPos = getNodeAbsolutePosition(newParent, nds);
            return {
              ...n,
              position: {
                x: absPos.x - parentAbsPos.x,
                y: absPos.y - parentAbsPos.y,
              },
              parentId: newParentId,
              extent: 'parent' as const,
            };
          } else {
            // Détacher : utiliser la position absolue, retirer parentId et extent
            return {
              ...n,
              position: absPos,
              parentId: undefined,
              extent: undefined,
            };
          }
        });
        return ensureNodeOrdering(updatedNodes);
      });
    },
    [nodes, setNodes, reparentNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
    },
    [setSelectedEdgeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, [setSelectedNodeId, setSelectedEdgeId]);

  // Chaos mode — right-click on nodes in simulation mode
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (mode !== 'simulation') return;
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [mode]
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Auto-layout via ELK
  const [isLayouting, setIsLayouting] = useState(false);
  const handleAutoLayout = useCallback(async () => {
    if (nodes.length === 0 || isLayouting) return;
    setIsLayouting(true);
    try {
      const layoutedNodes = await applyAutoLayout(nodes, edges);
      setNodes(layoutedNodes);
    } catch (err) {
      console.error('Auto-layout failed:', err);
    } finally {
      setIsLayouting(false);
    }
  }, [nodes, edges, setNodes, isLayouting]);

  // Latency path highlighting
  const [highlightedPath, setHighlightedPath] = useState<{ nodeIds: Set<string>; edgeIds: Set<string> } | null>(null);

  const handleHighlightPath = useCallback((nodeIds: string[], edgeIds: string[]) => {
    setHighlightedPath({ nodeIds: new Set(nodeIds), edgeIds: new Set(edgeIds) });
  }, []);

  const handleClearHighlight = useCallback(() => {
    setHighlightedPath(null);
  }, []);

  // Validation highlighting
  const validationResult = useAppStore((s) => s.validationResult);
  const validationNodeSeverity = useMemo(() => {
    const map = new Map<string, 'error' | 'warning'>();
    if (!validationResult) return map;
    for (const issue of validationResult.issues) {
      for (const nodeId of issue.nodeIds || []) {
        const existing = map.get(nodeId);
        if (issue.severity === 'error' || !existing) {
          map.set(nodeId, issue.severity === 'error' ? 'error' : (existing || 'warning'));
        }
      }
    }
    return map;
  }, [validationResult]);

  const validationEdgeIds = useMemo(() => {
    const set = new Set<string>();
    if (!validationResult) return set;
    for (const issue of validationResult.issues) {
      for (const edgeId of issue.edgeIds || []) {
        set.add(edgeId);
      }
    }
    return set;
  }, [validationResult]);

  // Apply highlight styles to nodes/edges
  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      const classes: string[] = [node.className || ''];

      // Latency path highlighting
      if (highlightedPath) {
        classes.push(highlightedPath.nodeIds.has(node.id) ? 'node-latency-highlight' : 'node-latency-dimmed');
      }

      // Validation highlighting
      const severity = validationNodeSeverity.get(node.id);
      if (severity === 'error') classes.push('validation-error');
      else if (severity === 'warning') classes.push('validation-warning');

      return { ...node, className: classes.filter(Boolean).join(' ') };
    });
  }, [nodes, highlightedPath, validationNodeSeverity]);

  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      let style = { ...edge.style };

      // Latency path highlighting
      if (highlightedPath) {
        if (highlightedPath.edgeIds.has(edge.id)) {
          style = { ...style, stroke: 'oklch(0.70 0.15 220)', strokeWidth: 3 };
        } else {
          style = { ...style, opacity: 0.2 };
        }
      }

      // Validation edge highlighting
      if (validationEdgeIds.has(edge.id)) {
        style = { ...style, stroke: 'oklch(0.65 0.25 25)', strokeWidth: 2.5 };
      }

      return { ...edge, style };
    });
  }, [edges, highlightedPath, validationEdgeIds]);

  const isEditable = mode === 'edit';

  return (
    <div className="flex-1 h-full relative" data-tour="flow-canvas">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={isEditable ? onNodesChange : undefined}
        onEdgesChange={isEditable ? onEdgesChange : undefined}
        onConnect={isEditable ? onConnect : undefined}
        onReconnect={isEditable ? onReconnect : undefined}
        onReconnectStart={isEditable ? onReconnectStart : undefined}
        onReconnectEnd={isEditable ? onReconnectEnd : undefined}
        onDrop={isEditable ? onDrop : undefined}
        onDragOver={isEditable ? onDragOver : undefined}
        onNodeClick={onNodeClick}
        onNodeDragStop={isEditable ? onNodeDragStop : undefined}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        nodesDraggable={isEditable}
        nodesConnectable={isEditable}
        elementsSelectable={true}
        fitView={false}
        onlyRenderVisibleElements
        defaultViewport={{ x: 100, y: 50, zoom: 0.75 }}
        className="bg-background"
        defaultEdgeOptions={{
          type: 'animated',
          reconnectable: true,
        }}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={20}
          size={0.5}
          color="var(--grid-minor)"
        />
        <Background
          id="major-grid"
          variant={BackgroundVariant.Lines}
          gap={100}
          size={0.5}
          color="var(--grid-major)"
        />

        <Controls
          showZoom={false}
          showFitView={false}
          showInteractive={false}
        />

        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'http-client') return 'oklch(0.70 0.15 220)';
            if (node.type === 'http-server') return 'oklch(0.68 0.18 290)';
            if (node.type === 'client-group') return 'oklch(0.70 0.15 220)';
            if (node.type === 'database') return 'oklch(0.72 0.19 155)';
            if (node.type === 'cache') return 'oklch(0.72 0.19 155)';
            if (node.type === 'load-balancer') return 'oklch(0.75 0.18 75)';
            if (node.type === 'message-queue') return 'oklch(0.75 0.18 75)';
            if (node.type === 'api-gateway') return 'oklch(0.75 0.18 75)';
            return 'oklch(0.55 0 0)';
          }}
          maskColor="var(--minimap-mask)"
        />

        {/* Custom Controls Panel with working zoom buttons */}
        <ZoomControls isEditable={isEditable} />

        {/* Mode Indicator + Auto-layout */}
        <Panel position="top-left">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'px-2 py-1 font-mono text-[10px] font-semibold border',
                mode === 'edit'
                  ? 'text-signal-flux border-signal-flux/30 bg-signal-flux/10'
                  : 'text-signal-active border-signal-active/30 bg-signal-active/10'
              )}
              style={{ borderRadius: '2px' }}
            >
              {mode === 'edit' ? 'MODE:EDIT' : 'MODE:SIM'}
            </div>
            {isEditable && nodes.length > 1 && (
              <button
                onClick={handleAutoLayout}
                disabled={isLayouting}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-semibold border rounded-sm cursor-pointer transition-colors',
                  'text-muted-foreground border-border hover:bg-muted/50',
                  isLayouting && 'opacity-50 cursor-wait'
                )}
                title="Auto-arranger (ELK)"
              >
                <LayoutGrid className="w-3 h-3" />
                {isLayouting ? '...' : 'LAYOUT'}
              </button>
            )}
          </div>
        </Panel>

        {/* Empty State */}
        {nodes.length === 0 && (
          <Panel position="top-center" className="mt-20">
            <div className="text-center text-muted-foreground font-mono">
              <p className="text-sm">{t('canvas.empty')}</p>
              <p className="text-xs mt-1 text-muted-foreground/60">
                {t('simulation.noComponents')}
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Metrics Panel */}
      <MetricsPanel />

      {/* Latency Calculator */}
      {isEditable && nodes.length > 1 && (
        <div className="absolute top-3 right-3 z-10">
          <LatencyPathPanel
            onHighlightPath={handleHighlightPath}
            onClearHighlight={handleClearHighlight}
          />
        </div>
      )}

      {/* Chaos Mode Context Menu */}
      <NodeContextMenu position={contextMenu} onClose={closeContextMenu} />
    </div>
  );
}
