import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ComponentType } from '@/types';
import {
  EDGE_WIDTH, EDGE_COLOR, EDGE_SELECTED_COLOR,
  NODE_WIDTH, NODE_HEIGHT, CONTAINER_COMPONENT_TYPES,
  HANDLE_RADIUS, canvasTheme, getNodeHeight,
} from './constants';
import { edgeStyleRegistry } from '@/plugins/extensions';
import { useArchitectureStore } from '@/store/architecture-store';
import { computeOrthogonalRoute } from '@/lib/orthogonal-router';
import { computeEdgeAnchors, type AnchorMap, type NodeBounds } from '@/lib/edge-anchors';
import { computeParallelGroups, parallelOffset, staggeredLabelT, type ParallelGroupInfo, type ParallelGroups } from '@/lib/edge-grouping';
import { computeBezierParams, bezierPoint, pointAlongPolyline, readWaypoints, waypointsAreFresh } from '@/lib/edge-paths';
import type { EdgeRoutingMode } from '@/store/app-store';

// Protocol colors — each protocol has a unique color
const PROTOCOL_COLORS: Record<string, number> = {
  rest: 0x3b82f6,     // blue (HTTP)
  http: 0x3b82f6,     // blue
  grpc: 0x14b8a6,     // teal
  websocket: 0x8b5cf6, // violet
  graphql: 0xec4899,   // pink
  tcp: 0x64748b,       // slate
  'message-queue': 0xf59e0b, // amber
  database: 0x22c55e,  // green
};

// Protocol badge display names
const PROTOCOL_LABELS: Record<string, string> = {
  rest: 'HTTP',
  http: 'HTTP',
  grpc: 'gRPC',
  websocket: 'WS',
  graphql: 'GQL',
};

// Protocol stroke widths
const PROTOCOL_WIDTHS: Record<string, number> = {
  rest: 1.5,
  http: 1.5,
  grpc: 2,
  websocket: 1.5,
  tcp: 1,
  'message-queue': 1.5,
  database: 1,
  graphql: 1.5,
};

interface EdgeVisual {
  line: Graphics;
  hitArea: Graphics;
  arrow: Graphics;
  label: Text | null;
  sourceHandle: Graphics;
  targetHandle: Graphics;
  edgeId: string;
  /** Reference to the live edge — used by `applyFocus` to recompute alpha without redrawing paths. */
  edge: GraphEdge;
  /** Target alpha (computed from selection/focus/filter) — restored by hover after pointerout */
  targetAlpha: number;
}

/**
 * Focus context controls dimming and visibility of edges:
 * - `focusNodeId`: when set, only edges incident to this node keep full opacity
 * - `protocolFilters`: map keyed by protocol; if `false`, edges with that protocol are hidden
 *   (`undefined` and `true` mean visible — matches the toggle semantics in app-store)
 */
export interface EdgeFocusContext {
  focusNodeId: string | null;
  protocolFilters: Partial<Record<string, boolean>>;
}

const DIM_ALPHA = 0.15;

/**
 * Build the text shown on an edge label. Combines the protocol short name (HTTP, gRPC,
 * WS, GQL) with the aggregate multiplier produced by collapse-view (×N when N > 1).
 *
 * Returns an empty string when there is nothing to display.
 */
function formatEdgeLabel(protocol: string | undefined, aggregateCount: number): string {
  const proto = protocol ? PROTOCOL_LABELS[protocol] ?? '' : '';
  const mult = aggregateCount > 1 ? `×${aggregateCount}` : '';
  if (proto && mult) return `${proto} ${mult}`;
  return proto || mult;
}

interface ReconnectResult {
  edgeId: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

/**
 * Renders edges between nodes as smooth bezier curves with:
 * - Directional arrow heads
 * - Protocol badges (HTTP, gRPC, WS, GQL)
 * - Selection highlighting with glow
 * - Color coding by protocol
 */
export class EdgeRenderer {
  private visuals: Map<string, EdgeVisual> = new Map();
  private nodePositionCache: Map<string, GraphNode> = new Map();

  // Callback for edge click (selection)
  onEdgeClick: ((edgeId: string) => void) | null = null;

  // Callback for edge double-click (drill-down par les plugins, ex: refinement EE).
  onEdgeDoubleClick: ((edgeId: string) => void) | null = null;

  // Callback for edge hover
  onEdgeHover: ((edgeId: string | null) => void) | null = null;

