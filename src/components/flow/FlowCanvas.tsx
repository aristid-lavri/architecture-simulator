'use client';

import { useCallback, useEffect, useRef } from 'react';
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
import AnimatedEdge from '@/components/edges/AnimatedEdge';
import { MetricsPanel } from '@/components/simulation/MetricsPanel';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, Lock, Unlock } from 'lucide-react';
import type { ComponentType } from '@/types';
import { defaultClientGroupData, defaultServerResources, defaultDegradation, defaultDatabaseNodeData, defaultCacheNodeData, defaultLoadBalancerNodeData, defaultMessageQueueNodeData, defaultApiGatewayNodeData } from '@/types';
import type { HttpClientNodeData } from '@/components/nodes/HttpClientNode';
import type { HttpServerNodeData } from '@/components/nodes/HttpServerNode';
import type { ClientGroupNodeData } from '@/components/nodes/ClientGroupNode';
import type { DatabaseNodeData } from '@/components/nodes/DatabaseNode';
import type { CacheNodeData } from '@/components/nodes/CacheNode';
import type { LoadBalancerNodeData } from '@/components/nodes/LoadBalancerNode';
import type { MessageQueueNodeData } from '@/components/nodes/MessageQueueNode';
import type { ApiGatewayNodeData } from '@/components/nodes/ApiGatewayNode';

// Custom node types
const nodeTypes = {
  'http-client': HttpClientNode,
  'http-server': HttpServerNode,
  'client-group': ClientGroupNode,
  'database': DatabaseNode,
  'cache': CacheNode,
  'load-balancer': LoadBalancerNode,
  'message-queue': MessageQueueNode,
  'api-gateway': ApiGatewayNode,
};

// Custom edge types
const edgeTypes = {
  animated: AnimatedEdge,
};

// Default data for new nodes
function getDefaultNodeData(type: ComponentType): HttpClientNodeData | HttpServerNodeData | ClientGroupNodeData | DatabaseNodeData | CacheNodeData | LoadBalancerNodeData | MessageQueueNodeData | ApiGatewayNodeData | { label: string } {
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
    default:
      return { label: type.replace('-', ' ').toUpperCase() };
  }
}

// Zoom controls component - must be inside ReactFlow context
function ZoomControls({ isEditable }: { isEditable: boolean }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel position="bottom-left" className="flex gap-2">
      <div className="flex items-center gap-1 bg-background border rounded-lg p-1 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => zoomOut()}
          title="Zoom arrière"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => zoomIn()}
          title="Zoom avant"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => fitView({ padding: 0.2 })}
          title="Ajuster à l'écran"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1 bg-background border rounded-lg p-1 shadow-sm">
        <Button
          variant={isEditable ? 'ghost' : 'secondary'}
          size="icon"
          className="h-8 w-8"
          disabled
          title={isEditable ? 'Mode édition' : 'Mode simulation'}
        >
          {isEditable ? (
            <Unlock className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </Button>
      </div>
    </Panel>
  );
}

