'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Database, Clock, AlertTriangle, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, CacheNodeData, CacheUtilization } from '@/types';
import { defaultCacheNodeData } from '@/types';

export type { CacheNodeData };

interface CacheNodeProps {
  data: CacheNodeData;
  selected?: boolean;
}

const cacheTypeLabels: Record<string, string> = {
  redis: 'Redis',
  memcached: 'Memcached',
};

const cacheTypeColors: Record<string, string> = {
  redis: '#DC382D',
  memcached: '#00A4DB',
};

const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  processing: 'ring-2 ring-orange-500 ring-opacity-50',
  success: 'ring-2 ring-green-500 ring-opacity-75',
  error: 'ring-2 ring-red-500 ring-opacity-75',
};

interface CacheGaugesProps {
  utilization: CacheUtilization;
  maxMemoryMB: number;
}

function getUtilizationColor(percentage: number): string {
  if (percentage < 70) return 'bg-green-500';
  if (percentage < 90) return 'bg-orange-500';
  return 'bg-red-500';
}

function getUtilizationTextColor(percentage: number): string {
  if (percentage < 70) return 'text-green-500';
  if (percentage < 90) return 'text-orange-500';
  return 'text-red-500';
}

function CacheGauges({ utilization, maxMemoryMB }: CacheGaugesProps) {
  const { memoryUsage, hitRatio, keyCount, hitCount, missCount } = utilization;
  const memColor = getUtilizationColor(memoryUsage);
  const hitColor = hitRatio >= 80 ? 'bg-green-500' : hitRatio >= 50 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="space-y-1 pt-1 border-t border-border/50">
      {/* Memory Usage */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 text-muted-foreground">
          <Database className="w-3 h-3" />
        </div>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', memColor)}
            style={{ width: `${memoryUsage}%` }}
          />
        </div>
        <span className={cn('text-[10px] font-medium w-7 text-right', getUtilizationTextColor(memoryUsage))}>
          {Math.round(memoryUsage)}%
        </span>
      </div>

      {/* Hit Ratio */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 text-muted-foreground">
          <TrendingUp className="w-3 h-3" />
        </div>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', hitColor)}
            style={{ width: `${hitRatio}%` }}
          />
        </div>
        <span className={cn('text-[10px] font-medium w-7 text-right', hitRatio >= 80 ? 'text-green-500' : hitRatio >= 50 ? 'text-orange-500' : 'text-red-500')}>
          {Math.round(hitRatio)}%
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
        <span>
          Keys: <span className="font-medium text-foreground">{keyCount.toLocaleString()}</span>
        </span>
        <span>
          H/M: <span className="font-medium text-green-500">{hitCount}</span>/<span className="font-medium text-red-500">{missCount}</span>
        </span>
      </div>
    </div>
  );
}

function CacheNode({ data, selected }: CacheNodeProps) {
  const {
    label,
    status = 'idle',
    cacheType = defaultCacheNodeData.cacheType,
    configuration = defaultCacheNodeData.configuration,
    performance = defaultCacheNodeData.performance,
    initialHitRatio = 80,
    utilization,
  } = data;

  const mode = useAppStore((state) => state.mode);
  const nodeColor = '#f97316'; // Orange pour Cache (selon plan)
  const cacheColor = cacheTypeColors[cacheType] || nodeColor;
  const showGauges = mode === 'simulation' && utilization;

  return (
    <motion.div
      className={cn(
        'relative rounded-lg border-2 bg-background shadow-md transition-all',
        'min-w-[180px] max-w-[220px]',
        selected ? 'border-primary' : 'border-orange-500',
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
      {/* Input Handle (Cache receives requests) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-orange-500"
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
          <Zap className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground">{cacheTypeLabels[cacheType]}</div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Cache Type Badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="text-white text-xs px-2 py-0"
            style={{ backgroundColor: cacheColor }}
          >
            {cacheType.toUpperCase()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {configuration.maxMemoryMB}MB
          </span>
        </div>

        {/* Latency and Hit Ratio */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{performance.getLatencyMs}ms</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>{initialHitRatio}% hit</span>
          </div>
        </div>

        {/* Resource Gauges (only during simulation with utilization data) */}
        {showGauges && (
          <CacheGauges
            utilization={utilization}
            maxMemoryMB={configuration.maxMemoryMB}
          />
        )}
      </div>

      {/* Status indicator */}
      {status !== 'idle' && (
        <motion.div
          className={cn(
            'absolute -top-1 -right-1 w-3 h-3 rounded-full',
            status === 'processing' && 'bg-orange-500',
            status === 'success' && 'bg-green-500',
            status === 'error' && 'bg-red-500'
          )}
          animate={status === 'processing' ? { opacity: [1, 0.5, 1] } : {}}
          transition={
            status === 'processing' ? { duration: 0.8, repeat: Infinity } : {}
          }
        />
      )}

      {/* Output Handle (Cache sends responses) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-orange-500"
      />
    </motion.div>
  );
}

export default memo(CacheNode);
