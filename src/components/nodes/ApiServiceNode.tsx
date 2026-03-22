'use client';

import { memo } from 'react';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { motion } from 'framer-motion';
import { Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { ApiServiceNodeData } from '@/types';
import { defaultApiServiceData } from '@/types';

export type { ApiServiceNodeData };

interface ApiServiceNodeProps {
  data: ApiServiceNodeData;
  selected?: boolean;
}

const SIGNAL_SERVICE = 'oklch(0.65 0.17 170)';

function ApiServiceNode({ data, selected }: ApiServiceNodeProps) {
  const {
    label,
    status = 'idle',
    serviceName = defaultApiServiceData.serviceName,
    basePath = defaultApiServiceData.basePath,
    protocol = defaultApiServiceData.protocol,
    responseTime = defaultApiServiceData.responseTime,
    maxConcurrentRequests = defaultApiServiceData.maxConcurrentRequests,
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
        style={{ backgroundColor: SIGNAL_SERVICE }}
      />

      <NodeHandles color={SIGNAL_SERVICE} type="both" />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Workflow className="w-3.5 h-3.5" style={{ color: SIGNAL_SERVICE }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_SERVICE } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold" style={{ color: SIGNAL_SERVICE }}>{serviceName}</span>
          <span className="text-muted-foreground text-[10px]">{protocol.toUpperCase()}</span>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground truncate">
          {basePath}
        </div>
        {mode === 'simulation' && (
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>{responseTime}ms</span>
            <span>max: {maxConcurrentRequests}</span>
          </div>
        )}
      </div>

    </motion.div>
  );
}

export default memo(ApiServiceNode);
