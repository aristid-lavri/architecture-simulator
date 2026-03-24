import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GraphNode } from '@/types/graph';
import type { NodeStatus, ResourceUtilization } from '@/types';
import {
  NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS, NODE_BORDER_WIDTH,
  NODE_FONT_SIZE, NODE_PADDING, CONTAINER_COMPONENT_TYPES,
  NODE_COLORS, STATUS_COLORS, canvasTheme,
  RESIZE_HANDLE_SIZE, RESIZE_HANDLE_HIT_SIZE, RESIZE_MIN_WIDTH, RESIZE_MIN_HEIGHT,
  FOOTER_SEPARATOR_Y, FOOTER_GAUGES_Y, FOOTER_METRICS_Y_MINIMAL, FOOTER_METRICS_Y_GAUGES,
  FOOTER_METRICS_FONT_SIZE, getNodeHeight, hasFooterGauges as typeHasFooterGauges,
} from './constants';
import { getComponentRenderer } from './node-renderers/registry';
import type { NodeFooterMetrics } from './node-renderers/types';

// Zone icon (not delegated to component renderers)
const ZONE_ICON = '⬡';


// ============================================
// Node visual components
// ============================================
interface ResizeHandle {
  graphics: Graphics;
  corner: 'se' | 'sw' | 'ne' | 'nw';
}

interface NodeVisual {
  container: Container;
  bg: Graphics;
  signalBar: Graphics;
  separator: Graphics;
  headerIcon: Text;
  headerLabel: Text;
  contentLine1: Text;
  contentLine2: Text;
  // Toolbar (floating above node)
  toolbar: Container;
  toolbarBg: Graphics;
  statusDot: Graphics;
  cogIcon: Text;
  trashIcon: Text;
  gauges: Graphics;
  // Footer
  footerSeparator: Graphics;
  footerGauges: Graphics;
  footerGaugeLabel: Text;
  footerMetricsText: Text;
  footerSuccessText: Text;
  footerErrorText: Text;
  selectionGlow: Graphics;
  resizeHandles: ResizeHandle[];
  nodeId: string;
  isZone: boolean;
  currentStatus: NodeStatus;
  animationPhase: number;
}

/**
 * Renders all graph nodes in PixiJS with instrument-panel styling:
 * - Signal bar (left accent)
 * - Header: icon + label + status dot
 * - Subtitle (type-specific info)
 * - Resource gauges (CPU/MEM/NET bars)
 * - Selection glow
 * - Status animations (pulse, fade)
 */
export class NodeRenderer {
  private visuals: Map<string, NodeVisual> = new Map();
  private positions: Map<string, { x: number; y: number }> = new Map();
  private resourceUtils: Map<string, ResourceUtilization> = new Map();
  private footerMetrics: Map<string, NodeFooterMetrics> = new Map();
  private animationTicker: ReturnType<typeof setInterval> | null = null;

  // Callbacks set by PixiCanvas
  onNodePointerDown: ((nodeId: string, event: PointerEvent) => void) | null = null;
  onNodePointerMove: ((event: PointerEvent) => void) | null = null;
  onNodePointerUp: ((event: PointerEvent) => void) | null = null;
  onNodeRightClick: ((nodeId: string, event: PointerEvent) => void) | null = null;
  onNodeHover: ((nodeId: string | null) => void) | null = null;
  onCogClick: ((nodeId: string) => void) | null = null;
  onDeleteClick: ((nodeId: string) => void) | null = null;
  onResizeStart: ((nodeId: string, corner: string, event: PointerEvent) => void) | null = null;
  onResizeMove: ((event: PointerEvent) => void) | null = null;
  onResizeEnd: ((event: PointerEvent) => void) | null = null;

  // Resize state
  private resizing = false;
  private resizeNodeId: string | null = null;
  private resizeCorner: string | null = null;
  private resizeStartSize: { w: number; h: number } | null = null;
  private resizeStartPos: { x: number; y: number } | null = null;
  private resizeStartWorldPos: { x: number; y: number } | null = null;

