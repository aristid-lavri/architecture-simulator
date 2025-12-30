'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Share2, Activity, Server, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, LoadBalancerNodeData, LoadBalancerUtilization } from '@/types';
import { defaultLoadBalancerNodeData } from '@/types';

export type { LoadBalancerNodeData };

interface LoadBalancerNodeProps {
  data: LoadBalancerNodeData;
  selected?: boolean;
}

const algorithmLabels: Record<string, string> = {
  'round-robin': 'Round Robin',
  'least-connections': 'Least Conn',
  'ip-hash': 'IP Hash',
  'weighted': 'Weighted',
};

const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  processing: 'ring-2 ring-green-500 ring-opacity-50',
  success: 'ring-2 ring-green-500 ring-opacity-75',
  error: 'ring-2 ring-red-500 ring-opacity-75',
};

interface LoadBalancerGaugesProps {
  utilization: LoadBalancerUtilization;
}

function LoadBalancerGauges({ utilization }: LoadBalancerGaugesProps) {
  const { totalRequests, activeConnections, backends } = utilization;
  const healthyBackends = backends.filter(b => b.healthy).length;
  const totalBackends = backends.length;

  return (
    <div className="space-y-1 pt-1 border-t border-border/50">
      {/* Backends Status */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Server className="w-3 h-3" />
          Backends:
        </span>
        <span>
          <span className={cn('font-medium', healthyBackends === totalBackends ? 'text-green-500' : 'text-orange-500')}>
            {healthyBackends}
          </span>
          <span className="text-muted-foreground">/{totalBackends}</span>
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          Active: <span className="font-medium text-foreground">{activeConnections}</span>
        </span>
        <span>
          Total: <span className="font-medium text-foreground">{totalRequests.toLocaleString()}</span>
        </span>
      </div>

      {/* Backend distribution mini-bars */}
      {backends.length > 0 && (
        <div className="flex gap-0.5 h-2 rounded overflow-hidden">
          {backends.map((backend, idx) => (
            <div
              key={backend.nodeId || idx}
              className={cn(
                'flex-1 transition-all duration-300',
                backend.healthy ? 'bg-green-500' : 'bg-red-500',
                !backend.healthy && 'opacity-50'
              )}
              style={{
                opacity: backend.healthy ? Math.max(0.3, backend.activeConnections / 10) : 0.3
              }}
              title={`${backend.nodeId}: ${backend.activeConnections} conn`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LoadBalancerNode({ data, selected }: LoadBalancerNodeProps) {
  const {
    label,
    status = 'idle',
    algorithm = defaultLoadBalancerNodeData.algorithm,
    healthCheck = defaultLoadBalancerNodeData.healthCheck,
    stickySessions = false,
    utilization,
  } = data;

  const mode = useAppStore((state) => state.mode);
  const nodeColor = '#22c55e'; // Vert pour Load Balancer (selon plan)
  const showGauges = mode === 'simulation' && utilization;

  return (
    <motion.div
      className={cn(
        'relative rounded-lg border-2 bg-background shadow-md transition-all',
        'min-w-[180px] max-w-[220px]',
        selected ? 'border-primary' : 'border-green-500',
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
      {/* Input Handle (receives requests) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-green-500"
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
          <Share2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground">Load Balancer</div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Algorithm Badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="text-white text-xs px-2 py-0"
            style={{ backgroundColor: nodeColor }}
          >
            {algorithmLabels[algorithm]}
          </Badge>
          {stickySessions && (
            <Badge variant="outline" className="text-xs px-1 py-0">
              Sticky
            </Badge>
          )}
        </div>

        {/* Health Check */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span>Health Check</span>
          </div>
          {healthCheck.enabled ? (
            <span className="text-green-500 text-[10px]">ON</span>
          ) : (
            <span className="text-muted-foreground text-[10px]">OFF</span>
          )}
        </div>

        {/* Resource Gauges (only during simulation with utilization data) */}
        {showGauges && (
          <LoadBalancerGauges utilization={utilization} />
        )}
      </div>

      {/* Status indicator */}
      {status !== 'idle' && (
        <motion.div
          className={cn(
            'absolute -top-1 -right-1 w-3 h-3 rounded-full',
            status === 'processing' && 'bg-green-500',
            status === 'success' && 'bg-green-500',
            status === 'error' && 'bg-red-500'
          )}
          animate={status === 'processing' ? { opacity: [1, 0.5, 1] } : {}}
          transition={
            status === 'processing' ? { duration: 0.8, repeat: Infinity } : {}
          }
        />
      )}

      {/* Output Handle (distributes to backends) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-green-500"
      />
    </motion.div>
  );
}

export default memo(LoadBalancerNode);
