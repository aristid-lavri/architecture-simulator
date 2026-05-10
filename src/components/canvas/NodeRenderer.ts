import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { getIconTexture } from './IconRegistry';
import { nodeRendererRegistry } from '@/plugins/extensions';
import { pluginRegistry } from '@/plugins/plugin-registry';
import { useArchitectureStore } from '@/store/architecture-store';
import type { GraphNode } from '@/types/graph';
import type { ComponentType, NodeStatus, ResourceUtilization } from '@/types';
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

/**
 * Résout un `typeTag` plugin (string statique OU fonction qui lit `node.data`)
 * en string. Utilisé par le variant `strict` pour afficher `[Person]`,
 * `Component: Repository`, etc.
 */
function resolveTypeTag(
  tag: string | ((data: Record<string, unknown>) => string) | undefined,
  data: Record<string, unknown>,
): string {
  if (!tag) return '';
  if (typeof tag === 'string') return tag;
  try {
    return tag(data);
  } catch {
    return '';
  }
}


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
  headerIcon: Sprite;       // Icône lucide (mode normal)
  headerStatusIcon: Text;   // Glyphe Unicode pour zones (⬡) et états down/degraded (✕/⚠)
  headerLabel: Text;
  contentLine1: Text;
  contentLine2: Text;
  // Toolbar (floating above node)
  toolbar: Container;
  toolbarBg: Graphics;
  statusDot: Graphics;
  chaosIcon: Text;
  cogIcon: Text;
  trashIcon: Text;
  collapseIcon: Text;
  gauges: Graphics;
  // Footer
  footerSeparator: Graphics;
  footerGauges: Graphics;
  footerGaugeLabel: Text;
  footerMetricsText: Text;
  footerSuccessText: Text;
  footerErrorText: Text;
  selectionGlow: Graphics;
  // Corner tag (apporté par les hints de plugin via nodeRendererRegistry, ex: "EXT", "L1", "L3").
  cornerTagBg: Graphics;
  cornerTagText: Text;
  // Secondary badge (haut-GAUCHE) : indicateurs additifs injectés par plugins (ex: "⚡", "📡").
  // Distinct du cornerTag (haut-DROIT) pour ne pas concurrencer le tag de niveau.
  secondaryBadgeBg: Graphics;
  secondaryBadgeText: Text;
  // Detail indicator (haut-DROIT, juste sous le cornerTag) : signal "has-detail" indiquant
  // qu'un drill-down est disponible (ex: c4-software-system avec containers enfants). D4.3.
  detailIndicatorText: Text;
  resizeHandles: ResizeHandle[];
  nodeId: string;
  nodeType: GraphNode['type'];
  nodeWidth: number;
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

  // Toggled par PixiCanvas selon le mode (l'icône chaos ne s'affiche qu'en simulation)
  chaosEnabled = false;

  // Callbacks set by PixiCanvas
  onNodePointerDown: ((nodeId: string, event: PointerEvent) => void) | null = null;
  onNodePointerMove: ((event: PointerEvent) => void) | null = null;
  onNodePointerUp: ((event: PointerEvent) => void) | null = null;
  onNodeRightClick: ((nodeId: string, event: PointerEvent) => void) | null = null;
  onNodeDoubleClick: ((nodeId: string) => void) | null = null;
  onNodeHover: ((nodeId: string | null) => void) | null = null;
  onCogClick: ((nodeId: string) => void) | null = null;
  onChaosClick: ((nodeId: string, screenX: number, screenY: number) => void) | null = null;
  onDeleteClick: ((nodeId: string) => void) | null = null;
  onCollapseClick: ((nodeId: string) => void) | null = null;
  onResizeStart: ((nodeId: string, corner: string, event: PointerEvent) => void) | null = null;
  onResizeMove: ((event: PointerEvent) => void) | null = null;
  onResizeEnd: ((event: PointerEvent) => void) | null = null;

  // Détection de double-clic : on stocke le timestamp du dernier tap par nœud.
  private lastTapPerNode: Map<string, number> = new Map();
  /** Délai max (ms) entre deux taps pour déclencher un double-clic. */
  static readonly DOUBLE_CLICK_DELAY_MS = 350;

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
      const isZone = CONTAINER_COMPONENT_TYPES.has(node.type as ComponentType);
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

    // Icône lucide rendue en Sprite (texture pré-générée par IconRegistry)
    // Dimensions assignées dans updateNodeVisual après le set texture
    const headerIcon = new Sprite(Texture.EMPTY);
    headerIcon.visible = false;

    // Fallback Text pour zones (⬡) et états down/degraded (✕/⚠)
    const headerStatusIcon = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 14,
        fill: 0xffffff,
        fontFamily: 'system-ui, sans-serif',
      }),
    });
    headerStatusIcon.visible = false;

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

    const chaosIcon = new Text({
      text: '⚡',
      style: new TextStyle({
        fontSize: 11,
        fill: 0xff9933,
        fontFamily: 'system-ui, sans-serif',
      }),
    });
    chaosIcon.eventMode = 'static';
    chaosIcon.cursor = 'pointer';
    // Hit area explicite pour garantir un clic robuste (le glyphe ⚡ a un bbox étroit)
    chaosIcon.hitArea = { contains: (x: number, y: number) => x >= -2 && x <= 14 && y >= -2 && y <= 16 };
    chaosIcon.on('pointerdown', (e) => {
      e.stopPropagation();
      this.onChaosClick?.(node.id, e.clientX, e.clientY);
    });
    chaosIcon.on('pointerover', () => { chaosIcon.style.fill = 0xffaa55; });
    chaosIcon.on('pointerout', () => { chaosIcon.style.fill = 0xff9933; });

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

    // Collapse / expand toggle for container types (zone / host-server / container).
    // The glyph and visibility are set in updateNodeVisual based on `data.collapsed`.
    const collapseIcon = new Text({
      text: '−',
      style: new TextStyle({
        fontSize: 14,
        fill: 0x6b7280,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '700',
      }),
    });
    collapseIcon.eventMode = 'static';
    collapseIcon.cursor = 'pointer';
    collapseIcon.hitArea = { contains: (x: number, y: number) => x >= -2 && x <= 14 && y >= -2 && y <= 16 };
    collapseIcon.on('pointerdown', (e) => {
      e.stopPropagation();
      this.onCollapseClick?.(node.id);
    });
    collapseIcon.on('pointerover', () => { collapseIcon.style.fill = 0x111827; });
    collapseIcon.on('pointerout', () => { collapseIcon.style.fill = 0x6b7280; });

    // Corner tag (apporté par les hints de plugin via nodeRendererRegistry).
    // Reste invisible tant qu'aucun hint ne le requiert.
    const cornerTagBg = new Graphics();
    cornerTagBg.visible = false;
    const cornerTagText = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 8,
        fill: 0xffffff,
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontWeight: '700',
        letterSpacing: 1,
      }),
    });
    cornerTagText.visible = false;

    // Secondary badge (top-left). Distinct du cornerTag (top-right) ; sert aux plugins
    // pour injecter des indicateurs d'état runtime additifs (cascade ⚡, emitter 📡, etc.).
    const secondaryBadgeBg = new Graphics();
    secondaryBadgeBg.visible = false;
    const secondaryBadgeText = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 10,
        fill: 0xffffff,
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontWeight: '700',
      }),
    });
    secondaryBadgeText.visible = false;

    // Detail indicator (top-right, below cornerTag). Glyphe `◧` indiquant un drill-down
    // disponible — injecté via `hints.extra.hasDetail` (D4.3). Couleur violet signal-server,
    // cohérente avec l'edge L3.
    const detailIndicatorText = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 11,
        fill: 0x9a7ad9,
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontWeight: '700',
      }),
    });
    detailIndicatorText.visible = false;

    toolbar.addChild(toolbarBg, statusDot, chaosIcon, cogIcon, trashIcon, collapseIcon);
    container.addChild(
      selectionGlow, bg, signalBar, separator,
      headerIcon, headerStatusIcon, headerLabel,
      contentLine1, contentLine2, gauges,
      footerSeparator, footerGauges, footerGaugeLabel,
      footerMetricsText, footerSuccessText, footerErrorText,
      cornerTagBg, cornerTagText,
      secondaryBadgeBg, secondaryBadgeText,
      detailIndicatorText,
      toolbar,
    );

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

    // Détection de double-clic : deux taps consécutifs sur le même nœud,
    // dans un intervalle court.
    container.on('pointertap', () => {
      if (!this.onNodeDoubleClick) return;
      const now = performance.now();
      const last = this.lastTapPerNode.get(node.id) ?? 0;
      if (now - last <= NodeRenderer.DOUBLE_CLICK_DELAY_MS) {
        this.lastTapPerNode.delete(node.id);
        this.onNodeDoubleClick(node.id);
      } else {
        this.lastTapPerNode.set(node.id, now);
      }
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
      container, bg, signalBar, separator, headerIcon, headerStatusIcon, headerLabel, contentLine1,
      contentLine2, toolbar, toolbarBg, statusDot, chaosIcon, cogIcon, trashIcon, collapseIcon, gauges,
      footerSeparator, footerGauges, footerGaugeLabel, footerMetricsText,
      footerSuccessText, footerErrorText,
      selectionGlow, cornerTagBg, cornerTagText,
      secondaryBadgeBg, secondaryBadgeText,
      detailIndicatorText,
      resizeHandles, nodeId: node.id, nodeType: node.type,
      nodeWidth: node.width ?? NODE_WIDTH, isZone,
      currentStatus: 'idle', animationPhase: 0,
    };
  }

  private updateNodeVisual(visual: NodeVisual, node: GraphNode, isSelected: boolean, absPos?: { x: number; y: number }): void {
    const theme = canvasTheme();
    // Couleurs : 1) theme natif CE, 2) plugin visual.colors, 3) fallback white/gray.
    const pluginColors = pluginRegistry.getNodeVisual(node.type)?.colors;
    const colors = theme.nodeColors[node.type as ComponentType]
      ?? pluginColors
      ?? { bg: 0xffffff, border: 0x555555, text: 0x333333 };
    const w = node.width ?? NODE_WIDTH;
    const h = node.height ?? (visual.isZone ? NODE_HEIGHT : getNodeHeight(node.type));
    const dataLabel = (node.data?.label as string) ?? node.type;
    const status: NodeStatus = (node.data?.status as NodeStatus) ?? 'idle';
    const isDown = status === 'down';
    const isDegraded = status === 'degraded';

    visual.currentStatus = status;
    visual.nodeType = node.type;
    visual.nodeWidth = w;
    const displayPos = absPos ?? node.position;
    visual.container.position.set(displayPos.x, displayPos.y);

    // ── Reset des styles non-standard (italique, gras, wordWrap) appliqués par les
    //    variants `strict`/`instance`. Évite que les overrides de variant persistent
    //    quand le rendu retombe en variant `instrument` standard.
    visual.headerLabel.style.fontWeight = 'normal';
    visual.headerLabel.style.fontStyle = 'normal';
    visual.contentLine1.style.fontStyle = 'normal';
    visual.contentLine2.style.fontStyle = 'normal';
    visual.contentLine2.style.wordWrap = false;

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

    // ── Header icon ──
    // - Mode normal : Sprite avec icône lucide (cohérent avec le rack)
    // - Zone OU état down/degraded : Text Unicode (⬡ pour zone, ✕/⚠ pour fault)
    const renderer = getComponentRenderer(node.type);
    const useFallbackText = visual.isZone || isDown || isDegraded;
    const lucideTexture = useFallbackText ? null : getIconTexture(node.type);

    if (lucideTexture) {
      // Sprite lucide visible, fallback caché
      visual.headerIcon.texture = lucideTexture;
      visual.headerIcon.width = 14;
      visual.headerIcon.height = 14;
      visual.headerIcon.tint = colors.border;
      visual.headerIcon.visible = true;
      visual.headerIcon.position.set(NODE_PADDING + 4, 6);
      visual.headerStatusIcon.visible = false;
    } else {
      // Fallback Text visible, Sprite caché
      visual.headerIcon.visible = false;
      const fallbackChar = isDown ? '✕' : isDegraded ? '⚠' : visual.isZone ? ZONE_ICON : renderer.icon;
      visual.headerStatusIcon.text = fallbackChar;
      visual.headerStatusIcon.style.fill = isDown ? 0xef4444 : isDegraded ? 0xf97316 : colors.border;
      visual.headerStatusIcon.style.fontSize = visual.isZone ? 12 : 14;
      visual.headerStatusIcon.visible = true;
      visual.headerStatusIcon.position.set(
        visual.isZone ? NODE_PADDING : NODE_PADDING + 4,
        visual.isZone ? 6 : 10,
      );
    }

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
    // Container types (zone / host-server / container) get a collapse toggle even though
    // they hide the chaos/cog/trash actions. Other nodes keep the existing layout.
    const isContainerType = node.type === 'network-zone' || node.type === 'host-server' || node.type === 'container';
    const showCollapseToggle = isContainerType;
    const showFullToolbar = !visual.isZone;
    visual.toolbar.visible = showFullToolbar || showCollapseToggle;

    if (visual.toolbar.visible) {
      const showChaos = this.chaosEnabled && showFullToolbar;
      // Layout slots, left → right: status, chaos, cog, trash, collapse.
      // Each slot is 16 px wide. We omit chaos/cog/trash for zones.
      let cursorX = 6; // running x for the next icon
      const slotW = 16;
      const tbH = 16;
      const SLOT_OFFSETS = {
        statusDot: 0,
        chaos:     0,
        cog:       0,
        trash:     0,
        collapse:  0,
      } as Record<string, number>;

      if (showFullToolbar) {
        SLOT_OFFSETS.statusDot = cursorX + 4; cursorX += slotW;
        if (showChaos) { SLOT_OFFSETS.chaos = cursorX; cursorX += slotW; }
        SLOT_OFFSETS.cog = cursorX; cursorX += slotW;
        SLOT_OFFSETS.trash = cursorX; cursorX += slotW;
      }
      if (showCollapseToggle) {
        SLOT_OFFSETS.collapse = cursorX; cursorX += slotW;
      }
      const tbW = cursorX + 4;
      const tbX = w - tbW;
      const tbY = -tbH - 3;

      visual.toolbar.position.set(tbX, tbY);

      visual.toolbarBg.clear();
      visual.toolbarBg.roundRect(0, 0, tbW, tbH, 3);
      visual.toolbarBg.fill({ color: theme.toolbarBg, alpha: 0.95 });
      visual.toolbarBg.roundRect(0, 0, tbW, tbH, 3);
      visual.toolbarBg.stroke({ width: 1, color: colors.border, alpha: 0.4 });

      visual.statusDot.visible = showFullToolbar;
      if (showFullToolbar) {
        const dotColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
        visual.statusDot.clear();
        visual.statusDot.circle(SLOT_OFFSETS.statusDot, tbH / 2, 3);
        visual.statusDot.fill({ color: dotColor, alpha: status === 'idle' ? 0.4 : 1 });
      }

      visual.chaosIcon.visible = showChaos;
      if (showChaos) visual.chaosIcon.position.set(SLOT_OFFSETS.chaos, 1);

      visual.cogIcon.visible = showFullToolbar;
      if (showFullToolbar) visual.cogIcon.position.set(SLOT_OFFSETS.cog, 1);

      visual.trashIcon.visible = showFullToolbar;
      if (showFullToolbar) visual.trashIcon.position.set(SLOT_OFFSETS.trash, 1);

      visual.collapseIcon.visible = showCollapseToggle;
      if (showCollapseToggle) {
        const collapsed = (node.data as Record<string, unknown> | undefined)?.collapsed === true;
        visual.collapseIcon.text = collapsed ? '+' : '−';
        visual.collapseIcon.position.set(SLOT_OFFSETS.collapse, -1);
      }
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

    // ── Plugin hints (cornerTag, variant strict/instance, typeTag, description) ──
    // Doit être appelé EN DERNIER : peut surcharger les graphiques rendus ci-dessus
    // (cas des variants `strict` et `instance` qui modifient drastiquement le rendu).
    this.applyPluginHints(visual, node, w, h, colors);
  }

  /**
   * Applique les hints fournis par les plugins (`nodeRendererRegistry.resolveHints`)
   * et les hints visuels du `pluginRegistry` (variant, typeTag, etc.).
   *
   * Trois variantes supportées :
   *  - `instrument` (défaut) : style SIGNAL standard. Seul `cornerTag` peut être surchargé ici.
   *  - `strict`              : notation C4 stricte. Surcharge bg, hide icon/signalBar/footer/gauges,
   *                            réutilise contentLine1 pour le typeTag, contentLine2 pour la description.
   *  - `instance`            : style instrument + badge `↗ refLabel` au-dessus du header.
   *
   * Le hint provient de DEUX sources, par priorité :
   *  1. `nodeRendererRegistry.resolveHints(node, ctx)` — provider dynamique (peut dépendre du contexte
   *     projet, du level, etc.). Utile pour la rétro-compat YAML legacy.
   *  2. `pluginRegistry.getNodeVisual(type)` — déclaré statiquement dans `PluginNodeDefinition.visual`.
   *     Source de vérité pour les types natifs plugin (`c4-person`, `c4-component`, …).
   */
  private applyPluginHints(
    visual: NodeVisual,
    node: GraphNode,
    w: number,
    h: number,
    colors: { bg: number; border: number; text: number },
  ): void {
    const projectMeta = useArchitectureStore.getState().projectMeta;
    const dynamicHints = nodeRendererRegistry.hasProviders()
      ? nodeRendererRegistry.resolveHints(node, { projectMeta })
      : null;
    const staticVisual = pluginRegistry.getNodeVisual(node.type);

    // Variant : priorité au dynamique, fallback au statique.
    const variant = dynamicHints?.variant ?? staticVisual?.variant ?? 'instrument';
    const cornerTag = dynamicHints?.cornerTag ?? staticVisual?.cornerTag;
    const showDescription = dynamicHints?.showDescription ?? staticVisual?.showDescription ?? false;

    // 1) Variant `strict` : surcharge le rendu standard pour la notation C4 stricte.
    if (variant === 'strict' && !visual.isZone) {
      this.applyStrictVariant(visual, node, w, h, colors, staticVisual, showDescription);
    }
    // 2) Variant `instance` : style instrument + badge `↗ ref` au-dessus du header.
    else if (variant === 'instance' && !visual.isZone) {
      this.applyInstanceVariant(visual, node, w, colors, staticVisual);
    }

    // 3) Corner tag : applicable à toutes les variantes.
    this.applyCornerTag(visual, w, cornerTag);

    // 4) Secondary badge (top-LEFT) : indicateurs additifs des plugins (cascade ⚡, emitter 📡).
    //    Statique inexistant aujourd'hui sur NodeVisual du CE — uniquement dynamique pour l'instant.
    const secondaryBadge = dynamicHints?.secondaryBadge;
    this.applySecondaryBadge(visual, secondaryBadge);

    // 5) Detail indicator (top-RIGHT, sous le cornerTag) : flag `extra.hasDetail` indiquant
    //    qu'un drill-down est disponible (D4.3). Lu uniquement depuis les hints dynamiques.
    const extra = dynamicHints?.extra as { hasDetail?: boolean; refinementCount?: number } | undefined;
    if (extra?.hasDetail) {
      this.applyDetailIndicator(visual, w, extra.refinementCount ?? 0);
    } else {
      this.applyDetailIndicator(visual, w, 0);
    }
  }

  /**
   * Notation C4 stricte (variant `strict`) :
   *  - Background parchment (ou couleur plugin) avec border net.
   *  - Pas d'icône header, pas de signal-bar gauche, pas de séparateur, pas de gauges.
   *  - Header : nom en font-display (cas mixte, gras, plus grand).
   *  - contentLine1 réutilisée pour le typeTag (`[Person]`, `Component: Repository`, …).
   *  - contentLine2 réutilisée pour la description (italique).
   *  - Footer + toolbar conservés (toolbar pour les actions cog/trash).
   */
  private applyStrictVariant(
    visual: NodeVisual,
    node: GraphNode,
    w: number,
    h: number,
    colors: { bg: number; border: number; text: number },
    staticVisual: ReturnType<typeof pluginRegistry.getNodeVisual>,
    showDescription: boolean,
  ): void {
    const dataLabel = (node.data?.label as string) ?? node.type;
    const description = (node.data?.description as string | undefined) ?? '';

    // ── Background parchment : surcharge le bg standard ──
    visual.bg.clear();
    visual.bg.roundRect(0, 0, w, h, NODE_RADIUS);
    visual.bg.fill({ color: colors.bg, alpha: 1 });
    visual.bg.roundRect(0, 0, w, h, NODE_RADIUS);
    visual.bg.stroke({ width: 1.5, color: colors.border, alpha: 0.85 });

    // ── Hide signal bar, icon, separator (notation C4 stricte = boîte uniforme) ──
    visual.signalBar.clear();
    visual.headerIcon.visible = false;
    visual.headerStatusIcon.visible = false;
    visual.separator.clear();
    visual.gauges.clear();

    // ── Header label : nom en cas mixte, font-display style, plus large ──
    visual.headerLabel.text = dataLabel;
    visual.headerLabel.style.fill = colors.text;
    visual.headerLabel.style.fontSize = 12;
    visual.headerLabel.style.fontWeight = '600';
    visual.headerLabel.position.set(NODE_PADDING, 8);
    visual.headerLabel.scale.x = 1;
    const maxNameW = w - NODE_PADDING * 2;
    if (visual.headerLabel.width > maxNameW) {
      visual.headerLabel.scale.x = maxNameW / visual.headerLabel.width;
    }

    // ── Type tag : réutilise contentLine1 (mono, dim) ──
    const typeTagText = resolveTypeTag(staticVisual?.typeTag, node.data ?? {});
    if (typeTagText) {
      visual.contentLine1.text = `[${typeTagText}]`;
      visual.contentLine1.style.fill = colors.border;
      visual.contentLine1.style.fontSize = 9;
      visual.contentLine1.style.fontStyle = 'normal';
      visual.contentLine1.position.set(NODE_PADDING, 26);
      visual.contentLine1.scale.x = 1;
      const maxTagW = w - NODE_PADDING * 2;
      if (visual.contentLine1.width > maxTagW) {
        visual.contentLine1.scale.x = maxTagW / visual.contentLine1.width;
      }
      visual.contentLine1.visible = true;
    } else {
      visual.contentLine1.visible = false;
    }

    // ── Description : réutilise contentLine2 (italique, font-sans) ──
    if (showDescription && description) {
      visual.contentLine2.text = description;
      visual.contentLine2.style.fill = colors.text;
      visual.contentLine2.style.fontSize = 10;
      visual.contentLine2.style.fontStyle = 'italic';
      visual.contentLine2.style.wordWrap = true;
      visual.contentLine2.style.wordWrapWidth = w - NODE_PADDING * 2;
      visual.contentLine2.position.set(NODE_PADDING, 42);
      visual.contentLine2.scale.x = 1;
      visual.contentLine2.visible = true;
    } else {
      visual.contentLine2.visible = false;
    }

    // ── Footer caché : strict = documentaire, pas de métriques ──
    visual.footerSeparator.clear();
    visual.footerGauges.clear();
    visual.footerMetricsText.visible = false;
    visual.footerSuccessText.visible = false;
    visual.footerErrorText.visible = false;
    visual.footerGaugeLabel.visible = false;
  }

  /**
   * Variant `instance` : style instrument standard + badge `↗ refLabel` flotté au-dessus du header.
   * Le `refLabel` est lu dans `node.data[visual.referenceField]` (typiquement `containerRef`).
   * Pour l'instant on affiche l'ID brut ; un futur raffinement pourra résoudre le label du nœud référencé.
   */
  private applyInstanceVariant(
    visual: NodeVisual,
    node: GraphNode,
    w: number,
    colors: { bg: number; border: number; text: number },
    staticVisual: ReturnType<typeof pluginRegistry.getNodeVisual>,
  ): void {
    const refField = staticVisual?.referenceField;
    if (!refField) return;
    const refValue = (node.data?.[refField] as string | undefined) ?? '';
    if (!refValue) return;

    // Le badge est dessiné dans contentLine1 (mono, amber, préfixe ↗).
    visual.contentLine1.text = `↗ ${refValue}`;
    visual.contentLine1.style.fill = colors.border;
    visual.contentLine1.style.fontSize = 9;
    visual.contentLine1.style.fontStyle = 'normal';
    visual.contentLine1.position.set(NODE_PADDING + 4, 30);
    visual.contentLine1.scale.x = 1;
    const maxRefW = w - NODE_PADDING * 2 - 8;
    if (visual.contentLine1.width > maxRefW) {
      visual.contentLine1.scale.x = maxRefW / visual.contentLine1.width;
    }
    visual.contentLine1.visible = true;
  }

  /**
   * Dessine le badge `cornerTag` (ex: "EXT", "L1", "L3") en haut-droite du nœud.
   * Couleur déduite du tag (mapping conservateur).
   */
  private applyCornerTag(visual: NodeVisual, w: number, tag: string | undefined): void {
    if (!tag) {
      visual.cornerTagBg.visible = false;
      visual.cornerTagText.visible = false;
      return;
    }

    const isExternal = tag === 'EXT' || tag === 'EXTERNAL';
    const tagColor = isExternal ? 0xc1483d : 0xd9a04e;

    visual.cornerTagText.text = tag;
    const textW = visual.cornerTagText.width;
    const padX = 4;
    const padY = 2;
    const tagW = textW + padX * 2;
    const tagH = 12;
    const tagX = w - tagW + 1;
    const tagY = -tagH / 2;

    visual.cornerTagBg.clear();
    visual.cornerTagBg.rect(tagX, tagY, tagW, tagH);
    visual.cornerTagBg.fill({ color: tagColor, alpha: 1 });
    visual.cornerTagBg.visible = true;

    visual.cornerTagText.position.set(tagX + padX, tagY + padY);
    visual.cornerTagText.visible = true;
  }

  /**
   * Dessine un badge secondaire (ex: "⚡", "📡") en haut-GAUCHE du nœud. Distinct du cornerTag
   * top-right pour permettre aux plugins d'injecter des indicateurs d'état runtime additifs
   * sans concurrencer le tag de niveau (L1/L3/EXT).
   *
   * Couleur dérivée du contenu (heuristique simple) : violet pour cascade (⚡), amber pour
   * emitter (📡), gris pour le reste. Une future évolution pourra exposer la couleur via
   * `NodeRenderHints.secondaryBadgeColor`.
   */
  private applySecondaryBadge(visual: NodeVisual, badge: string | undefined): void {
    if (!badge) {
      visual.secondaryBadgeBg.visible = false;
      visual.secondaryBadgeText.visible = false;
      return;
    }

    visual.secondaryBadgeText.text = badge;
    const textW = visual.secondaryBadgeText.width;
    const padX = 4;
    const padY = 1;
    const badgeW = textW + padX * 2;
    const badgeH = 14;
    const badgeX = -1; // léger débordement gauche, mirror du cornerTag
    const badgeY = -badgeH / 2;

    const isCascade = badge.includes('⚡');
    const isEmitter = badge.includes('📡');
    const badgeColor = isCascade ? 0x7c4dff : isEmitter ? 0xd9a04e : 0x6b7280;

    visual.secondaryBadgeBg.clear();
    visual.secondaryBadgeBg.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    visual.secondaryBadgeBg.fill({ color: badgeColor, alpha: 1 });
    visual.secondaryBadgeBg.visible = true;

    visual.secondaryBadgeText.position.set(badgeX + padX, badgeY + padY);
    visual.secondaryBadgeText.visible = true;
  }

  /**
   * Dessine l'indicateur "has-detail" (◧) en haut-DROITE du nœud, sous le cornerTag.
   * Signal qu'un drill-down est disponible — c.-à-d. que le node a des enfants raffinés
   * (containers pour un L1, components pour un L2). Injecté par `hints.extra.hasDetail`.
   *
   * Couleur : violet `#9a7ad9` cohérent avec l'edge L3 du plugin C4.
   * Suffixe optionnel `·N` quand `count > 1` pour donner une idée du fan-out.
   *
   * D4.3 (Phase 1F).
   */
  private applyDetailIndicator(visual: NodeVisual, w: number, count: number): void {
    if (count <= 0) {
      visual.detailIndicatorText.visible = false;
      return;
    }

    // Glyphe + (optionnellement) compteur. On évite l'overlay-counter Pixi pour rester sobre :
    // un simple suffixe textuel suffit et reste lisible à toutes les échelles de zoom.
    visual.detailIndicatorText.text = count > 1 ? `◧·${count}` : '◧';
    const textW = visual.detailIndicatorText.width;
    const textH = visual.detailIndicatorText.height;

    // Position : haut-DROIT, juste sous le cornerTag. Le cornerTag est centré sur Y=0
    // (`tagY = -tagH/2`) ; on se place à Y=8 pour rester clairement dessous quand il existe,
    // et juste à l'intérieur du nœud sinon.
    const x = w - textW - 4;
    const y = 8;

    visual.detailIndicatorText.position.set(x, y);
    visual.detailIndicatorText.visible = true;
    // Tooltip-like aria via PixiJS : pas supporté nativement. La sémantique est portée par
    // le node-title et l'overlay du detail-modal. On laisse le glyphe seul.
    void textH;
  }

  private drawFooter(visual: NodeVisual, node: GraphNode | null, w: number): void {
    const nodeType = node?.type ?? visual.nodeType;
    const nodeId = node?.id ?? visual.nodeId;

    visual.footerSeparator.clear();
    visual.footerGauges.clear();
    visual.footerMetricsText.visible = false;
    visual.footerSuccessText.visible = false;
    visual.footerErrorText.visible = false;
    visual.footerGaugeLabel.visible = false;
    if (visual.isZone) return;

    const x = NODE_PADDING + 4;
    const barW = w - NODE_PADDING * 2 - 8;
    const hasGauges = typeHasFooterGauges(nodeType);
    const metrics = this.footerMetrics.get(nodeId);

    // Footer separator line
    const theme = canvasTheme();
    visual.footerSeparator.moveTo(x, FOOTER_SEPARATOR_Y);
    visual.footerSeparator.lineTo(x + barW, FOOTER_SEPARATOR_Y);
    visual.footerSeparator.stroke({ width: 1, color: theme.separatorColor, alpha: theme.separatorAlpha });

    // Type-specific footer gauges (CPU/MEM, hit ratio, pool, etc.)
    // Always draw gauges for gauged types, even without simulation metrics
    if (hasGauges) {
      const defaultMetrics = metrics ?? { requestsIn: 0, requestsOut: 0, successCount: 0, errorCount: 0 };
      const renderer = getComponentRenderer(nodeType);
      renderer.drawFooterGauges?.(visual.footerGauges, defaultMetrics, x, FOOTER_GAUGES_Y, barW);

      // Show CPU/MEM labels above gauge bars for types with resource gauges
      const hasCpuMem = nodeType === 'http-server' || nodeType === 'api-gateway'
        || nodeType === 'api-service' || nodeType === 'background-job';
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
    const svcSuffix = (nodeType === 'load-balancer' || nodeType === 'api-gateway')
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
    visual.footerErrorText.style.fill = 0xef4444;
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
    // Immediately redraw footer so metrics update in real-time during simulation
    const visual = this.visuals.get(nodeId);
    if (visual) {
      this.drawFooter(visual, null, visual.nodeWidth);
    }
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
    // Immediately redraw footer so gauges update in real-time during simulation
    const visual = this.visuals.get(nodeId);
    if (visual) {
      this.drawFooter(visual, null, visual.nodeWidth);
    }
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
   * Bounds absolus du visuel d'un nœud — origine en haut-gauche, taille effective.
   * Utilisé par les overlays plugin (ex: visual-diff) pour dessiner par-dessus.
   * Renvoie `null` si le nœud n'est pas rendu actuellement.
   */
  getNodeBounds(nodeId: string): { x: number; y: number; width: number; height: number } | null {
    const visual = this.visuals.get(nodeId);
    const pos = this.positions.get(nodeId);
    if (!visual || !pos) return null;
    const bgBounds = visual.bg.getLocalBounds();
    return {
      x: pos.x,
      y: pos.y,
      width: Math.round(bgBounds.width),
      height: Math.round(bgBounds.height),
    };
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
