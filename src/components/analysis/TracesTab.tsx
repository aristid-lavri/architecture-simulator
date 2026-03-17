'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, ScrollText } from 'lucide-react';
import type { SimulationReport } from '@/store/simulation-store';
import type { SimulationEvent, SimulationEventType, RequestTrace } from '@/types';
import { useArchitectureStore } from '@/store/architecture-store';
import { cn } from '@/lib/utils';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  'http-client': 'bg-blue-500',
  'http-server': 'bg-blue-600',
  'client-group': 'bg-blue-400',
  'api-gateway': 'bg-purple-500',
  'load-balancer': 'bg-indigo-500',
  'database': 'bg-amber-600',
  'cache': 'bg-green-500',
  'message-queue': 'bg-orange-500',
  'circuit-breaker': 'bg-red-500',
  'cdn': 'bg-teal-500',
  'waf': 'bg-rose-500',
  'serverless': 'bg-cyan-500',
  'container': 'bg-slate-500',
  'api-service': 'bg-emerald-500',
  'background-job': 'bg-yellow-600',
  'host-server': 'bg-zinc-500',
};

function getBarColor(nodeType: string) {
  return NODE_TYPE_COLORS[nodeType] ?? 'bg-muted-foreground';
}

const EVENT_TYPE_CONFIG: Record<SimulationEventType, { label: string; color: string }> = {
  REQUEST_SENT: { label: 'REQ→', color: 'text-blue-400' },
  REQUEST_RECEIVED: { label: 'REQ←', color: 'text-blue-300' },
  PROCESSING_START: { label: 'PROC', color: 'text-muted-foreground' },
  PROCESSING_END: { label: 'DONE', color: 'text-muted-foreground' },
  RESPONSE_SENT: { label: 'RES→', color: 'text-green-500' },
  RESPONSE_RECEIVED: { label: 'RES←', color: 'text-green-500' },
  ERROR: { label: 'ERR', color: 'text-red-500' },
  SPAN_START: { label: 'SPAN→', color: 'text-purple-400' },
  SPAN_END: { label: 'SPAN←', color: 'text-purple-300' },
  HANDLER_DECISION: { label: 'DECIDE', color: 'text-amber-400' },
  QUEUE_ENTER: { label: 'Q.IN', color: 'text-orange-400' },
  QUEUE_EXIT: { label: 'Q.OUT', color: 'text-orange-300' },
  STATE_TRANSITION: { label: 'STATE', color: 'text-rose-400' },
  RESOURCE_SNAPSHOT: { label: 'RES', color: 'text-cyan-400' },
};

// ─── Waterfall Panel ────────────────────────────────────────────────────────────

