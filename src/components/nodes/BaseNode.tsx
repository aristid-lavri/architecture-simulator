'use client';

import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion, type TargetAndTransition } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { NodeStatus } from '@/types';

interface BaseNodeData {
  label: string;
  icon: ReactNode;
  color: string;
  status?: NodeStatus;
  subtitle?: string;
  children?: ReactNode;
}

interface BaseNodeProps {
  data: BaseNodeData;
  selected?: boolean;
}

const statusAnimations: Record<NodeStatus, TargetAndTransition> = {
  idle: {},
  processing: {
    scale: [1, 1.01, 1],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  success: {
    scale: [1, 1.02, 1],
    transition: { duration: 0.3 },
  },
  error: {
    x: [-2, 2, -2, 2, 0],
    transition: { duration: 0.3 },
  },
};

function BaseNode({ data, selected }: BaseNodeProps) {
  const { label, icon, color, status = 'idle', subtitle, children } = data;

  return (
    <motion.div
      className={cn(
        'node-instrument relative',
        'min-w-[160px] max-w-[210px]',
        selected && 'selected'
      )}
      animate={statusAnimations[status]}
      role="group"
      aria-label={`${label} — ${status}`}
    >
      {/* Signal bar — left accent */}
      <div
        className={cn(
          'node-signal-bar',
          status === 'processing' && 'signal-pulse',
          status === 'error' && 'signal-pulse-critical'
        )}
        style={{ backgroundColor: color }}
      />

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ borderColor: color }}
      />

      {/* Header — instrument label */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-muted-foreground" style={{ color }}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-instrument text-[10px] text-muted-foreground truncate">
              {label}
            </div>
            {subtitle && (
              <div className="text-xs font-mono text-foreground truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Status dot */}
        <div
          className={cn(
            'w-[6px] h-[6px] rounded-full flex-shrink-0',
            status === 'idle' && 'bg-muted-foreground/30',
            status === 'processing' && 'signal-pulse',
            status === 'success' && '',
            status === 'error' && 'signal-pulse-critical'
          )}
          style={{
            backgroundColor:
              status === 'processing'
                ? color
                : status === 'success'
                ? 'oklch(0.72 0.19 155)'
                : status === 'error'
                ? 'oklch(0.65 0.22 25)'
                : undefined,
          }}
        />
      </div>

      {/* Content */}
      {children && (
        <div className="px-3 pb-2 font-mono text-xs text-muted-foreground">
          {children}
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: color }}
      />
    </motion.div>
  );
}

export default memo(BaseNode);
