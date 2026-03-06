'use client';

import { memo } from 'react';
import { NodeResizer } from '@xyflow/react';
import { Globe, Shield, Server, Database, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NetworkZoneNodeData, NetworkZoneType } from '@/types';
import { defaultNetworkZoneData, zoneColors } from '@/types';

export type { NetworkZoneNodeData };

interface NetworkZoneNodeProps {
  data: NetworkZoneNodeData;
  selected?: boolean;
}

const zoneIcons: Record<NetworkZoneType, React.ReactNode> = {
  public: <Globe className="w-3 h-3" />,
  dmz: <Shield className="w-3 h-3" />,
  backend: <Server className="w-3 h-3" />,
  data: <Database className="w-3 h-3" />,
  custom: <Settings className="w-3 h-3" />,
};

function NetworkZoneNode({ data, selected }: NetworkZoneNodeProps) {
  const {
    label,
    zoneType = defaultNetworkZoneData.zoneType,
    domain,
    color = zoneColors[zoneType],
    interZoneLatency = 2,
  } = data;

  return (
    <div
      className={cn(
        'min-w-[300px] min-h-[200px] w-full h-full rounded-lg border-2 border-dashed',
        selected && 'ring-2 ring-ring ring-offset-2'
      )}
      style={{
        borderColor: `color-mix(in oklch, ${color}, transparent 50%)`,
        backgroundColor: `color-mix(in oklch, ${color}, transparent 92%)`,
      }}
    >
      <NodeResizer
        minWidth={300}
        minHeight={200}
        isVisible={selected}
        lineClassName="!border-ring"
        handleClassName="!bg-ring !w-2 !h-2"
      />

      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-t-md"
        style={{ backgroundColor: `color-mix(in oklch, ${color}, transparent 80%)` }}
      >
        <span style={{ color }}>{zoneIcons[zoneType]}</span>
        <span className="font-mono text-[11px] font-semibold" style={{ color }}>
          {label}
        </span>
        {domain && (
          <span className="font-mono text-[9px] text-muted-foreground ml-auto">
            {domain}
          </span>
        )}
        {interZoneLatency > 0 && (
          <span className="font-mono text-[9px] text-muted-foreground">
            +{interZoneLatency}ms
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(NetworkZoneNode);
