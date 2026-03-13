'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Trash2, Filter, Layers, ChevronDown, ChevronRight } from 'lucide-react';
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
  SPAN_START: { label: 'SPAN→', color: 'text-purple-400' },
  SPAN_END: { label: 'SPAN←', color: 'text-purple-300' },
};

type SortMode = 'time' | 'latency' | 'status';

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

/** Short display ID for chainId (last 6 chars) */
function shortChainId(chainId: string): string {
  return chainId.slice(-6);
}

interface ChainGroup {
  chainId: string;
  events: SimulationEvent[];
  firstTimestamp: number;
  totalLatency: number | null;
  hasError: boolean;
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
  const [chainFilter, setChainFilter] = useState<string>('');
  const [groupByChain, setGroupByChain] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [highlightedChainId, setHighlightedChainId] = useState<string | null>(null);
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

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

  // Get unique chainIds for the filter dropdown
  const availableChainIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of events) {
      if (e.chainId) ids.add(e.chainId);
    }
    return Array.from(ids);
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events.filter((e) => !disabledTypes.has(e.type));
    if (chainFilter) {
      result = result.filter((e) => e.chainId && e.chainId.includes(chainFilter));
    }
    return result;
  }, [events, disabledTypes, chainFilter]);

  // Group events by chain
  const chainGroups = useMemo((): ChainGroup[] => {
    if (!groupByChain) return [];

    const groups = new Map<string, SimulationEvent[]>();
    const ungrouped: SimulationEvent[] = [];

    for (const e of filteredEvents) {
      if (e.chainId) {
        const list = groups.get(e.chainId) || [];
        list.push(e);
        groups.set(e.chainId, list);
      } else {
        ungrouped.push(e);
      }
    }

    const result: ChainGroup[] = [];
    for (const [chainId, evts] of groups) {
      const hasError = evts.some((e) => e.type === 'ERROR');
      const responseSent = evts.find((e) => e.type === 'RESPONSE_SENT' && e.data.latency !== undefined);
      result.push({
        chainId,
        events: evts,
        firstTimestamp: evts[0].timestamp,
        totalLatency: responseSent?.data.latency ?? null,
        hasError,
      });
    }

    // Sort groups
    if (sortMode === 'latency') {
      result.sort((a, b) => (b.totalLatency ?? 0) - (a.totalLatency ?? 0));
    } else if (sortMode === 'status') {
      result.sort((a, b) => (b.hasError ? 1 : 0) - (a.hasError ? 1 : 0));
    } else {
      result.sort((a, b) => a.firstTimestamp - b.firstTimestamp);
    }

    // Add ungrouped events as a special group
    if (ungrouped.length > 0) {
      result.push({
        chainId: '__ungrouped__',
        events: ungrouped,
        firstTimestamp: ungrouped[0].timestamp,
        totalLatency: null,
        hasError: false,
      });
    }

    return result;
  }, [filteredEvents, groupByChain, sortMode]);

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

  const toggleChainExpanded = useCallback((chainId: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(chainId)) {
        next.delete(chainId);
      } else {
        next.add(chainId);
      }
      return next;
    });
  }, []);

  const handleEventClick = useCallback((event: SimulationEvent) => {
    if (event.chainId) {
      setHighlightedChainId((prev) => prev === event.chainId ? null : event.chainId!);
    }
  }, []);

  const renderEventRow = (event: SimulationEvent, showChainBadge: boolean = true) => {
    const config = EVENT_TYPE_CONFIG[event.type];
    const details = formatEventDetails(event);
    const isHighlighted = highlightedChainId && event.chainId === highlightedChainId;

    return (
      <div
        key={event.id}
        className={cn(
          'flex gap-2 hover:bg-muted/30 px-1 cursor-pointer',
          isHighlighted && 'bg-blue-500/10'
        )}
        style={{ borderRadius: '1px' }}
        onClick={() => handleEventClick(event)}
      >
        <span className="text-muted-foreground/60 shrink-0">{formatTime(event.timestamp)}</span>
        <span className={cn('shrink-0 w-10', config.color)}>{config.label}</span>
        {showChainBadge && event.chainId && (
          <span className="text-[8px] font-mono px-1 py-0 bg-muted/50 text-muted-foreground/70 shrink-0 self-center" style={{ borderRadius: '2px' }}>
            {shortChainId(event.chainId)}
          </span>
        )}
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
  };

  const renderGroupedView = () => {
    return chainGroups.map((group) => {
      if (group.chainId === '__ungrouped__') {
        return group.events.map((event) => renderEventRow(event, true));
      }

      const isExpanded = expandedChains.has(group.chainId);
      return (
        <div key={group.chainId} className="border-b border-border/30">
          <div
            className={cn(
              'flex items-center gap-2 px-1 py-0.5 cursor-pointer hover:bg-muted/30',
              group.hasError && 'bg-red-500/5'
            )}
            onClick={() => toggleChainExpanded(group.chainId)}
          >
            {isExpanded
              ? <ChevronDown className="w-3 h-3 text-muted-foreground/60 shrink-0" />
              : <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
            }
            <span className="text-[8px] font-mono px-1 bg-muted/50 text-muted-foreground/70" style={{ borderRadius: '2px' }}>
              {shortChainId(group.chainId)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {group.events.length} evt
            </span>
            {group.totalLatency !== null && (
              <span className="text-[10px] text-blue-400">
                {group.totalLatency}ms
              </span>
            )}
            {group.hasError && (
              <span className="text-[10px] text-signal-critical">ERR</span>
            )}
            <span className="text-[10px] text-muted-foreground/50">
              {formatTime(group.firstTimestamp)}
            </span>
          </div>
          {isExpanded && (
            <div className="pl-4">
              {group.events.map((event) => renderEventRow(event, false))}
            </div>
          )}
        </div>
      );
    });
  };

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

      {/* Extended toolbar: chain filter, group, sort */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* Chain filter */}
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Filtrer par requete..."
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value)}
            className="bg-muted/30 border border-border/50 text-[10px] px-1.5 py-0.5 w-32 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-400/50"
            style={{ borderRadius: '2px' }}
            list="chain-ids"
          />
          <datalist id="chain-ids">
            {availableChainIds.slice(-20).map((id) => (
              <option key={id} value={shortChainId(id)} />
            ))}
          </datalist>
        </div>

        {/* Group by chain toggle */}
        <button
          onClick={() => setGroupByChain(!groupByChain)}
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono border transition-colors',
            groupByChain
              ? 'text-blue-400 border-blue-400/30 bg-blue-400/5'
              : 'text-muted-foreground/60 border-border/50'
          )}
          style={{ borderRadius: '2px' }}
        >
          <Layers className="w-3 h-3" />
          Grouper
        </button>

        {/* Sort mode */}
        {groupByChain && (
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="bg-muted/30 border border-border/50 text-[9px] px-1 py-0.5 text-muted-foreground focus:outline-none"
            style={{ borderRadius: '2px' }}
          >
            <option value="time">Par temps</option>
            <option value="latency">Par latence</option>
            <option value="status">Erreurs d&apos;abord</option>
          </select>
        )}

        {/* Clear highlight */}
        {highlightedChainId && (
          <button
            onClick={() => setHighlightedChainId(null)}
            className="text-[9px] text-blue-400 hover:text-blue-300"
          >
            ✕ {shortChainId(highlightedChainId)}
          </button>
        )}
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto font-mono text-[11px] leading-relaxed bg-muted/20 border border-border p-2"
        style={{ maxHeight: panelHeight ? `${panelHeight - 90}px` : '190px', borderRadius: '2px' }}
      >
        {filteredEvents.length === 0 ? (
          <div className="text-muted-foreground/50 text-center py-4 text-[10px]">
            Aucun evenement
          </div>
        ) : groupByChain ? (
          renderGroupedView()
        ) : (
          filteredEvents.map((event) => renderEventRow(event))
        )}
        <div ref={sentinelRef} />
      </div>
    </div>
  );
}