  // Détection de double-clic par edge — fenêtre courte entre deux pointerdown.
  private static readonly DOUBLE_CLICK_DELAY_MS = 300;
  private lastTapPerEdge: Map<string, number> = new Map();

  // Callback when reconnection drag starts (so PixiCanvas can pause viewport)
  onReconnectStart: (() => void) | null = null;

  // Reconnection state
  private reconnecting = false;
  private reconnectEdgeId: string | null = null;
  private reconnectEnd: 'source' | 'target' | null = null;
  private reconnectOriginalEdge: GraphEdge | null = null;
  private previewLine: Graphics;
  private reconnectDragX = 0;
  private reconnectDragY = 0;

  // Track edit mode for showing endpoint handles
  private editMode = false;
  private selectedEdgeIdCache: string | null = null;

  /** @param layer — visual layer for lines/arrows (Z_EDGES)
   *  @param hitLayer — interactive layer for hit areas (Z_EDGE_HIT, above nodes) */
  constructor(private layer: Container, private hitLayer?: Container) {
    this.previewLine = new Graphics();
    this.previewLine.visible = false;
    this.layer.addChild(this.previewLine);
  }

  get isReconnecting(): boolean {
    return this.reconnecting;
  }

  setEditMode(editable: boolean): void {
    this.editMode = editable;
  }

  renderEdges(
    edges: GraphEdge[],
    nodes: GraphNode[],
    selectedEdgeId: string | null,
    routingMode: EdgeRoutingMode = 'bezier',
    focusContext?: EdgeFocusContext,
  ): void {
    // Build node position map
    this.nodePositionCache.clear();
    for (const node of nodes) {
      this.nodePositionCache.set(node.id, node);
    }
    this.selectedEdgeIdCache = selectedEdgeId;

    // Compute anchor distribution and parallel groups for this frame (shared with EdgePathCache).
    const boundsById = this.buildBoundsMap(nodes);
    const anchors = computeEdgeAnchors(edges, boundsById, { honorHandles: routingMode === 'orthogonal' });
    const groups = computeParallelGroups(edges);

    const existingIds = new Set(edges.map((e) => e.id));

    // Remove deleted edge visuals
    for (const [id, visual] of this.visuals) {
      if (!existingIds.has(id)) {
        visual.hitArea.destroy();
        visual.line.destroy();
        visual.arrow.destroy();
        visual.sourceHandle.destroy();
        visual.targetHandle.destroy();
        visual.label?.destroy();
        this.visuals.delete(id);
      }
    }

    // Create or update each edge
    for (const edge of edges) {
      const source = this.nodePositionCache.get(edge.source);
      const target = this.nodePositionCache.get(edge.target);
      if (!source || !target) continue;

      const isSelected = edge.id === selectedEdgeId;
      let visual = this.visuals.get(edge.id);

      if (!visual) {
        visual = this.createEdgeVisual(edge);
        this.visuals.set(edge.id, visual);
      } else {
        // Refresh the edge reference — the same id may carry updated data (e.g. new protocol).
        visual.edge = edge;
      }

      this.updateEdgeVisual(visual, edge, source, target, isSelected, nodes, routingMode, anchors, groups, focusContext);
    }
  }

  /** Build a map of nodeId → absolute bounds, for the anchor calculation. */
  private buildBoundsMap(nodes: GraphNode[]): Map<string, NodeBounds> {
    const map = new Map<string, NodeBounds>();
    for (const node of nodes) {
      const abs = this.getAbsolutePosition(node);
      map.set(node.id, {
        x: abs.x,
        y: abs.y,
        width: node.width ?? NODE_WIDTH,
        height: node.height ?? getNodeHeight(node.type),
      });
    }
    return map;
  }

  /**
   * Cheap pass that updates focus/filter alphas on existing visuals — no path or geometry
   * recomputation. Designed to be called on hover/selection changes without triggering the
   * full `renderEdges` pipeline (which re-runs anchor distribution, parallel grouping, and
   * particle path sampling).
   */
  applyFocus(selectedEdgeId: string | null, focusContext?: EdgeFocusContext): void {
    this.selectedEdgeIdCache = selectedEdgeId;
    for (const visual of this.visuals.values()) {
      const isSelected = visual.edgeId === selectedEdgeId;
      const alphaMul = this.computeAlphaMultiplier(visual.edge, isSelected, focusContext);
      visual.targetAlpha = alphaMul;
      visual.line.alpha = alphaMul;
      visual.arrow.alpha = alphaMul;
      if (visual.label) visual.label.alpha = alphaMul;
      visual.hitArea.eventMode = alphaMul === 0 ? 'none' : 'static';
    }
  }

