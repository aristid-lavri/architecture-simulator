import type { GraphNode, GraphEdge } from '@/types/graph';
import { NODE_WIDTH, NODE_HEIGHT } from './constants';
import { computeOrthogonalRoute } from '@/lib/orthogonal-router';
import { computeEdgeAnchors, type EdgeAnchor, type NodeBounds } from '@/lib/edge-anchors';
import { computeParallelGroups, parallelOffset } from '@/lib/edge-grouping';
import { computeBezierParams, bezierTangentAngle, readWaypoints, waypointsAreFresh } from '@/lib/edge-paths';
import type { EdgeRoutingMode } from '@/store/app-store';

interface PathPoint {
  x: number;
  y: number;
  angle: number; // tangent angle in radians
}

interface CachedPath {
  points: PathPoint[];
  totalLength: number;
  lengths: number[]; // cumulative arc length at each sample
}

const SAMPLES_PER_EDGE = 64;

/**
 * Pre-computes sampled point arrays along edge bezier curves.
 * Provides O(log n) position lookup by progress (0-1) via binary search.
 */
export class EdgePathCache {
  private cache: Map<string, CachedPath> = new Map();

  /**
   * Rebuild the cache for all edges. Call when nodes/edges change.
   */
  rebuild(edges: GraphEdge[], nodes: GraphNode[], routingMode: EdgeRoutingMode = 'bezier'): void {
    const nodeMap = new Map<string, GraphNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Anchor map and parallel groups mirror EdgeRenderer so particles travel the exact same path.
    const boundsMap = this.buildBoundsMap(nodes, nodeMap);
    const anchors = computeEdgeAnchors(edges, boundsMap, { honorHandles: routingMode === 'orthogonal' });
    const groups = computeParallelGroups(edges);

    this.cache.clear();

    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const anchor = anchors.get(edge.id) ?? this.fallbackAnchor(source, target, nodeMap);
      const offset = parallelOffset(groups.groupOf.get(edge.id));

      const path = routingMode === 'orthogonal'
        ? this.computeOrthogonalPath(edge, source, target, nodes, nodeMap, anchor)
        : this.computePath(anchor, offset);
      this.cache.set(edge.id, path);
    }
  }

  private buildBoundsMap(nodes: GraphNode[], nodeMap: Map<string, GraphNode>): Map<string, NodeBounds> {
    const map = new Map<string, NodeBounds>();
    for (const node of nodes) {
      const abs = this.getAbsolutePosition(node, nodeMap);
      map.set(node.id, {
        x: abs.x,
        y: abs.y,
        width: node.width ?? NODE_WIDTH,
        height: node.height ?? NODE_HEIGHT,
      });
    }
    return map;
  }

  private fallbackAnchor(source: GraphNode, target: GraphNode, nodeMap: Map<string, GraphNode>): EdgeAnchor {
    const sourceAbs = this.getAbsolutePosition(source, nodeMap);
    const targetAbs = this.getAbsolutePosition(target, nodeMap);
    const sw = source.width ?? NODE_WIDTH;
    const sh = source.height ?? NODE_HEIGHT;
    const tw = target.width ?? NODE_WIDTH;
    const th = target.height ?? NODE_HEIGHT;
    const scx = sourceAbs.x + sw / 2;
    const scy = sourceAbs.y + sh / 2;
    const tcx = targetAbs.x + tw / 2;
    const tcy = targetAbs.y + th / 2;
    return {
      source: this.borderIntersection(scx, scy, sw, sh, tcx, tcy),
      target: this.borderIntersection(tcx, tcy, tw, th, scx, scy),
      sourceSide: 'right',
      targetSide: 'left',
    };
  }

  /**
   * Get position and angle on an edge at progress t (0-1).
   * Returns null if edge not cached.
   */
  getPositionOnPath(
    edgeId: string,
    t: number,
    direction: 'forward' | 'backward' = 'forward',
  ): { x: number; y: number; angle: number } | null {
    const cached = this.cache.get(edgeId);
    if (!cached || cached.points.length === 0) return null;

    // Reverse progress for backward direction
    const progress = direction === 'backward' ? 1 - t : t;
    const targetLength = Math.max(0, Math.min(1, progress)) * cached.totalLength;

    // Binary search for the segment
    let lo = 0;
    let hi = cached.lengths.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cached.lengths[mid] < targetLength) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    if (lo === 0) {
      return { ...cached.points[0] };
    }

    // Interpolate between samples
    const prevLen = cached.lengths[lo - 1];
    const currLen = cached.lengths[lo];
    const segLen = currLen - prevLen;
    const frac = segLen > 0 ? (targetLength - prevLen) / segLen : 0;

    const p0 = cached.points[lo - 1];
    const p1 = cached.points[lo];

    const x = p0.x + (p1.x - p0.x) * frac;
    const y = p0.y + (p1.y - p0.y) * frac;
    const angle = direction === 'backward' ? p1.angle + Math.PI : p1.angle;

    return { x, y, angle };
  }

  /**
   * Compute a sampled bezier path between two anchor points.
   * Shares the bezier formula with EdgeRenderer via `computeBezierParams` so particles
   * follow the exact curve drawn on screen, including parallel-edge offsets.
   */
  private computePath(anchor: EdgeAnchor, parallelOffset = 0): CachedPath {
    const params = computeBezierParams(anchor.source, anchor.target, parallelOffset);
    const { source: sp, target: tp, cp1, cp2 } = params;

    const points: PathPoint[] = [];
    const lengths: number[] = [];
    let totalLength = 0;

    for (let i = 0; i <= SAMPLES_PER_EDGE; i++) {
      const t = i / SAMPLES_PER_EDGE;
      const mt = 1 - t;
      const x = mt * mt * mt * sp.x + 3 * mt * mt * t * cp1.x + 3 * mt * t * t * cp2.x + t * t * t * tp.x;
      const y = mt * mt * mt * sp.y + 3 * mt * mt * t * cp1.y + 3 * mt * t * t * cp2.y + t * t * t * tp.y;
      const angle = bezierTangentAngle(params, t);

      if (i > 0) {
        const prev = points[i - 1];
        const segDx = x - prev.x;
        const segDy = y - prev.y;
        totalLength += Math.sqrt(segDx * segDx + segDy * segDy);
      }

      points.push({ x, y, angle });
      lengths.push(totalLength);
    }

    return { points, totalLength, lengths };
  }

  /**
   * Compute a sampled orthogonal path between two anchor points.
   */
  private computeOrthogonalPath(
    edge: GraphEdge,
    source: GraphNode,
    target: GraphNode,
    allNodes: GraphNode[],
    nodeMap: Map<string, GraphNode>,
    anchor: EdgeAnchor,
  ): CachedPath {
    // Build obstacles
    const obstacles = allNodes
      .filter((n) => n.type !== 'network-zone')
      .map((n) => {
        const abs = this.getAbsolutePosition(n, nodeMap);
        return { id: n.id, x: abs.x, y: abs.y, width: n.width ?? NODE_WIDTH, height: n.height ?? NODE_HEIGHT };
      });

    const sourcePoint = anchor.source;
    const targetPoint = anchor.target;

    // Mirror EdgeRenderer: prefer ELK waypoints when they are still consistent with anchors.
    const elkWaypoints = readWaypoints(edge);
    let allPoints: { x: number; y: number }[];
    if (elkWaypoints && waypointsAreFresh(elkWaypoints, sourcePoint, targetPoint)) {
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

    const points: PathPoint[] = [];
    const lengths: number[] = [];
    let totalLength = 0;

    for (let seg = 0; seg < allPoints.length - 1; seg++) {
      const p0 = allPoints[seg];
      const p1 = allPoints[seg + 1];
      const segDx = p1.x - p0.x;
      const segDy = p1.y - p0.y;
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
      const angle = Math.atan2(segDy, segDx);

      // Sample each segment proportionally
      const numSamples = Math.max(2, Math.round((segLen / 500) * SAMPLES_PER_EDGE));
      for (let i = 0; i < numSamples; i++) {
        const t = i / (numSamples - 1);
        const x = p0.x + segDx * t;
        const y = p0.y + segDy * t;

        if (points.length > 0) {
          const prev = points[points.length - 1];
          const dx = x - prev.x;
          const dy = y - prev.y;
          totalLength += Math.sqrt(dx * dx + dy * dy);
        }

        points.push({ x, y, angle });
        lengths.push(totalLength);
      }
    }

    // Edge case: no waypoints
    if (points.length === 0) {
      points.push({ x: sourcePoint.x, y: sourcePoint.y, angle: 0 });
      lengths.push(0);
    }

    return { points, totalLength, lengths };
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

  private borderIntersection(
    cx: number, cy: number, w: number, h: number,
    toX: number, toY: number,
  ): { x: number; y: number } {
    const dx = toX - cx;
    const dy = toY - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const hw = w / 2;
    const hh = h / 2;
    const t = Math.abs(dx) * hh > Math.abs(dy) * hw
      ? hw / Math.abs(dx)
      : hh / Math.abs(dy);
    return { x: cx + dx * t, y: cy + dy * t };
  }

  clear(): void {
    this.cache.clear();
  }
}
