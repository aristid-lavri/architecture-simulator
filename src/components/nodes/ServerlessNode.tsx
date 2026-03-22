'use client';

import { memo } from 'react';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { motion } from 'framer-motion';
import { Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, ServerlessNodeData } from '@/types';
import { defaultServerlessData } from '@/types';

export type { ServerlessNodeData };

interface ServerlessNodeProps {
  data: ServerlessNodeData;
  selected?: boolean;
}

const SIGNAL_COMPUTE = 'oklch(0.68 0.18 50)';

function ServerlessNode({ data, selected }: ServerlessNodeProps) {
  const {
    label,
    status = 'idle',
    provider = defaultServerlessData.provider,
    memoryMB = defaultServerlessData.memoryMB,
    coldStartMs = defaultServerlessData.coldStartMs,
    concurrencyLimit = defaultServerlessData.concurrencyLimit,
    currentInstances = 0,
  } = data;

  const mode = useAppStore((state) => state.mode);

  return (
    <motion.div
      className={cn('node-instrument relative min-w-44 max-w-56', selected && 'selected')}
      animate={status === 'processing' ? { scale: [1, 1.01, 1] } : status === 'error' ? { x: [-2, 2, -2, 2, 0] } : {}}
      transition={status === 'processing' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      <div
        className={cn('node-signal-bar', status === 'processing' && 'signal-pulse', status === 'error' && 'signal-pulse-critical')}
        style={{ backgroundColor: SIGNAL_COMPUTE }}
      />

      <NodeHandles color={SIGNAL_COMPUTE} type="both" />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Cloud className="w-3.5 h-3.5" style={{ color: SIGNAL_COMPUTE }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_COMPUTE } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold" style={{ color: SIGNAL_COMPUTE }}>{provider.toUpperCase()}</span>
          <span className="text-muted-foreground">{memoryMB}MB</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>cold: {coldStartMs}ms</span>
          <span>max: {concurrencyLimit}</span>
        </div>
        {mode === 'simulation' && currentInstances > 0 && (
          <div className="font-mono text-[10px] text-signal-active">
            {currentInstances} instance{currentInstances > 1 ? 's' : ''}
          </div>
        )}
      </div>

    </motion.div>
  );
}

export default memo(ServerlessNode);
