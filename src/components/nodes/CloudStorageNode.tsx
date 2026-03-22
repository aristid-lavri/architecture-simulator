'use client';

import { memo } from 'react';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { motion } from 'framer-motion';
import { HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeStatus, CloudStorageNodeData } from '@/types';
import { defaultCloudStorageData } from '@/types';

export type { CloudStorageNodeData };

interface CloudStorageNodeProps {
  data: CloudStorageNodeData;
  selected?: boolean;
}

const SIGNAL_CLOUD = 'oklch(0.70 0.18 260)';

function CloudStorageNode({ data, selected }: CloudStorageNodeProps) {
  const {
    label,
    status = 'idle',
    provider = defaultCloudStorageData.provider,
    storageClass = defaultCloudStorageData.storageClass,
    readLatencyMs = defaultCloudStorageData.readLatencyMs,
    writeLatencyMs = defaultCloudStorageData.writeLatencyMs,
  } = data;

  return (
    <motion.div
      className={cn('node-instrument relative min-w-44 max-w-56', selected && 'selected')}
      animate={status === 'processing' ? { scale: [1, 1.01, 1] } : status === 'error' ? { x: [-2, 2, -2, 2, 0] } : {}}
      transition={status === 'processing' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      <div
        className={cn('node-signal-bar', status === 'processing' && 'signal-pulse', status === 'error' && 'signal-pulse-critical')}
        style={{ backgroundColor: SIGNAL_CLOUD }}
      />

      <NodeHandles color={SIGNAL_CLOUD} type="both" />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5" style={{ color: SIGNAL_CLOUD }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_CLOUD } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold" style={{ color: SIGNAL_CLOUD }}>{provider.toUpperCase()}</span>
          <span className="text-muted-foreground">{storageClass}</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>R:{readLatencyMs}ms</span>
          <span>W:{writeLatencyMs}ms</span>
        </div>
      </div>

    </motion.div>
  );
}

export default memo(CloudStorageNode);