  /**
   * Compute the multiplier applied on top of the base alpha for focus + protocol filter.
   * Returns 0 to fully hide (filtered out), DIM_ALPHA to dim, 1 for full visibility.
   */
  private computeAlphaMultiplier(edge: GraphEdge, isSelected: boolean, focus?: EdgeFocusContext): number {
    if (!focus) return 1;

    // Protocol filter — `false` means hidden (matches app-store toggle convention)
    const edgeData = edge.data as Record<string, unknown> | undefined;
    const protocol = (edgeData?.protocol as string | undefined) ?? '_none';
    if (focus.protocolFilters[protocol] === false) return 0;

    // Selection always wins over focus dimming
    if (isSelected) return 1;

    // Focus mode — dim edges not incident to the focused node
    if (focus.focusNodeId) {
      const isConnected = edge.source === focus.focusNodeId || edge.target === focus.focusNodeId;
      if (!isConnected) return DIM_ALPHA;
    }
    return 1;
  }

  private createEdgeVisual(edge: GraphEdge): EdgeVisual {
    const line = new Graphics();
    const hitArea = new Graphics();
    const arrow = new Graphics();

    // Invisible wider hit area for easier clicking
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';
    hitArea.alpha = 0;
    hitArea.on('pointerdown', (e) => {
      e.stopPropagation();
      this.onEdgeClick?.(edge.id);
      // Détection de double-clic : deux pointerdown rapprochés sur le même edge.
      if (this.onEdgeDoubleClick) {
        const now = performance.now();
        const last = this.lastTapPerEdge.get(edge.id) ?? 0;
        if (now - last <= EdgeRenderer.DOUBLE_CLICK_DELAY_MS) {
          this.lastTapPerEdge.delete(edge.id);
          this.onEdgeDoubleClick(edge.id);
        } else {
          this.lastTapPerEdge.set(edge.id, now);
        }
      }
    });
    hitArea.on('pointerover', () => {
      this.onEdgeHover?.(edge.id);
      const v = this.visuals.get(edge.id);
      if (v) {
        if (edge.id !== this.selectedEdgeIdCache) {
          // Boost to full opacity on hover regardless of focus dimming
          v.line.alpha = 1;
          v.arrow.alpha = 1;
          if (v.label) v.label.alpha = 1;
        }
        if (this.editMode) {
          v.sourceHandle.visible = true;
          v.targetHandle.visible = true;
        }
      }
    });
    hitArea.on('pointerout', () => {
      this.onEdgeHover?.(null);
      const v = this.visuals.get(edge.id);
      if (v && edge.id !== this.selectedEdgeIdCache) {
        // Restore the focus/filter-aware alpha
        v.line.alpha = v.targetAlpha;
        v.arrow.alpha = v.targetAlpha;
        if (v.label) v.label.alpha = v.targetAlpha;
        if (!this.selectedEdgeIdCache || edge.id !== this.selectedEdgeIdCache) {
          v.sourceHandle.visible = false;
          v.targetHandle.visible = false;
        }
      }
    });

    line.eventMode = 'none';
    arrow.eventMode = 'none';

    // Draggable endpoint handles for reconnection
    const sourceHandle = new Graphics();
    const targetHandle = new Graphics();
    for (const [handle, end] of [[sourceHandle, 'source'], [targetHandle, 'target']] as const) {
      handle.eventMode = 'static';
      handle.cursor = 'crosshair';
      handle.visible = false;
      handle.hitArea = { contains: (x: number, y: number) => x * x + y * y <= 14 ** 2 };

      handle.on('pointerdown', (e) => {
        e.stopPropagation();
        this.reconnecting = true;
        this.reconnectEdgeId = edge.id;
        this.reconnectEnd = end;
        this.reconnectOriginalEdge = edge;
        this.reconnectDragX = handle.position.x;
        this.reconnectDragY = handle.position.y;
        this.onReconnectStart?.();
      });

      handle.on('pointerover', () => { handle.alpha = 1; handle.scale.set(1.3); });
      handle.on('pointerout', () => { handle.alpha = 0.7; handle.scale.set(1); });
    }

    // Hit area goes in hitLayer (above nodes) for reliable click detection
    (this.hitLayer ?? this.layer).addChild(hitArea);
    this.layer.addChild(line, arrow);
    // Reconnection handles go in hitLayer (above nodes) for reliable click detection
    (this.hitLayer ?? this.layer).addChild(sourceHandle, targetHandle);

    // Protocol / aggregate label. Created if either a known protocol or an aggregate count exists.
    const edgeData = edge.data as Record<string, unknown> | undefined;
    const protocol = edgeData?.protocol as string | undefined;
    const aggregateCount = typeof edgeData?._aggregateCount === 'number' ? edgeData._aggregateCount : 1;
    const labelText = formatEdgeLabel(protocol, aggregateCount);
    let label: Text | null = null;

    if (labelText) {
      label = new Text({
        text: labelText,
        style: new TextStyle({
          fontSize: 8,
          fill: PROTOCOL_COLORS[protocol ?? ''] ?? 0x888888,
          fontFamily: '"SF Mono", "Fira Code", monospace',
          fontWeight: '600',
          letterSpacing: 0.5,
        }),
      });
      label.eventMode = 'none';
      this.layer.addChild(label);
    }

    return { line, hitArea, arrow, label, sourceHandle, targetHandle, edgeId: edge.id, edge, targetAlpha: 1 };
  }

