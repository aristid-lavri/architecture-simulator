'use client';

import { memo } from 'react';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { motion } from 'framer-motion';
import { Clock, Cog, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { BackgroundJobNodeData, BackgroundJobType } from '@/types';
import { defaultBackgroundJobData } from '@/types';

export type { BackgroundJobNodeData };

interface BackgroundJobNodeProps {
  data: BackgroundJobNodeData;
  selected?: boolean;
}

const SIGNAL_JOB = 'oklch(0.65 0.15 280)';

function getJobIcon(jobType: BackgroundJobType) {
  switch (jobType) {
    case 'cron':
      return Clock;
    case 'worker':
      return Cog;
    case 'batch':
      return Layers;
  }
}

function BackgroundJobNode({ data, selected }: BackgroundJobNodeProps) {
  const {
    label,
    status = 'idle',
    jobType = defaultBackgroundJobData.jobType,
    schedule,
    concurrency = defaultBackgroundJobData.concurrency,
    processingTimeMs = defaultBackgroundJobData.processingTimeMs,
    batchSize,
  } = data;

  const mode = useAppStore((state) => state.mode);
  const Icon = getJobIcon(jobType);

  return (
    <motion.div
      className={cn('node-instrument relative min-w-44 max-w-56', selected && 'selected')}
      animate={status === 'processing' ? { scale: [1, 1.01, 1] } : status === 'error' ? { x: [-2, 2, -2, 2, 0] } : {}}
      transition={status === 'processing' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      <div
        className={cn('node-signal-bar', status === 'processing' && 'signal-pulse', status === 'error' && 'signal-pulse-critical')}
        style={{ backgroundColor: SIGNAL_JOB }}
      />

      <NodeHandles color={SIGNAL_JOB} type="both" />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: SIGNAL_JOB }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_JOB } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold" style={{ color: SIGNAL_JOB }}>{jobType.toUpperCase()}</span>
          <span className="text-muted-foreground text-[10px]">x{concurrency}</span>
        </div>
        {jobType === 'cron' && schedule && (
          <div className="font-mono text-[10px] text-muted-foreground truncate">
            {schedule}
          </div>
        )}
        {jobType === 'batch' && batchSize && (
          <div className="font-mono text-[10px] text-muted-foreground">
            batch: {batchSize}
          </div>
        )}
        {mode === 'simulation' && (
          <div className="font-mono text-[10px] text-muted-foreground">
            {processingTimeMs}ms
          </div>
        )}
      </div>

    </motion.div>
  );
}

export default memo(BackgroundJobNode);