function WaterfallPanel({
  traces,
  labelMap,
}: {
  traces: RequestTrace[];
  labelMap: Map<string, string>;
}) {
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);

  const selectedTrace = useMemo(
    () => traces.find(t => t.chainId === selectedChainId),
    [traces, selectedChainId]
  );

  if (traces.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-medium">Waterfall — traces les plus lentes</h3>
      </div>
      <div className="flex" style={{ minHeight: '240px' }}>
        {/* Trace list */}
        <div className="w-52 border-r border-border shrink-0 overflow-y-auto max-h-96">
          {traces.slice(0, 50).map(trace => {
            const firstSpan = trace.spans[0];
            const originLabel = firstSpan
              ? (labelMap.get(firstSpan.nodeId) ?? firstSpan.nodeId.split('-')[0])
              : '?';
            const isError = trace.status === 'error';
            return (
              <button
                key={trace.chainId}
                onClick={() => setSelectedChainId(
                  selectedChainId === trace.chainId ? null : trace.chainId
                )}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-mono border-b border-border/30 transition-colors',
                  selectedChainId === trace.chainId
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isError ? 'bg-red-500' : 'bg-green-500')} />
                  <span className="truncate flex-1">{originLabel}</span>
                  <span className="text-muted-foreground shrink-0">{formatDuration(trace.totalDuration)}</span>
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {trace.spans.length} spans · {trace.chainId.slice(-8)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Span waterfall */}
        <div className="flex-1 p-3 overflow-y-auto max-h-96">
          {selectedTrace ? (
            <SpanWaterfall trace={selectedTrace} labelMap={labelMap} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
              Sélectionnez une trace
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpanWaterfall({
  trace,
  labelMap,
}: {
  trace: RequestTrace;
  labelMap: Map<string, string>;
}) {
  const traceDuration = trace.totalDuration || 1;
  const traceStart = trace.startTime;

  // Compute time per component
  const timePerComponent = useMemo(() => {
    const map = new Map<string, { nodeId: string; nodeType: string; nodeName: string; totalTime: number }>();
    for (const span of trace.spans) {
      const key = span.nodeId;
      const existing = map.get(key);
      const dur = span.duration ?? 0;
      if (existing) {
        existing.totalTime += dur;
      } else {
        map.set(key, {
          nodeId: span.nodeId,
          nodeType: span.nodeType,
          nodeName: labelMap.get(span.nodeId) ?? span.nodeId.split('-')[0],
          totalTime: dur,
        });
      }
    }
    return Array.from(map.values())
      .map(c => ({ ...c, percentage: traceDuration > 0 ? (c.totalTime / traceDuration) * 100 : 0 }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [trace, labelMap, traceDuration]);

  // Detect N+1
  const nPlusOne = useMemo(() => {
    const counts = new Map<string, number>();
    for (const span of trace.spans) {
      counts.set(span.nodeId, (counts.get(span.nodeId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count >= 3)
      .map(([nodeId, count]) => ({ nodeId, count, nodeName: labelMap.get(nodeId) ?? nodeId }));
  }, [trace, labelMap]);

  // Bottleneck: span with highest duration
  const bottleneckSpan = useMemo(
    () => trace.spans.reduce(
      (max, s) => (s.duration ?? 0) > (max?.duration ?? 0) ? s : max,
      null as typeof trace.spans[0] | null
    ),
    [trace]
  );

  return (
    <div className="space-y-3 font-mono text-[11px]">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">Trace {trace.chainId.slice(-12)}</span>
        <span className="text-muted-foreground ml-auto">{formatDuration(traceDuration)}</span>
      </div>

      {/* Span bars */}
      <div className="space-y-0.5">
        {trace.spans.map(span => {
          const spanStart = span.startTime - traceStart;
          const spanDur = span.duration ?? 0;
          const leftPct = Math.min((spanStart / traceDuration) * 100, 99);
          const widthPct = Math.max((spanDur / traceDuration) * 100, 0.5);
          const isBottleneck = bottleneckSpan?.id === span.id;
          return (
            <div
              key={span.id}
              className={cn(
                'flex items-center gap-2 py-0.5 px-1 rounded-sm',
                isBottleneck && 'bg-yellow-500/10'
              )}
            >
              <div className="w-24 shrink-0 truncate text-muted-foreground flex items-center gap-1">
                {isBottleneck && <AlertTriangle className="w-2.5 h-2.5 text-yellow-500 shrink-0" />}
                <span className="truncate">{labelMap.get(span.nodeId) ?? span.nodeId.split('-')[0]}</span>
              </div>
              <div className="flex-1 relative h-4">
                <div
                  className={cn(
                    'absolute top-0.5 h-3 rounded-sm',
                    span.status === 'error' ? 'bg-red-500/80' : getBarColor(span.nodeType)
                  )}
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.min(widthPct, 100 - leftPct)}%`,
                    minWidth: '2px',
                  }}
                />
              </div>
              <div className="w-12 text-right text-muted-foreground shrink-0">
                {spanDur > 0 ? formatDuration(spanDur) : '...'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time breakdown */}
      <div className="border-t border-border/30 pt-2">
        <div className="text-[10px] font-medium text-muted-foreground mb-1">Temps par composant</div>
        <div className="space-y-0.5">
          {timePerComponent.map(comp => (
            <div key={comp.nodeId} className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 shrink-0 rounded-sm', getBarColor(comp.nodeType))} />
              <span className="w-24 truncate text-muted-foreground">{comp.nodeName}</span>
              <div className="flex-1 h-1.5 bg-muted/30 rounded-sm overflow-hidden">
                <div
                  className={cn('h-full rounded-sm', getBarColor(comp.nodeType))}
                  style={{ width: `${Math.min(comp.percentage, 100)}%`, opacity: 0.7 }}
                />
              </div>
              <span className="w-10 text-right text-muted-foreground">{comp.percentage.toFixed(1)}%</span>
              <span className="w-12 text-right text-muted-foreground">{formatDuration(comp.totalTime)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* N+1 patterns */}
      {nPlusOne.length > 0 && (
        <div className="border-t border-border/30 pt-2">
          <div className="text-[10px] font-medium text-yellow-500 flex items-center gap-1 mb-1">
            <AlertTriangle className="w-3 h-3" /> Patterns N+1 détectés
          </div>
          {nPlusOne.map(p => (
            <div key={p.nodeId} className="text-[10px] text-muted-foreground px-1">
              <span className="text-yellow-500">{p.nodeName}</span> appelé {p.count}×
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Event Log Panel ────────────────────────────────────────────────────────────

function EventLogPanel({
  events,
  labelMap,
}: {
  events: SimulationEvent[];
  labelMap: Map<string, string>;
}) {
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const getLabel = useCallback((id: string) => labelMap.get(id) ?? id.split('-')[0], [labelMap]);

  const chains = useMemo(() => {
    const groups = new Map<string, SimulationEvent[]>();
    for (const e of events) {
      const key = e.chainId ?? '__no_chain__';
      const list = groups.get(key) ?? [];
      list.push(e);
      groups.set(key, list);
    }
    const result: { chainId: string; events: SimulationEvent[]; hasError: boolean; totalLatency: number | null; status: 'success' | 'error' | 'incomplete' }[] = [];
    for (const [chainId, evts] of groups) {
      const hasError = evts.some(e => e.type === 'ERROR');
      const responseSent = evts.find(e => e.type === 'RESPONSE_SENT' && e.data.latency !== undefined);
      const hasResponse = evts.some(e => e.type === 'RESPONSE_SENT' || e.type === 'RESPONSE_RECEIVED');
      result.push({
        chainId,
        events: evts,
        hasError,
        totalLatency: responseSent?.data.latency ?? null,
        status: hasError ? 'error' : hasResponse ? 'success' : 'incomplete',
      });
    }
    result.sort((a, b) => {
      if (a.hasError !== b.hasError) return a.hasError ? -1 : 1;
      return a.events[0].timestamp - b.events[0].timestamp;
    });
    return result;
  }, [events]);

  const filteredChains = useMemo(() => {
    if (!filter) return chains;
    const lf = filter.toLowerCase();
    return chains.filter(c =>
      c.chainId.toLowerCase().includes(lf) ||
      c.events.some(e => getLabel(e.sourceNodeId).toLowerCase().includes(lf))
    );
  }, [chains, filter, getLabel]);

  const statusCounts = useMemo(() => ({
    success: chains.filter(c => c.status === 'success').length,
    error: chains.filter(c => c.status === 'error').length,
    incomplete: chains.filter(c => c.status === 'incomplete').length,
  }), [chains]);

  const toggle = (chainId: string) => {
    setExpandedChains(prev => {
      const next = new Set(prev);
      if (next.has(chainId)) next.delete(chainId);
      else next.add(chainId);
      return next;
    });
  };

  return (
    <div className="bg-card rounded-lg border">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ScrollText className="w-4 h-4" /> Log des événements
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded">{statusCounts.success} succès</span>
          {statusCounts.error > 0 && <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded">{statusCounts.error} erreurs</span>}
          <span className="text-muted-foreground">{events.length} événements</span>
        </div>
      </div>

      {/* Filter */}
      <div className="px-3 py-2 border-b border-border/50">
        <input
          type="text"
          placeholder="Filtrer par chain ID ou composant…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full bg-muted/30 border border-border/50 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-400/50"
        />
      </div>

      {/* Chain list */}
      <div className="max-h-96 overflow-y-auto font-mono text-[11px]">
        {filteredChains.map(chain => {
          const isExpanded = expandedChains.has(chain.chainId);
          const firstEvent = chain.events[0];
          return (
            <div key={chain.chainId} className="border-b border-border/30 last:border-0">
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/30',
                  chain.hasError && 'bg-red-500/5'
                )}
                onClick={() => toggle(chain.chainId)}
              >
                {isExpanded
                  ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                }
                <span className="text-[10px] font-mono px-1 bg-muted/50 text-muted-foreground rounded">
                  {chain.chainId.slice(-6)}
                </span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded',
                  chain.status === 'success' ? 'bg-green-500/10 text-green-500' :
                  chain.status === 'error' ? 'bg-red-500/10 text-red-500' :
                  'bg-yellow-500/10 text-yellow-500'
                )}>
                  {chain.status === 'success' ? 'OK' : chain.status === 'error' ? 'ERR' : '...'}
                </span>
                {chain.totalLatency !== null && (
                  <span className="text-blue-400 text-[10px]">{chain.totalLatency}ms</span>
                )}
                <span className="text-muted-foreground text-[10px]">{chain.events.length} evt</span>
                {firstEvent.data.method && (
                  <span className="text-muted-foreground text-[10px] ml-auto">
                    {firstEvent.data.method} {firstEvent.data.path}
                  </span>
                )}
              </div>
              {isExpanded && (
                <div className="pl-8 pr-3 pb-2 leading-relaxed">
                  {chain.events.map(event => {
                    const config = EVENT_TYPE_CONFIG[event.type];
                    return (
                      <div key={event.id} className="flex gap-2 text-[11px]">
                        <span className="text-muted-foreground/60 shrink-0">{formatTime(event.timestamp)}</span>
                        <span className={cn('shrink-0 w-10', config.color)}>{config.label}</span>
                        <span className="text-foreground/80">{getLabel(event.sourceNodeId)}</span>
                        {event.targetNodeId && (
                          <>
                            <span className="text-muted-foreground/40">→</span>
                            <span className="text-foreground/80">{getLabel(event.targetNodeId)}</span>
                          </>
                        )}
                        {event.data.status && (
                          <span className={event.data.status >= 400 ? 'text-red-500' : 'text-green-500'}>
                            {event.data.status}
                          </span>
                        )}
                        {event.data.latency !== undefined && (
                          <span className="text-blue-400">{event.data.latency}ms</span>
                        )}
                        {event.data.error && (
                          <span className="text-red-500">{event.data.error}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main TracesTab ─────────────────────────────────────────────────────────────

export function TracesTab({ report }: { report: SimulationReport }) {
  const { traces, events, cacheStats, databaseStats, messageQueueStats, apiGatewayStats } = report;
  const nodes = useArchitectureStore((s) => s.nodes);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, (node.data as { label?: string }).label || node.id.split('-')[0]);
    }
    return map;
  }, [nodes]);

  const sortedTraces = useMemo(() => {
    if (!traces || traces.length === 0) return [];
    return [...traces]
      .filter(t => t.status === 'completed' || t.status === 'error')
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 50);
  }, [traces]);

  const chainCount = useMemo(() => {
    const chains = new Set<string>();
    for (const e of events) {
      if (e.chainId) chains.add(e.chainId);
    }
    return chains.size;
  }, [events]);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{chainCount}</div>
          <div className="text-xs text-muted-foreground">Chaînes de requêtes</div>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{events.length}</div>
          <div className="text-xs text-muted-foreground">Événements capturés</div>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{sortedTraces.length}</div>
          <div className="text-xs text-muted-foreground">Traces complètes</div>
        </div>
      </div>

      {/* Waterfall */}
      {sortedTraces.length > 0 && (
        <WaterfallPanel traces={sortedTraces} labelMap={labelMap} />
      )}

      {/* Event Log */}
      {events.length > 0 && (
        <EventLogPanel events={events} labelMap={labelMap} />
      )}

      {/* Per-Handler Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Database Stats */}
        {databaseStats && Object.keys(databaseStats).length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">Base de données</h3>
            {Object.entries(databaseStats).map(([nodeId, stats]) => (
              <div key={nodeId} className="mb-3 last:mb-0">
                <div className="text-xs font-medium mb-1">{labelMap.get(nodeId) ?? nodeId}</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Queries/s</span><span className="font-mono">{stats.queriesPerSecond.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pool</span><span className="font-mono">{Math.round(stats.connectionPoolUsage)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Connexions</span><span className="font-mono">{stats.activeConnections}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Moy query</span><span className="font-mono">{Math.round(stats.avgQueryTime)}ms</span></div>
                  {stats.queriesByType && (
                    <div className="col-span-2 flex gap-3 text-muted-foreground">
                      <span>R:{stats.queriesByType.read}</span>
                      <span>W:{stats.queriesByType.write}</span>
                      <span>T:{stats.queriesByType.transaction}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cache Stats */}
        {cacheStats && Object.keys(cacheStats).length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">Cache</h3>
            {Object.entries(cacheStats).map(([nodeId, stats]) => (
              <div key={nodeId} className="mb-3 last:mb-0">
                <div className="text-xs font-medium mb-1">{labelMap.get(nodeId) ?? nodeId}</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Hit ratio</span>
                    <span className={cn('font-mono', stats.hitRatio < 60 ? 'text-yellow-500' : 'text-green-500')}>{Math.round(stats.hitRatio)}%</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Clés</span><span className="font-mono">{stats.keyCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Hits</span><span className="font-mono text-green-500">{stats.hitCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Misses</span><span className="font-mono text-orange-500">{stats.missCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mémoire</span><span className="font-mono">{Math.round(stats.memoryUsage)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Évictions</span><span className="font-mono">{stats.evictionCount}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Message Queue Stats */}
        {messageQueueStats && Object.keys(messageQueueStats).length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">Files de messages</h3>
            {Object.entries(messageQueueStats).map(([nodeId, stats]) => (
              <div key={nodeId} className="mb-3 last:mb-0">
                <div className="text-xs font-medium mb-1">{labelMap.get(nodeId) ?? nodeId}</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Profondeur</span>
                    <span className={cn('font-mono', stats.queueDepth > 100 ? 'text-orange-500' : '')}>{stats.queueDepth}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Publiés</span><span className="font-mono">{stats.messagesPublished}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Consommés</span><span className="font-mono">{stats.messagesConsumed}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">En vol</span><span className="font-mono">{stats.messagesInFlight}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">DLQ</span>
                    <span className={cn('font-mono', stats.messagesDeadLettered > 0 ? 'text-red-500' : '')}>{stats.messagesDeadLettered}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Retries</span><span className="font-mono">{stats.messagesRetried}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* API Gateway Stats */}
        {apiGatewayStats && Object.keys(apiGatewayStats).length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">API Gateway</h3>
            {Object.entries(apiGatewayStats).map(([nodeId, stats]) => {
              const successPct = stats.totalRequests > 0
                ? Math.round(((stats.totalRequests - stats.blockedRequests) / stats.totalRequests) * 100) : 100;
              return (
                <div key={nodeId} className="mb-3 last:mb-0">
                  <div className="text-xs font-medium mb-1">{labelMap.get(nodeId) ?? nodeId}</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono">{stats.totalRequests}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Succès</span>
                      <span className={cn('font-mono', successPct < 90 ? 'text-yellow-500' : 'text-green-500')}>{successPct}%</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Bloqués</span>
                      <span className={cn('font-mono', stats.blockedRequests > 0 ? 'text-red-500' : '')}>{stats.blockedRequests}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Auth fail</span><span className="font-mono">{stats.authFailures}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Rate limit</span><span className="font-mono">{stats.rateLimitHits}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