  private updateEdgeVisual(
    visual: EdgeVisual,
    edge: GraphEdge,
    source: GraphNode,
    target: GraphNode,
    isSelected: boolean,
    allNodes: GraphNode[],
    routingMode: EdgeRoutingMode,
    anchors: AnchorMap,
    groups: ParallelGroups,
    focusContext?: EdgeFocusContext,
  ): void {
    const edgeData = edge.data as Record<string, unknown> | undefined;
    const protocol = edgeData?.protocol as string | undefined;
    const customColor = edgeData?.color as string | undefined;
    const customColorNum = customColor ? parseInt(customColor.replace('#', ''), 16) : undefined;
    const customWidth = edgeData?.strokeWidth as number | undefined;

    // Pseudo-edge flag (D4.5 — injecté par pseudoEdgeRegistry, jamais persisté).
    // Un pseudo-edge `ghost` est rendu en couleur slate-400, opacité réduite, et
    // largeur amincie ; les handles de reconnexion sont désactivés.
    const isPseudo = (edge as { __pseudo?: boolean }).__pseudo === true;
    const pseudoVisualHint = (edge as { visualHint?: string }).visualHint;
    const isGhost = isPseudo && pseudoVisualHint === 'ghost';

    // Plugin overrides (edgeStyleRegistry.resolveHints) — appliqués si l'edge n'a pas
    // déjà un override explicite de l'utilisateur (customColor/customWidth conservent la priorité).
    let pluginColorNum: number | undefined;
    let pluginWidth: number | undefined;
    if (edgeStyleRegistry.hasProviders()) {
      const projectMeta = useArchitectureStore.getState().projectMeta;
      const hints = edgeStyleRegistry.resolveHints(edge, {
        projectMeta,
        sourceNode: source,
        targetNode: target,
      });
      if (hints?.color && hints.color.startsWith('#')) {
        const parsed = parseInt(hints.color.replace('#', ''), 16);
        if (!Number.isNaN(parsed)) pluginColorNum = parsed;
      }
      if (typeof hints?.strokeWidth === 'number') pluginWidth = hints.strokeWidth;
    }

    // Ghost edge : couleur slate-400 par défaut, width amincie. Ces valeurs écrasent
    // les fallbacks (mais respectent un customColor utilisateur explicite).
    const ghostColor = 0x94a3b8; // slate-400
    const ghostBaseColor = customColorNum ?? pluginColorNum ?? ghostColor;
    const ghostBaseWidth = Math.max(1, (customWidth ?? pluginWidth ?? EDGE_WIDTH) - 0.4);

    const baseColor = isGhost
      ? ghostBaseColor
      : (customColorNum ?? pluginColorNum ?? PROTOCOL_COLORS[protocol ?? ''] ?? canvasTheme().edgeColor);
    const baseWidth = isGhost
      ? ghostBaseWidth
      : (customWidth ?? pluginWidth ?? PROTOCOL_WIDTHS[protocol ?? ''] ?? EDGE_WIDTH);
    const color = isSelected ? EDGE_SELECTED_COLOR : baseColor;
    const width = isSelected ? baseWidth + 1 : baseWidth;
    const baseAlpha = isSelected ? 1 : canvasTheme().edgeAlpha;
    // Ghost : opacité réduite à 0.45 pour signaler le caractère synthétique (non persisté).
    const alpha = isGhost ? Math.min(baseAlpha, 0.45) : baseAlpha;
    const alphaMul = this.computeAlphaMultiplier(edge, isSelected, focusContext);
    // Apply focus/filter via sprite-level alpha so hover can temporarily boost through it.
    // Stroke alpha stays at the baseline; sprite alpha = alphaMul carries focus/filter state.
    visual.targetAlpha = alphaMul;
    visual.line.alpha = alphaMul;
    visual.arrow.alpha = alphaMul;
    if (visual.label) {
      // Refresh label text — aggregate counts can change between renders when underlying
      // edges are added or removed under a collapsed container.
      const aggregateCount = typeof edgeData?._aggregateCount === 'number' ? edgeData._aggregateCount : 1;
      const desired = formatEdgeLabel(protocol, aggregateCount);
      if (visual.label.text !== desired) visual.label.text = desired;
      visual.label.alpha = alphaMul;
    }
    // Filtered-out edges should not capture clicks/hovers
    visual.hitArea.eventMode = alphaMul === 0 ? 'none' : 'static';

    // Compute absolute positions
    const sourceAbs = this.getAbsolutePosition(source);
    const targetAbs = this.getAbsolutePosition(target);

    const sw = source.width ?? NODE_WIDTH;
    const sh = source.height ?? getNodeHeight(source.type);
    const tw = target.width ?? NODE_WIDTH;
    const th = target.height ?? getNodeHeight(target.type);

    // Anchor lookup (with fallback to centre-of-side via borderIntersection if missing).
    const anchor = anchors.get(edge.id) ?? this.fallbackAnchor(sourceAbs, targetAbs, sw, sh, tw, th);

    // Parallel-group info drives both the perpendicular offset and the label staggering.
    const groupInfo = groups.groupOf.get(edge.id);
    const offset = parallelOffset(groupInfo);

    if (routingMode === 'orthogonal') {
      // Étape 2's distributed anchors already produce parallel orthogonal corridors;
      // no extra lateral offset is applied to A* exit points.
      this.drawOrthogonal(visual, edge, source, target, allNodes, anchor, groupInfo, color, width, alpha, isSelected);
    } else {
      this.drawBezier(visual, anchor, offset, groupInfo, color, width, alpha, isSelected);
    }

    // ── Endpoint handles for reconnection (edit mode + selected or hovered) ──
    // Pseudo-edges ne sont jamais reconnectables (pas persistées dans le store) → handles masqués.
    const showEndpoints = this.editMode && isSelected && !isPseudo;
    const sp = anchor.source;
    const tp = anchor.target;

    for (const [handle, pos] of [[visual.sourceHandle, sp], [visual.targetHandle, tp]] as const) {
      handle.visible = showEndpoints;
      // Always draw handles (so hover can show them without re-render)
      handle.clear();
      handle.position.set(pos.x, pos.y);
      handle.circle(0, 0, 10);
      handle.fill({ color: canvasTheme().reconnectHandleBg, alpha: 0.95 });
      handle.circle(0, 0, 10);
      handle.stroke({ width: 2, color: 0x6366f1, alpha: 0.9 });
      handle.circle(0, 0, 4);
      handle.fill({ color: 0x6366f1, alpha: 0.9 });
      handle.alpha = 0.8;
    }
  }

