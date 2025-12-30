'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Users, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { NodeStatus, LoadDistribution, RampUpCurve } from '@/types';

export interface ClientGroupNodeData {
  label: string;
  status?: NodeStatus;
  virtualClients: number;
  requestMode: 'sequential' | 'parallel';
  concurrentRequests: number;
  baseInterval: number;
  intervalVariance: number;
  distribution: LoadDistribution;
  burstSize?: number;
  burstInterval?: number;
  rampUpEnabled: boolean;
  rampUpDuration: number;
  rampUpCurve: RampUpCurve;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  requestBody?: string;
  activeClients?: number;
  requestsSent?: number;
  [key: string]: unknown;
}

interface ClientGroupNodeProps {
  data: ClientGroupNodeData;
  selected?: boolean;
}

const distributionLabels: Record<LoadDistribution, string> = {
  uniform: 'Uniforme',
  random: 'Aléatoire',
  burst: 'Burst',
};

const rampUpLabels: Record<RampUpCurve, string> = {
  linear: 'Linéaire',
  exponential: 'Exponentiel',
  step: 'Par paliers',
};

const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  processing: 'ring-2 ring-blue-500 ring-opacity-50',
  success: 'ring-2 ring-green-500 ring-opacity-75',
  error: 'ring-2 ring-red-500 ring-opacity-75',
};

function ClientGroupNode({ data, selected }: ClientGroupNodeProps) {
  const {
    label,
    status = 'idle',
    virtualClients = 10,
    requestMode = 'parallel',
    concurrentRequests = 5,
    distribution = 'uniform',
    rampUpEnabled = false,
    rampUpDuration = 30000,
    rampUpCurve = 'linear',
    activeClients,
    requestsSent,
  } = data;

  const nodeColor = '#3b82f6'; // Blue for Client Group
  const displayActiveClients = activeClients ?? 0;
  const displayRequestsSent = requestsSent ?? 0;

  // Calculate requests per second approximation
  // In parallel mode, each client can send multiple concurrent requests
  const multiplier = requestMode === 'parallel' ? concurrentRequests : 1;
  const rps = displayActiveClients > 0 && data.baseInterval > 0
    ? Math.round((displayActiveClients * multiplier * 1000) / data.baseInterval * 10) / 10
    : 0;

  return (
    <motion.div
      className={cn(
        'relative rounded-lg border-2 bg-background shadow-md transition-all',
        'min-w-[200px] max-w-[240px]',
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
          <Users className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground">Groupe de clients</div>
        </div>
        {/* Virtual clients badge */}
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 text-xs">
          {virtualClients}
        </Badge>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Request Mode */}
        <div className="flex items-center gap-2 text-xs">
          <Zap className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Mode:</span>
          <span className="font-medium">
            {requestMode === 'parallel' ? `Parallèle (×${concurrentRequests})` : 'Séquentiel'}
          </span>
        </div>

        {/* Distribution */}
        <div className="flex items-center gap-2 text-xs">
          <Zap className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Distribution:</span>
          <span className="font-medium">{distributionLabels[distribution]}</span>
        </div>

        {/* Ramp-up info */}
        {rampUpEnabled && (
          <div className="flex items-center gap-2 text-xs">
            <TrendingUp className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Ramp-up:</span>
            <span className="font-medium">
              {rampUpDuration / 1000}s {rampUpLabels[rampUpCurve]}
            </span>
          </div>
        )}

        {/* Runtime stats (always visible) */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
          <div className="text-muted-foreground">
            Actifs: <span className="font-medium text-foreground">{displayActiveClients}/{virtualClients}</span>
          </div>
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">{rps}</span> req/s
          </div>
        </div>

        {/* Total requests sent (always visible) */}
        <div className="text-xs text-muted-foreground text-center">
          Total: <span className="font-medium text-foreground">{displayRequestsSent}</span> requêtes
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

      {/* Output Handle only (Client Group sends requests) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500"
      />
    </motion.div>
  );
}

export default memo(ClientGroupNode);
