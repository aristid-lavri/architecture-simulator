'use client';

import { useMemo } from 'react';
import { Panel } from '@xyflow/react';
import type { Edge } from '@xyflow/react';
import { useAppStore } from '@/store/app-store';
import type { ConnectionProtocol } from '@/types';
import { cn } from '@/lib/utils';

const PROTOCOL_LABELS: Record<ConnectionProtocol, string> = {
  rest: 'HTTP',
  grpc: 'gRPC',
  websocket: 'WS',
  graphql: 'GQL',
};

const PROTOCOL_COLORS: Record<ConnectionProtocol, string> = {
  rest: 'oklch(0.70 0.15 220)',
  grpc: 'oklch(0.72 0.19 155)',
  websocket: 'oklch(0.75 0.18 55)',
  graphql: 'oklch(0.68 0.18 330)',
};

interface EdgeFilterBarProps {
  edges: Edge[];
}

export function EdgeFilterBar({ edges }: EdgeFilterBarProps) {
  const { edgeProtocolFilters, toggleEdgeProtocolFilter } = useAppStore();

  // Detect which protocols are used in the current diagram
  const usedProtocols = useMemo(() => {
    const protocols = new Set<ConnectionProtocol>();
    let hasNoProtocol = false;
    for (const edge of edges) {
      const protocol = (edge.data as Record<string, unknown> | undefined)?.protocol as ConnectionProtocol | undefined;
      if (protocol) {
        protocols.add(protocol);
      } else {
        hasNoProtocol = true;
      }
    }
    return { protocols: Array.from(protocols).sort(), hasNoProtocol };
  }, [edges]);

  // Don't show if there's only one or zero protocol types
  if (usedProtocols.protocols.length <= 1 && !usedProtocols.hasNoProtocol) return null;

  return (
    <Panel position="top-center">
      <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border px-2 py-1 rounded-sm">
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase mr-1">Edges</span>
        {usedProtocols.protocols.map((protocol) => {
          const isHidden = edgeProtocolFilters[protocol] === false;
          return (
            <button
              key={protocol}
              onClick={() => toggleEdgeProtocolFilter(protocol)}
              className={cn(
                'px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase border rounded-sm transition-all cursor-pointer',
                isHidden
                  ? 'opacity-30 border-border text-muted-foreground'
                  : 'border-current'
              )}
              style={{
                color: isHidden ? undefined : PROTOCOL_COLORS[protocol],
                borderColor: isHidden ? undefined : `color-mix(in oklch, ${PROTOCOL_COLORS[protocol]} 40%, transparent)`,
              }}
              title={`${isHidden ? 'Afficher' : 'Masquer'} les edges ${PROTOCOL_LABELS[protocol]}`}
            >
              {PROTOCOL_LABELS[protocol]}
            </button>
          );
        })}
        {usedProtocols.hasNoProtocol && (
          <button
            onClick={() => toggleEdgeProtocolFilter('_none')}
            className={cn(
              'px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase border rounded-sm transition-all cursor-pointer',
              edgeProtocolFilters._none === false
                ? 'opacity-30 border-border text-muted-foreground'
                : 'border-border text-muted-foreground'
            )}
            title={`${edgeProtocolFilters._none === false ? 'Afficher' : 'Masquer'} les edges sans protocole`}
          >
            ---
          </button>
        )}
      </div>
    </Panel>
  );
}