  /** Build an anchor synthesised from the existing border-intersection logic — used as a fallback when the anchor map has no entry (e.g. self-referent edges). */
  private fallbackAnchor(
    sourceAbs: { x: number; y: number }, targetAbs: { x: number; y: number },
    sw: number, sh: number, tw: number, th: number,
  ): { source: { x: number; y: number }; target: { x: number; y: number }; sourceSide: 'top' | 'right' | 'bottom' | 'left'; targetSide: 'top' | 'right' | 'bottom' | 'left' } {
    const scx = sourceAbs.x + sw / 2;
    const scy = sourceAbs.y + sh / 2;
    const tcx = targetAbs.x + tw / 2;
    const tcy = targetAbs.y + th / 2;
    const sp = this.borderIntersection(scx, scy, sw, sh, tcx, tcy);
    const tp = this.borderIntersection(tcx, tcy, tw, th, scx, scy);
    return { source: sp, target: tp, sourceSide: 'right', targetSide: 'left' };
  }

  // ── Bezier drawing ──
  private drawBezier(
    visual: EdgeVisual,
    anchor: { source: { x: number; y: number }; target: { x: number; y: number } },
    parallelOffset: number,
    groupInfo: ParallelGroupInfo | undefined,
    color: number, width: number, alpha: number, isSelected: boolean,
  ): void {
    const params = computeBezierParams(anchor.source, anchor.target, parallelOffset);
    const { source: sp, target: tp, cp1, cp2 } = params;

    // Hit area
    visual.hitArea.clear();
    visual.hitArea.setStrokeStyle({ width: 16, color: 0xffffff, alpha: 1 });
    visual.hitArea.moveTo(sp.x, sp.y);
    visual.hitArea.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, tp.x, tp.y);
    visual.hitArea.stroke();
    visual.hitArea.alpha = 0;

