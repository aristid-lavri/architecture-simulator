'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, CircuitBreakerNodeData, CircuitBreakerState } from '@/types';

export type { CircuitBreakerNodeData };

interface CircuitBreakerNodeProps {
  data: CircuitBreakerNodeData;
  selected?: boolean;
}

const SIGNAL_RESILIENCE = 'oklch(0.70 0.18 330)';

const stateColors: Record<CircuitBreakerState, string> = {
  closed: 'text-signal-healthy',
  open: 'text-signal-critical',
  'half-open': 'text-signal-warning',
};

function CircuitBreakerNode({ data, selected }: CircuitBreakerNodeProps) {
  const {
    label,
    status = 'idle',
    failureThreshold,
    timeout,
    circuitState = 'closed',
    failureCount = 0,
  } = data;

  const mode = useAppStore((state) => state.mode);

  return (
    <motion.div
      className={cn('node-instrument relative min-w-44 max-w-56', selected && 'selected')}
      animate={status === 'processing' ? { scale: [1, 1.01, 1] } : status === 'error' ? { x: [-2, 2, -2, 2, 0] } : {}}
      transition={status === 'processing' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      <div
        className={cn('node-signal-bar', status === 'processing' && 'signal-pulse', status === 'error' && 'signal-pulse-critical')}
        style={{ backgroundColor: SIGNAL_RESILIENCE }}
      />

      <Handle type="target" position={Position.Left} style={{ borderColor: SIGNAL_RESILIENCE }} />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <ShieldOff className="w-3.5 h-3.5" style={{ color: SIGNAL_RESILIENCE }} />
          <span className="text-instrument text-[10px] text-muted-foreground">{label}</span>
        </div>
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            status === 'idle' && 'bg-muted-foreground/30',
            status === 'processing' && 'signal-pulse',
            status === 'success' && 'bg-signal-healthy',
            status === 'error' && 'bg-signal-critical signal-pulse-critical'
          )}
          style={status === 'processing' ? { backgroundColor: SIGNAL_RESILIENCE } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className={cn('font-semibold uppercase', stateColors[circuitState])}>{circuitState}</span>
          <span className="text-muted-foreground">{timeout / 1000}s</span>
        </div>
        {mode === 'simulation' && (
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>failures: {failureCount}/{failureThreshold}</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ borderColor: SIGNAL_RESILIENCE }} />
    </motion.div>
  );
}

export default memo(CircuitBreakerNode);
