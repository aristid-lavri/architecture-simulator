'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { useAppStore } from '@/store/app-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { useSimulationStore } from '@/store/simulation-store';
import { SimulationEngine } from '@/engine/SimulationEngine';
import { AnalyticsEngine } from '@/analytics/AnalyticsEngine';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ComponentType } from '@/types';
import { useAnalyticsStore } from '@/store/analytics-store';
import { NodeRenderer } from './NodeRenderer';
import { EdgeRenderer } from './EdgeRenderer';
import { GridRenderer } from './GridRenderer';
import { ParticleRenderer } from './ParticleRenderer';
import { HandleRenderer } from './HandleRenderer';
import {
  Z_GRID, Z_ZONES, Z_EDGES, Z_NODES, Z_EDGE_HIT, Z_HANDLES, Z_PARTICLES,
  CONTAINER_COMPONENT_TYPES, ZONE_DEFAULT_WIDTH, ZONE_DEFAULT_HEIGHT,
  HOST_DEFAULT_WIDTH, HOST_DEFAULT_HEIGHT, CONTAINER_DEFAULT_WIDTH, CONTAINER_DEFAULT_HEIGHT,
} from './constants';
import { getDefaultNodeData } from './node-defaults';
import { findContainerAtPosition } from './hit-testing';
import { applyAutoLayout } from '@/lib/auto-layout';
import { MetricsPanel } from '@/components/simulation/MetricsPanel';
import { MiniMap } from './MiniMap';
import { NodeContextMenu } from '@/components/flow/NodeContextMenu';
import { Route } from 'lucide-react';

