'use client';

import { memo } from 'react';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, CacheNodeData, CacheUtilization } from '@/types';
import { defaultCacheNodeData } from '@/types';

export type { CacheNodeData };

interface CacheNodeProps {
  data: CacheNodeData;
  selected?: boolean;
}

const SIGNAL_DATA = 'oklch(0.72 0.19 155)';

function CacheGauges({ utilization }: { utilization: CacheUtilization }) {
  const { memoryUsage, hitRatio, keyCount, hitCount, missCount } = utilization;

  return (
    <div className="space-y-1 pt-1.5 border-t border-border/50">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[9px] text-muted-foreground w-6">MEM</span>
        <div className="flex-1 h-0.5 bg-border rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full resource-bar',
              memoryUsage < 70 ? 'bg-signal-healthy' : memoryUsage < 90 ? 'bg-signal-warning' : 'bg-signal-critical'
            )}
            style={{ width: `${memoryUsage}%` }}
          />
        </div>
        <span className={cn(
          'font-mono text-[9px] w-6 text-right',
          memoryUsage < 70 ? 'text-signal-healthy' : memoryUsage < 90 ? 'text-signal-warning' : 'text-signal-critical'
        )}>
          {Math.round(memoryUsage)}%
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[9px] text-muted-foreground w-6">HIT</span>
        <div className="flex-1 h-0.5 bg-border rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full resource-bar',
              hitRatio >= 80 ? 'bg-signal-healthy' : hitRatio >= 50 ? 'bg-signal-warning' : 'bg-signal-critical'
            )}
            style={{ width: `${hitRatio}%` }}
          />
        </div>
        <span className={cn(
          'font-mono text-[9px] w-6 text-right',
          hitRatio >= 80 ? 'text-signal-healthy' : hitRatio >= 50 ? 'text-signal-warning' : 'text-signal-critical'
        )}>
          {Math.round(hitRatio)}%
        </span>
      </div>
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
        <span>{keyCount.toLocaleString()} keys</span>
        <span className="text-signal-healthy">{hitCount}</span>/<span className="text-signal-critical">{missCount}</span>
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
      <div
        className={cn(
          'node-signal-bar',
          status === 'processing' && 'signal-pulse',
          status === 'error' && 'signal-pulse-critical'
        )}
        style={{ backgroundColor: SIGNAL_DATA }}
      />

      <NodeHandles color={SIGNAL_DATA} type="both" />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" style={{ color: SIGNAL_DATA }} />
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

      <div className="px-3 pb-2.5 space-y-1.5">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-signal-data font-semibold">{cacheType.toUpperCase()}</span>
          <span className="text-muted-foreground">{configuration.maxMemoryMB}MB</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{performance.getLatencyMs}ms</span>
          <span>{initialHitRatio}% hit</span>
        </div>

        {showGauges && <CacheGauges utilization={utilization} />}
      </div>

    </motion.div>
  );
}

export default memo(CacheNode);
