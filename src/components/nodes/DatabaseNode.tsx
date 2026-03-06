'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, DatabaseNodeData, DatabaseUtilization } from '@/types';
import { defaultDatabaseNodeData } from '@/types';

export type { DatabaseNodeData };

interface DatabaseNodeProps {
  data: DatabaseNodeData;
  selected?: boolean;
}

const SIGNAL_DATA = 'oklch(0.72 0.19 155)';

function DatabaseGauges({ utilization, maxConnections }: { utilization: DatabaseUtilization; maxConnections: number }) {
  const { activeConnections, queriesPerSecond, connectionPoolUsage, avgQueryTime } = utilization;
  const connPercentage = Math.min(100, connectionPoolUsage);

  return (
    <div className="space-y-1 pt-1.5 border-t border-border/50">
      {/* Pool bar */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[9px] text-muted-foreground w-6">POOL</span>
        <div className="flex-1 h-0.5 bg-border rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full resource-bar',
              connPercentage < 70 ? 'bg-signal-healthy' : connPercentage < 90 ? 'bg-signal-warning' : 'bg-signal-critical'
            )}
            style={{ width: `${connPercentage}%` }}
          />
        </div>
        <span className={cn(
          'font-mono text-[9px] w-6 text-right',
          connPercentage < 70 ? 'text-signal-healthy' : connPercentage < 90 ? 'text-signal-warning' : 'text-signal-critical'
        )}>
          {Math.round(connPercentage)}%
        </span>
      </div>
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
        <span>conn {activeConnections}/{maxConnections}</span>
        <span>{Math.round(queriesPerSecond)} q/s</span>
      </div>
      <div className="font-mono text-[9px] text-muted-foreground">
        latency {avgQueryTime.toFixed(1)}ms
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
  const showGauges = mode === 'simulation' && utilization;

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
        style={{ backgroundColor: SIGNAL_DATA }}
      />

      <Handle type="target" position={Position.Left} style={{ borderColor: SIGNAL_DATA }} />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5" style={{ color: SIGNAL_DATA }} />
          <span className="text-instrument text-[10px] text-muted-foreground">{label}</span>
        </div>
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            status === 'idle' && 'bg-muted-foreground/30',
            status === 'processing' && 'signal-pulse',
            status === 'success' && 'bg-signal-healthy',
            status === 'error' && 'bg-signal-critical signal-pulse-critical'
          )}
          style={status === 'processing' ? { backgroundColor: SIGNAL_DATA } : undefined}
        />
      </div>

      {/* Content */}
      <div className="px-3 pb-2.5 space-y-1.5">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-signal-data font-semibold">{databaseType.toUpperCase()}</span>
          <span className="text-muted-foreground">{connectionPool.maxConnections} conn</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{performance.readLatencyMs}ms read</span>
          {errorRate > 0 && <span className="text-signal-warning">{errorRate}% err</span>}
        </div>

        {showGauges && (
          <DatabaseGauges utilization={utilization} maxConnections={connectionPool.maxConnections} />
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ borderColor: SIGNAL_DATA }} />
    </motion.div>
  );
}

export default memo(DatabaseNode);
