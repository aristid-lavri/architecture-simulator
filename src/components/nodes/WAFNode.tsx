'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeStatus, WAFNodeData } from '@/types';
import { defaultWAFNodeData } from '@/types';

export type { WAFNodeData };

interface WAFNodeProps {
  data: WAFNodeData;
  selected?: boolean;
}

const SIGNAL_SECURITY = 'oklch(0.65 0.20 25)';

function WAFNode({ data, selected }: WAFNodeProps) {
  const {
    label,
    status = 'idle',
    provider = defaultWAFNodeData.provider,
    blockRate = defaultWAFNodeData.blockRate,
    inspectionLatencyMs = defaultWAFNodeData.inspectionLatencyMs,
    rules = defaultWAFNodeData.rules,
  } = data;

  const activeRules = Object.values(rules).filter(Boolean).length;

  return (
    <motion.div
      className={cn('node-instrument relative min-w-44 max-w-56', selected && 'selected')}
      animate={status === 'processing' ? { scale: [1, 1.01, 1] } : status === 'error' ? { x: [-2, 2, -2, 2, 0] } : {}}
      transition={status === 'processing' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      <div
        className={cn('node-signal-bar', status === 'processing' && 'signal-pulse', status === 'error' && 'signal-pulse-critical')}
        style={{ backgroundColor: SIGNAL_SECURITY }}
      />

      <Handle type="target" position={Position.Left} style={{ borderColor: SIGNAL_SECURITY }} />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: SIGNAL_SECURITY }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_SECURITY } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold" style={{ color: SIGNAL_SECURITY }}>{provider.toUpperCase()}</span>
          <span className="text-muted-foreground">{inspectionLatencyMs}ms</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{activeRules} rules</span>
          <span>{blockRate}% block</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ borderColor: SIGNAL_SECURITY }} />
    </motion.div>
  );
}

export default memo(WAFNode);
