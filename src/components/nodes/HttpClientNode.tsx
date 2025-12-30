'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Monitor, ArrowRight, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { NodeStatus, HttpMethod, RequestMode } from '@/types';

export interface HttpClientNodeData {
  label: string;
  status?: NodeStatus;
  // HTTP Client specific
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
  GET: 'bg-green-500',
  POST: 'bg-blue-500',
  PUT: 'bg-orange-500',
  DELETE: 'bg-red-500',
};

const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  processing: 'ring-2 ring-blue-500 ring-opacity-50',
  success: 'ring-2 ring-green-500 ring-opacity-75',
  error: 'ring-2 ring-red-500 ring-opacity-75',
};

function HttpClientNode({ data, selected }: HttpClientNodeProps) {
  const {
    label,
    status = 'idle',
    method = 'GET',
    path = '/api',
    requestMode = 'single',
    interval,
  } = data;

  const nodeColor = '#3b82f6'; // Blue for HTTP Client

  return (
    <motion.div
      className={cn(
        'relative rounded-lg border-2 bg-background shadow-md transition-all',
        'min-w-[180px] max-w-[220px]',
        selected ? 'border-primary' : 'border-blue-500',
        statusStyles[status]
      )}
      animate={
        status === 'processing'
          ? { scale: [1, 1.02, 1] }
          : status === 'error'
          ? { x: [-2, 2, -2, 2, 0] }
          : {}
      }
      transition={
        status === 'processing'
          ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.3 }
      }
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-md"
        style={{ backgroundColor: `${nodeColor}20` }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md"
          style={{ backgroundColor: nodeColor, color: 'white' }}
        >
          <Monitor className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground">Client HTTP</div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Method and Path */}
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn('text-white text-xs px-2 py-0', methodColors[method])}
          >
            {method}
          </Badge>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {path}
          </span>
        </div>

        {/* Mode indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {requestMode === 'loop' ? (
            <>
              <Repeat className="w-3 h-3" />
              <span>Boucle {interval ? `(${interval}ms)` : ''}</span>
            </>
          ) : (
            <>
              <ArrowRight className="w-3 h-3" />
              <span>Requête unique</span>
            </>
          )}
        </div>
      </div>

      {/* Status indicator */}
      {status !== 'idle' && (
        <motion.div
          className={cn(
            'absolute -top-1 -right-1 w-3 h-3 rounded-full',
            status === 'processing' && 'bg-blue-500',
            status === 'success' && 'bg-green-500',
            status === 'error' && 'bg-red-500'
          )}
          animate={status === 'processing' ? { opacity: [1, 0.5, 1] } : {}}
          transition={
            status === 'processing' ? { duration: 0.8, repeat: Infinity } : {}
          }
        />
      )}

      {/* Output Handle only (Client sends requests) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500"
      />
    </motion.div>
  );
}

export default memo(HttpClientNode);
