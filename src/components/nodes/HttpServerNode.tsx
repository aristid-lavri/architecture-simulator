'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Server, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import ResourceGauges from './ResourceGauges';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, ServerResources, ResourceUtilization, DegradationSettings } from '@/types';
import { defaultServerResources } from '@/types';

export interface HttpServerNodeData {
  label: string;
  status?: NodeStatus;
  // HTTP Server specific
  port: number;
  responseStatus: number;
  responseBody?: string;
  responseDelay: number;
  errorRate: number;
  // Resource configuration
  resources?: ServerResources;
  utilization?: ResourceUtilization;
  degradation?: DegradationSettings;
  [key: string]: unknown;
}

interface HttpServerNodeProps {
  data: HttpServerNodeData;
  selected?: boolean;
}

const statusCodeColors: Record<string, string> = {
  '2': 'bg-green-500', // 2xx
  '3': 'bg-blue-500',  // 3xx
  '4': 'bg-orange-500', // 4xx
  '5': 'bg-red-500',    // 5xx
};

const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  processing: 'ring-2 ring-purple-500 ring-opacity-50',
  success: 'ring-2 ring-green-500 ring-opacity-75',
  error: 'ring-2 ring-red-500 ring-opacity-75',
};

function HttpServerNode({ data, selected }: HttpServerNodeProps) {
  const {
    label,
    status = 'idle',
    port = 8080,
    responseStatus = 200,
    responseDelay = 100,
    errorRate = 0,
    resources = defaultServerResources,
    utilization,
  } = data;

  const mode = useAppStore((state) => state.mode);
  const nodeColor = '#8b5cf6'; // Purple for HTTP Server
  const statusCodeCategory = String(responseStatus).charAt(0);
  const statusCodeColor = statusCodeColors[statusCodeCategory] || 'bg-gray-500';
  const showResourceGauges = mode === 'simulation' && utilization;

  return (
    <motion.div
      className={cn(
        'relative rounded-lg border-2 bg-background shadow-md transition-all',
        'min-w-[180px] max-w-[220px]',
        selected ? 'border-primary' : 'border-purple-500',
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
      {/* Input Handle (Server receives requests) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-md"
        style={{ backgroundColor: `${nodeColor}20` }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md"
          style={{ backgroundColor: nodeColor, color: 'white' }}
        >
          <Server className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground">:{port}</div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Status code */}
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn('text-white text-xs px-2 py-0', statusCodeColor)}
          >
            {responseStatus}
          </Badge>
          <span className="text-xs text-muted-foreground">Status</span>
        </div>

        {/* Latency and Error Rate */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{responseDelay}ms</span>
          </div>
          {errorRate > 0 && (
            <div className="flex items-center gap-1 text-orange-500">
              <AlertTriangle className="w-3 h-3" />
              <span>{errorRate}%</span>
            </div>
          )}
        </div>

        {/* Resource Gauges (only during simulation with utilization data) */}
        {showResourceGauges && (
          <ResourceGauges
            utilization={utilization}
            resources={resources}
            compact
          />
        )}
      </div>

      {/* Status indicator */}
      {status !== 'idle' && (
        <motion.div
          className={cn(
            'absolute -top-1 -right-1 w-3 h-3 rounded-full',
            status === 'processing' && 'bg-purple-500',
            status === 'success' && 'bg-green-500',
            status === 'error' && 'bg-red-500'
          )}
          animate={status === 'processing' ? { opacity: [1, 0.5, 1] } : {}}
          transition={
            status === 'processing' ? { duration: 0.8, repeat: Infinity } : {}
          }
        />
      )}

      {/* Output Handle (Server sends responses) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background"
      />
    </motion.div>
  );
}

export default memo(HttpServerNode);
