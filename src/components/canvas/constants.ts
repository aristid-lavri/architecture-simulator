import type { ComponentType } from '@/types';

// ============================================
// Node visual constants
// ============================================

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 84;        // default for nodes without footer gauges
export const NODE_HEIGHT_GAUGES = 100; // for nodes with resource/specialized gauges
export const NODE_RADIUS = 2;
export const NODE_BORDER_WIDTH = 1;
export const NODE_FONT_SIZE = 12;
export const NODE_ICON_SIZE = 16;
export const NODE_PADDING = 10;

// Footer layout
export const FOOTER_SEPARATOR_Y = 58;
export const FOOTER_GAUGES_Y = 64;
export const FOOTER_METRICS_Y_MINIMAL = 64;   // when no gauges
export const FOOTER_METRICS_Y_GAUGES = 78;    // when gauges present
export const FOOTER_METRICS_FONT_SIZE = 8;

// Types with footer resource/specialized gauges
const GAUGED_TYPES = new Set<ComponentType>([
  'http-server', 'api-gateway', 'api-service', 'background-job', 'serverless',
  'database', 'cache', 'message-queue', 'cdn', 'waf',
]);

/** Get the correct node height for a component type */
export function getNodeHeight(type: ComponentType): number {
  if (CONTAINER_COMPONENT_TYPES.has(type)) return NODE_HEIGHT; // zones use their own sizing
  return GAUGED_TYPES.has(type) ? NODE_HEIGHT_GAUGES : NODE_HEIGHT;
}

/** Check if a component type has footer gauges */
export function hasFooterGauges(type: ComponentType): boolean {
  return GAUGED_TYPES.has(type);
}

// Container/zone defaults
export const ZONE_DEFAULT_WIDTH = 400;
export const ZONE_DEFAULT_HEIGHT = 300;
export const HOST_DEFAULT_WIDTH = 300;
export const HOST_DEFAULT_HEIGHT = 250;
export const CONTAINER_DEFAULT_WIDTH = 200;
export const CONTAINER_DEFAULT_HEIGHT = 180;

// Z-order layers
export const Z_GRID = 0;
export const Z_ZONES = 1;
export const Z_EDGES = 2;
export const Z_NODES = 3;
export const Z_EDGE_HIT = 4;   // Edge hit areas above nodes for click detection
export const Z_PARTICLES = 5;
export const Z_HANDLES = 6;
export const Z_SELECTION = 7;

// Handle constants (rectangular)
export const HANDLE_WIDTH = 14;
export const HANDLE_HEIGHT = 8;
export const HANDLE_RADIUS = 5; // kept for hit-testing
export const HANDLE_HIT_RADIUS = 10;

// Resize handle constants
export const RESIZE_HANDLE_SIZE = 8;
export const RESIZE_HANDLE_HIT_SIZE = 16;
export const RESIZE_MIN_WIDTH = 120;
export const RESIZE_MIN_HEIGHT = 80;

// Grid
export const GRID_MINOR_GAP = 20;
export const GRID_MAJOR_GAP = 100;

// Edge constants
export const EDGE_WIDTH = 2;
export const EDGE_SELECTED_COLOR = 0x6366f1;

// Container types that can have children
export const CONTAINER_COMPONENT_TYPES = new Set<ComponentType>([
  'network-zone',
  'host-server',
  'container',
]);

// ============================================
// Canvas Theme System
// ============================================

type NodeColorSet = { bg: number; border: number; text: number };

/** Theme-dependent colors for the PixiJS canvas */
export interface CanvasTheme {
  // Grid
  gridMinorColor: number;
  gridMajorColor: number;
  gridMinorAlpha: number;
  gridMajorAlpha: number;
  // Edge
  edgeColor: number;
  edgeAlpha: number;
  // Node common colors
  nodeBgAlpha: number;
  separatorColor: number;
  separatorAlpha: number;
  contentLine1Color: number;
  contentLine2Color: number;
  footerMetricsColor: number;
  footerMetricsActiveColor: number;
  toolbarBg: number;
  handleBg: number;
  resizeHandleBg: number;
  reconnectHandleBg: number;
  gaugeTrackColor: number;
  gaugeTrackAlpha: number;
  cogIconColor: number;
  cogIconHoverColor: number;
  errorLabelColor: number;
  degradedLabelColor: number;
  // Per-component node colors
  nodeColors: Record<ComponentType, NodeColorSet>;
}

