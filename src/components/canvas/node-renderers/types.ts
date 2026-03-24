import type { Graphics } from 'pixi.js';
import { canvasTheme } from '../constants';

/**
 * Runtime metrics for the node footer.
 * Populated from analytics/simulation store during simulation.
 */
export interface NodeFooterMetrics {
  requestsIn: number;
  requestsOut: number;
  successCount: number;
  errorCount: number;
  // Resource utilization (0-100)
  cpu?: number;
  memory?: number;
  // Specialized metrics
  hitRatio?: number;
  queueDepth?: number;
  maxQueueDepth?: number;
  blockRate?: number;
  poolUsage?: number;
  activeInstances?: number;
  maxInstances?: number;
  connectedServices?: number;
}

/**
 * Interface for per-component-type content rendering.
 * Each renderer knows how to extract and display content specific to its type.
 */
export interface ComponentContentRenderer {
  /** Unicode icon for the component header */
  icon: string;

  /** Extract display lines from node data */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContentLines(data: Record<string, any>): string[];

  /**
   * Optional: draw custom gauges/bars into the Graphics object.
   * Called after text content, at the given y position.
   * Returns the height consumed by the gauges.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drawGauges?(g: Graphics, data: Record<string, any>, x: number, y: number, w: number): number;

  /**
   * Optional: draw footer-specific gauges (CPU/MEM bars, specialized bars).
   * Called in the footer area, above the minimal metrics line.
   * Returns the height consumed.
   */
  drawFooterGauges?(g: Graphics, metrics: NodeFooterMetrics, x: number, y: number, w: number): number;
}

/** Gauge color helper: green < 70%, amber < 90%, amber intense ≥ 90% */
export function gaugeColor(pct: number): number {
  if (pct < 70) return 0x22c55e;
  if (pct < 90) return 0xf59e0b;
  return 0xd97706;
}

/** Draw a single gauge bar (background track + fill) */
export function drawGaugeBar(g: Graphics, x: number, y: number, w: number, h: number, pct: number, label?: string): void {
  // Background track
  const theme = canvasTheme();
  g.roundRect(x, y, w, h, 1);
  g.fill({ color: theme.gaugeTrackColor, alpha: theme.gaugeTrackAlpha });
  // Fill
  if (pct > 0) {
    const fillW = Math.max(1, (pct / 100) * w);
    g.roundRect(x, y, fillW, h, 1);
    g.fill(gaugeColor(pct));
  }
}
