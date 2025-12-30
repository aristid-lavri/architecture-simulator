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
  request: '#3b82f6',
  'response-success': '#22c55e',
  'response-error': '#ef4444',
};

export interface AnimatedEdgeData extends Record<string, unknown> {
  color?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  pathType?: 'bezier' | 'smoothstep' | 'straight';
  animated?: boolean;
  label?: string;
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
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  // Edge customization from data
  const edgeColor = data?.color || (selected ? '#3b82f6' : (simulationState === 'running' ? '#666' : '#888'));
  const strokeWidth = data?.strokeWidth || (selected ? 4 : 3);
  const strokeStyle = data?.strokeStyle || 'solid';
  const pathType = data?.pathType || 'bezier';

  const particles = useMemo(
    () => allParticles.filter((p) => p.edgeId === id),
    [allParticles, id]
  );

  // Calculate path based on pathType
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

  // Get stroke dasharray based on style
  const strokeDasharray = useMemo(() => {
    switch (strokeStyle) {
      case 'dashed':
        return '8 4';
      case 'dotted':
        return '2 4';
      default:
        return undefined;
    }
  }, [strokeStyle]);

  // Get path length when path changes
  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [edgePath]);

  // Get point on the actual SVG path at progress t (0-1)
  const getPointOnPath = (t: number): { x: number; y: number } => {
    if (!pathRef.current || pathLength === 0) {
      // Fallback to linear interpolation
      return {
        x: sourceX + (targetX - sourceX) * t,
        y: sourceY + (targetY - sourceY) * t,
      };
    }

    const point = pathRef.current.getPointAtLength(t * pathLength);
    return { x: point.x, y: point.y };
  };

  return (
    <>
      {/* Hidden path for measuring */}
      <path
        ref={pathRef}
        d={edgePath}
        fill="none"
        style={{ visibility: 'hidden' }}
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

      {/* Particles rendered as SVG circles */}
      {particles.map((particle) => {
        // For backward direction, invert the progress (1 - progress)
        const effectiveProgress = particle.direction === 'backward'
          ? 1 - particle.progress
          : particle.progress;
        const point = getPointOnPath(effectiveProgress);
        const color = particleColors[particle.type];

        return (
          <g key={particle.id}>
            {/* Glow effect */}
            <circle
              cx={point.x}
              cy={point.y}
              r={8}
              fill={color}
              opacity={0.3}
            />
            {/* Main particle */}
            <circle
              cx={point.x}
              cy={point.y}
              r={6}
              fill={color}
              stroke="white"
              strokeWidth={2}
            />
          </g>
        );
      })}

      {/* Edge label or particle count */}
      {(particles.length > 0 || data?.label) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan px-2 py-0.5 text-xs bg-white/80 rounded-full border shadow-sm"
          >
            {particles.length > 0 ? particles.length : data?.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(AnimatedEdgeComponent);