export function PixiCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const analyticsEngineRef = useRef<AnalyticsEngine | null>(null);
  const nodeRendererRef = useRef<NodeRenderer | null>(null);
  const edgeRendererRef = useRef<EdgeRenderer | null>(null);
  const gridRendererRef = useRef<GridRenderer | null>(null);
  const particleRendererRef = useRef<ParticleRenderer | null>(null);
  const handleRendererRef = useRef<HandleRenderer | null>(null);
  const initializedRef = useRef(false);
  const unsubHydrationRef = useRef<(() => void) | null>(null);
  const [viewportReady, setViewportReady] = useState(false);

  // Layers
  const gridLayerRef = useRef<Container | null>(null);
  const zoneLayerRef = useRef<Container | null>(null);
  const edgeLayerRef = useRef<Container | null>(null);
  const nodeLayerRef = useRef<Container | null>(null);
  const handleLayerRef = useRef<Container | null>(null);
  const particleLayerRef = useRef<Container | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    nodeId: string;
    startPos: { x: number; y: number };
    offset: { x: number; y: number };
  } | null>(null);

  // Track whether a node/edge was just clicked (to suppress viewport deselect)
  const nodeClickedRef = useRef(false);

  // Hover state for handles
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // App store
  const mode = useAppStore((s) => s.mode);
  const edgeRoutingMode = useAppStore((s) => s.edgeRoutingMode);
  const isComponentsPanelOpen = useAppStore((s) => s.isComponentsPanelOpen);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const setSelectedEdgeId = useAppStore((s) => s.setSelectedEdgeId);

  // Architecture store
  const {
    nodes: storedNodes,
    edges: storedEdges,
    setNodesAndEdges: saveNodesAndEdges,
    undo,
    redo,
    _syncVersion,
  } = useArchitectureStore();

  // Simulation store selectors
  const simulationState = useSimulationStore((s) => s.state);
  const nodeStates = useSimulationStore((s) => s.nodeStates);
  const addParticle = useSimulationStore((s) => s.addParticle);
  const removeParticle = useSimulationStore((s) => s.removeParticle);
  const batchUpdateParticleProgress = useSimulationStore((s) => s.batchUpdateParticleProgress);
  const setNodeStatus = useSimulationStore((s) => s.setNodeStatus);
  const incrementRequestsSent = useSimulationStore((s) => s.incrementRequestsSent);
  const recordResponse = useSimulationStore((s) => s.recordResponse);
  const setMetrics = useSimulationStore((s) => s.setMetrics);
  const setExtendedMetrics = useSimulationStore((s) => s.setExtendedMetrics);
  const setResourceUtilization = useSimulationStore((s) => s.setResourceUtilization);
  const addResourceSample = useSimulationStore((s) => s.addResourceSample);
  const updateClientGroupStats = useSimulationStore((s) => s.updateClientGroupStats);
  const addTimeSeriesSnapshot = useSimulationStore((s) => s.addTimeSeriesSnapshot);
  const stopSimulation = useSimulationStore((s) => s.stop);
  const setBottleneckAnalysis = useSimulationStore((s) => s.setBottleneckAnalysis);
  const registerEngineMetricsProvider = useSimulationStore((s) => s.registerEngineMetricsProvider);
  const registerEngineReportDataProvider = useSimulationStore((s) => s.registerEngineReportDataProvider);
  const faultInjections = useSimulationStore((s) => s.faultInjections);
  const isolatedNodes = useSimulationStore((s) => s.isolatedNodes);

  // Analytics
  const updateComponentAnalytics = useAnalyticsStore((s) => s.updateComponentAnalytics);
  const setSynthesis = useAnalyticsStore((s) => s.setSynthesis);
  const resetAnalytics = useAnalyticsStore((s) => s.reset);
  const analyticsComponents = useAnalyticsStore((s) => s.components);

  const isEditable = mode === 'edit';

  // Keep callbacks ref to avoid stale closures
  const callbacksRef = useRef({
    addParticle, removeParticle, batchUpdateParticleProgress,
    setNodeStatus, incrementRequestsSent, recordResponse,
    setMetrics, setExtendedMetrics, setResourceUtilization,
    addResourceSample, updateClientGroupStats, addTimeSeriesSnapshot,
    stopSimulation, setBottleneckAnalysis, updateComponentAnalytics,
    setSynthesis, resetAnalytics,
  });

  useEffect(() => {
    callbacksRef.current = {
      addParticle, removeParticle, batchUpdateParticleProgress,
      setNodeStatus, incrementRequestsSent, recordResponse,
      setMetrics, setExtendedMetrics, setResourceUtilization,
      addResourceSample, updateClientGroupStats, addTimeSeriesSnapshot,
      stopSimulation, setBottleneckAnalysis, updateComponentAnalytics,
      setSynthesis, resetAnalytics,
    };
  }, [addParticle, removeParticle, batchUpdateParticleProgress, setNodeStatus, incrementRequestsSent, recordResponse, setMetrics, setExtendedMetrics, setResourceUtilization, addResourceSample, updateClientGroupStats, addTimeSeriesSnapshot, stopSimulation, setBottleneckAnalysis, updateComponentAnalytics, setSynthesis, resetAnalytics]);

  // ============================================
  // Initialize PixiJS Application
  // ============================================
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    const container = canvasRef.current;
    const app = new Application();

    (async () => {
      await app.init({
        resizeTo: container,
        background: 0x0f0f13,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      container.appendChild(app.canvas as HTMLCanvasElement);

      // Create viewport for pan/zoom
      const viewport = new Viewport({
        screenWidth: container.clientWidth,
        screenHeight: container.clientHeight,
        worldWidth: 5000,
        worldHeight: 5000,
        events: app.renderer.events,
      });

      viewport
        .drag({ mouseButtons: 'middle-left' })
        .pinch()
        .wheel()
        .decelerate();

      // Disable drag when clicking on a node (handled by node interaction)
      viewport.drag({ pressDrag: true, clampWheel: false });

      app.stage.addChild(viewport);

      // Create layers
      const gridLayer = new Container();
      const zoneLayer = new Container();
      const edgeLayer = new Container();
      const nodeLayer = new Container();
      const edgeHitLayer = new Container();
      const handleLayer = new Container();
      const particleLayer = new Container();

      gridLayer.zIndex = Z_GRID;
      zoneLayer.zIndex = Z_ZONES;
      edgeLayer.zIndex = Z_EDGES;
      nodeLayer.zIndex = Z_NODES;
      edgeHitLayer.zIndex = Z_EDGE_HIT;
      particleLayer.zIndex = Z_PARTICLES;
      handleLayer.zIndex = Z_HANDLES;

      viewport.sortableChildren = true;
      viewport.addChild(gridLayer, zoneLayer, edgeLayer, nodeLayer, edgeHitLayer, particleLayer, handleLayer);

      // Create renderers
      const gridRenderer = new GridRenderer(gridLayer);
      const nodeRenderer = new NodeRenderer(nodeLayer, zoneLayer, handleLayer);
      const edgeRenderer = new EdgeRenderer(edgeLayer, edgeHitLayer);
      const particleRenderer = new ParticleRenderer(particleLayer, app);
      const handleRenderer = new HandleRenderer(handleLayer);

      // Store refs
      appRef.current = app;
      viewportRef.current = viewport;
      gridLayerRef.current = gridLayer;
      zoneLayerRef.current = zoneLayer;
      edgeLayerRef.current = edgeLayer;
      nodeLayerRef.current = nodeLayer;
      handleLayerRef.current = handleLayer;
      gridRendererRef.current = gridRenderer;
      nodeRendererRef.current = nodeRenderer;
      edgeRendererRef.current = edgeRenderer;
      particleRendererRef.current = particleRenderer;
      handleRendererRef.current = handleRenderer;
      particleLayerRef.current = particleLayer;

      // Initial grid render
      gridRenderer.render(viewport);

      // Update grid on viewport move
      viewport.on('moved', () => {
        gridRenderer.render(viewport);
      });

      initializedRef.current = true;
      setViewportReady(true);

      // Render initial nodes/edges from store (read current state to avoid stale closure after async hydration)
      const currentArch = useArchitectureStore.getState();
      const currentApp = useAppStore.getState();
      if (currentArch.nodes.length > 0 || currentArch.edges.length > 0) {
        nodeRenderer.renderNodes(currentArch.nodes, currentApp.selectedNodeId);
        edgeRenderer.renderEdges(currentArch.edges, currentArch.nodes, currentApp.selectedEdgeId, currentApp.edgeRoutingMode);
      }

      // Also subscribe to hydration in case it finishes after PixiJS init
      // (the sync useEffect may have fired while initializedRef was still false)
      const unsub = useArchitectureStore.persist.onFinishHydration(() => {
        const arch = useArchitectureStore.getState();
        const appState = useAppStore.getState();
        if (arch.nodes.length > 0 || arch.edges.length > 0) {
          nodeRenderer.renderNodes(arch.nodes, appState.selectedNodeId);
          edgeRenderer.renderEdges(arch.edges, arch.nodes, appState.selectedEdgeId, appState.edgeRoutingMode);
        }
      });
      unsubHydrationRef.current = unsub;
    })();

    return () => {
      unsubHydrationRef.current?.();
      nodeRendererRef.current?.destroy();
      edgeRendererRef.current?.destroy();
      gridRendererRef.current?.destroy();
      particleRendererRef.current?.destroy();
      handleRendererRef.current?.destroy();
      app.destroy(true, { children: true });
      appRef.current = null;
      viewportRef.current = null;
      initializedRef.current = false;
      setViewportReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // Sync nodes/edges from store
  // ============================================
  const prevSyncVersionRef = useRef(_syncVersion);

  useEffect(() => {
    if (!initializedRef.current || !nodeRendererRef.current || !edgeRendererRef.current) return;

    nodeRendererRef.current.renderNodes(storedNodes, selectedNodeId);
    edgeRendererRef.current.renderEdges(storedEdges, storedNodes, selectedEdgeId, edgeRoutingMode);

    // Rebuild particle path cache when edges/nodes change
    particleRendererRef.current?.rebuildPaths(storedEdges, storedNodes, edgeRoutingMode);

    prevSyncVersionRef.current = _syncVersion;
  }, [storedNodes, storedEdges, _syncVersion, selectedNodeId, selectedEdgeId, edgeRoutingMode, viewportReady]);

  // ============================================
  // Node status updates (simulation mode)
  // ============================================
  useEffect(() => {
    if (!nodeRendererRef.current || nodeStates.size === 0) return;
    nodeRendererRef.current.updateStatuses(nodeStates);
  }, [nodeStates]);

  // ============================================
  // Connection handles (edit mode)
  // ============================================
  useEffect(() => {
    if (!handleRendererRef.current || !isEditable) {
      handleRendererRef.current?.hideAll();
      return;
    }
    handleRendererRef.current.renderHandles(storedNodes, selectedNodeId, hoveredNodeId);
  }, [isEditable, storedNodes, selectedNodeId, hoveredNodeId, viewportReady]);

  // Wire up edge click callback (selection) and edit mode sync
  useEffect(() => {
    if (!edgeRendererRef.current) return;
    edgeRendererRef.current.onEdgeClick = (edgeId: string) => {
      nodeClickedRef.current = true;
      useAppStore.getState().setSelectedEdgeId(edgeId);
    };
    edgeRendererRef.current.setEditMode(isEditable);
    edgeRendererRef.current.onEdgeHover = (edgeId: string | null) => {
      useAppStore.getState().setHoveredEdgeId(edgeId);
    };

    // Reconnection drag: pause viewport and listen for global move/up
    edgeRendererRef.current.onReconnectStart = () => {
      const viewport = viewportRef.current;
      if (viewport) viewport.plugins.pause('drag');
      setIsDragging(true);

      const onMove = (e: PointerEvent) => {
        if (!edgeRendererRef.current?.isReconnecting || !viewportRef.current || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const worldPos = viewportRef.current.toWorld(e.clientX - rect.left, e.clientY - rect.top);
        edgeRendererRef.current.updateReconnectDrag(worldPos.x, worldPos.y);
      };

      const onUp = (e: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);

        if (edgeRendererRef.current?.isReconnecting && viewportRef.current && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const worldPos = viewportRef.current.toWorld(e.clientX - rect.left, e.clientY - rect.top);
          const result = edgeRendererRef.current.endReconnectDrag(worldPos.x, worldPos.y, storedNodes);
          if (result) {
            const updatedEdges = storedEdges.map((ed) =>
              ed.id === result.edgeId ? {
                ...ed,
                source: result.source,
                target: result.target,
                sourceHandle: result.sourceHandle,
                targetHandle: result.targetHandle,
              } : ed
            );
            saveNodesAndEdges(storedNodes, updatedEdges);
          }
        }

        if (viewport) viewport.plugins.resume('drag');
        setIsDragging(false);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
  }, [isEditable, storedNodes, storedEdges, saveNodesAndEdges, viewportReady]);

  // Wire up edge creation callback
  useEffect(() => {
    if (!handleRendererRef.current) return;
    handleRendererRef.current.onEdgeCreated = (sourceId, targetId, sourceHandle, targetHandle) => {
      const newEdge: GraphEdge = {
        id: `edge-${sourceId}-${targetId}-${Date.now()}`,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
      };
      saveNodesAndEdges(storedNodes, [...storedEdges, newEdge]);
    };
  }, [storedNodes, storedEdges, saveNodesAndEdges, viewportReady]);

  // ============================================
  // Node interactions: click, drag, resize, context menu
  // ============================================
  useEffect(() => {
    if (!nodeRendererRef.current || !viewportRef.current) return;

    const viewport = viewportRef.current;
    const nodeRenderer = nodeRendererRef.current;

    nodeRenderer.onNodePointerDown = (nodeId: string, event: PointerEvent) => {
      nodeClickedRef.current = true;

      if (!isEditable) {
        useAppStore.getState().setSelectedNodeId(nodeId);
        return;
      }

      useAppStore.getState().setSelectedNodeId(nodeId);

      // Start drag — read fresh from store to avoid stale closure
      const currentNodes = useArchitectureStore.getState().nodes;
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) return;

      // Use absolute visual position for offset (node.position may be relative to parent)
      const absPos = nodeRendererRef.current?.getNodePosition(nodeId) ?? node.position;
      const worldPos = viewport.toWorld(event.clientX, event.clientY);
      dragStateRef.current = {
        nodeId,
        startPos: { ...node.position },
        offset: { x: worldPos.x - absPos.x, y: worldPos.y - absPos.y },
      };
      setIsDragging(true);

      // Pause viewport dragging while dragging a node
      viewport.plugins.pause('drag');
    };

    nodeRenderer.onNodeRightClick = (nodeId: string, event: PointerEvent) => {
      if (mode !== 'simulation') return;
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId });
    };

    nodeRenderer.onNodeHover = (nodeId: string | null) => {
      setHoveredNodeId(nodeId);
    };

    // Cog icon click → open properties panel
    nodeRenderer.onCogClick = (nodeId: string) => {
      useAppStore.getState().setSelectedNodeId(nodeId);
      useAppStore.getState().setPropertiesPanelOpen(true);
    };

  }, [isEditable, viewportReady]);

  // Push analytics data to node footer metrics
  useEffect(() => {
    if (!nodeRendererRef.current) return;
    for (const [nodeId, analytics] of analyticsComponents) {
      nodeRendererRef.current.updateFooterMetrics(nodeId, {
        requestsIn: analytics.totalRequests,
        requestsOut: analytics.totalRequests,
        successCount: analytics.totalRequests - analytics.totalErrors,
        errorCount: analytics.totalErrors,
        cpu: analytics.cpu,
        memory: analytics.memory,
        queueDepth: analytics.queueDepth,
      });
    }
  }, [analyticsComponents]);

  useEffect(() => {
    if (!nodeRendererRef.current || !viewportRef.current) return;
    const nodeRenderer = nodeRendererRef.current;
    const viewport = viewportRef.current;

    // ── Resize callbacks ──
    nodeRenderer.onResizeStart = (nodeId: string, corner: string, event: PointerEvent) => {
      nodeClickedRef.current = true;
      if (!isEditable) return;

      const node = storedNodes.find((n) => n.id === nodeId);
      if (!node) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldPos = viewport.toWorld(event.clientX - rect.left, event.clientY - rect.top);

      const w = node.width ?? 400;
      const h = node.height ?? 300;
      nodeRenderer.startResize(nodeId, corner, worldPos.x, worldPos.y, w, h, node.position.x, node.position.y);

      viewport.plugins.pause('drag');
      setIsDragging(true);
    };

    nodeRenderer.onResizeMove = (event: PointerEvent) => {
      if (!nodeRenderer.isResizing) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldPos = viewport.toWorld(event.clientX - rect.left, event.clientY - rect.top);

      const result = nodeRenderer.computeResize(worldPos.x, worldPos.y);
      if (!result) return;

      const resizeNodeId = nodeRenderer.getResizeNodeId();
      if (!resizeNodeId) return;

      // Live visual update
      nodeRenderer.resizeNodeVisual(resizeNodeId, result.x, result.y, result.w, result.h);

      // Re-render edges with updated size
      edgeRendererRef.current?.renderEdges(storedEdges, storedNodes.map((n) =>
        n.id === resizeNodeId ? { ...n, position: { x: result.x, y: result.y }, width: result.w, height: result.h } : n
      ), selectedEdgeId, edgeRoutingMode);
    };

    nodeRenderer.onResizeEnd = (_event: PointerEvent) => {
      const resizeNodeId = nodeRenderer.getResizeNodeId();
      if (!resizeNodeId || !isEditable) {
        viewport.plugins.resume('drag');
        setIsDragging(false);
        return;
      }

      // Get final visual position from renderer (absolute)
      const finalPos = nodeRenderer.getNodePosition(resizeNodeId);
      const node = storedNodes.find((n) => n.id === resizeNodeId);
      if (finalPos && node) {
        const visual = nodeRenderer['visuals']?.get(resizeNodeId);
        if (visual) {
          const bgBounds = visual.bg.getLocalBounds();
          // Convert absolute position back to parent-relative if needed
          let storePos = finalPos;
          if (node.parentId) {
            const parentAbsPos = nodeRenderer.getNodePosition(node.parentId);
            if (parentAbsPos) {
              storePos = { x: finalPos.x - parentAbsPos.x, y: finalPos.y - parentAbsPos.y };
            }
          }
          const updatedNodes = storedNodes.map((n) =>
            n.id === resizeNodeId ? {
              ...n,
              position: storePos,
              width: Math.round(bgBounds.width),
              height: Math.round(bgBounds.height),
            } : n
          );
          saveNodesAndEdges(updatedNodes, storedEdges);
        }
      }

      viewport.plugins.resume('drag');
      setIsDragging(false);
    };

    // Handle edge creation drag: update preview line on pointermove, finish on pointerup
    nodeRenderer.onNodePointerMove = (event: PointerEvent) => {
      if (handleRendererRef.current?.isDragging && viewportRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const worldPos = viewportRef.current.toWorld(event.clientX - rect.left, event.clientY - rect.top);
          handleRendererRef.current.updateDrag(worldPos.x, worldPos.y);
          return; // Don't process node drag while creating an edge
        }
      }

      // Edge reconnection drag
      if (edgeRendererRef.current?.isReconnecting && viewportRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const worldPos = viewportRef.current.toWorld(event.clientX - rect.left, event.clientY - rect.top);
          edgeRendererRef.current.updateReconnectDrag(worldPos.x, worldPos.y);
          return;
        }
      }

      // Node drag logic
      if (!dragStateRef.current || !isEditable) return;
      const worldPos = viewport.toWorld(event.clientX, event.clientY);
      const newX = worldPos.x - dragStateRef.current.offset.x;
      const newY = worldPos.y - dragStateRef.current.offset.y;
      nodeRenderer.moveNode(dragStateRef.current.nodeId, newX, newY);
      edgeRendererRef.current?.renderEdges(storedEdges, storedNodes.map((n) =>
        n.id === dragStateRef.current!.nodeId ? { ...n, position: { x: newX, y: newY } } : n
      ), selectedEdgeId, edgeRoutingMode);
    };

    nodeRenderer.onNodePointerUp = (event: PointerEvent) => {
      // Finish edge creation drag
      if (handleRendererRef.current?.isDragging && viewportRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const worldPos = viewportRef.current.toWorld(event.clientX - rect.left, event.clientY - rect.top);
        handleRendererRef.current.endDrag(worldPos.x, worldPos.y, storedNodes);
      }

      // Finish edge reconnection drag
      if (edgeRendererRef.current?.isReconnecting && viewportRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const worldPos = viewportRef.current.toWorld(event.clientX - rect.left, event.clientY - rect.top);
        const result = edgeRendererRef.current.endReconnectDrag(worldPos.x, worldPos.y, storedNodes);
        if (result) {
          const updatedEdges = storedEdges.map((e) =>
            e.id === result.edgeId ? {
              ...e,
              source: result.source,
              target: result.target,
              sourceHandle: result.sourceHandle,
              targetHandle: result.targetHandle,
            } : e
          );
          saveNodesAndEdges(storedNodes, updatedEdges);
        }
      }

      // Finish node drag with reparenting
      if (dragStateRef.current && isEditable) {
        try {
          const { nodeId } = dragStateRef.current;
          const movedPos = nodeRendererRef.current?.getNodePosition(nodeId);
          if (movedPos) {
            const draggedNode = storedNodes.find((n) => n.id === nodeId);
            if (draggedNode) {
              const newParent = findContainerAtPosition(
                storedNodes.filter((n) => n.id !== nodeId),
                movedPos,
                draggedNode.type,
              );

              const newParentId = newParent?.id ?? undefined;
              const oldParentId = draggedNode.parentId;

              let finalPosition = movedPos;
              if (newParentId) {
                // Convert absolute visual position to parent-relative coordinates
                const parentAbsPos = nodeRendererRef.current?.getNodePosition(newParentId) ?? newParent!.position;
                finalPosition = {
                  x: movedPos.x - parentAbsPos.x,
                  y: movedPos.y - parentAbsPos.y,
                };
              }

              const updatedNodes = storedNodes.map((n) =>
                n.id === nodeId ? { ...n, position: finalPosition, parentId: newParentId } : n
              );
              saveNodesAndEdges(updatedNodes, storedEdges);
            }
          }
        } finally {
          dragStateRef.current = null;
          setIsDragging(false);
          viewport.plugins.resume('drag');
        }
      }
    };
  }, [isEditable, mode, storedNodes, storedEdges, selectedNodeId, selectedEdgeId, edgeRoutingMode, setSelectedNodeId, setSelectedEdgeId, saveNodesAndEdges, viewportReady]);

  // ============================================
  // Canvas click (deselect)
  // ============================================
  useEffect(() => {
    if (!viewportRef.current) return;
    const viewport = viewportRef.current;

    const handleClick = () => {
      if (nodeClickedRef.current) {
        nodeClickedRef.current = false;
        return;
      }
      if (!isDragging) {
        useAppStore.getState().setSelectedNodeId(null);
        useAppStore.getState().setSelectedEdgeId(null);
        setContextMenu(null);
      }
    };

    viewport.on('clicked', handleClick);
    return () => { viewport.off('clicked', handleClick); };
  }, [isDragging, setSelectedNodeId, setSelectedEdgeId]);

  // ============================================
  // Drag-and-drop from ComponentsPanel
  // ============================================
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isEditable || !viewportRef.current || !canvasRef.current) return;

    const type = e.dataTransfer.getData('application/reactflow') as ComponentType;
    if (!type) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const viewport = viewportRef.current;
    const worldPos = viewport.toWorld(e.clientX - rect.left, e.clientY - rect.top);

    const position = { x: worldPos.x, y: worldPos.y };

    // Find parent container at drop position
    const parent = findContainerAtPosition(storedNodes, position, type);

    // Convert to parent-relative coordinates if nested
    let finalPosition = position;
    if (parent) {
      // Use absolute position of parent (walk parentId chain)
      const parentAbsPos = nodeRendererRef.current?.getNodePosition(parent.id) ?? parent.position;
      finalPosition = {
        x: position.x - parentAbsPos.x,
        y: position.y - parentAbsPos.y,
      };
    }

    // Determine dimensions for container types
    let width: number | undefined;
    let height: number | undefined;
    if (type === 'network-zone') { width = ZONE_DEFAULT_WIDTH; height = ZONE_DEFAULT_HEIGHT; }
    else if (type === 'host-server') { width = HOST_DEFAULT_WIDTH; height = HOST_DEFAULT_HEIGHT; }
    else if (type === 'container') { width = CONTAINER_DEFAULT_WIDTH; height = CONTAINER_DEFAULT_HEIGHT; }

    const newNode: GraphNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: finalPosition,
      data: getDefaultNodeData(type),
      ...(parent ? { parentId: parent.id } : {}),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
    };

    saveNodesAndEdges([...storedNodes, newNode], storedEdges);
  }, [isEditable, storedNodes, storedEdges, saveNodesAndEdges]);

  // ============================================
  // Keyboard shortcuts
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'edit') return;
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
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          const updatedNodes = storedNodes.filter((n) => n.id !== selectedNodeId && n.parentId !== selectedNodeId);
          const removedIds = new Set([selectedNodeId, ...storedNodes.filter((n) => n.parentId === selectedNodeId).map((n) => n.id)]);
          const updatedEdges = storedEdges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target));
          saveNodesAndEdges(updatedNodes, updatedEdges);
          useAppStore.getState().setSelectedNodeId(null);
        } else if (selectedEdgeId) {
          const updatedEdges = storedEdges.filter((e) => e.id !== selectedEdgeId);
          saveNodesAndEdges(storedNodes, updatedEdges);
          useAppStore.getState().setSelectedEdgeId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, undo, redo, selectedNodeId, selectedEdgeId, storedNodes, storedEdges, saveNodesAndEdges]);

  // ============================================
  // Simulation engine
  // ============================================
  useEffect(() => {
    if (engineRef.current) return;

    analyticsEngineRef.current = new AnalyticsEngine((event) => {
      callbacksRef.current.updateComponentAnalytics(event);
    });

    engineRef.current = new SimulationEngine({
      onStateChange: () => {},
      onAddParticle: (particle) => callbacksRef.current.addParticle(particle),
      onRemoveParticle: (id) => callbacksRef.current.removeParticle(id),
      onBatchUpdateProgress: (updates) => callbacksRef.current.batchUpdateParticleProgress(updates),
      onNodeStatusChange: (nodeId, status) => callbacksRef.current.setNodeStatus(nodeId, status),
      onMetricsUpdate: (metrics) => callbacksRef.current.setMetrics(metrics),
      onExtendedMetricsUpdate: (ext) => callbacksRef.current.setExtendedMetrics(ext),
      onResourceUpdate: (nodeId, utilization) => {
        callbacksRef.current.setResourceUtilization(nodeId, utilization);
        callbacksRef.current.addResourceSample({ nodeId, ...utilization, timestamp: Date.now() });
        // Update Pixi node resource gauges in real-time
        nodeRendererRef.current?.updateResourceUtilization(nodeId, utilization);
      },
      onTimeSeriesSnapshot: (snap) => callbacksRef.current.addTimeSeriesSnapshot(snap),
      onBottleneckUpdate: (analysis) => callbacksRef.current.setBottleneckAnalysis(analysis),
    });

    registerEngineMetricsProvider(() => engineRef.current!.getFinalMetrics().metrics);
    registerEngineReportDataProvider(() => engineRef.current!.getReportData());

    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
      registerEngineMetricsProvider(null);
      registerEngineReportDataProvider(null);
    };
  }, [registerEngineMetricsProvider, registerEngineReportDataProvider]);

  // Update engine with current nodes/edges
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setNodesAndEdges(storedNodes, storedEdges);
    }
  }, [storedNodes, storedEdges]);

  // Simulation mode switching
  useEffect(() => {
    if (!engineRef.current) return;

    if (mode === 'edit') {
      engineRef.current.stop();
      particleRendererRef.current?.stopRenderLoop();
      particleRendererRef.current?.hideAll();
      return;
    }

    // Simulation mode
    if (simulationState === 'running') {
      engineRef.current.setNodesAndEdges(storedNodes, storedEdges);
      analyticsEngineRef.current?.initialize(storedNodes);

      // Rebuild paths and start particle render loop
      particleRendererRef.current?.rebuildPaths(storedEdges, storedNodes, edgeRoutingMode);
      particleRendererRef.current?.startRenderLoop(
        () => useSimulationStore.getState().particles
      );

      engineRef.current.start();
    } else if (simulationState === 'paused') {
      engineRef.current.pause();
      particleRendererRef.current?.stopRenderLoop();
    } else if (simulationState === 'idle') {
      engineRef.current.stop();
      particleRendererRef.current?.stopRenderLoop();
      particleRendererRef.current?.hideAll();
      resetAnalytics();
    }
  }, [mode, simulationState, storedNodes, storedEdges, resetAnalytics]);

  // Fault provider sync
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setFaultProvider(() => ({
        faults: useSimulationStore.getState().faultInjections,
        isolated: useSimulationStore.getState().isolatedNodes,
      }));
    }
  }, [faultInjections, isolatedNodes]);

  // ============================================
  // Auto-layout (ELK)
  // ============================================
  const [isLayouting, setIsLayouting] = useState(false);

  const handleAutoLayout = useCallback(async () => {
    if (storedNodes.length === 0 || isLayouting) return;
    setIsLayouting(true);
    try {
      const layoutedNodes = await applyAutoLayout(storedNodes, storedEdges);
      saveNodesAndEdges(layoutedNodes, storedEdges);
    } finally {
      setIsLayouting(false);
    }
  }, [storedNodes, storedEdges, isLayouting, saveNodesAndEdges]);

  // ============================================
  // Resize handling
  // ============================================
  useEffect(() => {
    if (!canvasRef.current || !appRef.current || !viewportRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      appRef.current?.renderer.resize(width, height);
      viewportRef.current?.resize(width, height);
      gridRendererRef.current?.render(viewportRef.current!);
    });

    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [viewportReady]);

  // ============================================
  // Render
  // ============================================
  return (
    <div className="flex-1 h-full min-w-0 relative flex flex-col" data-tour="flow-canvas">
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ cursor: isDragging ? 'grabbing' : 'default' }}
      />

      {/* Reopen components panel button */}
      {!isComponentsPanelOpen && isEditable && (
        <button
          onClick={() => useAppStore.getState().setComponentsPanelOpen(true)}
          className="absolute top-3 left-3 z-20 w-7 h-7 bg-card/90 backdrop-blur border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-xs"
          aria-label="Ouvrir le panneau de composants"
        >
          ›
        </button>
      )}

      {/* Mode indicator */}
      <div className={`absolute top-3 ${!isComponentsPanelOpen && isEditable ? 'left-13' : 'left-3'} flex items-center gap-2 z-10`}>
        <div className={`px-2 py-1 rounded text-xs font-mono ${
          isEditable
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        }`}>
          {isEditable ? 'MODE:EDIT' : 'MODE:SIM'}
        </div>
        {isEditable && storedNodes.length > 1 && (
          <button
            className="px-2 py-1 rounded text-xs font-mono bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={handleAutoLayout}
            disabled={isLayouting}
          >
            {isLayouting ? '...' : '⊞ Layout'}
          </button>
        )}
        {storedEdges.length > 0 && (
          <button
            onClick={() => {
              const { edgeRoutingMode: current, setEdgeRoutingMode } = useAppStore.getState();
              setEdgeRoutingMode(current === 'bezier' ? 'orthogonal' : 'bezier');
            }}
            className={`flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-semibold border rounded-sm cursor-pointer transition-colors ${
              edgeRoutingMode === 'orthogonal'
                ? 'text-signal-flux border-signal-flux/30 bg-signal-flux/10'
                : 'text-muted-foreground border-border hover:bg-muted/50'
            }`}
            title={edgeRoutingMode === 'orthogonal' ? 'Mode : routage orthogonal' : 'Mode : courbes bézier'}
          >
            <Route className="w-3 h-3" />
            {edgeRoutingMode === 'orthogonal' ? 'ORTHO' : 'BEZIER'}
          </button>
        )}
        {storedNodes.length === 0 && isEditable && (
          <div className="text-muted-foreground text-sm ml-4">
            Glissez des composants pour commencer
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-20 left-3 flex flex-col gap-1 z-10">
        <button
          className="w-8 h-8 bg-card/80 backdrop-blur border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={() => viewportRef.current?.zoomPercent(0.25, true)}
        >+</button>
        <button
          className="w-8 h-8 bg-card/80 backdrop-blur border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
          onClick={() => viewportRef.current?.zoomPercent(-0.25, true)}
        >−</button>
        <button
          className="w-8 h-8 bg-card/80 backdrop-blur border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground text-[10px]"
          onClick={() => viewportRef.current?.fit(true)}
        >⊞</button>
      </div>

      {/* Context menu (simulation mode) */}
      {contextMenu && (
        <NodeContextMenu
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* MiniMap (bottom-right) */}
      <MiniMap nodes={storedNodes} viewport={viewportReady ? viewportRef.current : null} />

      {/* Metrics panel (bottom) */}
      <MetricsPanel />
    </div>
  );
}
