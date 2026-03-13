'use client';

import { memo, useMemo, useRef, useEffect, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import { useSimulationStore } from '@/store/simulation-store';
import type { ParticleType } from '@/types';

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
}

export type AnimatedEdge = Edge<AnimatedEdgeData>;

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
  const allParticles = useSimulationStore((state) => state.particles);
  const simulationState = useSimulationStore((state) => state.state);
  const particles = useMemo(() => allParticles.filter((p) => p.edgeId === id), [allParticles, id]);
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  // Edge customization
  const edgeColor = data?.color || (selected ? 'oklch(0.70 0.15 220)' : (simulationState === 'running' ? 'var(--edge-color-active)' : 'var(--edge-color)'));
  const strokeWidth = data?.strokeWidth || (selected ? 2 : 1.5);
  const strokeStyle = data?.strokeStyle || 'solid';
  const pathType = data?.pathType || 'bezier';

  const [edgePath, labelX, labelY] = useMemo(() => {
    const pathParams = {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    };

    switch (pathType) {
      case 'smoothstep':
        return getSmoothStepPath(pathParams);
      case 'straight':
        return getStraightPath({ sourceX, sourceY, targetX, targetY });
      case 'bezier':
      default:
        return getBezierPath(pathParams);
    }
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, pathType]);

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

  return (
    <>
      {/* Hidden path for measuring */}
      <path ref={pathRef} d={edgePath} fill="none" style={{ visibility: 'hidden' }} />

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
    </>
  );
}

export default memo(AnimatedEdgeComponent);
