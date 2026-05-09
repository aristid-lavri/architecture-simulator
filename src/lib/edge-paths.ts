import type { GraphEdge } from '@/types/graph';
import type { Point } from './edge-anchors';

/**
 * Read transient waypoints attached to an edge by `applyAutoLayout`. Returns `null` when
 * absent. Coordinates are absolute (root frame), as produced by ELK's orthogonal router.
 */
export function readWaypoints(edge: GraphEdge): Point[] | null {
  const data = edge.data as Record<string, unknown> | undefined;
  const wp = data?._waypoints;
  if (!Array.isArray(wp) || wp.length < 2) return null;
  for (const p of wp) {
    if (typeof p !== 'object' || p === null) return null;
    const point = p as { x?: unknown; y?: unknown };
    if (typeof point.x !== 'number' || typeof point.y !== 'number') return null;
  }
  return wp as Point[];
}

/** Squared distance between two points. */
function dist2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Decide whether ELK-supplied waypoints are still usable for the current anchor positions.
 * If the user dragged a node, the original endpoints diverge from the live anchors and the
 * route is stale — the renderer should fall back to its own router instead.
 *
 * Threshold is generous (~50 px) so that the dynamic-anchors redistribution from Étape 2
 * does not invalidate routes when only the side anchor position shifted slightly.
 */
const FRESHNESS_THRESHOLD_SQ = 50 * 50;

export function waypointsAreFresh(waypoints: Point[], source: Point, target: Point): boolean {
  if (waypoints.length < 2) return false;
  return (
    dist2(waypoints[0], source) < FRESHNESS_THRESHOLD_SQ &&
    dist2(waypoints[waypoints.length - 1], target) < FRESHNESS_THRESHOLD_SQ
  );
}

export interface BezierParams {
  /** Bezier endpoints (anchor positions, unmodified by the parallel offset). */
  source: Point;
  target: Point;
  /** Cubic bezier control points (offset for parallel separation). */
  cp1: Point;
  cp2: Point;
}

/** Hard cap on the curvature so very long edges don't bow excessively. */
const MAX_CURVATURE = 80;
/** Curvature is `dist * CURVATURE_RATIO`, clamped at MAX_CURVATURE. */
const CURVATURE_RATIO = 0.35;

/**
 * Compute the cubic-bezier control points between two anchor points, with an optional
 * perpendicular offset for parallel-edge separation.
 *
 * The endpoints (`source`, `target`) are NOT shifted — only the control points move,
 * which keeps the line attached to the node anchors while creating a parallel arc.
 */
export function computeBezierParams(source: Point, target: Point, parallelOffset = 0): BezierParams {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(dist * CURVATURE_RATIO, MAX_CURVATURE);
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let cp1: Point;
  let cp2: Point;

  if (absDx > absDy) {
    // Predominantly horizontal — shape control points along the x axis.
    cp1 = { x: source.x + Math.sign(dx) * curvature, y: source.y };
    cp2 = { x: target.x - Math.sign(dx) * curvature, y: target.y };
  } else {
    // Predominantly vertical.
    cp1 = { x: source.x, y: source.y + Math.sign(dy) * curvature };
    cp2 = { x: target.x, y: target.y - Math.sign(dy) * curvature };
  }

  // Apply parallel offset perpendicular to the source→target direction.
  // This shifts the control points laterally without moving the endpoints.
  if (parallelOffset !== 0 && dist > 0) {
    const nx = -dy / dist;
    const ny = dx / dist;
    cp1 = { x: cp1.x + nx * parallelOffset, y: cp1.y + ny * parallelOffset };
    cp2 = { x: cp2.x + nx * parallelOffset, y: cp2.y + ny * parallelOffset };
  }

  return { source, target, cp1, cp2 };
}

/** Sample a cubic bezier at parameter `t ∈ [0, 1]`. */
export function bezierPoint(p: BezierParams, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p.source.x + 3 * mt * mt * t * p.cp1.x + 3 * mt * t * t * p.cp2.x + t * t * t * p.target.x,
    y: mt * mt * mt * p.source.y + 3 * mt * mt * t * p.cp1.y + 3 * mt * t * t * p.cp2.y + t * t * t * p.target.y,
  };
}

/**
 * Interpolate a position at progress `t ∈ [0, 1]` along a polyline (proportionally to arc length).
 * Used to place labels at consistent visual positions along orthogonal routes.
 */
export function pointAlongPolyline(points: ReadonlyArray<Point>, t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const lengths: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
    lengths.push(total);
  }
  if (total === 0) return points[0];

  const target = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < points.length; i++) {
    if (lengths[i] >= target) {
      const segLen = lengths[i] - lengths[i - 1];
      const frac = segLen > 0 ? (target - lengths[i - 1]) / segLen : 0;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * frac,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * frac,
      };
    }
  }
  return points[points.length - 1];
}

/** Tangent angle of a cubic bezier at parameter `t`. */
export function bezierTangentAngle(p: BezierParams, t: number): number {
  const mt = 1 - t;
  const dtx = 3 * mt * mt * (p.cp1.x - p.source.x) + 6 * mt * t * (p.cp2.x - p.cp1.x) + 3 * t * t * (p.target.x - p.cp2.x);
  const dty = 3 * mt * mt * (p.cp1.y - p.source.y) + 6 * mt * t * (p.cp2.y - p.cp1.y) + 3 * t * t * (p.target.y - p.cp2.y);
  return Math.atan2(dty, dtx);
}
