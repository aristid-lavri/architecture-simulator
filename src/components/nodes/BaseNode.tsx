'use client';

import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion, type TargetAndTransition } from 'framer-motion';
import { Skull, AlertTriangle } from 'lucide-react';
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
  down: {
    opacity: [1, 0.4, 1],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  degraded: {
    opacity: [1, 0.7, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

function BaseNode({ data, selected }: BaseNodeProps) {
  const { label, icon, color, status = 'idle', subtitle, children } = data;

  const isDown = status === 'down';
  const isDegraded = status === 'degraded';
  const isFaulted = isDown || isDegraded;

  return (
    <motion.div
      className={cn(
        'node-instrument relative',
        'min-w-[160px] max-w-[210px]',
        selected && 'selected',
        isDown && 'ring-2 ring-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.4)]',
        isDegraded && 'ring-2 ring-orange-500/80 shadow-[0_0_12px_rgba(249,115,22,0.3)]'
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
          status === 'error' && 'signal-pulse-critical',
          isDown && 'signal-pulse-critical',
          isDegraded && 'signal-pulse'
        )}
        style={{
          backgroundColor: isDown
            ? 'oklch(0.65 0.22 25)'
            : isDegraded
            ? 'oklch(0.75 0.18 55)'
            : color,
        }}
      />

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ borderColor: isFaulted ? (isDown ? '#ef4444' : '#f97316') : color }}
      />

      {/* Header — instrument label */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-muted-foreground" style={{ color: isFaulted ? undefined : color }}>
            {isDown ? (
              <Skull size={16} className="text-red-500" />
            ) : isDegraded ? (
              <AlertTriangle size={16} className="text-orange-500" />
            ) : (
              icon
            )}
          </div>
          <div className="min-w-0">
            <div className={cn(
              'text-instrument text-[10px] truncate',
              isDown ? 'text-red-400' : isDegraded ? 'text-orange-400' : 'text-muted-foreground'
            )}>
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
            status === 'error' && 'signal-pulse-critical',
            isDown && 'signal-pulse-critical',
            isDegraded && 'signal-pulse'
          )}
          style={{
            backgroundColor:
              isDown
                ? 'oklch(0.65 0.22 25)'
                : isDegraded
                ? 'oklch(0.75 0.18 55)'
                : status === 'processing'
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
        style={{ borderColor: isFaulted ? (isDown ? '#ef4444' : '#f97316') : color }}
      />
    </motion.div>
  );
}

export default memo(BaseNode);
