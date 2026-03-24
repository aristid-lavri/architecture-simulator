import type { ComponentType } from '@/types';

// ============================================
// Node visual constants
// ============================================

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 76;        // default for nodes without footer gauges
export const NODE_HEIGHT_GAUGES = 90; // for nodes with resource/specialized gauges
export const NODE_RADIUS = 2;
export const NODE_BORDER_WIDTH = 1;
export const NODE_FONT_SIZE = 12;
export const NODE_ICON_SIZE = 16;
export const NODE_PADDING = 10;

// Footer layout
export const FOOTER_SEPARATOR_Y = 52;
export const FOOTER_GAUGES_Y = 56;
export const FOOTER_METRICS_Y_MINIMAL = 56;   // when no gauges
export const FOOTER_METRICS_Y_GAUGES = 68;    // when gauges present
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
export const GRID_MINOR_COLOR = 0x2a2a2e;
export const GRID_MAJOR_COLOR = 0x3a3a3e;
export const GRID_MINOR_ALPHA = 0.3;
export const GRID_MAJOR_ALPHA = 0.4;

// Edge constants
export const EDGE_WIDTH = 2;
export const EDGE_COLOR = 0x888888;
export const EDGE_SELECTED_COLOR = 0x6366f1;

// ============================================
// Component type colors (mapped from OKLCH theme)
// ============================================

// Colors mapped to SIGNAL categories:
// SIMULATION = blue (0x3b82f6), INFRASTRUCTURE = amber (0xf59e0b),
// DATA = green (0x22c55e), RESILIENCE = magenta (0xd946ef),
// COMPUTE = indigo (0x6366f1), CLOUD = violet (0x8b5cf6),
// SECURITY = amber (0xf59e0b), ZONE = slate
// RED (0xef4444) is RESERVED for error states only.
export const NODE_COLORS: Record<ComponentType, { bg: number; border: number; text: number }> = {
  // ── SIMULATION (blue) ──
  'http-client':       { bg: 0x1e293b, border: 0x3b82f6, text: 0xbfdbfe },
  'http-server':       { bg: 0x1e2040, border: 0x8b5cf6, text: 0xddd6fe },
  'client-group':      { bg: 0x1e293b, border: 0x60a5fa, text: 0xbfdbfe },
  // ── INFRASTRUCTURE (amber/yellow) ──
  'api-gateway':       { bg: 0x302010, border: 0xf59e0b, text: 0xfde68a },
  'load-balancer':     { bg: 0x302010, border: 0xeab308, text: 0xfef08a },
  'cdn':               { bg: 0x302010, border: 0xfbbf24, text: 0xfef08a },
  'waf':               { bg: 0x302010, border: 0xf59e0b, text: 0xfde68a },
  'firewall':          { bg: 0x302010, border: 0xd97706, text: 0xfed7aa },
  'service-discovery': { bg: 0x302010, border: 0xeab308, text: 0xfef08a },
  'dns':               { bg: 0x302010, border: 0xca8a04, text: 0xfef08a },
  // ── DATA (green) ──
  'database':          { bg: 0x1e2e1e, border: 0x22c55e, text: 0xbbf7d0 },
  'cache':             { bg: 0x1e2e1e, border: 0x4ade80, text: 0xbbf7d0 },
  'message-queue':     { bg: 0x1e2e1e, border: 0x34d399, text: 0xa7f3d0 },
  // ── RESILIENCE (magenta/pink) ──
  'circuit-breaker':   { bg: 0x2e1e30, border: 0xd946ef, text: 0xf5d0fe },
  // ── COMPUTE (indigo/cyan) ──
  'host-server':       { bg: 0x1e2040, border: 0x6366f1, text: 0xc7d2fe },
  'container':         { bg: 0x1e3040, border: 0x0ea5e9, text: 0xbae6fd },
  'api-service':       { bg: 0x1e3030, border: 0x2dd4bf, text: 0xccfbf1 },
  'background-job':    { bg: 0x2e2010, border: 0xd97706, text: 0xfde68a },
  'serverless':        { bg: 0x2e1e40, border: 0x7c3aed, text: 0xddd6fe },
  // ── CLOUD (violet) ──
  'cloud-storage':     { bg: 0x1e2540, border: 0x60a5fa, text: 0xbfdbfe },
  'cloud-function':    { bg: 0x2e1e40, border: 0xc084fc, text: 0xe9d5ff },
  // ── ZONES (slate) ──
  'network-zone':      { bg: 0x1e2030, border: 0x475569, text: 0x94a3b8 },
  // ── OTHERS ──
  'identity-provider': { bg: 0x2e1e30, border: 0xd946ef, text: 0xf5d0fe },
};

// Status colors
export const STATUS_COLORS = {
  idle: 0x64748b,
  processing: 0x3b82f6,
  success: 0x22c55e,
  error: 0xef4444,
  down: 0x991b1b,
  degraded: 0xf59e0b,
} as const;

// Container types that can have children
export const CONTAINER_COMPONENT_TYPES = new Set<ComponentType>([
  'network-zone',
  'host-server',
  'container',
]);
