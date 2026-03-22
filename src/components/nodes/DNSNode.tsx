'use client';

import { memo } from 'react';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeStatus, DNSNodeData } from '@/types';
import { defaultDNSNodeData } from '@/types';

export type { DNSNodeData };

interface DNSNodeProps {
  data: DNSNodeData;
  selected?: boolean;
}

const SIGNAL_INFRA = 'oklch(0.68 0.15 180)';

function DNSNode({ data, selected }: DNSNodeProps) {
  const {
    label,
    status = 'idle',
    resolutionLatencyMs = defaultDNSNodeData.resolutionLatencyMs,
    ttlSeconds = defaultDNSNodeData.ttlSeconds,
    failoverEnabled = defaultDNSNodeData.failoverEnabled,
  } = data;

  return (
    <motion.div
      className={cn('node-instrument relative min-w-44 max-w-56', selected && 'selected')}
      animate={status === 'processing' ? { scale: [1, 1.01, 1] } : status === 'error' ? { x: [-2, 2, -2, 2, 0] } : {}}
      transition={status === 'processing' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      <div
        className={cn('node-signal-bar', status === 'processing' && 'signal-pulse', status === 'error' && 'signal-pulse-critical')}
        style={{ backgroundColor: SIGNAL_INFRA }}
      />

      <NodeHandles color={SIGNAL_INFRA} type="both" />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5" style={{ color: SIGNAL_INFRA }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_INFRA } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold" style={{ color: SIGNAL_INFRA }}>DNS</span>
          <span className="text-muted-foreground">{resolutionLatencyMs}ms</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>TTL: {ttlSeconds}s</span>
          {failoverEnabled && <span className="text-signal-active">failover</span>}
        </div>
      </div>

    </motion.div>
  );
}

export default memo(DNSNode);
