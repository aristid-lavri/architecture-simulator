'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, ApiGatewayNodeData, ApiGatewayUtilization } from '@/types';
import { defaultApiGatewayNodeData } from '@/types';

export type { ApiGatewayNodeData };

interface ApiGatewayNodeProps {
  data: ApiGatewayNodeData;
  selected?: boolean;
}

const SIGNAL_INFRA = 'oklch(0.75 0.18 75)';

const authLabels: Record<string, string> = {
  'none': 'NONE',
  'api-key': 'KEY',
  'jwt': 'JWT',
  'oauth2': 'O2',
};

function AGWGauges({ utilization, rateLimitPerSecond }: { utilization: ApiGatewayUtilization; rateLimitPerSecond: number }) {
  const { totalRequests, blockedRequests, authFailures, avgLatency, rateLimitHits } = utilization;
  const successRate = totalRequests > 0 ? ((totalRequests - blockedRequests - authFailures) / totalRequests) * 100 : 100;

  return (
    <div className="space-y-1 pt-1.5 border-t border-border/50">
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
        <span>{totalRequests.toLocaleString()} req</span>
        <span className={cn(
          'font-semibold',
          successRate >= 95 ? 'text-signal-healthy' : successRate >= 80 ? 'text-signal-warning' : 'text-signal-critical'
        )}>
          {successRate.toFixed(1)}% OK
        </span>
      </div>
      <div className="font-mono text-[9px] text-muted-foreground">
        latency {avgLatency.toFixed(1)}ms
      </div>
      {(authFailures > 0 || rateLimitHits > 0) && (
        <div className="flex items-center gap-2 font-mono text-[9px]">
          {authFailures > 0 && <span className="text-signal-warning">auth:{authFailures}</span>}
          {rateLimitHits > 0 && <span className="text-signal-critical">rate:{rateLimitHits}</span>}
        </div>
      )}
      {rateLimitPerSecond > 0 && (
        <div className="font-mono text-[9px] text-muted-foreground">
          limit {rateLimitPerSecond} rps
        </div>
      )}
    </div>
  );
}

function ApiGatewayNode({ data, selected }: ApiGatewayNodeProps) {
  const {
    label,
    status = 'idle',
    authType = defaultApiGatewayNodeData.authType,
    rateLimiting = defaultApiGatewayNodeData.rateLimiting,
    routing = defaultApiGatewayNodeData.routing,
    utilization,
  } = data;

  const appMode = useAppStore((state) => state.mode);
  const showGauges = appMode === 'simulation' && utilization;

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

      <Handle type="target" position={Position.Left} style={{ borderColor: SIGNAL_INFRA }} />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" style={{ color: SIGNAL_INFRA }} />
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
          <span className="text-signal-infra font-semibold">{authLabels[authType]}</span>
          <span className="text-muted-foreground text-[10px]">
            {rateLimiting.enabled ? 'RL:ON' : 'RL:OFF'}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span className="truncate">{routing.pathPrefix}</span>
          <span>{routing.timeout}ms</span>
        </div>

        {showGauges && (
          <AGWGauges utilization={utilization} rateLimitPerSecond={rateLimiting.requestsPerSecond} />
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ borderColor: SIGNAL_INFRA }} />
    </motion.div>
  );
}

export default memo(ApiGatewayNode);