    // Line
    visual.line.clear();
    if (isSelected) {
      visual.line.setStrokeStyle({ width: width + 4, color, alpha: 0.2 });
      visual.line.moveTo(sp.x, sp.y);
      visual.line.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, tp.x, tp.y);
      visual.line.stroke();
    }
    visual.line.setStrokeStyle({ width, color, alpha });
    visual.line.moveTo(sp.x, sp.y);
    visual.line.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, tp.x, tp.y);
    visual.line.stroke();

    // Arrow
    const arrowAngle = Math.atan2(tp.y - cp2.y, tp.x - cp2.x);
    this.drawArrow(visual, tp.x, tp.y, arrowAngle, color, alpha, isSelected);

    // Label staggered along the curve so badges in a parallel group don't overlap.
    if (visual.label) {
      const t = staggeredLabelT(groupInfo);
      const m = bezierPoint(params, t);
      visual.label.position.set(m.x - visual.label.width / 2, m.y - visual.label.height - 4);
    }
  }

  // ── Orthogonal drawing ──
  private drawOrthogonal(
    visual: EdgeVisual,
    edge: GraphEdge,
    source: GraphNode, target: GraphNode,
    allNodes: GraphNode[],
    anchor: { source: { x: number; y: number }; target: { x: number; y: number }; sourceSide: 'top' | 'right' | 'bottom' | 'left'; targetSide: 'top' | 'right' | 'bottom' | 'left' },
    groupInfo: ParallelGroupInfo | undefined,
    color: number, width: number, alpha: number, isSelected: boolean,
  ): void {
    // Build obstacles from all nodes
    const obstacles = allNodes
      .filter((n) => n.type !== 'network-zone')
      .map((n) => {
        const abs = this.getAbsolutePosition(n);
        return { id: n.id, x: abs.x, y: abs.y, width: n.width ?? NODE_WIDTH, height: n.height ?? getNodeHeight(n.type) };
      });

    const sourcePoint = anchor.source;
    const targetPoint = anchor.target;

    // Prefer waypoints from a recent ELK auto-layout when they are still consistent with
    // the current node positions; otherwise fall back to the local A* router.
    const elkWaypoints = readWaypoints(edge);
    let allPoints: { x: number; y: number }[];
    if (elkWaypoints && waypointsAreFresh(elkWaypoints, sourcePoint, targetPoint)) {
      // Replace ELK's start/end with the live anchor positions so the path always lands
      // exactly on the rendered node sides (anchors may have been redistributed by the
      // dynamic-anchors module since layout time).
      allPoints = [sourcePoint, ...elkWaypoints.slice(1, -1), targetPoint];
    } else {
      const excludeIds = new Set([edge.source, edge.target]);
      if (source.parentId) excludeIds.add(source.parentId);
      if (target.parentId) excludeIds.add(target.parentId);

      const route = computeOrthogonalRoute(
        { ...sourcePoint, side: anchor.sourceSide },
        { ...targetPoint, side: anchor.targetSide },
        obstacles,
        excludeIds,
      );
      allPoints = [sourcePoint, ...route.waypoints, targetPoint];
    }

    // Hit area
    visual.hitArea.clear();
    visual.hitArea.setStrokeStyle({ width: 16, color: 0xffffff, alpha: 1 });
    visual.hitArea.moveTo(allPoints[0].x, allPoints[0].y);
    for (let i = 1; i < allPoints.length; i++) {
      visual.hitArea.lineTo(allPoints[i].x, allPoints[i].y);
    }
    visual.hitArea.stroke();
    visual.hitArea.alpha = 0;

    // Line
    visual.line.clear();
    if (isSelected) {
      visual.line.setStrokeStyle({ width: width + 4, color, alpha: 0.2 });
      visual.line.moveTo(allPoints[0].x, allPoints[0].y);
      for (let i = 1; i < allPoints.length; i++) {
        visual.line.lineTo(allPoints[i].x, allPoints[i].y);
      }
      visual.line.stroke();
    }
    visual.line.setStrokeStyle({ width, color, alpha });
    visual.line.moveTo(allPoints[0].x, allPoints[0].y);
    for (let i = 1; i < allPoints.length; i++) {
      visual.line.lineTo(allPoints[i].x, allPoints[i].y);
    }
    visual.line.stroke();

    // Arrow from last segment
    const last = allPoints[allPoints.length - 1];
    const prev = allPoints[allPoints.length - 2];
    const arrowAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
    this.drawArrow(visual, last.x, last.y, arrowAngle, color, alpha, isSelected);

    // Label staggered along the polyline by total arc length.
    if (visual.label) {
      const t = staggeredLabelT(groupInfo);
      const pos = pointAlongPolyline(allPoints, t);
      visual.label.position.set(pos.x - visual.label.width / 2, pos.y - visual.label.height - 4);
    }
  }

  // ── Arrow head helper ──
  private drawArrow(
    visual: EdgeVisual,
    tx: number, ty: number,
    angle: number,
    color: number, alpha: number, isSelected: boolean,
  ): void {
    const arrowLen = isSelected ? 10 : 8;
    const arrowSpread = Math.PI / 7;

    visual.arrow.clear();
    const ax1 = tx - arrowLen * Math.cos(angle - arrowSpread);
    const ay1 = ty - arrowLen * Math.sin(angle - arrowSpread);
    const ax2 = tx - arrowLen * Math.cos(angle + arrowSpread);
    const ay2 = ty - arrowLen * Math.sin(angle + arrowSpread);

    visual.arrow.moveTo(tx, ty);
    visual.arrow.lineTo(ax1, ay1);
    visual.arrow.lineTo(ax2, ay2);
    visual.arrow.closePath();
    visual.arrow.fill({ color, alpha });
  }

  /**
   * Compute the absolute position of a node (walking up the parentId chain).
   */
  private getAbsolutePosition(node: GraphNode): { x: number; y: number } {
    let x = node.position.x;
    let y = node.position.y;
    let current = node;

    while (current.parentId) {
      const parent = this.nodePositionCache.get(current.parentId);
      if (!parent) break;
      x += parent.position.x;
      y += parent.position.y;
      current = parent;
    }

    return { x, y };
  }

  /**
   * Find the intersection point of a line from (cx, cy) toward (toX, toY)
   * with the border of a rectangle centered at (cx, cy).
   */
  private borderIntersection(
    cx: number, cy: number,
    w: number, h: number,
    toX: number, toY: number,
  ): { x: number; y: number } {
    const dx = toX - cx;
    const dy = toY - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    const hw = w / 2;
    const hh = h / 2;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let t: number;
    if (absDx * hh > absDy * hw) {
      t = hw / absDx;
    } else {
      t = hh / absDy;
    }

    return { x: cx + dx * t, y: cy + dy * t };
  }

  // ============================================
  // Edge reconnection drag
  // ============================================

  updateReconnectDrag(worldX: number, worldY: number): void {
    if (!this.reconnecting || !this.reconnectOriginalEdge) return;
    this.reconnectDragX = worldX;
    this.reconnectDragY = worldY;

    // Draw preview line from the fixed end to the drag position
    const edge = this.reconnectOriginalEdge;
    const fixedNode = this.reconnectEnd === 'source'
      ? this.nodePositionCache.get(edge.target)
      : this.nodePositionCache.get(edge.source);

    if (!fixedNode) return;

    const fixedAbs = this.getAbsolutePosition(fixedNode);
    const fw = fixedNode.width ?? NODE_WIDTH;
    const fh = fixedNode.height ?? getNodeHeight(fixedNode.type);
    const fcx = fixedAbs.x + fw / 2;
    const fcy = fixedAbs.y + fh / 2;
    const fp = this.borderIntersection(fcx, fcy, fw, fh, worldX, worldY);

    this.previewLine.clear();
    this.previewLine.visible = true;
    this.previewLine.setStrokeStyle({ width: 2, color: 0x6366f1, alpha: 0.6 });
    this.previewLine.moveTo(fp.x, fp.y);
    this.previewLine.lineTo(worldX, worldY);
    this.previewLine.stroke();

    // Draw endpoint indicator
    this.previewLine.circle(worldX, worldY, 5);
    this.previewLine.fill({ color: 0x6366f1, alpha: 0.4 });

    // Hide the original edge visual during drag
    const visual = this.visuals.get(edge.id);
    if (visual) {
      visual.line.alpha = 0.15;
      visual.arrow.alpha = 0.15;
    }
  }

  endReconnectDrag(worldX: number, worldY: number, nodes: GraphNode[]): ReconnectResult | null {
    this.previewLine.clear();
    this.previewLine.visible = false;

    if (!this.reconnecting || !this.reconnectOriginalEdge || !this.reconnectEnd) {
      this.reconnecting = false;
      return null;
    }

    const edge = this.reconnectOriginalEdge;

    // Restore original edge visibility
    const visual = this.visuals.get(edge.id);
    if (visual) {
      visual.line.alpha = 1;
      visual.arrow.alpha = 1;
    }

    // Find target node at drop position
    const hitRadius = 20;
    let targetNode: GraphNode | null = null;

    for (const node of nodes) {
      if (CONTAINER_COMPONENT_TYPES.has(node.type as ComponentType)) continue;
      const abs = this.getAbsolutePosition(node);
      const w = node.width ?? NODE_WIDTH;
      const h = node.height ?? getNodeHeight(node.type);

      if (worldX >= abs.x - hitRadius && worldX <= abs.x + w + hitRadius &&
          worldY >= abs.y - hitRadius && worldY <= abs.y + h + hitRadius) {
        targetNode = node;
        break;
      }
    }

    this.reconnecting = false;
    const result: ReconnectResult | null = null;

    if (targetNode) {
      // Determine which side of the target was hit
      const abs = this.getAbsolutePosition(targetNode);
      const w = targetNode.width ?? NODE_WIDTH;
      const h = targetNode.height ?? getNodeHeight(targetNode.type);
      const cx = abs.x + w / 2;
      const cy = abs.y + h / 2;
      const dx = worldX - cx;
      const dy = worldY - cy;

      let side: string;
      if (Math.abs(dx) > Math.abs(dy)) {
        side = dx > 0 ? 'right' : 'left';
      } else {
        side = dy > 0 ? 'bottom' : 'top';
      }

      if (this.reconnectEnd === 'source') {
        // Reconnecting source end — target stays fixed
        if (targetNode.id !== edge.target) {
          const reconnectResult: ReconnectResult = {
            edgeId: edge.id,
            source: targetNode.id,
            target: edge.target,
            sourceHandle: `source-${side}`,
            targetHandle: edge.targetHandle ?? 'target-left',
          };
          this.reconnectEdgeId = null;
          this.reconnectEnd = null;
          this.reconnectOriginalEdge = null;
          return reconnectResult;
        }
      } else {
        // Reconnecting target end — source stays fixed
        if (targetNode.id !== edge.source) {
          const reconnectResult: ReconnectResult = {
            edgeId: edge.id,
            source: edge.source,
            target: targetNode.id,
            sourceHandle: edge.sourceHandle ?? 'source-right',
            targetHandle: `target-${side}`,
          };
          this.reconnectEdgeId = null;
          this.reconnectEnd = null;
          this.reconnectOriginalEdge = null;
          return reconnectResult;
        }
      }
    }

    this.reconnectEdgeId = null;
    this.reconnectEnd = null;
    this.reconnectOriginalEdge = null;
    return result;
  }

  destroy(): void {
    for (const visual of this.visuals.values()) {
      visual.hitArea.destroy();
      visual.line.destroy();
      visual.arrow.destroy();
      visual.sourceHandle.destroy();
      visual.targetHandle.destroy();
      visual.label?.destroy();
    }
    this.visuals.clear();
    this.previewLine.destroy();
  }
}
