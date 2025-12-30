'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Shield, Key, Gauge, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import type { NodeStatus, ApiGatewayNodeData, ApiGatewayUtilization } from '@/types';
import { defaultApiGatewayNodeData } from '@/types';

export type { ApiGatewayNodeData };

interface ApiGatewayNodeProps {
  data: ApiGatewayNodeData;
  selected?: boolean;
}

const authTypeLabels: Record<string, string> = {
  'none': 'No Auth',
  'api-key': 'API Key',
  'jwt': 'JWT',
  'oauth2': 'OAuth2',
};

const statusStyles: Record<NodeStatus, string> = {
  idle: '',
  processing: 'ring-2 ring-blue-500 ring-opacity-50',
  success: 'ring-2 ring-green-500 ring-opacity-75',
  error: 'ring-2 ring-red-500 ring-opacity-75',
};

interface ApiGatewayGaugesProps {
  utilization: ApiGatewayUtilization;
  rateLimitPerSecond: number;
}

function ApiGatewayGauges({ utilization, rateLimitPerSecond }: ApiGatewayGaugesProps) {
  const { totalRequests, blockedRequests, authFailures, avgLatency, rateLimitHits } = utilization;
  const successRate = totalRequests > 0 ? ((totalRequests - blockedRequests - authFailures) / totalRequests) * 100 : 100;

  return (
    <div className="space-y-1.5 pt-1 border-t border-border/50">
      {/* Request Stats */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Requests: <span className="font-medium text-foreground">{totalRequests.toLocaleString()}</span></span>
        <span className={cn(
          'font-medium',
          successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-orange-500' : 'text-red-500'
        )}>
          {successRate.toFixed(1)}% OK
        </span>
      </div>

      {/* Latency */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Gauge className="w-3 h-3" />
          Latency:
        </span>
        <span className="font-medium text-foreground">{avgLatency.toFixed(1)} ms</span>
      </div>

      {/* Blocked Stats */}
      <div className="grid grid-cols-2 gap-x-2 text-[10px] text-muted-foreground">
        {authFailures > 0 && (
          <div className="flex items-center gap-1 text-orange-500">
            <Key className="w-3 h-3" />
            Auth: {authFailures}
          </div>
        )}
        {rateLimitHits > 0 && (
          <div className="flex items-center gap-1 text-red-500">
            <Ban className="w-3 h-3" />
            Rate: {rateLimitHits}
          </div>
        )}
      </div>

      {/* Rate limit indicator bar */}
      {rateLimitPerSecond > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Rate Limit:</span>
            <span className="text-foreground">{rateLimitPerSecond} req/s</span>
          </div>
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
  const nodeColor = '#3b82f6'; // Bleu pour API Gateway (selon plan)
  const showGauges = appMode === 'simulation' && utilization;

  return (
    <motion.div
      className={cn(
        'relative rounded-lg border-2 bg-background shadow-md transition-all',
        'min-w-[180px] max-w-[220px]',
        selected ? 'border-primary' : 'border-blue-500',
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
      {/* Input Handle (receives requests) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-500"
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
          <Shield className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-xs text-muted-foreground">API Gateway</div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Auth and Rate Limit Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className="text-white text-xs px-2 py-0"
            style={{ backgroundColor: nodeColor }}
          >
            {authTypeLabels[authType]}
          </Badge>
          {rateLimiting.enabled && (
            <Badge variant="outline" className="text-xs px-1 py-0">
              Rate Limit
            </Badge>
          )}
        </div>

        {/* Routing Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate font-mono">{routing.pathPrefix}</span>
          <span>{(routing.timeout / 1000).toFixed(0)}s timeout</span>
        </div>

        {/* Resource Gauges (only during simulation with utilization data) */}
        {showGauges && (
          <ApiGatewayGauges
            utilization={utilization}
            rateLimitPerSecond={rateLimiting.requestsPerSecond}
          />
        )}
      </div>

      {/* Status indicator */}
      {status !== 'idle' && (
        <motion.div
          className={cn(
            'absolute -top-1 -right-1 w-3 h-3 rounded-full',
            status === 'processing' && 'bg-blue-500',
            status === 'success' && 'bg-green-500',
            status === 'error' && 'bg-red-500'
          )}
          animate={status === 'processing' ? { opacity: [1, 0.5, 1] } : {}}
          transition={
            status === 'processing' ? { duration: 0.8, repeat: Infinity } : {}
          }
        />
      )}

      {/* Output Handle (routes to backends) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500"
      />
    </motion.div>
  );
}

export default memo(ApiGatewayNode);