// Border colors are shared between themes — only bg/text change
const SHARED_BORDERS: Record<ComponentType, number> = {
  'http-client': 0x3b82f6,
  'http-server': 0x8b5cf6,
  'client-group': 0x60a5fa,
  'api-gateway': 0xf59e0b,
  'load-balancer': 0xeab308,
  'cdn': 0xfbbf24,
  'waf': 0xf59e0b,
  'firewall': 0xd97706,
  'service-discovery': 0xeab308,
  'dns': 0xca8a04,
  'database': 0x22c55e,
  'cache': 0x4ade80,
  'message-queue': 0x34d399,
  'circuit-breaker': 0xd946ef,
  'host-server': 0x6366f1,
  'container': 0x0ea5e9,
  'api-service': 0x2dd4bf,
  'background-job': 0xd97706,
  'serverless': 0x7c3aed,
  'cloud-storage': 0x60a5fa,
  'cloud-function': 0xc084fc,
  'network-zone': 0x475569,
  'identity-provider': 0xd946ef,
};

function makeNodeColors(
  bgMap: Record<ComponentType, number>,
  textMap: Record<ComponentType, number>,
): Record<ComponentType, NodeColorSet> {
  const result = {} as Record<ComponentType, NodeColorSet>;
  for (const type of Object.keys(SHARED_BORDERS) as ComponentType[]) {
    result[type] = { bg: bgMap[type], border: SHARED_BORDERS[type], text: textMap[type] };
  }
  return result;
}

// ── Light theme node colors ──
const LIGHT_NODE_BG: Record<ComponentType, number> = {
  'http-client': 0xffffff, 'http-server': 0xffffff, 'client-group': 0xffffff,
  'api-gateway': 0xffffff, 'load-balancer': 0xffffff, 'cdn': 0xffffff,
  'waf': 0xffffff, 'firewall': 0xffffff, 'service-discovery': 0xffffff, 'dns': 0xffffff,
  'database': 0xffffff, 'cache': 0xffffff, 'message-queue': 0xffffff,
  'circuit-breaker': 0xffffff,
  'host-server': 0xffffff, 'container': 0xffffff, 'api-service': 0xffffff,
  'background-job': 0xffffff, 'serverless': 0xffffff,
  'cloud-storage': 0xffffff, 'cloud-function': 0xffffff,
  'network-zone': 0xf8fafc, 'identity-provider': 0xffffff,
};

const LIGHT_NODE_TEXT: Record<ComponentType, number> = {
  'http-client': 0x1e40af, 'http-server': 0x5b21b6, 'client-group': 0x1e40af,
  'api-gateway': 0x92400e, 'load-balancer': 0x854d0e, 'cdn': 0x854d0e,
  'waf': 0x92400e, 'firewall': 0x78350f, 'service-discovery': 0x854d0e, 'dns': 0x713f12,
  'database': 0x166534, 'cache': 0x166534, 'message-queue': 0x115e59,
  'circuit-breaker': 0x86198f,
  'host-server': 0x3730a3, 'container': 0x0c4a6e, 'api-service': 0x115e59,
  'background-job': 0x78350f, 'serverless': 0x4c1d95,
  'cloud-storage': 0x1e40af, 'cloud-function': 0x6b21a8,
  'network-zone': 0x334155, 'identity-provider': 0x86198f,
};

// ── Dark theme node colors ──
const DARK_NODE_BG: Record<ComponentType, number> = {
  'http-client': 0x1e293b, 'http-server': 0x1e2040, 'client-group': 0x1e293b,
  'api-gateway': 0x302010, 'load-balancer': 0x302010, 'cdn': 0x302010,
  'waf': 0x302010, 'firewall': 0x302010, 'service-discovery': 0x302010, 'dns': 0x302010,
  'database': 0x1e2e1e, 'cache': 0x1e2e1e, 'message-queue': 0x1e2e1e,
  'circuit-breaker': 0x2e1e30,
  'host-server': 0x1e2040, 'container': 0x1e3040, 'api-service': 0x1e3030,
  'background-job': 0x2e2010, 'serverless': 0x2e1e40,
  'cloud-storage': 0x1e2540, 'cloud-function': 0x2e1e40,
  'network-zone': 0x1e2030, 'identity-provider': 0x2e1e30,
};

