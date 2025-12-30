'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Database, Clock, AlertTriangle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, DatabaseNodeData, DatabaseUtilization } from '@/types';
import { defaultDatabaseNodeData } from '@/types';

export type { DatabaseNodeData };

interface DatabaseNodeProps {
  data: DatabaseNodeData;
  selected?: boolean;
}

const databaseTypeLabels: Record<string, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
};

const databaseTypeColors: Record<string, string> = {
  postgresql: '#336791',
  mysql: '#4479A1',
  mongodb: '#47A248',
};

const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  processing: 'ring-2 ring-purple-500 ring-opacity-50',
  success: 'ring-2 ring-green-500 ring-opacity-75',
  error: 'ring-2 ring-red-500 ring-opacity-75',
};

interface DatabaseGaugesProps {
  utilization: DatabaseUtilization;
  maxConnections: number;
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

function DatabaseGauges({ utilization, maxConnections }: DatabaseGaugesProps) {
  const { activeConnections, queriesPerSecond, connectionPoolUsage, avgQueryTime } = utilization;
  const connPercentage = Math.min(100, connectionPoolUsage);
  const connColor = getUtilizationColor(connPercentage);

  return (
    <div className="space-y-1 pt-1 border-t border-border/50">
      {/* Connection Pool Usage */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 text-muted-foreground">
          <Layers className="w-3 h-3" />
        </div>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', connColor)}
            style={{ width: `${connPercentage}%` }}
          />
        </div>
        <span className={cn('text-[10px] font-medium w-7 text-right', getUtilizationTextColor(connPercentage))}>
          {Math.round(connPercentage)}%
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
        <span>
          Conn: <span className="font-medium text-foreground">{activeConnections}/{maxConnections}</span>
        </span>
        <span>
          Q/s: <span className="font-medium text-foreground">{Math.round(queriesPerSecond)}</span>
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          Latence: <span className="font-medium text-foreground">{avgQueryTime.toFixed(1)}ms</span>
        </span>
      </div>
    </div>
  );
}

function DatabaseNode({ data, selected }: DatabaseNodeProps) {
  const {
    label,
    status = 'idle',
    databaseType = defaultDatabaseNodeData.databaseType,
    connectionPool = defaultDatabaseNodeData.connectionPool,
    performance = defaultDatabaseNodeData.performance,
    errorRate = 0,
    utilization,
  } = data;

  const mode = useAppStore((state) => state.mode);
  const nodeColor = '#9333ea'; // Violet foncé pour Database (selon plan)
  const dbTypeColor = databaseTypeColors[databaseType] || nodeColor;
  const showGauges = mode === 'simulation' && utilization;

  return (
    <motion.div
      className={cn(
        'relative rounded-lg border-2 bg-background shadow-md transition-all',
        'min-w-[180px] max-w-[220px]',
        selected ? 'border-primary' : 'border-purple-700',
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
      {/* Input Handle (Database receives queries) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-purple-700"
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
          <Database className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground">{databaseTypeLabels[databaseType]}</div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Database Type Badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="text-white text-xs px-2 py-0"
            style={{ backgroundColor: dbTypeColor }}
          >
            {databaseType.toUpperCase()}
          </Badge>
        </div>

        {/* Connection Pool and Latency */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            <span>{connectionPool.maxConnections} conn</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{performance.readLatencyMs}ms</span>
          </div>
        </div>

        {/* Error Rate */}
        {errorRate > 0 && (
          <div className="flex items-center gap-1 text-xs text-orange-500">
            <AlertTriangle className="w-3 h-3" />
            <span>{errorRate}% erreur</span>
          </div>
        )}

        {/* Resource Gauges (only during simulation with utilization data) */}
        {showGauges && (
          <DatabaseGauges
            utilization={utilization}
            maxConnections={connectionPool.maxConnections}
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

      {/* Output Handle (Database sends responses) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-700"
      />
    </motion.div>
  );
}

export default memo(DatabaseNode);