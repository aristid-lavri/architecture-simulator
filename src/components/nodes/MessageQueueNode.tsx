'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { MessageSquare, Inbox, Send, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, MessageQueueNodeData, MessageQueueUtilization } from '@/types';
import { defaultMessageQueueNodeData } from '@/types';

export type { MessageQueueNodeData };

interface MessageQueueNodeProps {
  data: MessageQueueNodeData;
  selected?: boolean;
}

const queueTypeLabels: Record<string, string> = {
  'rabbitmq': 'RabbitMQ',
  'kafka': 'Kafka',
  'sqs': 'SQS',
};

const modeLabels: Record<string, string> = {
  'fifo': 'FIFO',
  'priority': 'Priority',
  'pubsub': 'Pub/Sub',
};

const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  processing: 'ring-2 ring-yellow-500 ring-opacity-50',
  success: 'ring-2 ring-green-500 ring-opacity-75',
  error: 'ring-2 ring-red-500 ring-opacity-75',
};

interface MessageQueueGaugesProps {
  utilization: MessageQueueUtilization;
  maxQueueSize: number;
}

function MessageQueueGauges({ utilization, maxQueueSize }: MessageQueueGaugesProps) {
  const { queueDepth, messagesPublished, messagesConsumed, messagesDeadLettered, throughput } = utilization;
  const queueUsage = Math.min(100, (queueDepth / maxQueueSize) * 100);

  return (
    <div className="space-y-1.5 pt-1 border-t border-border/50">
      {/* Queue Depth Bar */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Inbox className="w-3 h-3" />
            Queue:
          </span>
          <span>
            <span className={cn(
              'font-medium',
              queueUsage > 80 ? 'text-red-500' : queueUsage > 50 ? 'text-orange-500' : 'text-foreground'
            )}>
              {queueDepth.toLocaleString()}
            </span>
            <span className="text-muted-foreground">/{maxQueueSize.toLocaleString()}</span>
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full',
              queueUsage > 80 ? 'bg-red-500' : queueUsage > 50 ? 'bg-orange-500' : 'bg-yellow-500'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${queueUsage}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Message Stats */}
      <div className="grid grid-cols-2 gap-x-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Send className="w-3 h-3 text-green-500" />
          <span>In: <span className="font-medium text-foreground">{messagesPublished.toLocaleString()}</span></span>
        </div>
        <div className="flex items-center gap-1">
          <Inbox className="w-3 h-3 text-blue-500" />
          <span>Out: <span className="font-medium text-foreground">{messagesConsumed.toLocaleString()}</span></span>
        </div>
      </div>

      {/* Throughput and Dead Letters */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          Throughput: <span className="font-medium text-foreground">{throughput.toFixed(0)} msg/s</span>
        </span>
        {messagesDeadLettered > 0 && (
          <span className="flex items-center gap-0.5 text-red-500">
            <AlertTriangle className="w-3 h-3" />
            DLQ: {messagesDeadLettered}
          </span>
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
  const nodeColor = '#eab308'; // Jaune pour Message Queue (selon plan)
  const showGauges = appMode === 'simulation' && utilization;

  return (
    <motion.div
      className={cn(
        'relative rounded-lg border-2 bg-background shadow-md transition-all',
        'min-w-[180px] max-w-[220px]',
        selected ? 'border-primary' : 'border-yellow-500',
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
      {/* Input Handle (receives messages) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-yellow-500"
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
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground">Message Queue</div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Queue Type and Mode Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className="text-white text-xs px-2 py-0"
            style={{ backgroundColor: nodeColor }}
          >
            {queueTypeLabels[queueType]}
          </Badge>
          <Badge variant="outline" className="text-xs px-1 py-0">
            {modeLabels[mode]}
          </Badge>
        </div>

        {/* Configuration Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Consumers: <span className="font-medium text-foreground">{consumerCount}</span></span>
          <span>Max: <span className="font-medium text-foreground">{(configuration.maxQueueSize / 1000).toFixed(0)}k</span></span>
        </div>

        {/* Resource Gauges (only during simulation with utilization data) */}
        {showGauges && (
          <MessageQueueGauges
            utilization={utilization}
            maxQueueSize={configuration.maxQueueSize}
          />
        )}
      </div>

      {/* Status indicator */}
      {status !== 'idle' && (
        <motion.div
          className={cn(
            'absolute -top-1 -right-1 w-3 h-3 rounded-full',
            status === 'processing' && 'bg-yellow-500',
            status === 'success' && 'bg-green-500',
            status === 'error' && 'bg-red-500'
          )}
          animate={status === 'processing' ? { opacity: [1, 0.5, 1] } : {}}
          transition={
            status === 'processing' ? { duration: 0.8, repeat: Infinity } : {}
          }
        />
      )}

      {/* Output Handle (sends to consumers) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-yellow-500"
      />
    </motion.div>
  );
}

export default memo(MessageQueueNode);
