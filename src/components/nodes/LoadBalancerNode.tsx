'use client';

import { memo } from 'react';
import { NodeHandles } from '@/components/nodes/NodeHandles';
import { motion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, LoadBalancerNodeData, LoadBalancerUtilization } from '@/types';
import { defaultLoadBalancerNodeData } from '@/types';

export type { LoadBalancerNodeData };

interface LoadBalancerNodeProps {
  data: LoadBalancerNodeData;
  selected?: boolean;
}

const SIGNAL_INFRA = 'oklch(0.75 0.18 75)';

const algoLabels: Record<string, string> = {
  'round-robin': 'RR',
  'least-connections': 'LC',
  'ip-hash': 'IPH',
  'weighted': 'WGT',
};

function LBGauges({ utilization }: { utilization: LoadBalancerUtilization }) {
  const { totalRequests, activeConnections, backends } = utilization;
  const healthyBackends = backends.filter(b => b.healthy).length;

  return (
    <div className="space-y-1 pt-1.5 border-t border-border/50">
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
        <span>backends <span className={cn('font-semibold', healthyBackends === backends.length ? 'text-signal-healthy' : 'text-signal-warning')}>{healthyBackends}</span>/{backends.length}</span>
        <span>active <span className="text-foreground font-semibold">{activeConnections}</span></span>
      </div>
      <div className="font-mono text-[9px] text-muted-foreground">
        total {totalRequests.toLocaleString()} req
      </div>
      {backends.length > 0 && (
        <div className="flex gap-px h-1 rounded overflow-hidden">
          {backends.map((backend, idx) => (
            <div
              key={backend.nodeId || idx}
              className={cn(
                'flex-1 transition-all duration-300',
                backend.healthy ? 'bg-signal-healthy' : 'bg-signal-critical opacity-40'
              )}
              style={{ opacity: backend.healthy ? Math.max(0.3, backend.activeConnections / 10) : 0.3 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LoadBalancerNode({ data, selected }: LoadBalancerNodeProps) {
  const {
    label,
    status = 'idle',
    algorithm = defaultLoadBalancerNodeData.algorithm,
    healthCheck = defaultLoadBalancerNodeData.healthCheck,
    stickySessions = false,
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
        style={{ backgroundColor: SIGNAL_INFRA }}
      />

      <NodeHandles color={SIGNAL_INFRA} type="both" />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Share2 className="w-3.5 h-3.5" style={{ color: SIGNAL_INFRA }} />
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
          <span className="text-signal-infra font-semibold">{algoLabels[algorithm] || algorithm}</span>
          <span className="text-muted-foreground text-[10px]">
            {healthCheck.enabled ? 'HC:ON' : 'HC:OFF'}
            {stickySessions ? ' STK' : ''}
          </span>
        </div>

        {showGauges && <LBGauges utilization={utilization} />}
      </div>

    </motion.div>
  );
}

export default memo(LoadBalancerNode);