export function FlowCanvas() {
  const { t } = useTranslation();
  const { mode, setSelectedNodeId, setSelectedEdgeId } = useAppStore();
  const {
    state: simulationState,
    nodeStates,
    addParticle,
    removeParticle,
    updateParticle,
    setNodeStatus,
    incrementRequestsSent,
    recordResponse,
    setMetrics,
    setResourceUtilization,
    updateClientGroupStats,
  } = useSimulationStore();

  // Get persisted nodes and edges from architecture store
  const {
    nodes: storedNodes,
    edges: storedEdges,
    setNodes: saveNodes,
    setEdges: saveEdges,
  } = useArchitectureStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const initializedRef = useRef(false);

  // Track if we're syncing from store to avoid loops
  const syncingFromStoreRef = useRef(false);

  // Track previous store state to detect template loads
  const prevStoredNodesRef = useRef<Node[]>([]);
  const prevStoredEdgesRef = useRef<Edge[]>([]);

  // Initialize from store only once after hydration
  useEffect(() => {
    if (!initializedRef.current && (storedNodes.length > 0 || storedEdges.length > 0)) {
      setNodes(storedNodes);
      setEdges(storedEdges);
      prevStoredNodesRef.current = storedNodes;
      prevStoredEdgesRef.current = storedEdges;
      initializedRef.current = true;
    } else if (!initializedRef.current) {
      // Mark as initialized even if empty
      initializedRef.current = true;
    }
  }, [storedNodes, storedEdges, setNodes, setEdges]);

  // Detect when a template is loaded (complete replacement of nodes/edges)
  useEffect(() => {
    if (!initializedRef.current) return;

    // Check if the stored nodes have completely changed (template load)
    const storedNodeIds = new Set(storedNodes.map(n => n.id));
    const prevNodeIds = new Set(prevStoredNodesRef.current.map(n => n.id));

    // If the node IDs are completely different, it's a template load
    const isTemplateLoad = storedNodes.length > 0 && (
      prevStoredNodesRef.current.length === 0 ||
      ![...storedNodeIds].some(id => prevNodeIds.has(id))
    );

    if (isTemplateLoad) {
      syncingFromStoreRef.current = true;
      setNodes(storedNodes);
      setEdges(storedEdges);
    }

    prevStoredNodesRef.current = storedNodes;
    prevStoredEdgesRef.current = storedEdges;
  }, [storedNodes, storedEdges, setNodes, setEdges]);

  // Sync node data changes from store to local state (for PropertiesPanel updates)
  useEffect(() => {
    if (!initializedRef.current) return;

    // Check if any node data has changed in the store
    setNodes((currentNodes) => {
      let hasChanges = false;
      const updatedNodes = currentNodes.map((node) => {
        const storedNode = storedNodes.find((n) => n.id === node.id);
        if (storedNode) {
          // Compare data (excluding status which is managed by simulation)
          const currentData = { ...node.data };
          const storedData = { ...storedNode.data };
          delete currentData.status;
          delete storedData.status;

          if (JSON.stringify(currentData) !== JSON.stringify(storedData)) {
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
        syncingFromStoreRef.current = true;
        return updatedNodes;
      }
      return currentNodes;
    });
  }, [storedNodes, setNodes]);

  // Sync edge data changes from store to local state (for PropertiesPanel updates)
  useEffect(() => {
    if (!initializedRef.current) return;

    // Check if any edge data has changed in the store
    setEdges((currentEdges) => {
      let hasChanges = false;
      const updatedEdges = currentEdges.map((edge) => {
        const storedEdge = storedEdges.find((e) => e.id === edge.id);
        if (storedEdge) {
          // Compare data
          if (JSON.stringify(edge.data) !== JSON.stringify(storedEdge.data)) {
            hasChanges = true;
            return {
              ...edge,
              data: storedEdge.data,
            };
          }
        }
        return edge;
      });

      if (hasChanges) {
        syncingFromStoreRef.current = true;
        return updatedEdges;
      }
      return currentEdges;
    });
  }, [storedEdges, setEdges]);

  // Sync nodes and edges to localStorage whenever they change (only after initialization)
  useEffect(() => {
    if (initializedRef.current && !syncingFromStoreRef.current) {
      saveNodes(nodes);
    }
    syncingFromStoreRef.current = false;
  }, [nodes, saveNodes]);

  useEffect(() => {
    if (initializedRef.current) {
      saveEdges(edges);
    }
  }, [edges, saveEdges]);

  // Sync node statuses from simulation store to node data
  useEffect(() => {
    if (nodeStates.size === 0) return;

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const nodeState = nodeStates.get(node.id);
        if (nodeState && node.data.status !== nodeState.status) {
          return {
            ...node,
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
    updateClientGroupStats,
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
      updateClientGroupStats,
    };
  }, [addParticle, removeParticle, updateParticle, setNodeStatus, incrementRequestsSent, recordResponse, setMetrics, setResourceUtilization, updateClientGroupStats]);

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
      });
    }
  }, []);

  // Update engine with current nodes and edges
  useEffect(() => {
    if (engineRef.current) {
      console.log('Setting nodes and edges to engine:', { nodes, edges });
      engineRef.current.setNodesAndEdges(nodes, edges);
    }
  }, [nodes, edges]);

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
      console.log('onConnect called:', params);
      if (!params.source || !params.target) {
        console.log('Missing source or target');
        return;
      }

      // Use animated edge type for particle animations
      const newEdge: Edge = {
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle ?? undefined,
        targetHandle: params.targetHandle ?? undefined,
        type: 'animated',
      };
      console.log('Creating edge:', newEdge);
      setEdges((eds) => {
        console.log('Current edges:', eds);
        return [...eds, newEdge];
      });
    },
    [setEdges]
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

      // Determine node type for React Flow
      const nodeType = type === 'http-client' || type === 'http-server' || type === 'client-group' || type === 'database' || type === 'cache' || type === 'load-balancer' || type === 'message-queue' || type === 'api-gateway' ? type : 'default';

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: nodeType,
        position,
        data: getDefaultNodeData(type),
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

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
  }, [setSelectedNodeId, setSelectedEdgeId]);

  const isEditable = mode === 'edit';

  return (
    <div className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={isEditable}
        nodesConnectable={isEditable}
        elementsSelectable={true}
        fitView={false}
        defaultViewport={{ x: 100, y: 50, zoom: 0.75 }}
        className="bg-background"
        defaultEdgeOptions={{
          type: 'animated',
          reconnectable: true,
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="bg-muted/30"
        />

        <Controls
          showZoom={false}
          showFitView={false}
          showInteractive={false}
          className="bg-background border rounded-lg shadow-sm"
        />

        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'http-client') return '#3b82f6';
            if (node.type === 'http-server') return '#8b5cf6';
            if (node.type === 'client-group') return '#2563eb';
            if (node.type === 'database') return '#9333ea';
            if (node.type === 'cache') return '#f97316';
            if (node.type === 'load-balancer') return '#22c55e';
            if (node.type === 'message-queue') return '#eab308';
            if (node.type === 'api-gateway') return '#3b82f6';
            return '#6366f1';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          className="bg-background border rounded-lg shadow-sm"
        />

        {/* Custom Controls Panel with working zoom buttons */}
        <ZoomControls isEditable={isEditable} />

        {/* Mode Indicator */}
        <Panel position="top-left">
          <div
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              mode === 'edit'
                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                : 'bg-green-500/10 text-green-500 border border-green-500/20'
            }`}
          >
            {mode === 'edit' ? t('canvas.editMode') : t('canvas.simulationMode')}
          </div>
        </Panel>

        {/* Empty State */}
        {nodes.length === 0 && (
          <Panel position="top-center" className="mt-20">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">{t('canvas.empty')}</p>
              <p className="text-sm mt-1">
                {t('simulation.noComponents')}
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Metrics Panel */}
      <MetricsPanel />
    </div>
  );
}
