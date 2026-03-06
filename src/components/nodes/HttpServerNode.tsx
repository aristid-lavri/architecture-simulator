'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import ResourceGauges from './ResourceGauges';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, ServerResources, ResourceUtilization, DegradationSettings } from '@/types';
import { defaultServerResources } from '@/types';

export interface HttpServerNodeData {
  label: string;
  status?: NodeStatus;
  port: number;
  responseStatus: number;
  responseBody?: string;
  responseDelay: number;
  errorRate: number;
  resources?: ServerResources;
  utilization?: ResourceUtilization;
  degradation?: DegradationSettings;
  [key: string]: unknown;
}

interface HttpServerNodeProps {
  data: HttpServerNodeData;
  selected?: boolean;
}

const SIGNAL_SERVER = 'oklch(0.68 0.18 290)';

function getStatusColor(code: number): string {
  if (code < 300) return 'text-signal-healthy';
  if (code < 400) return 'text-signal-flux';
  if (code < 500) return 'text-signal-warning';
  return 'text-signal-critical';
}

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
  const showResourceGauges = mode === 'simulation' && utilization;

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
        style={{ backgroundColor: SIGNAL_SERVER }}
      />

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ borderColor: SIGNAL_SERVER }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Server className="w-3.5 h-3.5" style={{ color: SIGNAL_SERVER }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_SERVER } : undefined}
        />
      </div>

      {/* Content */}
      <div className="px-3 pb-2.5 space-y-1.5">
        {/* Port + Status */}
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-muted-foreground">:{port}</span>
          <span className={cn('font-semibold', getStatusColor(responseStatus))}>
            {responseStatus}
          </span>
        </div>

        {/* Latency + Error rate */}
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{responseDelay}ms</span>
          {errorRate > 0 && (
            <span className="text-signal-warning">{errorRate}% err</span>
          )}
        </div>

        {/* Resource Gauges */}
        {showResourceGauges && (
          <ResourceGauges
            utilization={utilization}
            resources={resources}
            compact
          />
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: SIGNAL_SERVER }}
      />
    </motion.div>
  );
}

export default memo(HttpServerNode);