const DARK_NODE_TEXT: Record<ComponentType, number> = {
  'http-client': 0xbfdbfe, 'http-server': 0xddd6fe, 'client-group': 0xbfdbfe,
  'api-gateway': 0xfde68a, 'load-balancer': 0xfef08a, 'cdn': 0xfef08a,
  'waf': 0xfde68a, 'firewall': 0xfed7aa, 'service-discovery': 0xfef08a, 'dns': 0xfef08a,
  'database': 0xbbf7d0, 'cache': 0xbbf7d0, 'message-queue': 0xa7f3d0,
  'circuit-breaker': 0xf5d0fe,
  'host-server': 0xc7d2fe, 'container': 0xbae6fd, 'api-service': 0xccfbf1,
  'background-job': 0xfde68a, 'serverless': 0xddd6fe,
  'cloud-storage': 0xbfdbfe, 'cloud-function': 0xe9d5ff,
  'network-zone': 0x94a3b8, 'identity-provider': 0xf5d0fe,
};

const LIGHT_THEME: CanvasTheme = {
  gridMinorColor: 0xc0c0c8,
  gridMajorColor: 0xa0a0a8,
  gridMinorAlpha: 0.25,
  gridMajorAlpha: 0.3,
  edgeColor: 0x888888,
  edgeAlpha: 0.6,
  nodeBgAlpha: 0.95,
  separatorColor: 0x000000,
  separatorAlpha: 0.08,
  contentLine1Color: 0x444444,
  contentLine2Color: 0x888888,
  footerMetricsColor: 0xaaaaaa,
  footerMetricsActiveColor: 0x666666,
  toolbarBg: 0xffffff,
  handleBg: 0xffffff,
  resizeHandleBg: 0xffffff,
  reconnectHandleBg: 0xffffff,
  gaugeTrackColor: 0x000000,
  gaugeTrackAlpha: 0.08,
  cogIconColor: 0x999999,
  cogIconHoverColor: 0x333333,
  errorLabelColor: 0xdc2626,
  degradedLabelColor: 0xd97706,
  nodeColors: makeNodeColors(LIGHT_NODE_BG, LIGHT_NODE_TEXT),
};

const DARK_THEME: CanvasTheme = {
  // Grid — subtle lines on dark background
  gridMinorColor: 0x1e2a3a,
  gridMajorColor: 0x253545,
  gridMinorAlpha: 1.0,
  gridMajorAlpha: 1.0,
  edgeColor: 0x8090a8,
  edgeAlpha: 0.6,
  nodeBgAlpha: 0.95,
  separatorColor: 0xc0c8d8,
  separatorAlpha: 0.08,
  contentLine1Color: 0xcccccc,
  contentLine2Color: 0x888888,
  footerMetricsColor: 0x555555,
  footerMetricsActiveColor: 0x888888,
  toolbarBg: 0x1c2035,
  handleBg: 0x1c2035,
  resizeHandleBg: 0x1c2035,
  reconnectHandleBg: 0x1c2035,
  gaugeTrackColor: 0x2a3045,
  gaugeTrackAlpha: 0.6,
  cogIconColor: 0x7888a0,
  cogIconHoverColor: 0xe0e8f0,
  errorLabelColor: 0xfca5a5,
  degradedLabelColor: 0xfed7aa,
  nodeColors: makeNodeColors(DARK_NODE_BG, DARK_NODE_TEXT),
};

// ── Mutable active theme (switched by PixiCanvas on theme change) ──
let _activeTheme: CanvasTheme = DARK_THEME;

/** Get the current canvas theme colors */
export function canvasTheme(): CanvasTheme {
  return _activeTheme;
}

/** Switch the canvas theme. Always sets the theme (idempotent). Returns true if the theme actually changed. */
export function setCanvasTheme(theme: 'dark' | 'light'): boolean {
  const next = theme === 'light' ? LIGHT_THEME : DARK_THEME;
  const changed = next !== _activeTheme;
  _activeTheme = next;
  return changed;
}

// ── Legacy accessors (kept for backward compat, now delegate to active theme) ──

/** @deprecated Use canvasTheme().nodeColors[type] instead */
export const NODE_COLORS: Record<ComponentType, NodeColorSet> = new Proxy({} as Record<ComponentType, NodeColorSet>, {
  get(_target, prop: string) {
    return _activeTheme.nodeColors[prop as ComponentType];
  },
  ownKeys() {
    return Object.keys(_activeTheme.nodeColors);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    if (prop in _activeTheme.nodeColors) {
      return { configurable: true, enumerable: true, value: _activeTheme.nodeColors[prop as ComponentType] };
    }
    return undefined;
  },
});

/** @deprecated Use canvasTheme().edgeColor instead */
export const EDGE_COLOR = 0x888888; // fallback, renderers should use canvasTheme()

// Status colors (theme-independent — always high contrast)
export const STATUS_COLORS = {
  idle: 0x64748b,
  processing: 0x3b82f6,
  success: 0x22c55e,
  error: 0xef4444,
  down: 0x991b1b,
  degraded: 0xf59e0b,
} as const;