  // Bound listeners for cleanup
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor(
    private nodeLayer: Container,
    private zoneLayer: Container,
    private handleLayer: Container,
  ) {
    // Global pointermove/pointerup for drag and resize
    this.boundPointerMove = (e: PointerEvent) => {
      if (this.resizing) {
        this.onResizeMove?.(e);
      } else {
        this.onNodePointerMove?.(e);
      }
    };
    this.boundPointerUp = (e: PointerEvent) => {
      if (this.resizing) {
        this.onResizeEnd?.(e);
        this.resizing = false;
        this.resizeNodeId = null;
        this.resizeCorner = null;
        this.resizeStartSize = null;
        this.resizeStartPos = null;
        this.resizeStartWorldPos = null;
      } else {
        this.onNodePointerUp?.(e);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', this.boundPointerMove);
      window.addEventListener('pointerup', this.boundPointerUp);
    }

    // Animation ticker for status pulses (every 50ms)
    this.animationTicker = setInterval(() => this.tickAnimations(), 50);
  }

  renderNodes(nodes: GraphNode[], selectedId: string | null): void {
    const existingIds = new Set(nodes.map((n) => n.id));

    // Remove visuals for deleted nodes
    for (const [id, visual] of this.visuals) {
      if (!existingIds.has(id)) {
        visual.container.destroy({ children: true });
        this.visuals.delete(id);
        this.positions.delete(id);
      }
    }

    // Build node map for parentId chain lookups
    const nodeMap = new Map<string, GraphNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Create or update visuals for each node
    for (const node of nodes) {
      const isZone = CONTAINER_COMPONENT_TYPES.has(node.type);
      let visual = this.visuals.get(node.id);

      if (!visual) {
        visual = this.createNodeVisual(node, isZone);
        this.visuals.set(node.id, visual);
      }

      // Compute absolute position by walking parentId chain
      const absPos = this.getAbsolutePosition(node, nodeMap);
      this.updateNodeVisual(visual, node, node.id === selectedId, absPos);
      this.positions.set(node.id, absPos);
    }
  }

  private getAbsolutePosition(node: GraphNode, nodeMap: Map<string, GraphNode>): { x: number; y: number } {
    let x = node.position.x;
    let y = node.position.y;
    let current = node;
    while (current.parentId) {
      const parent = nodeMap.get(current.parentId);
      if (!parent) break;
      x += parent.position.x;
      y += parent.position.y;
      current = parent;
    }
    return { x, y };
  }

  private createNodeVisual(node: GraphNode, isZone: boolean): NodeVisual {
    const container = new Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';

    const selectionGlow = new Graphics();
    const bg = new Graphics();
    const signalBar = new Graphics();
    const separator = new Graphics();
    const gauges = new Graphics();
    const footerSeparator = new Graphics();
    const footerGauges = new Graphics();
    const footerGaugeLabel = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 7,
        fill: 0x888888,
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontWeight: '600',
        letterSpacing: 0.5,
      }),
    });
    const footerMetricsText = new Text({
      text: '',
      style: new TextStyle({
        fontSize: FOOTER_METRICS_FONT_SIZE,
        fill: 0x666666,
        fontFamily: '"SF Mono", "Fira Code", monospace',
      }),
    });
    const footerSuccessText = new Text({
      text: '',
      style: new TextStyle({
        fontSize: FOOTER_METRICS_FONT_SIZE,
        fill: 0x22c55e,
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontWeight: '600',
      }),
    });
    const footerErrorText = new Text({
      text: '',
      style: new TextStyle({
        fontSize: FOOTER_METRICS_FONT_SIZE,
        fill: 0xef4444,
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontWeight: '600',
      }),
    });

    const headerIcon = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 14,
        fill: 0xffffff,
        fontFamily: 'system-ui, sans-serif',
      }),
    });

    const headerLabel = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 9,
        fill: 0x888888,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '600',
        letterSpacing: 1,
      }),
    });

    const contentLine1 = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 10,
        fill: 0xcccccc,
        fontFamily: '"SF Mono", "Fira Code", monospace',
      }),
    });
    const contentLine2 = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 9,
        fill: 0x888888,
        fontFamily: '"SF Mono", "Fira Code", monospace',
      }),
    });

    // ── Toolbar (floating above node: [status dot] [cog]) ──
    const toolbar = new Container();
    toolbar.eventMode = 'static';
    const toolbarBg = new Graphics();
    const statusDot = new Graphics();
    const cogIcon = new Text({
      text: '⚙',
      style: new TextStyle({
        fontSize: 11,
        fill: canvasTheme().cogIconColor,
        fontFamily: 'system-ui, sans-serif',
      }),
    });
    cogIcon.eventMode = 'static';
    cogIcon.cursor = 'pointer';
    cogIcon.on('pointerdown', (e) => {
      e.stopPropagation();
      this.onCogClick?.(node.id);
    });
    cogIcon.on('pointerover', () => { cogIcon.style.fill = canvasTheme().cogIconHoverColor; });
    cogIcon.on('pointerout', () => { cogIcon.style.fill = canvasTheme().cogIconColor; });

    const trashIcon = new Text({
      text: '🗑',
      style: new TextStyle({
        fontSize: 10,
        fill: 0xcc3333,
        fontFamily: 'system-ui, sans-serif',
      }),
    });
    trashIcon.eventMode = 'static';
    trashIcon.cursor = 'pointer';
    trashIcon.on('pointerdown', (e) => {
      e.stopPropagation();
      this.onDeleteClick?.(node.id);
    });
    trashIcon.on('pointerover', () => { trashIcon.style.fill = 0xff4444; });
    trashIcon.on('pointerout', () => { trashIcon.style.fill = 0xcc3333; });

    toolbar.addChild(toolbarBg, statusDot, cogIcon, trashIcon);
    container.addChild(selectionGlow, bg, signalBar, separator, headerIcon, headerLabel, contentLine1, contentLine2, gauges, footerSeparator, footerGauges, footerGaugeLabel, footerMetricsText, footerSuccessText, footerErrorText, toolbar);

    // Create resize handles for all node types (functional resize for zones, visual indicator for others)
    const resizeHandles: ResizeHandle[] = [];
    const corners: Array<'se' | 'sw' | 'ne' | 'nw'> = ['se', 'sw', 'ne', 'nw'];
    for (const corner of corners) {
      const g = new Graphics();
      g.visible = false;

      if (isZone) {
        g.eventMode = 'static';
        g.cursor = corner === 'se' || corner === 'nw' ? 'nwse-resize' : 'nesw-resize';
        g.hitArea = {
          contains: (x: number, y: number) =>
            Math.abs(x) <= RESIZE_HANDLE_HIT_SIZE / 2 && Math.abs(y) <= RESIZE_HANDLE_HIT_SIZE / 2,
        };
        g.on('pointerdown', (e) => {
          e.stopPropagation();
          this.resizing = true;
          this.resizeNodeId = node.id;
          this.resizeCorner = corner;
          this.onResizeStart?.(node.id, corner, e.nativeEvent as PointerEvent);
        });
      } else {
        g.eventMode = 'none'; // visual indicator only, no resize interaction
      }

      container.addChild(g);
      resizeHandles.push({ graphics: g, corner });
    }

    // Add to appropriate layer
    if (isZone) {
      this.zoneLayer.addChild(container);
    } else {
      this.nodeLayer.addChild(container);
    }

    // Interaction events
    container.on('pointerdown', (e) => {
      if (e.button === 2) {
        this.onNodeRightClick?.(node.id, e.nativeEvent as PointerEvent);
      } else {
        this.onNodePointerDown?.(node.id, e.nativeEvent as PointerEvent);
      }
    });
    container.on('rightclick', (e) => {
      e.preventDefault?.();
      this.onNodeRightClick?.(node.id, e.nativeEvent as PointerEvent);
    });

    // Hover effect
    container.on('pointerover', () => {
      if (!isZone) {
        container.scale.set(1.02);
      }
      this.onNodeHover?.(node.id);
    });
    container.on('pointerout', () => {
      container.scale.set(1);
      this.onNodeHover?.(null);
    });

    return {
      container, bg, signalBar, separator, headerIcon, headerLabel, contentLine1,
      contentLine2, toolbar, toolbarBg, statusDot, cogIcon, trashIcon, gauges,
      footerSeparator, footerGauges, footerGaugeLabel, footerMetricsText,
      footerSuccessText, footerErrorText,
      selectionGlow, resizeHandles, nodeId: node.id, isZone,
      currentStatus: 'idle', animationPhase: 0,
    };
  }

  private updateNodeVisual(visual: NodeVisual, node: GraphNode, isSelected: boolean, absPos?: { x: number; y: number }): void {
    const theme = canvasTheme();
    const colors = theme.nodeColors[node.type] ?? { bg: 0xffffff, border: 0x555555, text: 0x333333 };
    const w = node.width ?? NODE_WIDTH;
    const h = node.height ?? (visual.isZone ? NODE_HEIGHT : getNodeHeight(node.type));
    const dataLabel = (node.data?.label as string) ?? node.type;
    const status: NodeStatus = (node.data?.status as NodeStatus) ?? 'idle';
    const isDown = status === 'down';
    const isDegraded = status === 'degraded';

    visual.currentStatus = status;
    const displayPos = absPos ?? node.position;
    visual.container.position.set(displayPos.x, displayPos.y);

    // ── Selection glow ──
    visual.selectionGlow.clear();
    if (isSelected) {
      visual.selectionGlow.roundRect(-3, -3, w + 6, h + 6, NODE_RADIUS + 2);
      visual.selectionGlow.fill({ color: 0x6366f1, alpha: 0.15 });
      visual.selectionGlow.roundRect(-3, -3, w + 6, h + 6, NODE_RADIUS + 2);
      visual.selectionGlow.stroke({ width: 2, color: 0x6366f1, alpha: 0.7 });
    }

    // ── Background ──
    visual.bg.clear();
    if (visual.isZone) {
      // Zone: subtle fill + dashed-look border
      visual.bg.roundRect(0, 0, w, h, NODE_RADIUS);
      visual.bg.fill({ color: colors.bg, alpha: 0.2 });
      // Draw dashed border segments
      this.drawDashedRect(visual.bg, 0, 0, w, h, NODE_RADIUS, {
        color: isDown ? 0xef4444 : isDegraded ? 0xf97316 : colors.border,
        alpha: 0.5,
        width: 1.5,
        dash: 8,
        gap: 4,
      });
    } else {
      // Regular node: solid fill
      visual.bg.roundRect(0, 0, w, h, NODE_RADIUS);
      visual.bg.fill({ color: colors.bg, alpha: theme.nodeBgAlpha });
      visual.bg.roundRect(0, 0, w, h, NODE_RADIUS);
      visual.bg.stroke({
        width: isSelected ? 2 : NODE_BORDER_WIDTH,
        color: isDown ? 0xef4444 : isDegraded ? 0xf97316 : (isSelected ? 0x6366f1 : colors.border),
        alpha: isDown || isDegraded ? 0.8 : 0.6,
      });
    }

    // ── Signal bar (left accent, regular nodes only) ──
    visual.signalBar.clear();
    if (!visual.isZone) {
      const barColor = isDown ? 0xef4444 : isDegraded ? 0xf97316 : colors.border;
      visual.signalBar.roundRect(0, 4, 2, h - 8, 1);
      visual.signalBar.fill(barColor);
    }

    // ── Header icon (from per-type renderer) ──
    const renderer = getComponentRenderer(node.type);
    const icon = visual.isZone ? ZONE_ICON : renderer.icon;
    visual.headerIcon.text = isDown ? '✕' : isDegraded ? '⚠' : icon;
    visual.headerIcon.style.fill = isDown ? 0xef4444 : isDegraded ? 0xf97316 : colors.border;
    visual.headerIcon.style.fontSize = visual.isZone ? 12 : 14;
    visual.headerIcon.position.set(
      visual.isZone ? NODE_PADDING : NODE_PADDING + 4,
      visual.isZone ? 6 : 10,
    );

    // ── Header label ──
    visual.headerLabel.text = dataLabel.toUpperCase();
    visual.headerLabel.style.fill = isDown ? theme.errorLabelColor : isDegraded ? theme.degradedLabelColor : colors.text;
    visual.headerLabel.style.fontSize = 9;
    const iconWidth = visual.isZone ? 14 : 18;
    visual.headerLabel.position.set(
      (visual.isZone ? NODE_PADDING : NODE_PADDING + 4) + iconWidth + 4,
      visual.isZone ? 8 : 12,
    );
    // Truncate label to fit
    const maxLabelWidth = w - NODE_PADDING * 2 - iconWidth - 20;
    if (visual.headerLabel.width > maxLabelWidth) {
      visual.headerLabel.scale.x = maxLabelWidth / visual.headerLabel.width;
    } else {
      visual.headerLabel.scale.x = 1;
    }

    // ── Separator line (between header and content) ──
    visual.separator.clear();
    if (!visual.isZone) {
      visual.separator.moveTo(NODE_PADDING + 4, 27);
      visual.separator.lineTo(w - NODE_PADDING - 4, 27);
      visual.separator.stroke({ width: 1, color: theme.separatorColor, alpha: theme.separatorAlpha });
    }

    // ── Content lines (delegated to per-type renderer) ──
    const lines = renderer.getContentLines((node.data ?? {}) as Record<string, unknown>);
    visual.contentLine1.visible = lines.length > 0 && !visual.isZone;
    visual.contentLine2.visible = lines.length > 1 && !visual.isZone;

    if (lines.length > 0 && !visual.isZone) {
      visual.contentLine1.text = lines[0];
      visual.contentLine1.style.fill = theme.contentLine1Color;
      visual.contentLine1.position.set(NODE_PADDING + 4, 32);
      const maxW = w - NODE_PADDING * 2 - 8;
      visual.contentLine1.scale.x = visual.contentLine1.width > maxW ? maxW / visual.contentLine1.width : 1;
    }
    if (lines.length > 1 && !visual.isZone) {
      visual.contentLine2.text = lines[1];
      visual.contentLine2.style.fill = theme.contentLine2Color;
      visual.contentLine2.position.set(NODE_PADDING + 4, 45);
      const maxW = w - NODE_PADDING * 2 - 8;
      visual.contentLine2.scale.x = visual.contentLine2.width > maxW ? maxW / visual.contentLine2.width : 1;
    }

    // ── Type-specific gauges (delegated) ──
    if (renderer.drawGauges && !visual.isZone) {
      const gaugeY = lines.length > 1 ? 58 : lines.length > 0 ? 48 : 32;
      renderer.drawGauges(visual.gauges, (node.data ?? {}) as Record<string, unknown>, NODE_PADDING + 4, gaugeY, w - NODE_PADDING * 2);
    }

    // ── Toolbar (floating above node, right-aligned) ──
    visual.toolbar.visible = !visual.isZone;
    if (!visual.isZone) {
      const tbW = 52;  // toolbar width (status dot + cog + trash)
      const tbH = 16;  // toolbar height
      const tbX = w - tbW; // right-aligned
      const tbY = -tbH - 3; // above the node with 3px gap

      visual.toolbar.position.set(tbX, tbY);

      // Toolbar background pill
      visual.toolbarBg.clear();
      visual.toolbarBg.roundRect(0, 0, tbW, tbH, 3);
      visual.toolbarBg.fill({ color: theme.toolbarBg, alpha: 0.95 });
      visual.toolbarBg.roundRect(0, 0, tbW, tbH, 3);
      visual.toolbarBg.stroke({ width: 1, color: colors.border, alpha: 0.4 });

      // Status dot (left side of toolbar)
      const dotColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
      visual.statusDot.clear();
      visual.statusDot.circle(10, tbH / 2, 3);
      visual.statusDot.fill({ color: dotColor, alpha: status === 'idle' ? 0.4 : 1 });

      // Cog icon (middle of toolbar)
      visual.cogIcon.position.set(20, 1);

      // Trash icon (right side of toolbar)
      visual.trashIcon.position.set(36, 1);
    }

    // ── Footer (separator + optional gauges + minimal metrics) ──
    this.drawFooter(visual, node, w);

    // ── Resize handles (all node types when selected) ──
    if (visual.resizeHandles.length > 0) {
      const showHandles = isSelected;
      for (const rh of visual.resizeHandles) {
        rh.graphics.visible = showHandles;
        if (!showHandles) continue;

        rh.graphics.clear();
        const hs = RESIZE_HANDLE_SIZE;

        // Position relative to node corners
        let hx = 0, hy = 0;
        switch (rh.corner) {
          case 'se': hx = w; hy = h; break;
          case 'sw': hx = 0; hy = h; break;
          case 'ne': hx = w; hy = 0; break;
          case 'nw': hx = 0; hy = 0; break;
        }
        rh.graphics.position.set(hx, hy);

        // Draw handle visual
        rh.graphics.roundRect(-hs / 2, -hs / 2, hs, hs, 1);
        rh.graphics.fill({ color: theme.resizeHandleBg, alpha: 0.95 });
        rh.graphics.roundRect(-hs / 2, -hs / 2, hs, hs, 1);
        rh.graphics.stroke({ width: 1.5, color: 0x6366f1, alpha: 0.8 });
        // Inner dot
        rh.graphics.circle(0, 0, 1.5);
        rh.graphics.fill({ color: 0x6366f1, alpha: 0.9 });
      }
    }
  }

  private drawFooter(visual: NodeVisual, node: GraphNode, w: number): void {
    visual.footerSeparator.clear();
    visual.footerGauges.clear();
    visual.footerMetricsText.visible = false;
    visual.footerSuccessText.visible = false;
    visual.footerErrorText.visible = false;
    visual.footerGaugeLabel.visible = false;
    if (visual.isZone) return;

    const x = NODE_PADDING + 4;
    const barW = w - NODE_PADDING * 2 - 8;
    const hasGauges = typeHasFooterGauges(node.type);
    const metrics = this.footerMetrics.get(node.id);

    // Footer separator line
    const theme = canvasTheme();
    visual.footerSeparator.moveTo(x, FOOTER_SEPARATOR_Y);
    visual.footerSeparator.lineTo(x + barW, FOOTER_SEPARATOR_Y);
    visual.footerSeparator.stroke({ width: 1, color: theme.separatorColor, alpha: theme.separatorAlpha });

    // Type-specific footer gauges (CPU/MEM, hit ratio, pool, etc.)
    // Always draw gauges for gauged types, even without simulation metrics
    if (hasGauges) {
      const defaultMetrics = metrics ?? { requestsIn: 0, requestsOut: 0, successCount: 0, errorCount: 0 };
      const renderer = getComponentRenderer(node.type);
      renderer.drawFooterGauges?.(visual.footerGauges, defaultMetrics, x, FOOTER_GAUGES_Y, barW);

      // Show CPU/MEM labels above gauge bars for types with resource gauges
      const hasCpuMem = node.type === 'http-server' || node.type === 'api-gateway'
        || node.type === 'api-service' || node.type === 'background-job';
      if (hasCpuMem) {
        const cpuPct = Math.round(defaultMetrics.cpu ?? 0);
        const memPct = Math.round(defaultMetrics.memory ?? 0);
        visual.footerGaugeLabel.text = `CPU ${cpuPct}%          MEM ${memPct}%`;
        visual.footerGaugeLabel.style.fill = theme.footerMetricsColor;
        visual.footerGaugeLabel.position.set(x, FOOTER_GAUGES_Y - 8);
        visual.footerGaugeLabel.visible = true;
        // Scale to fit
        visual.footerGaugeLabel.scale.x = visual.footerGaugeLabel.width > barW ? barW / visual.footerGaugeLabel.width : 1;
      }
    }

    // Metrics line with explicit labels: REQ, RES, SUC (green), ERR (red)
    const metricsY = hasGauges ? FOOTER_METRICS_Y_GAUGES : FOOTER_METRICS_Y_MINIMAL;
    const m = metrics ?? { requestsIn: 0, requestsOut: 0, successCount: 0, errorCount: 0 };

    // Connected services count for LB/gateway
    const svcSuffix = (node.type === 'load-balancer' || node.type === 'api-gateway')
      && m.connectedServices != null && m.connectedServices > 0
      ? `  ▸${m.connectedServices}svc` : '';

    // Part 1: REQ/RES in default color
    visual.footerMetricsText.text = `REQ:${m.requestsIn} RES:${m.requestsOut}${svcSuffix}`;
    visual.footerMetricsText.style.fill = theme.footerMetricsColor;
    visual.footerMetricsText.position.set(x, metricsY);
    visual.footerMetricsText.visible = true;
    visual.footerMetricsText.scale.x = 1;

    // Part 2: SUC in green
    const sucX = x + visual.footerMetricsText.width + 4;
    visual.footerSuccessText.text = `SUC:${m.successCount}`;
    visual.footerSuccessText.style.fill = 0x22c55e;
    visual.footerSuccessText.position.set(sucX, metricsY);
    visual.footerSuccessText.visible = true;
    visual.footerSuccessText.scale.x = 1;

    // Part 3: ERR in red
    const errX = sucX + visual.footerSuccessText.width + 4;
    visual.footerErrorText.text = `ERR:${m.errorCount}`;
    visual.footerErrorText.style.fill = m.errorCount > 0 ? 0xef4444 : theme.footerMetricsColor;
    visual.footerErrorText.position.set(errX, metricsY);
    visual.footerErrorText.visible = true;
    visual.footerErrorText.scale.x = 1;

    // Scale all metrics texts to fit if they overflow
    const totalW = (errX - x) + visual.footerErrorText.width;
    if (totalW > barW) {
      const scale = barW / totalW;
      visual.footerMetricsText.scale.x = scale;
      visual.footerSuccessText.scale.x = scale;
      visual.footerErrorText.scale.x = scale;
      // Reposition after scaling
      const sucXScaled = x + visual.footerMetricsText.width * scale + 4 * scale;
      visual.footerSuccessText.position.x = sucXScaled;
      const errXScaled = sucXScaled + visual.footerSuccessText.width * scale + 4 * scale;
      visual.footerErrorText.position.x = errXScaled;
    }
  }

  /** Update footer metrics for a specific node (called from PixiCanvas) */
  updateFooterMetrics(nodeId: string, metrics: NodeFooterMetrics): void {
    this.footerMetrics.set(nodeId, metrics);
  }

  private drawDashedRect(
    g: Graphics, x: number, y: number, w: number, h: number, r: number,
    opts: { color: number; alpha: number; width: number; dash: number; gap: number },
  ): void {
    g.setStrokeStyle({ width: opts.width, color: opts.color, alpha: opts.alpha });

    // Draw dashed lines along each side
    const sides = [
      { x1: x + r, y1: y, x2: x + w - r, y2: y },         // top
      { x1: x + w, y1: y + r, x2: x + w, y2: y + h - r }, // right
      { x1: x + w - r, y1: y + h, x2: x + r, y2: y + h }, // bottom
      { x1: x, y1: y + h - r, x2: x, y2: y + r },         // left
    ];

    for (const side of sides) {
      const dx = side.x2 - side.x1;
      const dy = side.y2 - side.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / len;
      const ny = dy / len;
      let pos = 0;
      let drawing = true;

      while (pos < len) {
        const segLen = drawing ? opts.dash : opts.gap;
        const endPos = Math.min(pos + segLen, len);

        if (drawing) {
          g.moveTo(side.x1 + nx * pos, side.y1 + ny * pos);
          g.lineTo(side.x1 + nx * endPos, side.y1 + ny * endPos);
        }
        pos = endPos;
        drawing = !drawing;
      }
    }
    g.stroke();
  }

  // ============================================
  // Status animations (called every 50ms)
  // ============================================
  private tickAnimations(): void {
    for (const visual of this.visuals.values()) {
      if (visual.isZone) continue;

      visual.animationPhase += 0.05;
      const status = visual.currentStatus;

      if (status === 'processing') {
        // Gentle pulse on the signal bar
        const pulse = 0.6 + 0.4 * Math.sin(visual.animationPhase * 4);
        visual.signalBar.alpha = pulse;
        visual.statusDot.alpha = pulse;
      } else if (status === 'down') {
        // Slow blink
        const blink = 0.4 + 0.6 * Math.sin(visual.animationPhase * 2);
        visual.container.alpha = blink;
      } else if (status === 'degraded') {
        // Gentle fade
        const fade = 0.7 + 0.3 * Math.sin(visual.animationPhase * 1.5);
        visual.container.alpha = fade;
      } else {
        // Reset
        visual.signalBar.alpha = 1;
        visual.statusDot.alpha = 1;
        visual.container.alpha = 1;
      }
    }
  }

  // ============================================
  // Runtime updates
  // ============================================

  updateStatuses(nodeStates: Map<string, { status: NodeStatus }>): void {
    for (const [nodeId, state] of nodeStates) {
      const visual = this.visuals.get(nodeId);
      if (!visual) continue;
      visual.currentStatus = state.status;

      // Update status dot color in toolbar
      const dotColor = STATUS_COLORS[state.status] ?? STATUS_COLORS.idle;
      visual.statusDot.clear();
      if (!visual.isZone) {
        visual.statusDot.circle(10, 8, 3);
        visual.statusDot.fill({ color: dotColor, alpha: state.status === 'idle' ? 0.4 : 1 });
      }
    }
  }

  updateResourceUtilization(nodeId: string, util: ResourceUtilization): void {
    this.resourceUtils.set(nodeId, util);
    // Resource utilization is now shown via footer gauges — update footer metrics
    const existing = this.footerMetrics.get(nodeId) ?? { requestsIn: 0, requestsOut: 0, successCount: 0, errorCount: 0 };
    existing.cpu = util.cpu;
    existing.memory = util.memory;
    this.footerMetrics.set(nodeId, existing);
  }

  moveNode(nodeId: string, x: number, y: number): void {
    const visual = this.visuals.get(nodeId);
    if (visual) {
      visual.container.position.set(x, y);
      this.positions.set(nodeId, { x, y });
    }
  }

  getNodePosition(nodeId: string): { x: number; y: number } | undefined {
    return this.positions.get(nodeId);
  }

  /**
   * Apply heatmap tinting to nodes based on bottleneck analysis.
   * Higher saturation nodes get a warm (red/orange) tint overlay.
   */
  updateHeatmap(heatmapData: { nodeId: string; heatmapLevel: number; rank: number; isSpof: boolean }[]): void {
    // Reset all tints first
    for (const visual of this.visuals.values()) {
      visual.bg.tint = 0xffffff;
    }

    for (const entry of heatmapData) {
      const visual = this.visuals.get(entry.nodeId);
      if (!visual || visual.isZone) continue;

      // Tint based on heatmap level (0=cool, 5=hot)
      const level = Math.min(5, entry.heatmapLevel);
      if (level >= 4) {
        visual.bg.tint = 0xff6666; // hot red
      } else if (level >= 3) {
        visual.bg.tint = 0xffaa66; // orange
      } else if (level >= 2) {
        visual.bg.tint = 0xffdd88; // warm yellow
      }
      // level 0-1: no tint (cool)
    }
  }

  // ============================================
  // Resize API
  // ============================================

  get isResizing(): boolean {
    return this.resizing;
  }

  getResizeNodeId(): string | null {
    return this.resizeNodeId;
  }

  getResizeCorner(): string | null {
    return this.resizeCorner;
  }

  startResize(nodeId: string, corner: string, worldX: number, worldY: number, nodeW: number, nodeH: number, nodeX: number, nodeY: number): void {
    this.resizing = true;
    this.resizeNodeId = nodeId;
    this.resizeCorner = corner;
    this.resizeStartSize = { w: nodeW, h: nodeH };
    this.resizeStartPos = { x: nodeX, y: nodeY };
    this.resizeStartWorldPos = { x: worldX, y: worldY };
  }

  computeResize(worldX: number, worldY: number): { x: number; y: number; w: number; h: number } | null {
    if (!this.resizeStartSize || !this.resizeStartWorldPos || !this.resizeStartPos || !this.resizeCorner) return null;

    const dx = worldX - this.resizeStartWorldPos.x;
    const dy = worldY - this.resizeStartWorldPos.y;
    let { w, h } = this.resizeStartSize;
    let { x, y } = this.resizeStartPos;

    switch (this.resizeCorner) {
      case 'se':
        w = Math.max(RESIZE_MIN_WIDTH, this.resizeStartSize.w + dx);
        h = Math.max(RESIZE_MIN_HEIGHT, this.resizeStartSize.h + dy);
        break;
      case 'sw':
        w = Math.max(RESIZE_MIN_WIDTH, this.resizeStartSize.w - dx);
        h = Math.max(RESIZE_MIN_HEIGHT, this.resizeStartSize.h + dy);
        x = this.resizeStartPos.x + this.resizeStartSize.w - w;
        break;
      case 'ne':
        w = Math.max(RESIZE_MIN_WIDTH, this.resizeStartSize.w + dx);
        h = Math.max(RESIZE_MIN_HEIGHT, this.resizeStartSize.h - dy);
        y = this.resizeStartPos.y + this.resizeStartSize.h - h;
        break;
      case 'nw':
        w = Math.max(RESIZE_MIN_WIDTH, this.resizeStartSize.w - dx);
        h = Math.max(RESIZE_MIN_HEIGHT, this.resizeStartSize.h - dy);
        x = this.resizeStartPos.x + this.resizeStartSize.w - w;
        y = this.resizeStartPos.y + this.resizeStartSize.h - h;
        break;
    }

    return { x, y, w, h };
  }

  /**
   * Live-update the node visual during resize (before committing to store).
   */
  resizeNodeVisual(nodeId: string, x: number, y: number, w: number, h: number): void {
    const visual = this.visuals.get(nodeId);
    if (!visual) return;
    visual.container.position.set(x, y);
    this.positions.set(nodeId, { x, y });

    // Redraw background with new size
    const colors = canvasTheme().nodeColors[visual.isZone ? 'network-zone' : 'http-server'] ?? { bg: 0xffffff, border: 0x555555 };
    visual.bg.clear();
    visual.bg.roundRect(0, 0, w, h, NODE_RADIUS);
    visual.bg.fill({ color: colors.bg, alpha: 0.2 });
    this.drawDashedRect(visual.bg, 0, 0, w, h, NODE_RADIUS, {
      color: colors.border, alpha: 0.5, width: 1.5, dash: 8, gap: 4,
    });

    // Update selection glow
    visual.selectionGlow.clear();
    visual.selectionGlow.roundRect(-3, -3, w + 6, h + 6, NODE_RADIUS + 2);
    visual.selectionGlow.fill({ color: 0x6366f1, alpha: 0.15 });
    visual.selectionGlow.roundRect(-3, -3, w + 6, h + 6, NODE_RADIUS + 2);
    visual.selectionGlow.stroke({ width: 2, color: 0x6366f1, alpha: 0.7 });

    // Reposition resize handles
    for (const rh of visual.resizeHandles) {
      rh.graphics.visible = true;
      rh.graphics.clear();
      const hs = RESIZE_HANDLE_SIZE;
      let hx = 0, hy = 0;
      switch (rh.corner) {
        case 'se': hx = w; hy = h; break;
        case 'sw': hx = 0; hy = h; break;
        case 'ne': hx = w; hy = 0; break;
        case 'nw': hx = 0; hy = 0; break;
      }
      rh.graphics.position.set(hx, hy);
      rh.graphics.roundRect(-hs / 2, -hs / 2, hs, hs, 1);
      rh.graphics.fill({ color: 0x1a1a2e, alpha: 0.95 });
      rh.graphics.roundRect(-hs / 2, -hs / 2, hs, hs, 1);
      rh.graphics.stroke({ width: 1.5, color: 0x6366f1, alpha: 0.8 });
      rh.graphics.circle(0, 0, 1.5);
      rh.graphics.fill({ color: 0x6366f1, alpha: 0.9 });
    }
  }

  destroy(): void {
    if (this.animationTicker) clearInterval(this.animationTicker);
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.boundPointerMove);
      window.removeEventListener('pointerup', this.boundPointerUp);
    }
    for (const visual of this.visuals.values()) {
      visual.container.destroy({ children: true });
    }
    this.visuals.clear();
    this.positions.clear();
  }
}
