'use client';

import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContainerNodeData } from '@/types';
import { defaultContainerData, containerColor } from '@/types';

export type { ContainerNodeData };

interface ContainerNodeProps {
  data: ContainerNodeData;
  selected?: boolean;
}

const SIGNAL_COMPUTE = containerColor;

function ContainerNode({ data, selected }: ContainerNodeProps) {
  const {
    label,
    status = 'idle',
    image = defaultContainerData.image,
    replicas = defaultContainerData.replicas,
    cpuLimit = defaultContainerData.cpuLimit,
    memoryLimit = defaultContainerData.memoryLimit,
    cpuLimitCores = defaultContainerData.cpuLimitCores,
    memoryLimitMB = defaultContainerData.memoryLimitMB,
    color = SIGNAL_COMPUTE,
  } = data;

  return (
    <div
      className={cn(
        'min-w-[200px] min-h-[150px] w-full h-full rounded-lg border-2',
        selected && 'ring-2 ring-ring ring-offset-2'
      )}
      style={{
        borderColor: `color-mix(in oklch, ${color}, transparent 30%)`,
        borderStyle: 'dashed',
        backgroundColor: `color-mix(in oklch, ${color}, transparent 94%)`,
      }}
    >
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="!border-ring"
        handleClassName="!bg-ring !w-2 !h-2"
      />

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ borderColor: color }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-t-md"
        style={{ backgroundColor: `color-mix(in oklch, ${color}, transparent 75%)` }}
      >
        <Box className="w-3.5 h-3.5" style={{ color }} />
        <span className="font-mono text-[11px] font-semibold" style={{ color }}>
          {label}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">
          {replicas}x {image}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground ml-auto">
          {cpuLimitCores != null ? `${cpuLimitCores} cores` : `cpu: ${cpuLimit}`}
          {' | '}
          {memoryLimitMB != null ? `${memoryLimitMB} MB` : `mem: ${memoryLimit}`}
        </span>

        {/* Status indicator */}
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            status === 'idle' && 'bg-muted-foreground/30',
            status === 'processing' && 'signal-pulse',
            status === 'success' && 'bg-signal-healthy',
            status === 'error' && 'bg-signal-critical signal-pulse-critical'
          )}
          style={status === 'processing' ? { backgroundColor: color } : undefined}
        />
      </div>

      {/* Interior zone for child services — extra padding at bottom */}
      <div className="px-2 pt-2 pb-8" />

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: color }}
      />
    </div>
  );
}

export default memo(ContainerNode);
