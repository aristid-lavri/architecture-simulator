'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ResourceUtilization, ServerResources } from '@/types';

interface ResourceGaugesProps {
  utilization: ResourceUtilization;
  resources: ServerResources;
  compact?: boolean;
}

function getBarColor(percentage: number): string {
  if (percentage < 70) return 'bg-signal-healthy';
  if (percentage < 90) return 'bg-signal-warning';
  return 'bg-signal-critical';
}

function getTextColor(percentage: number): string {
  if (percentage < 70) return 'text-signal-healthy';
  if (percentage < 90) return 'text-signal-warning';
  return 'text-signal-critical';
}

function GaugeBar({ value, label, compact = false }: { value: number; label: string; compact?: boolean }) {
  const percentage = Math.min(100, value);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${Math.round(percentage)}%`}>
        <span className="font-mono text-[9px] text-muted-foreground w-6">{label}</span>
        <div className="flex-1 h-0.5 bg-border rounded-full overflow-hidden">
          <div
            className={cn('h-full resource-bar', getBarColor(percentage))}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={cn('font-mono text-[9px] w-6 text-right', getTextColor(percentage))}>
          {Math.round(percentage)}%
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1" role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${Math.round(percentage)}%`}>
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={getTextColor(percentage)}>{Math.round(percentage)}%</span>
      </div>
      <div className="h-0.5 bg-border rounded-full overflow-hidden">
        <div
          className={cn('h-full resource-bar', getBarColor(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SaturationDot({ saturation }: { saturation: number }) {
  if (saturation >= 90) {
    return <div className="w-1.5 h-1.5 rounded-full bg-signal-critical animate-pulse" title={`Saturé: ${Math.round(saturation)}%`} />;
  }
  if (saturation >= 70) {
    return <div className="w-1.5 h-1.5 rounded-full bg-signal-warning" title={`Dégradé: ${Math.round(saturation)}%`} />;
  }
  return <div className="w-1.5 h-1.5 rounded-full bg-signal-healthy" title={`Normal: ${Math.round(saturation)}%`} />;
}

function ResourceGauges({ utilization, resources, compact = false }: ResourceGaugesProps) {
  const { cpu, memory, network, disk, activeConnections, queuedRequests } = utilization;
  const { connections } = resources;
  const saturation = utilization.saturation ?? Math.max(cpu, memory, network, disk ?? 0);

  if (compact) {
    return (
      <div className="space-y-0.5 pt-1.5 border-t border-border/50">
        <GaugeBar value={cpu} label="CPU" compact />
        <GaugeBar value={memory} label="MEM" compact />
        <GaugeBar value={network} label="NET" compact />
        {disk !== undefined && <GaugeBar value={disk} label="DSK" compact />}
        <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground pt-0.5">
          <div className="flex items-center gap-1">
            <SaturationDot saturation={saturation} />
            <span>
              conn <span className="text-foreground">{activeConnections}/{connections.maxConcurrent}</span>
            </span>
          </div>
          {queuedRequests > 0 && (
            <span className="text-signal-warning">
              q:<span className="font-semibold">{queuedRequests}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 bg-muted/20 rounded border border-border/50">
      <GaugeBar value={cpu} label="CPU" />
      <GaugeBar value={memory} label="MEM" />
      <GaugeBar value={network} label="NET" />
      {disk !== undefined && <GaugeBar value={disk} label="DSK" />}
      <div className="flex items-center justify-between font-mono text-[10px] pt-1.5 border-t border-border/50">
        <span className="text-muted-foreground">
          conn <span className="text-foreground">{activeConnections}/{connections.maxConcurrent}</span>
        </span>
        <span className={cn('text-muted-foreground', queuedRequests > 0 && 'text-signal-warning')}>
          queue <span className="font-semibold">{queuedRequests}/{connections.queueSize}</span>
        </span>
      </div>
    </div>
  );
}

export default memo(ResourceGauges);
