'use client';

import { memo } from 'react';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, MessageQueueNodeData, MessageQueueUtilization } from '@/types';
import { defaultMessageQueueNodeData } from '@/types';

export type { MessageQueueNodeData };

interface MessageQueueNodeProps {
  data: MessageQueueNodeData;
  selected?: boolean;
}

const SIGNAL_INFRA = 'oklch(0.75 0.18 75)';

function MQGauges({ utilization, maxQueueSize }: { utilization: MessageQueueUtilization; maxQueueSize: number }) {
  const { queueDepth, messagesPublished, messagesConsumed, messagesDeadLettered, throughput } = utilization;
  const queueUsage = Math.min(100, (queueDepth / maxQueueSize) * 100);

  return (
    <div className="space-y-1 pt-1.5 border-t border-border/50">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[9px] text-muted-foreground w-6">Q</span>
        <div className="flex-1 h-0.5 bg-border rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full resource-bar',
              queueUsage > 80 ? 'bg-signal-critical' : queueUsage > 50 ? 'bg-signal-warning' : 'bg-signal-infra'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${queueUsage}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className={cn(
          'font-mono text-[9px] w-8 text-right',
          queueUsage > 80 ? 'text-signal-critical' : queueUsage > 50 ? 'text-signal-warning' : 'text-muted-foreground'
        )}>
          {queueDepth.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
        <span>in:<span className="text-signal-healthy">{messagesPublished.toLocaleString()}</span></span>
        <span>out:<span className="text-signal-flux">{messagesConsumed.toLocaleString()}</span></span>
      </div>
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
        <span>{throughput.toFixed(0)} msg/s</span>
        {messagesDeadLettered > 0 && (
          <span className="text-signal-critical">DLQ:{messagesDeadLettered}</span>
        )}
      </div>
    </div>
  );
}

function MessageQueueNode({ data, selected }: MessageQueueNodeProps) {
  const {
    label,
    status = 'idle',
    queueType = defaultMessageQueueNodeData.queueType,
    mode = defaultMessageQueueNodeData.mode,
    configuration = defaultMessageQueueNodeData.configuration,
    consumerCount = defaultMessageQueueNodeData.consumerCount,
    utilization,
  } = data;

  const appMode = useAppStore((state) => state.mode);
  const showGauges = appMode === 'simulation' && utilization;

  const modeLabels: Record<string, string> = { fifo: 'FIFO', priority: 'PRI', pubsub: 'P/S' };

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
        style={{ backgroundColor: SIGNAL_INFRA }}
      />

      <NodeHandles color={SIGNAL_INFRA} type="both" />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" style={{ color: SIGNAL_INFRA }} />
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

      <div className="px-3 pb-2.5 space-y-1.5">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-signal-infra font-semibold">{queueType.toUpperCase()}</span>
          <span className="text-muted-foreground text-[10px]">{modeLabels[mode]}</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{consumerCount} consumers</span>
          <span>{(configuration.maxQueueSize / 1000).toFixed(0)}k max</span>
        </div>

        {showGauges && <MQGauges utilization={utilization} maxQueueSize={configuration.maxQueueSize} />}
      </div>

    </motion.div>
  );
}

export default memo(MessageQueueNode);
