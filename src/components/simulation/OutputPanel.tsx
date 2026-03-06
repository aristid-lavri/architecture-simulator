'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useSimulationEvents } from '@/hooks/useSimulationEvents';
import { useArchitectureStore } from '@/store/architecture-store';
import { cn } from '@/lib/utils';
import type { SimulationEvent, SimulationEventType } from '@/types';

const EVENT_TYPE_CONFIG: Record<SimulationEventType, { label: string; color: string }> = {
  REQUEST_SENT: { label: 'REQ→', color: 'text-blue-400' },
  REQUEST_RECEIVED: { label: 'REQ←', color: 'text-blue-300' },
  PROCESSING_START: { label: 'PROC', color: 'text-muted-foreground' },
  PROCESSING_END: { label: 'DONE', color: 'text-muted-foreground' },
  RESPONSE_SENT: { label: 'RES→', color: 'text-signal-healthy' },
  RESPONSE_RECEIVED: { label: 'RES←', color: 'text-signal-healthy' },
  ERROR: { label: 'ERR', color: 'text-signal-critical' },
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

function formatEventDetails(event: SimulationEvent): string {
  const parts: string[] = [];
  if (event.data.method) parts.push(event.data.method);
  if (event.data.path) parts.push(event.data.path);
  if (event.data.status) parts.push(`${event.data.status}`);
  if (event.data.latency !== undefined) parts.push(`${event.data.latency}ms`);
  if (event.data.error) parts.push(event.data.error);
  return parts.join(' ');
}

interface OutputPanelProps {
  eventCount: number;
  panelHeight?: number;
}

export function OutputPanel({ eventCount: _eventCount, panelHeight }: OutputPanelProps) {
  const { events, clear } = useSimulationEvents();
  const nodes = useArchitectureStore((s) => s.nodes);
  const [disabledTypes, setDisabledTypes] = useState<Set<SimulationEventType>>(
    new Set(['PROCESSING_START', 'PROCESSING_END'])
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Node label map
  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, (node.data as { label?: string }).label || node.id.split('-')[0]);
    }
    return map;
  }, [nodes]);

  const getLabel = useCallback((id: string) => labelMap.get(id) || id.split('-')[0], [labelMap]);

  // Filter events
  const filteredEvents = useMemo(
    () => events.filter((e) => !disabledTypes.has(e.type)),
    [events, disabledTypes]
  );

  // Auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    autoScrollRef.current = atBottom;
  }, []);

  useEffect(() => {
    if (autoScrollRef.current && sentinelRef.current) {
      sentinelRef.current.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    }
  }, [filteredEvents]);

  const toggleType = useCallback((type: SimulationEventType) => {
    setDisabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  return (
    <div className="px-4 pb-3 border-t border-border pt-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 flex-wrap">
          {(Object.entries(EVENT_TYPE_CONFIG) as [SimulationEventType, { label: string; color: string }][]).map(
            ([type, config]) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={cn(
                  'px-1.5 py-0.5 text-[9px] font-mono uppercase border transition-colors',
                  disabledTypes.has(type)
                    ? 'text-muted-foreground/40 border-border/50'
                    : `${config.color} border-current/30`,
                )}
                style={{ borderRadius: '2px' }}
              >
                {config.label}
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground">
            {filteredEvents.length}/{events.length}
          </span>
          <button
            onClick={clear}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Effacer les logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto font-mono text-[11px] leading-relaxed bg-muted/20 border border-border p-2"
        style={{ maxHeight: panelHeight ? `${panelHeight - 60}px` : '220px', borderRadius: '2px' }}
      >
        {filteredEvents.length === 0 ? (
          <div className="text-muted-foreground/50 text-center py-4 text-[10px]">
            Aucun evenement
          </div>
        ) : (
          filteredEvents.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.type];
            const details = formatEventDetails(event);
            return (
              <div key={event.id} className="flex gap-2 hover:bg-muted/30 px-1" style={{ borderRadius: '1px' }}>
                <span className="text-muted-foreground/60 shrink-0">{formatTime(event.timestamp)}</span>
                <span className={cn('shrink-0 w-10', config.color)}>{config.label}</span>
                <span className="text-foreground/80 shrink-0">{getLabel(event.sourceNodeId)}</span>
                {event.targetNodeId && (
                  <>
                    <span className="text-muted-foreground/40">→</span>
                    <span className="text-foreground/80 shrink-0">{getLabel(event.targetNodeId)}</span>
                  </>
                )}
                {details && (
                  <>
                    <span className="text-border">|</span>
                    <span className={cn(
                      'truncate',
                      event.type === 'ERROR' ? 'text-signal-critical' : 'text-muted-foreground'
                    )}>
                      {details}
                    </span>
                  </>
                )}
              </div>
            );
          })
        )}
        <div ref={sentinelRef} />
      </div>
    </div>
  );
}
