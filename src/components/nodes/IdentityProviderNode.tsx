'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IdentityProviderNodeData } from '@/types';
import { defaultIdentityProviderData } from '@/types';

export type { IdentityProviderNodeData };

interface IdentityProviderNodeProps {
  data: IdentityProviderNodeData;
  selected?: boolean;
}

const SIGNAL_IDENTITY = 'oklch(0.72 0.18 280)';

function IdentityProviderNode({ data, selected }: IdentityProviderNodeProps) {
  const {
    label,
    status = 'idle',
    providerType = defaultIdentityProviderData.providerType,
    protocol = defaultIdentityProviderData.protocol,
    tokenFormat = defaultIdentityProviderData.tokenFormat,
    tokenValidationLatencyMs = defaultIdentityProviderData.tokenValidationLatencyMs,
    sessionCacheEnabled = defaultIdentityProviderData.sessionCacheEnabled,
    mfaEnabled = defaultIdentityProviderData.mfaEnabled,
    errorRate = defaultIdentityProviderData.errorRate,
  } = data;

  return (
    <motion.div
      className={cn('node-instrument relative min-w-44 max-w-56', selected && 'selected')}
      animate={status === 'processing' ? { scale: [1, 1.01, 1] } : status === 'error' ? { x: [-2, 2, -2, 2, 0] } : {}}
      transition={status === 'processing' ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      <div
        className={cn('node-signal-bar', status === 'processing' && 'signal-pulse', status === 'error' && 'signal-pulse-critical')}
        style={{ backgroundColor: SIGNAL_IDENTITY }}
      />

      <Handle type="target" position={Position.Left} style={{ borderColor: SIGNAL_IDENTITY }} />

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5" style={{ color: SIGNAL_IDENTITY }} />
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
          style={status === 'processing' ? { backgroundColor: SIGNAL_IDENTITY } : undefined}
        />
      </div>

      <div className="px-3 pb-2.5 space-y-1">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-semibold" style={{ color: SIGNAL_IDENTITY }}>{providerType.toUpperCase()}</span>
          <span className="text-muted-foreground">{tokenValidationLatencyMs}ms</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{protocol.toUpperCase()}</span>
          <span>{tokenFormat.toUpperCase()}</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{sessionCacheEnabled ? 'cache' : 'no-cache'}{mfaEnabled ? ' + MFA' : ''}</span>
          {errorRate > 0 && <span>{errorRate}% err</span>}
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ borderColor: SIGNAL_IDENTITY }} />
    </motion.div>
  );
}

export default memo(IdentityProviderNode);
