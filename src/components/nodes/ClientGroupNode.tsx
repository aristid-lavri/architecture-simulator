'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeStatus, LoadDistribution, RampUpCurve } from '@/types';

export interface ClientGroupNodeData {
  label: string;
  status?: NodeStatus;
  virtualClients: number;
  requestMode: 'sequential' | 'parallel';
  concurrentRequests: number;
  baseInterval: number;
  intervalVariance: number;
  distribution: LoadDistribution;
  burstSize?: number;
  burstInterval?: number;
  rampUpEnabled: boolean;
  rampUpDuration: number;
  rampUpCurve: RampUpCurve;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  requestBody?: string;
  activeClients?: number;
  requestsSent?: number;
  [key: string]: unknown;
}

interface ClientGroupNodeProps {
  data: ClientGroupNodeData;
  selected?: boolean;
}

const SIGNAL_CLIENT = 'oklch(0.70 0.15 220)';

const distLabels: Record<LoadDistribution, string> = {
  uniform: 'uniform',
  random: 'random',
  burst: 'burst',
};

function ClientGroupNode({ data, selected }: ClientGroupNodeProps) {
  const {
    label,
    status = 'idle',
    virtualClients = 10,
    requestMode = 'parallel',
    concurrentRequests = 5,
    distribution = 'uniform',
    rampUpEnabled = false,
    activeClients,
    requestsSent,
  } = data;

  const displayActiveClients = activeClients ?? 0;
  const displayRequestsSent = requestsSent ?? 0;
  const multiplier = requestMode === 'parallel' ? concurrentRequests : 1;
  const rps = displayActiveClients > 0 && data.baseInterval > 0
    ? Math.round((displayActiveClients * multiplier * 1000) / data.baseInterval * 10) / 10
    : 0;

  return (
    <motion.div
      className={cn(
        'node-instrument relative min-w-48 max-w-60',
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
        style={{ backgroundColor: SIGNAL_CLIENT }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5" style={{ color: SIGNAL_CLIENT }} />
          <span className="text-instrument text-[10px] text-muted-foreground">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-foreground font-semibold">{virtualClients}</span>
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              status === 'idle' && 'bg-muted-foreground/30',
              status === 'processing' && 'signal-pulse',
              status === 'success' && 'bg-signal-healthy',
              status === 'error' && 'bg-signal-critical signal-pulse-critical'
            )}
            style={status === 'processing' ? { backgroundColor: SIGNAL_CLIENT } : undefined}
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-2.5 space-y-1.5">
        {/* Config row */}
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{requestMode === 'parallel' ? `parallel x${concurrentRequests}` : 'sequential'}</span>
          <span>{distLabels[distribution]}{rampUpEnabled ? ' +ramp' : ''}</span>
        </div>

        {/* Runtime stats */}
        <div className="flex items-center justify-between font-mono text-[10px] pt-1 border-t border-border/50">
          <span className="text-muted-foreground">
            <span className="text-foreground font-semibold">{displayActiveClients}</span>/{virtualClients} active
          </span>
          <span className="text-foreground font-semibold">{rps} <span className="text-muted-foreground font-normal">rps</span></span>
        </div>

        {/* Total */}
        <div className="font-mono text-[10px] text-muted-foreground text-center">
          {displayRequestsSent.toLocaleString()} req
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: SIGNAL_CLIENT }}
      />
    </motion.div>
  );
}

export default memo(ClientGroupNode);
