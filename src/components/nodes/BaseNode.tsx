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

const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  processing: 'ring-2 ring-blue-500 ring-opacity-50',
  success: 'ring-2 ring-green-500 ring-opacity-75',
  error: 'ring-2 ring-red-500 ring-opacity-75',
};

const statusAnimations: Record<NodeStatus, TargetAndTransition> = {
  idle: {},
  processing: {
    scale: [1, 1.02, 1],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  success: {
    scale: [1, 1.05, 1],
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
        'relative rounded-lg border-2 bg-background shadow-md transition-all',
        'min-w-[150px] max-w-[200px]',
        selected && 'border-primary',
        statusStyles[status]
      )}
      style={{ borderColor: selected ? undefined : color }}
      animate={statusAnimations[status]}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-md"
        style={{ backgroundColor: `${color}20` }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md"
          style={{ backgroundColor: color, color: 'white' }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {children && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {children}
        </div>
      )}

      {/* Status indicator */}
      {status !== 'idle' && (
        <motion.div
          className={cn(
            'absolute -top-1 -right-1 w-3 h-3 rounded-full',
            status === 'processing' && 'bg-blue-500',
            status === 'success' && 'bg-green-500',
            status === 'error' && 'bg-red-500'
          )}
          animate={
            status === 'processing'
              ? { opacity: [1, 0.5, 1] }
              : {}
          }
          transition={
            status === 'processing'
              ? { duration: 0.8, repeat: Infinity }
              : {}
          }
        />
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />
    </motion.div>
  );
}

export default memo(BaseNode);
