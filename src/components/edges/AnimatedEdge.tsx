'use client';

import { memo, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  type EdgeProps,
} from '@xyflow/react';
import { useSimulationStore } from '@/store/simulation-store';
import type { ParticleType } from '@/types';

const particleColors: Record<ParticleType, string> = {
  request: '#3b82f6',
  'response-success': '#22c55e',
  'response-error': '#ef4444',
};

function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  style = {},
  markerEnd,
}: EdgeProps) {
  const allParticles = useSimulationStore((state) => state.particles);
  const simulationState = useSimulationStore((state) => state.state);

  const particles = useMemo(
    () => allParticles.filter((p) => p.edgeId === id),
    [allParticles, id]
  );

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Calculate point on bezier curve at progress t (0-1)
  const getPointOnPath = (t: number) => {
    const cx1 = sourceX + (targetX - sourceX) * 0.5;
    const cy1 = sourceY;
    const cx2 = sourceX + (targetX - sourceX) * 0.5;
    const cy2 = targetY;

    const x =
      Math.pow(1 - t, 3) * sourceX +
      3 * Math.pow(1 - t, 2) * t * cx1 +
      3 * (1 - t) * Math.pow(t, 2) * cx2 +
      Math.pow(t, 3) * targetX;

    const y =
      Math.pow(1 - t, 3) * sourceY +
      3 * Math.pow(1 - t, 2) * t * cy1 +
      3 * (1 - t) * Math.pow(t, 2) * cy2 +
      Math.pow(t, 3) * targetY;

    return { x, y };
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: simulationState === 'running' ? '#666' : '#888',
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
              filter="blur(3px)"
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

      {/* Particle count label */}
      {particles.length > 0 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan px-2 py-0.5 text-xs bg-white/80 rounded-full border shadow-sm"
          >
            {particles.length}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(AnimatedEdge);
