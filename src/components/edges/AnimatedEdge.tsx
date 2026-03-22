'use client';

import { memo, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  useReactFlow,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import { useSimulationStore } from '@/store/simulation-store';
import { useAppStore } from '@/store/app-store';
import { useArchitectureStore } from '@/store/architecture-store';
import type { Particle, ParticleType } from '@/types';
import { waypointsToSvgPath } from '@/lib/orthogonal-router';

// Stable empty array reference to avoid re-renders when no particles on an edge
const EMPTY_PARTICLES: Particle[] = [];

const particleColors: Record<ParticleType, string> = {
  request: 'oklch(0.70 0.15 220)',
  'response-success': 'oklch(0.72 0.19 155)',
  'response-error': 'oklch(0.65 0.22 25)',
  'token-request': 'oklch(0.75 0.18 55)',
  'token-response': 'oklch(0.78 0.16 90)',
};

const particleGlowClass: Record<ParticleType, string> = {
  request: 'particle-glow-request',
  'response-success': 'particle-glow-success',
  'response-error': 'particle-glow-error',
  'token-request': 'particle-glow-request',
  'token-response': 'particle-glow-success',
};

export interface AnimatedEdgeData extends Record<string, unknown> {
  color?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  pathType?: 'bezier' | 'smoothstep' | 'straight';
  animated?: boolean;
  label?: string;
  protocol?: import('@/types').ConnectionProtocol;
  /** Port cible sur un host-server (pour le routage via port mapping) */
  targetPort?: number;
  /** Edge créé automatiquement par un port mapping */
  autoCreated?: boolean;
  /** Dimmed by selection/filter (set by FlowCanvas displayEdges) */
  dimmed?: boolean;
  /** Waypoints for orthogonal routing */
  waypoints?: Array<{ x: number; y: number }>;
  /** Port offset percentage (0-100) for source handle distribution */
  sourcePortOffset?: number;
  /** Port offset percentage (0-100) for target handle distribution */
  targetPortOffset?: number;
  /** User-defined anchor/bend points for manual edge shaping (persisted) */
  anchors?: Array<{ x: number; y: number }>;
}

export type AnimatedEdge = Edge<AnimatedEdgeData>;

/** Distance from point to line segment */
function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * Build an SVG path through source → anchors → target.
 * Respects the edge pathType format:
 *   - 'bezier'     → smooth Catmull-Rom splines
 *   - 'smoothstep' → orthogonal segments with rounded corners
 *   - 'straight'   → direct line segments between points
 */
function buildAnchorPath(
  sx: number, sy: number,
  tx: number, ty: number,
  anchors: Array<{ x: number; y: number }>,
  pathType: 'bezier' | 'smoothstep' | 'straight' = 'bezier'
): { path: string; labelX: number; labelY: number } {
  const points = [{ x: sx, y: sy }, ...anchors, { x: tx, y: ty }];
  const midIdx = Math.floor(points.length / 2);
  const labelPos = points[midIdx];

  if (points.length === 2) {
    return {
      path: `M ${sx} ${sy} L ${tx} ${ty}`,
      labelX: labelPos.x,
      labelY: labelPos.y,
    };
  }

  let d: string;

  switch (pathType) {
    case 'straight':
      // Direct line segments
      d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
      }
      break;

    case 'smoothstep': {
      // Orthogonal step segments with rounded corners at each anchor
      const cornerRadius = 8;
      d = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        // Mid-point step: go horizontal then vertical (or vice versa)
        const midX = (prev.x + curr.x) / 2;

        if (i < points.length - 1 || Math.abs(prev.x - curr.x) < 1 || Math.abs(prev.y - curr.y) < 1) {
          // Direct segments for nearly-aligned points
          if (Math.abs(prev.x - curr.x) < 1 || Math.abs(prev.y - curr.y) < 1) {
            d += ` L ${curr.x} ${curr.y}`;
          } else {
            // Step via midpoint with rounded corners
            const bend1 = { x: midX, y: prev.y };
            const bend2 = { x: midX, y: curr.y };
            d += roundedCornerSegment(prev, bend1, bend2, cornerRadius);
            d += roundedCornerSegment(bend1, bend2, curr, cornerRadius);
            d += ` L ${curr.x} ${curr.y}`;
          }
        } else {
          const bend1 = { x: midX, y: prev.y };
          const bend2 = { x: midX, y: curr.y };
          d += roundedCornerSegment(prev, bend1, bend2, cornerRadius);
          d += roundedCornerSegment(bend1, bend2, curr, cornerRadius);
          d += ` L ${curr.x} ${curr.y}`;
        }
      }
      break;
    }

    case 'bezier':
    default:
      // Smooth Catmull-Rom splines
      d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        const tension = 0.3;
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;

        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }
      break;
  }

  return { path: d, labelX: labelPos.x, labelY: labelPos.y };
}

