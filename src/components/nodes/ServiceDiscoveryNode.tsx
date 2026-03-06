'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeStatus, ServiceDiscoveryNodeData } from '@/types';
import { defaultServiceDiscoveryData } from '@/types';

export type { ServiceDiscoveryNodeData };

interface ServiceDiscoveryNodeProps {
  data: ServiceDiscoveryNodeData;
  selected?: boolean;
}

const SIGNAL_DISCOVERY = 'oklch(0.68 0.15 180)';

function ServiceDiscoveryNode({ data, selected }: ServiceDiscoveryNodeProps) {
  const {
    label,
    status = 'idle',
    provider = defaultServiceDiscoveryData.provider,
    lookupLatencyMs = defaultServiceDiscoveryData.lookupLatencyMs,
    healthCheckIntervalMs = defaultServiceDiscoveryData.healthCheckIntervalMs,
  } = data;

  return (
    <motion.div
      className={cn('node-instrument relative min-w-44 max-w-56', selected && 'selected')}
      animate={status === 'processing' ? { scale: [1, 1.01, 1] } : status === 'error' ? { x: [-2, 2, -2, 2, 0] } : {}}
      transition={status === 'processing' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      <div
        className={cn('node-signal-bar', status === 'processing' && 'signal-pulse', status === 'error' && 'signal-pulse-critical')}
        style={{ backgroundColor: SIGNAL_DISCOVERY }}
      />

      <Handle type="target" position={Position.Left} style={{ borderColor: SIGNAL_DISCOVERY }} />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Compass className="w-3.5 h-3.5" style={{ color: SIGNAL_DISCOVERY }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_DISCOVERY } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold" style={{ color: SIGNAL_DISCOVERY }}>{provider.toUpperCase()}</span>
          <span className="text-muted-foreground">{lookupLatencyMs}ms</span>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          health: {healthCheckIntervalMs / 1000}s
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ borderColor: SIGNAL_DISCOVERY }} />
    </motion.div>
  );
}

export default memo(ServiceDiscoveryNode);
