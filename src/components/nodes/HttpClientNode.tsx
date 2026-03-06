'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Monitor, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeStatus, HttpMethod, RequestMode } from '@/types';

export interface HttpClientNodeData {
  label: string;
  status?: NodeStatus;
  method: HttpMethod;
  path: string;
  requestMode: RequestMode;
  interval?: number;
  [key: string]: unknown;
}

interface HttpClientNodeProps {
  data: HttpClientNodeData;
  selected?: boolean;
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'text-signal-healthy',
  POST: 'text-signal-flux',
  PUT: 'text-signal-infra',
  DELETE: 'text-signal-critical',
};

const SIGNAL_CLIENT = 'oklch(0.70 0.15 220)';

function HttpClientNode({ data, selected }: HttpClientNodeProps) {
  const {
    label,
    status = 'idle',
    method = 'GET',
    path = '/api',
    requestMode = 'single',
    interval,
  } = data;

  return (
    <motion.div
      className={cn(
        'node-instrument relative min-w-44 max-w-56',
        selected && 'selected'
      )}
      animate={
        status === 'processing'
          ? { scale: [1, 1.01, 1] }
          : status === 'error'
          ? { x: [-2, 2, -2, 2, 0] }
          : {}
      }
      transition={
        status === 'processing'
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.3 }
      }
    >
      {/* Signal bar */}
      <div
        className={cn(
          'node-signal-bar',
          status === 'processing' && 'signal-pulse',
          status === 'error' && 'signal-pulse-critical'
        )}
        style={{ backgroundColor: SIGNAL_CLIENT }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5" style={{ color: SIGNAL_CLIENT }} />
          <span className="text-instrument text-[10px] text-muted-foreground">
            {label}
          </span>
        </div>
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            status === 'idle' && 'bg-muted-foreground/30',
            status === 'processing' && 'signal-pulse',
            status === 'success' && 'bg-signal-healthy',
            status === 'error' && 'bg-signal-critical signal-pulse-critical'
          )}
          style={status === 'processing' ? { backgroundColor: SIGNAL_CLIENT } : undefined}
        />
      </div>

      {/* Content */}
      <div className="px-3 pb-2.5 space-y-1.5">
        {/* Method + Path */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className={cn('font-semibold', methodColors[method])}>
            {method}
          </span>
          <span className="text-foreground truncate">{path}</span>
        </div>

        {/* Mode */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
          {requestMode === 'loop' ? (
            <>
              <Repeat className="w-2.5 h-2.5" />
              <span>{interval || 1000}ms</span>
            </>
          ) : (
            <span>single</span>
          )}
        </div>
      </div>

      {/* Output Handle only */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: SIGNAL_CLIENT }}
      />
    </motion.div>
  );
}

export default memo(HttpClientNode);