/** Generate a line-to with a rounded corner at the bend point */
function roundedCornerSegment(
  _from: { x: number; y: number },
  bend: { x: number; y: number },
  to: { x: number; y: number },
  radius: number
): string {
  const dx = to.x - bend.x;
  const dy = to.y - bend.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const r = Math.min(radius, dist / 2);

  if (r < 1) return ` L ${bend.x} ${bend.y}`;

  // Point before corner
  const beforeX = bend.x;
  const beforeY = bend.y;

  // Point after corner (towards 'to', at distance r)
  const afterX = bend.x + (dx / dist) * r;
  const afterY = bend.y + (dy / dist) * r;

  return ` L ${beforeX} ${beforeY} Q ${bend.x} ${bend.y} ${afterX} ${afterY}`;
}

function AnimatedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  style = {},
  markerEnd,
  selected,
  data,
}: EdgeProps<AnimatedEdge>) {
  const simulationState = useSimulationStore((state) => state.state);
  // Only subscribe to the Set of particle IDs for THIS edge (structural changes)
  const edgeParticleIds = useSimulationStore((state) => state.particlesByEdge.get(id));
  const hasParticles = edgeParticleIds != null && edgeParticleIds.size > 0;
  // Only subscribe to tick when this edge actually has particles — edges without
  // particles skip 60fps re-renders entirely.
  const tick = useSimulationStore((state) =>
    hasParticles ? state.particleProgressTick : 0
  );
  // Read particles imperatively via getState() inside useMemo — avoids infinite loop
  // from Zustand selector returning a new array ref on every evaluation
  const particles = useMemo(() => {
    if (!hasParticles) return EMPTY_PARTICLES;
    const allParticles = useSimulationStore.getState().particles;
    const result: Particle[] = [];
    for (const pid of edgeParticleIds!) {
      const p = allParticles.get(pid);
      if (p) result.push(p);
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, id, hasParticles, edgeParticleIds]);
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  // Hover state
  const hoveredEdgeId = useAppStore((s) => s.hoveredEdgeId);
  const setHoveredEdgeId = useAppStore((s) => s.setHoveredEdgeId);
  const isHovered = hoveredEdgeId === id;
  const isSomeEdgeHovered = hoveredEdgeId !== null;
  const isDimmedByHover = isSomeEdgeHovered && !isHovered;
  const isDimmedBySelection = data?.dimmed === true;
  const isDimmed = isDimmedByHover || isDimmedBySelection;

  // Edge customization
  const baseEdgeColor = data?.color || (selected ? 'oklch(0.70 0.15 220)' : (simulationState === 'running' ? 'var(--edge-color-active)' : 'var(--edge-color)'));
  const edgeColor = isHovered ? 'oklch(0.70 0.15 220)' : baseEdgeColor;
  const strokeWidth = isHovered ? 3 : (data?.strokeWidth || (selected ? 2.5 : 2));
  const strokeStyle = data?.strokeStyle || 'solid';
  const pathType = data?.pathType || 'bezier';

  // Apply port distribution offsets (shift Y for left/right handles, X for top/bottom)
  const sourcePortOffset = data?.sourcePortOffset;
  const targetPortOffset = data?.targetPortOffset;

  const adjustedSourceY = sourcePortOffset != null && (sourcePosition === Position.Left || sourcePosition === Position.Right)
    ? sourceY + (sourcePortOffset - 50) * 0.3
    : sourceY;
  const adjustedSourceX = sourcePortOffset != null && (sourcePosition === Position.Top || sourcePosition === Position.Bottom)
    ? sourceX + (sourcePortOffset - 50) * 0.3
    : sourceX;
  const adjustedTargetY = targetPortOffset != null && (targetPosition === Position.Left || targetPosition === Position.Right)
    ? targetY + (targetPortOffset - 50) * 0.3
    : targetY;
  const adjustedTargetX = targetPortOffset != null && (targetPosition === Position.Top || targetPosition === Position.Bottom)
    ? targetX + (targetPortOffset - 50) * 0.3
    : targetX;

  const waypoints = data?.waypoints;
  const anchors = data?.anchors;

  const [edgePath, labelX, labelY] = useMemo(() => {
    const sX = adjustedSourceX;
    const sY = adjustedSourceY;
    const tX = adjustedTargetX;
    const tY = adjustedTargetY;

    // User-defined anchor points take highest priority
    if (anchors && anchors.length > 0) {
      const result = buildAnchorPath(sX, sY, tX, tY, anchors, pathType);
      return [result.path, result.labelX, result.labelY] as [string, number, number];
    }

    // Orthogonal routing via precomputed waypoints
    if (waypoints && waypoints.length >= 2) {
      const path = waypointsToSvgPath(waypoints);
      const midIdx = Math.floor(waypoints.length / 2);
      const mid = waypoints[midIdx];
      return [path, mid.x, mid.y] as [string, number, number];
    }

    const pathParams = {
      sourceX: sX,
      sourceY: sY,
      sourcePosition,
      targetX: tX,
      targetY: tY,
      targetPosition,
    };

    switch (pathType) {
      case 'smoothstep':
        return getSmoothStepPath(pathParams);
      case 'straight':
        return getStraightPath({ sourceX: sX, sourceY: sY, targetX: tX, targetY: tY });
      case 'bezier':
      default:
        return getBezierPath(pathParams);
    }
  }, [adjustedSourceX, adjustedSourceY, sourcePosition, adjustedTargetX, adjustedTargetY, targetPosition, pathType, waypoints, anchors]);

  const strokeDasharray = useMemo(() => {
    switch (strokeStyle) {
      case 'dashed': return '8 4';
      case 'dotted': return '2 4';
      default: return undefined;
    }
  }, [strokeStyle]);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [edgePath]);

  const getPointOnPath = (t: number): { x: number; y: number } => {
    if (!pathRef.current || pathLength === 0) {
      return {
        x: sourceX + (targetX - sourceX) * t,
        y: sourceY + (targetY - sourceY) * t,
      };
    }
    const point = pathRef.current.getPointAtLength(t * pathLength);
    return { x: point.x, y: point.y };
  };

  const getAngleOnPath = (t: number): number => {
    if (!pathRef.current || pathLength === 0) {
      return Math.atan2(targetY - sourceY, targetX - sourceX) * (180 / Math.PI);
    }
    const len = t * pathLength;
    const p1 = pathRef.current.getPointAtLength(Math.max(0, len - 1));
    const p2 = pathRef.current.getPointAtLength(Math.min(pathLength, len + 1));
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
  };

  const groupOpacity = isDimmed ? 0.12 : 1;
  const mode = useAppStore((s) => s.mode);
  const isEditable = mode === 'edit';
  const updateEdge = useArchitectureStore((s) => s.updateEdge);
  const { screenToFlowPosition } = useReactFlow();

  // Dragging state for anchor points
  const [draggingAnchorIdx, setDraggingAnchorIdx] = useState<number | null>(null);

  const handleAnchorDrag = useCallback(
    (e: React.MouseEvent, idx: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (!anchors) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startAnchor = { ...anchors[idx] };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        // Convert screen delta to flow delta (account for zoom)
        const startFlow = screenToFlowPosition({ x: startX, y: startY });
        const currentFlow = screenToFlowPosition({ x: startX + dx, y: startY + dy });
        const flowDx = currentFlow.x - startFlow.x;
        const flowDy = currentFlow.y - startFlow.y;

        const newAnchors = [...anchors];
        newAnchors[idx] = { x: startAnchor.x + flowDx, y: startAnchor.y + flowDy };
        updateEdge(id, { anchors: newAnchors });
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        setDraggingAnchorIdx(null);
      };

      setDraggingAnchorIdx(idx);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [anchors, id, updateEdge, screenToFlowPosition]
  );

  // Long press on edge to add anchor at press position
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const addAnchorAtPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!isEditable) return;

      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      const currentAnchors = anchors || [];

      // Find best insertion index: closest segment
      const allPoints = [
        { x: adjustedSourceX, y: adjustedSourceY },
        ...currentAnchors,
        { x: adjustedTargetX, y: adjustedTargetY },
      ];

      let bestIdx = currentAnchors.length;
      let bestDist = Infinity;

      for (let i = 0; i < allPoints.length - 1; i++) {
        const a = allPoints[i];
        const b = allPoints[i + 1];
        const dist = distToSegment(flowPos, a, b);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      const newAnchors = [...currentAnchors];
      newAnchors.splice(bestIdx, 0, flowPos);
      updateEdge(id, { anchors: newAnchors });
    },
    [isEditable, anchors, id, updateEdge, screenToFlowPosition, adjustedSourceX, adjustedSourceY, adjustedTargetX, adjustedTargetY]
  );

  const handleEdgeLongPressStart = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      longPressTriggeredRef.current = false;
      const { clientX, clientY } = e;
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        addAnchorAtPosition(clientX, clientY);
      }, 400);
    },
    [isEditable, addAnchorAtPosition]
  );

  const handleEdgeLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Right-click on anchor to remove it
  const handleAnchorContextMenu = useCallback(
    (e: React.MouseEvent, idx: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (!anchors) return;
      const newAnchors = anchors.filter((_, i) => i !== idx);
      updateEdge(id, { anchors: newAnchors.length > 0 ? newAnchors : undefined });
    },
    [anchors, id, updateEdge]
  );

  return (
    <g
      onMouseEnter={() => setHoveredEdgeId(id)}
      onMouseLeave={() => { if (hoveredEdgeId === id) setHoveredEdgeId(null); handleEdgeLongPressEnd(); }}
      style={{
        opacity: groupOpacity,
        transition: 'opacity 0.15s ease',
        pointerEvents: isDimmedBySelection ? 'none' : 'auto',
      }}
    >
      {/* Hidden path for measuring */}
      <path ref={pathRef} d={edgePath} fill="none" style={{ visibility: 'hidden' }} />

      {/* Invisible wide interaction area for hover + long press detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: isEditable ? 'crosshair' : undefined }}
        onMouseDown={handleEdgeLongPressStart}
        onMouseUp={handleEdgeLongPressEnd}
        onMouseLeave={handleEdgeLongPressEnd}
      />

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth,
          stroke: edgeColor,
          strokeDasharray,
        }}
      />

      {/* Particles — luminous streaks, not circles */}
      {particles.map((particle) => {
        const effectiveProgress = particle.direction === 'backward'
          ? 1 - particle.progress
          : particle.progress;
        const point = getPointOnPath(effectiveProgress);
        const angle = getAngleOnPath(effectiveProgress);
        const color = particleColors[particle.type];
        const glowClass = particleGlowClass[particle.type];

        const isAuthenticated = particle.data?.authenticated === true;
        const isTokenParticle = particle.type === 'token-request' || particle.type === 'token-response';

        return (
          <g key={particle.id} className={glowClass} aria-hidden="true">
            {/* Streak particle */}
            <rect
              x={point.x - 7}
              y={point.y - 1}
              width={14}
              height={2}
              rx={1}
              fill={color}
              opacity={0.9}
              transform={`rotate(${angle}, ${point.x}, ${point.y})`}
            />
            {/* Lock indicator for authenticated requests */}
            {isAuthenticated && !isTokenParticle && (
              <g transform={`translate(${point.x + 6}, ${point.y - 8})`}>
                <rect x={-3} y={2} width={6} height={5} rx={0.5} fill={color} opacity={0.8} />
                <path d={`M-1.5,2 V0.5 A1.5,1.5 0 0,1 1.5,0.5 V2`} fill="none" stroke={color} strokeWidth={1} opacity={0.8} />
              </g>
            )}
            {/* Key indicator for token particles */}
            {isTokenParticle && (
              <circle cx={point.x} cy={point.y} r={3} fill={color} opacity={0.5} />
            )}
          </g>
        );
      })}

      {/* Anchor point handles — visible when edge is selected or hovered in edit mode */}
      {(selected || isHovered) && isEditable && anchors && anchors.length > 0 && (
        <>
          {/* Thin lines showing anchor connections */}
          {anchors.map((anchor, idx) => {
            const prev = idx === 0
              ? { x: adjustedSourceX, y: adjustedSourceY }
              : anchors[idx - 1];
            return (
              <line
                key={`anchor-line-${idx}`}
                x1={prev.x}
                y1={prev.y}
                x2={anchor.x}
                y2={anchor.y}
                stroke="oklch(0.70 0.15 220 / 30%)"
                strokeWidth={1}
                strokeDasharray="4 3"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
          {/* Last anchor → target */}
          <line
            x1={anchors[anchors.length - 1].x}
            y1={anchors[anchors.length - 1].y}
            x2={adjustedTargetX}
            y2={adjustedTargetY}
            stroke="oklch(0.70 0.15 220 / 30%)"
            strokeWidth={1}
            strokeDasharray="4 3"
            style={{ pointerEvents: 'none' }}
          />

          {/* Draggable anchor circles */}
          {anchors.map((anchor, idx) => (
            <g key={`anchor-${idx}`} className="nodrag">
              {/* Larger invisible hit area */}
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={10}
                fill="transparent"
                style={{ cursor: 'grab', pointerEvents: 'all' }}
                onMouseDown={(e) => handleAnchorDrag(e, idx)}
                onContextMenu={(e) => handleAnchorContextMenu(e, idx)}
              />
              {/* Visible anchor diamond */}
              <rect
                x={anchor.x - 5}
                y={anchor.y - 5}
                width={10}
                height={10}
                rx={2}
                fill={draggingAnchorIdx === idx ? 'oklch(0.80 0.18 220)' : 'oklch(0.70 0.15 220)'}
                stroke="var(--background)"
                strokeWidth={1.5}
                transform={`rotate(45, ${anchor.x}, ${anchor.y})`}
                style={{ cursor: 'grab', pointerEvents: 'none' }}
              />
              {/* Index label */}
              <text
                x={anchor.x}
                y={anchor.y - 10}
                textAnchor="middle"
                fill="oklch(0.70 0.15 220)"
                fontSize={8}
                fontFamily="monospace"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {idx + 1}
              </text>
            </g>
          ))}
        </>
      )}

      {/* Edge label / particle count / protocol badge */}
      {(particles.length > 0 || data?.label || data?.protocol) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan flex items-center gap-1"
          >
            {data?.protocol && (
              <span className="px-1 py-0.5 text-[9px] font-mono font-semibold uppercase bg-background/90 border border-border rounded text-muted-foreground">
                {data.protocol}
              </span>
            )}
            {(particles.length > 0 || data?.label) && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-background/90 border border-border rounded text-muted-foreground">
                {particles.length > 0 ? particles.length : data?.label}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

export default memo(AnimatedEdgeComponent);
