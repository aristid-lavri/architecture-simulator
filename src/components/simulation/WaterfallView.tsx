'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertTriangle, Search, MousePointerClick } from 'lucide-react';
import { criticalPathAnalyzer } from '@/engine/CriticalPathAnalyzer';
import { useAppStore } from '@/store/app-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { useSimulationStore } from '@/store/simulation-store';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { RequestTrace, TraceSpan, CriticalPathAnalysis } from '@/types';

// Couleurs par type de composant
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
  'firewall': 'bg-rose-600',
  'serverless': 'bg-cyan-500',
  'container': 'bg-slate-500',
  'service-discovery': 'bg-violet-500',
  'dns': 'bg-gray-500',
  'cloud-storage': 'bg-sky-500',
  'cloud-function': 'bg-cyan-600',
  'host-server': 'bg-zinc-500',
  'api-service': 'bg-emerald-500',
  'background-job': 'bg-yellow-600',
  'network-zone': 'bg-gray-400',
};

function getBarColor(nodeType: string): string {
  return NODE_TYPE_COLORS[nodeType] ?? 'bg-muted-foreground';
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface WaterfallViewProps {
  panelHeight: number;
}

export function WaterfallView({ panelHeight }: WaterfallViewProps) {
  const { t } = useTranslation();
  const [traces, setTraces] = useState<RequestTrace[]>(() => criticalPathAnalyzer.getTraces());
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CriticalPathAnalysis | null>(null);
  const simulationState = useSimulationStore((s) => s.state);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const nodes = useArchitectureStore((s) => s.nodes);

  // Node label map
  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      const label = (node.data as { label?: string }).label || node.id.split('-')[0];
      map.set(node.id, label);
    }
    return map;
  }, [nodes]);

  // S'abonner aux mises a jour du CriticalPathAnalyzer
  useEffect(() => {
    let updateTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = criticalPathAnalyzer.subscribe(() => {
      // Throttle a 200ms
      if (!updateTimer) {
        updateTimer = setTimeout(() => {
          setTraces(criticalPathAnalyzer.getTraces());
          updateTimer = null;
        }, 200);
      }
    });

    return () => {
      unsubscribe();
      if (updateTimer) clearTimeout(updateTimer);
    };
  }, []);

  // Mettre a jour les traces quand la simulation s'arrete (flush final)
  useEffect(() => {
    if (simulationState === 'idle') {
      setTraces(criticalPathAnalyzer.getTraces());
    }
  }, [simulationState]);

  // Analyser la trace selectionnee
  useEffect(() => {
    if (selectedChainId) {
      setAnalysis(criticalPathAnalyzer.analyze(selectedChainId));
    } else {
      setAnalysis(null);
    }
  }, [selectedChainId, traces]);

  const completedTraces = useMemo(
    () => traces.filter((t) => t.status === 'completed' || t.status === 'error'),
    [traces]
  );

  const selectedTrace = useMemo(
    () => completedTraces.find((t) => t.chainId === selectedChainId),
    [completedTraces, selectedChainId]
  );

  const handleSpanClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, [setSelectedNodeId]);

  if (completedTraces.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-xs font-mono">
        {t('waterfall.noTraces')}
      </div>
    );
  }

  return (
    <div className="h-full flex" style={{ maxHeight: panelHeight }}>
      {/* Liste des traces (panneau gauche) */}
      <TraceList
        traces={completedTraces}
        selectedChainId={selectedChainId}
        onSelect={setSelectedChainId}
        labelMap={labelMap}
      />

      {/* Detail de la trace selectionnee (panneau droit) */}
      <div className="flex-1 overflow-y-auto">
        {selectedTrace && analysis ? (
          <TraceDetail
            trace={selectedTrace}
            analysis={analysis}
            labelMap={labelMap}
            onSpanClick={handleSpanClick}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-xs font-mono gap-1">
            <MousePointerClick className="w-3 h-3" />
            {t('waterfall.selectTrace')}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Sous-composants
// ============================================

function TraceList({
  traces,
  selectedChainId,
  onSelect,
  labelMap,
}: {
  traces: RequestTrace[];
  selectedChainId: string | null;
  onSelect: (chainId: string) => void;
  labelMap: Map<string, string>;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return traces.slice(0, 50);
    const lowerFilter = filter.toLowerCase();
    return traces
      .filter((trace) => {
        const chainMatch = trace.chainId.toLowerCase().includes(lowerFilter);
        const nodeMatch = trace.spans.some((s) =>
          (labelMap.get(s.nodeId) ?? s.nodeId).toLowerCase().includes(lowerFilter)
        );
        return chainMatch || nodeMatch;
      })
      .slice(0, 50);
  }, [traces, filter, labelMap]);

  return (
    <div className="w-56 border-r border-border/30 flex flex-col shrink-0">
      {/* Search */}
      <div className="p-1.5 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('waterfall.search')}
            className="w-full pl-5 pr-2 py-1 text-[10px] font-mono bg-transparent border border-border/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30"
            style={{ borderRadius: '2px' }}
          />
        </div>
      </div>

      {/* Trace list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((trace) => {
          const firstSpan = trace.spans[0];
          const originLabel = firstSpan ? (labelMap.get(firstSpan.nodeId) ?? firstSpan.nodeId.split('-')[0]) : '?';
          const isError = trace.status === 'error';

          return (
            <button
              key={trace.chainId}
              onClick={() => onSelect(trace.chainId)}
              className={cn(
                'w-full text-left px-2 py-1.5 text-[10px] font-mono border-b border-border/20 transition-colors',
                selectedChainId === trace.chainId
                  ? 'bg-muted/50 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              <div className="flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 shrink-0', isError ? 'bg-signal-critical' : 'bg-signal-healthy')} style={{ borderRadius: '50%' }} />
                <span className="truncate">{originLabel}</span>
                <span className="ml-auto text-muted-foreground">{formatDuration(trace.totalDuration)}</span>
              </div>
              <div className="text-[9px] text-muted-foreground/70 mt-0.5">
                {trace.spans.length} spans · {trace.chainId.slice(-8)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Count */}
      <div className="px-2 py-1 text-[9px] font-mono text-muted-foreground border-t border-border/30">
        {filtered.length}/{traces.length} traces
      </div>
    </div>
  );
}

function TraceDetail({
  trace,
  analysis,
  labelMap,
  onSpanClick,
}: {
  trace: RequestTrace;
  analysis: CriticalPathAnalysis;
  labelMap: Map<string, string>;
  onSpanClick: (nodeId: string) => void;
}) {
  const { t } = useTranslation();

  // Calculer l'echelle horizontale
  const traceStart = trace.startTime;
  const traceDuration = trace.totalDuration || 1;

  return (
    <div className="p-2 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-foreground font-medium">{t('waterfall.trace')}</span>
        <span className="text-muted-foreground">{trace.chainId.slice(-12)}</span>
        <span className="ml-auto text-foreground">{formatDuration(traceDuration)}</span>
      </div>

      {/* Waterfall chart */}
      <div className="space-y-0.5">
        {trace.spans.map((span) => {
          const spanStart = span.startTime - traceStart;
          const spanDuration = span.duration ?? 0;
          const leftPercent = (spanStart / traceDuration) * 100;
          const widthPercent = Math.max((spanDuration / traceDuration) * 100, 0.5);
          const isBottleneck = analysis.bottleneckSpan?.id === span.id;

          return (
            <div
              key={span.id}
              className={cn(
                'flex items-center gap-1 text-[10px] font-mono group cursor-pointer hover:bg-muted/30 py-0.5 px-1 transition-colors',
                isBottleneck && 'bg-signal-warning/10'
              )}
              style={{ borderRadius: '2px' }}
              onClick={() => onSpanClick(span.nodeId)}
              title={`${t('waterfall.clickToLocate')} ${labelMap.get(span.nodeId) ?? span.nodeId}`}
            >
              {/* Node name */}
              <div className="w-28 shrink-0 truncate text-muted-foreground group-hover:text-foreground flex items-center gap-1">
                {isBottleneck && <AlertTriangle className="w-2.5 h-2.5 text-signal-warning shrink-0" />}
                <span className="truncate">{labelMap.get(span.nodeId) ?? span.nodeId.split('-')[0]}</span>
              </div>

              {/* Timeline bar */}
              <div className="flex-1 relative h-4">
                <div
                  className={cn(
                    'absolute top-0.5 h-3 transition-all',
                    span.status === 'error' ? 'bg-signal-critical/80' : getBarColor(span.nodeType),
                    isBottleneck && 'ring-1 ring-signal-warning'
                  )}
                  style={{
                    left: `${Math.min(leftPercent, 99)}%`,
                    width: `${Math.min(widthPercent, 100 - leftPercent)}%`,
                    borderRadius: '1px',
                    minWidth: '2px',
                  }}
                />
              </div>

              {/* Duration */}
              <div className="w-14 shrink-0 text-right text-muted-foreground">
                {spanDuration > 0 ? formatDuration(spanDuration) : '...'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Analysis section */}
      <div className="border-t border-border/30 pt-2 space-y-2">
        {/* Time per component */}
        <div>
          <div className="text-[10px] font-mono text-foreground font-medium mb-1">
            {t('waterfall.timeBreakdown')}
          </div>
          <div className="space-y-0.5">
            {Array.from(analysis.timePerComponent.values())
              .sort((a, b) => b.percentage - a.percentage)
              .map((comp) => (
                <div key={comp.nodeId} className="flex items-center gap-1 text-[10px] font-mono">
                  <div className={cn('w-2 h-2 shrink-0', getBarColor(comp.nodeType))} style={{ borderRadius: '1px' }} />
                  <span className="truncate text-muted-foreground w-28">{comp.nodeName}</span>
                  <div className="flex-1 h-1.5 bg-muted/30 relative" style={{ borderRadius: '1px' }}>
                    <div
                      className={cn('absolute inset-y-0 left-0', getBarColor(comp.nodeType))}
                      style={{ width: `${Math.min(comp.percentage, 100)}%`, borderRadius: '1px', opacity: 0.7 }}
                    />
                  </div>
                  <span className="w-10 text-right text-muted-foreground">{comp.percentage.toFixed(1)}%</span>
                  <span className="w-12 text-right text-muted-foreground">{formatDuration(comp.totalTime)}</span>
                </div>
              ))}
          </div>
        </div>

        {/* N+1 patterns */}
        {analysis.nPlusOnePatterns.length > 0 && (
          <div>
            <div className="text-[10px] font-mono text-signal-warning font-medium mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t('waterfall.nPlusOne')}
            </div>
            <div className="space-y-0.5">
              {analysis.nPlusOnePatterns.map((pattern) => (
                <div key={pattern.nodeId} className="text-[10px] font-mono text-muted-foreground px-1">
                  <span className="text-signal-warning">{pattern.nodeName}</span>
                  {' '}{t('waterfall.calledPrefix')} {pattern.count}x
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottleneck */}
        {analysis.bottleneckSpan && (
          <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-signal-warning" />
            {t('waterfall.bottleneck')}:
            <span className="text-foreground">{labelMap.get(analysis.bottleneckSpan.nodeId) ?? analysis.bottleneckSpan.nodeId}</span>
            <span>({formatDuration(analysis.bottleneckSpan.duration ?? 0)})</span>
          </div>
        )}
      </div>
    </div>
  );
}
