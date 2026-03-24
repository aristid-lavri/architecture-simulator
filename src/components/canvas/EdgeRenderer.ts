import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GraphNode, GraphEdge } from '@/types/graph';
import {
  EDGE_WIDTH, EDGE_COLOR, EDGE_SELECTED_COLOR,
  NODE_WIDTH, NODE_HEIGHT, CONTAINER_COMPONENT_TYPES,
  HANDLE_RADIUS, canvasTheme, getNodeHeight,
} from './constants';
import { computeOrthogonalRoute, parseHandleSide } from '@/lib/orthogonal-router';
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

  // Callback for edge hover
  onEdgeHover: ((edgeId: string | null) => void) | null = null;

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

  renderEdges(edges: GraphEdge[], nodes: GraphNode[], selectedEdgeId: string | null, routingMode: EdgeRoutingMode = 'bezier'): void {
    // Build node position map
    this.nodePositionCache.clear();
    for (const node of nodes) {
      this.nodePositionCache.set(node.id, node);
    }
    this.selectedEdgeIdCache = selectedEdgeId;

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
      }

      this.updateEdgeVisual(visual, edge, source, target, isSelected, nodes, routingMode);
    }
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
    });
    hitArea.on('pointerover', () => {
      this.onEdgeHover?.(edge.id);
      const v = this.visuals.get(edge.id);
      if (v) {
        if (edge.id !== this.selectedEdgeIdCache) {
          v.line.alpha = 1;
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
        v.line.alpha = 0.6;
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

    // Protocol label
    const edgeData = edge.data as Record<string, unknown> | undefined;
    const protocol = edgeData?.protocol as string | undefined;
    let label: Text | null = null;

    if (protocol && PROTOCOL_LABELS[protocol]) {
      label = new Text({
        text: PROTOCOL_LABELS[protocol],
        style: new TextStyle({
          fontSize: 8,
          fill: PROTOCOL_COLORS[protocol] ?? 0x888888,
          fontFamily: '"SF Mono", "Fira Code", monospace',
          fontWeight: '600',
          letterSpacing: 0.5,
        }),
      });
      label.eventMode = 'none';
      this.layer.addChild(label);
    }

    return { line, hitArea, arrow, label, sourceHandle, targetHandle, edgeId: edge.id };
  }

  private updateEdgeVisual(
    visual: EdgeVisual,
    edge: GraphEdge,
    source: GraphNode,
    target: GraphNode,
    isSelected: boolean,
    allNodes: GraphNode[],
    routingMode: EdgeRoutingMode,
  ): void {
    const edgeData = edge.data as Record<string, unknown> | undefined;
    const protocol = edgeData?.protocol as string | undefined;
    const color = isSelected ? EDGE_SELECTED_COLOR : (PROTOCOL_COLORS[protocol ?? ''] ?? canvasTheme().edgeColor);
    const width = isSelected ? (PROTOCOL_WIDTHS[protocol ?? ''] ?? EDGE_WIDTH) + 1 : (PROTOCOL_WIDTHS[protocol ?? ''] ?? EDGE_WIDTH);
    const alpha = isSelected ? 1 : 0.6;

    // Compute absolute positions
    const sourceAbs = this.getAbsolutePosition(source);
    const targetAbs = this.getAbsolutePosition(target);

    const sw = source.width ?? NODE_WIDTH;
    const sh = source.height ?? getNodeHeight(source.type);
    const tw = target.width ?? NODE_WIDTH;
    const th = target.height ?? getNodeHeight(target.type);

    if (routingMode === 'orthogonal') {
      this.drawOrthogonal(visual, edge, source, target, allNodes, sourceAbs, targetAbs, sw, sh, tw, th, color, width, alpha, isSelected);
    } else {
      this.drawBezier(visual, sourceAbs, targetAbs, sw, sh, tw, th, color, width, alpha, isSelected);
    }

    // ── Endpoint handles for reconnection (edit mode + selected or hovered) ──
    const showEndpoints = this.editMode && isSelected;
    const scx = sourceAbs.x + sw / 2;
    const scy = sourceAbs.y + sh / 2;
    const tcx = targetAbs.x + tw / 2;
    const tcy = targetAbs.y + th / 2;
    const sp = this.borderIntersection(scx, scy, sw, sh, tcx, tcy);
    const tp = this.borderIntersection(tcx, tcy, tw, th, scx, scy);

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

  // ── Bezier drawing ──
  private drawBezier(
    visual: EdgeVisual,
    sourceAbs: { x: number; y: number }, targetAbs: { x: number; y: number },
    sw: number, sh: number, tw: number, th: number,
    color: number, width: number, alpha: number, isSelected: boolean,
  ): void {
    const scx = sourceAbs.x + sw / 2;
    const scy = sourceAbs.y + sh / 2;
    const tcx = targetAbs.x + tw / 2;
    const tcy = targetAbs.y + th / 2;

    const sp = this.borderIntersection(scx, scy, sw, sh, tcx, tcy);
    const tp = this.borderIntersection(tcx, tcy, tw, th, scx, scy);

    const dx = tp.x - sp.x;
    const dy = tp.y - sp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(dist * 0.35, 80);

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    let cx1: number, cy1: number, cx2: number, cy2: number;

    if (absDx > absDy) {
      cx1 = sp.x + Math.sign(dx) * curvature;
      cy1 = sp.y;
      cx2 = tp.x - Math.sign(dx) * curvature;
      cy2 = tp.y;
    } else {
      cx1 = sp.x;
      cy1 = sp.y + Math.sign(dy) * curvature;
      cx2 = tp.x;
      cy2 = tp.y - Math.sign(dy) * curvature;
    }

    // Hit area
    visual.hitArea.clear();
    visual.hitArea.setStrokeStyle({ width: 16, color: 0xffffff, alpha: 1 });
    visual.hitArea.moveTo(sp.x, sp.y);
    visual.hitArea.bezierCurveTo(cx1, cy1, cx2, cy2, tp.x, tp.y);
    visual.hitArea.stroke();
    visual.hitArea.alpha = 0;

    // Line
    visual.line.clear();
    if (isSelected) {
      visual.line.setStrokeStyle({ width: width + 4, color, alpha: 0.2 });
      visual.line.moveTo(sp.x, sp.y);
      visual.line.bezierCurveTo(cx1, cy1, cx2, cy2, tp.x, tp.y);
      visual.line.stroke();
    }
    visual.line.setStrokeStyle({ width, color, alpha });
    visual.line.moveTo(sp.x, sp.y);
    visual.line.bezierCurveTo(cx1, cy1, cx2, cy2, tp.x, tp.y);
    visual.line.stroke();

    // Arrow
    const arrowAngle = Math.atan2(tp.y - cy2, tp.x - cx2);
    this.drawArrow(visual, tp.x, tp.y, arrowAngle, color, alpha, isSelected);

    // Label
    if (visual.label) {
      const t = 0.5, mt = 0.5;
      const mx = mt * mt * mt * sp.x + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * tp.x;
      const my = mt * mt * mt * sp.y + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * tp.y;
      visual.label.position.set(mx - visual.label.width / 2, my - visual.label.height - 4);
    }
  }

  // ── Orthogonal drawing ──
  private drawOrthogonal(
    visual: EdgeVisual,
    edge: GraphEdge,
    source: GraphNode, target: GraphNode,
    allNodes: GraphNode[],
    sourceAbs: { x: number; y: number }, targetAbs: { x: number; y: number },
    sw: number, sh: number, tw: number, th: number,
    color: number, width: number, alpha: number, isSelected: boolean,
  ): void {
    // Build obstacles from all nodes
    const obstacles = allNodes
      .filter((n) => n.type !== 'network-zone')
      .map((n) => {
        const abs = this.getAbsolutePosition(n);
        return { id: n.id, x: abs.x, y: abs.y, width: n.width ?? NODE_WIDTH, height: n.height ?? getNodeHeight(n.type) };
      });

    const srcSide = parseHandleSide(edge.sourceHandle);
    const tgtSide = parseHandleSide(edge.targetHandle);

    const srcObs = { x: sourceAbs.x, y: sourceAbs.y, width: sw, height: sh };
    const tgtObs = { x: targetAbs.x, y: targetAbs.y, width: tw, height: th };

    const sourcePoint = this.getHandlePoint(srcObs, srcSide);
    const targetPoint = this.getHandlePoint(tgtObs, tgtSide);

    const excludeIds = new Set([edge.source, edge.target]);
    if (source.parentId) excludeIds.add(source.parentId);
    if (target.parentId) excludeIds.add(target.parentId);

    const route = computeOrthogonalRoute(
      { ...sourcePoint, side: srcSide },
      { ...targetPoint, side: tgtSide },
      obstacles,
      excludeIds,
    );

    const waypoints = route.waypoints;
    const allPoints = [sourcePoint, ...waypoints, targetPoint];

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

    // Label at midpoint of the path
    if (visual.label) {
      const midIdx = Math.floor(allPoints.length / 2);
      const p0 = allPoints[midIdx - 1] ?? allPoints[0];
      const p1 = allPoints[midIdx];
      visual.label.position.set(
        (p0.x + p1.x) / 2 - visual.label.width / 2,
        (p0.y + p1.y) / 2 - visual.label.height - 4,
      );
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

  // ── Handle point helper ──
  private getHandlePoint(
    obs: { x: number; y: number; width: number; height: number },
    side: 'top' | 'right' | 'bottom' | 'left',
  ): { x: number; y: number } {
    switch (side) {
      case 'right': return { x: obs.x + obs.width, y: obs.y + obs.height / 2 };
      case 'left': return { x: obs.x, y: obs.y + obs.height / 2 };
      case 'top': return { x: obs.x + obs.width / 2, y: obs.y };
      case 'bottom': return { x: obs.x + obs.width / 2, y: obs.y + obs.height };
    }
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
      if (CONTAINER_COMPONENT_TYPES.has(node.type)) continue;
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
