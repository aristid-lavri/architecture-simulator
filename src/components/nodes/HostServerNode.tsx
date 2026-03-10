'use client';

import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Monitor, Container } from 'lucide-react';
import { cn } from '@/lib/utils';
import ResourceGauges from './ResourceGauges';
import { useAppStore } from '@/store/app-store';
import type { HostServerNodeData } from '@/types';
import { defaultHostServerData, defaultServerResources, hostServerColor } from '@/types';

export type { HostServerNodeData };

interface HostServerNodeProps {
  data: HostServerNodeData & {
    hasContainerChildren?: boolean;
    childrenCount?: number;
  };
  selected?: boolean;
}

const SIGNAL_HOST = hostServerColor;

function HostServerNode({ data, selected }: HostServerNodeProps) {
  const {
    label = defaultHostServerData.label,
    status = 'idle',
    ipAddress = defaultHostServerData.ipAddress,
    portMappings = [],
    resources = defaultServerResources,
    utilization,
    color = SIGNAL_HOST,
    hasContainerChildren,
    childrenCount,
  } = data;

  const mode = useAppStore((state) => state.mode);
  const showResourceGauges = mode === 'simulation' && utilization;

  return (
    <div
      className={cn(
        'min-w-[400px] min-h-[250px] w-full h-full rounded-lg border-2',
        selected && 'ring-2 ring-ring ring-offset-2'
      )}
      style={{
        borderColor: `color-mix(in oklch, ${color}, transparent 30%)`,
        backgroundColor: `color-mix(in oklch, ${color}, transparent 94%)`,
      }}
    >
      <NodeResizer
        minWidth={400}
        minHeight={250}
        isVisible={selected}
        lineClassName="!border-ring"
        handleClassName="!bg-ring !w-2 !h-2"
      />

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ borderColor: color }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-t-md"
        style={{ backgroundColor: `color-mix(in oklch, ${color}, transparent 75%)` }}
      >
        <Monitor className="w-3.5 h-3.5" style={{ color }} />
        <span className="font-mono text-[11px] font-semibold" style={{ color }}>
          {label}
        </span>
        {hasContainerChildren && (
          <Container className="w-3 h-3 text-muted-foreground" />
        )}
        {typeof childrenCount === 'number' && childrenCount > 0 && (
          <span className="font-mono text-[9px] text-muted-foreground">
            {childrenCount} service{childrenCount > 1 ? 's' : ''}
          </span>
        )}
        <span className="font-mono text-[9px] text-muted-foreground ml-auto">
          {ipAddress}
        </span>
        {portMappings.length > 0 && (
          <span className="font-mono text-[9px] text-muted-foreground">
            {portMappings.length} port{portMappings.length > 1 ? 's' : ''}
          </span>
        )}

        {/* Status indicator */}
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            status === 'idle' && 'bg-muted-foreground/30',
            status === 'processing' && 'signal-pulse',
            status === 'success' && 'bg-signal-healthy',
            status === 'error' && 'bg-signal-critical signal-pulse-critical'
          )}
          style={status === 'processing' ? { backgroundColor: color } : undefined}
        />
      </div>

      {/* Resource Gauges (simulation mode only) - footer area */}
      {showResourceGauges && (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 rounded-b-md"
          style={{ backgroundColor: `color-mix(in oklch, ${color}, transparent 85%)` }}
        >
          <ResourceGauges
            utilization={utilization}
            resources={resources}
            compact
          />
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: color }}
      />
    </div>
  );
}

export default memo(HostServerNode);
