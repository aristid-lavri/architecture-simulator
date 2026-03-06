'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeStatus, ContainerNodeData } from '@/types';
import { defaultContainerData } from '@/types';

export type { ContainerNodeData };

interface ContainerNodeProps {
  data: ContainerNodeData;
  selected?: boolean;
}

const SIGNAL_COMPUTE = 'oklch(0.68 0.18 50)';

function ContainerNode({ data, selected }: ContainerNodeProps) {
  const {
    label,
    status = 'idle',
    image = defaultContainerData.image,
    replicas = defaultContainerData.replicas,
    cpuLimit = defaultContainerData.cpuLimit,
    memoryLimit = defaultContainerData.memoryLimit,
  } = data;

  return (
    <motion.div
      className={cn('node-instrument relative min-w-44 max-w-56', selected && 'selected')}
      animate={status === 'processing' ? { scale: [1, 1.01, 1] } : status === 'error' ? { x: [-2, 2, -2, 2, 0] } : {}}
      transition={status === 'processing' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      <div
        className={cn('node-signal-bar', status === 'processing' && 'signal-pulse', status === 'error' && 'signal-pulse-critical')}
        style={{ backgroundColor: SIGNAL_COMPUTE }}
      />

      <Handle type="target" position={Position.Left} style={{ borderColor: SIGNAL_COMPUTE }} />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Box className="w-3.5 h-3.5" style={{ color: SIGNAL_COMPUTE }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_COMPUTE } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold" style={{ color: SIGNAL_COMPUTE }}>{replicas}x</span>
          <span className="text-muted-foreground text-[10px]">{image}</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>cpu: {cpuLimit}</span>
          <span>mem: {memoryLimit}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ borderColor: SIGNAL_COMPUTE }} />
    </motion.div>
  );
}

export default memo(ContainerNode);
