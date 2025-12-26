'use client';

import { memo } from 'react';
import { Cpu, MemoryStick, Wifi, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResourceUtilization, ServerResources } from '@/types';

interface ResourceGaugesProps {
  utilization: ResourceUtilization;
  resources: ServerResources;
  compact?: boolean;
}

interface GaugeBarProps {
  value: number;
  max?: number;
  label: string;
  icon: React.ReactNode;
  compact?: boolean;
}

function getUtilizationColor(percentage: number): string {
  if (percentage < 70) return 'bg-green-500';
  if (percentage < 90) return 'bg-orange-500';
  return 'bg-red-500';
}

function getUtilizationTextColor(percentage: number): string {
  if (percentage < 70) return 'text-green-500';
  if (percentage < 90) return 'text-orange-500';
  return 'text-red-500';
}

function GaugeBar({ value, max = 100, label, icon, compact = false }: GaugeBarProps) {
  const percentage = Math.min(100, (value / max) * 100);
  const colorClass = getUtilizationColor(percentage);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 text-muted-foreground">{icon}</div>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', colorClass)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={cn('text-[10px] font-medium w-7 text-right', getUtilizationTextColor(percentage))}>
          {Math.round(percentage)}%
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={cn('font-medium', getUtilizationTextColor(percentage))}>
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ResourceGauges({ utilization, resources, compact = false }: ResourceGaugesProps) {
  const { cpu, memory, network, disk, activeConnections, queuedRequests } = utilization;
  const { connections } = resources;

  if (compact) {
    return (
      <div className="space-y-1 pt-1 border-t border-border/50">
        <GaugeBar
          value={cpu}
          label="CPU"
          icon={<Cpu className="w-3 h-3" />}
          compact
        />
        <GaugeBar
          value={memory}
          label="RAM"
          icon={<MemoryStick className="w-3 h-3" />}
          compact
        />
        <GaugeBar
          value={network}
          label="NET"
          icon={<Wifi className="w-3 h-3" />}
          compact
        />
        {disk !== undefined && (
          <GaugeBar
            value={disk}
            label="DISK"
            icon={<HardDrive className="w-3 h-3" />}
            compact
          />
        )}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          <span>
            Conn: <span className="font-medium text-foreground">{activeConnections}/{connections.maxConcurrent}</span>
          </span>
          {queuedRequests > 0 && (
            <span className="text-orange-500">
              Queue: <span className="font-medium">{queuedRequests}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
      <GaugeBar
        value={cpu}
        label="CPU"
        icon={<Cpu className="w-4 h-4" />}
      />
      <GaugeBar
        value={memory}
        label="Mémoire"
        icon={<MemoryStick className="w-4 h-4" />}
      />
      <GaugeBar
        value={network}
        label="Réseau"
        icon={<Wifi className="w-4 h-4" />}
      />
      {disk !== undefined && (
        <GaugeBar
          value={disk}
          label="Disque"
          icon={<HardDrive className="w-4 h-4" />}
        />
      )}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
        <div className="text-muted-foreground">
          Connexions: <span className="font-medium text-foreground">{activeConnections}/{connections.maxConcurrent}</span>
        </div>
        <div className={cn(
          'text-muted-foreground',
          queuedRequests > 0 && 'text-orange-500'
        )}>
          File: <span className="font-medium">{queuedRequests}/{connections.queueSize}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(ResourceGauges);
