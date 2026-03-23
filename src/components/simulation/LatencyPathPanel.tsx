'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Timer, X, ArrowRight, ChevronDown, ChevronUp, Route } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useArchitectureStore } from '@/store/architecture-store';
import { useTranslation } from '@/i18n';
import { calculatePathLatency, compareProtocolLatencies, type LatencyResult } from '@/lib/latency-calculator';
import type { ConnectionProtocol } from '@/types';

interface LatencyPathPanelProps {
  /** Callback pour surligner un chemin sur le canvas */
  onHighlightPath?: (nodeIds: string[], edgeIds: string[]) => void;
  /** Callback pour effacer le surlignage */
  onClearHighlight?: () => void;
}

const protocolLabels: Record<ConnectionProtocol, string> = {
  rest: 'REST',
  grpc: 'gRPC',
  websocket: 'WebSocket',
  graphql: 'GraphQL',
};

const protocolColors: Record<ConnectionProtocol, string> = {
  rest: 'text-signal-flux',
  grpc: 'text-signal-active',
  websocket: 'text-signal-healthy',
  graphql: 'text-signal-warning',
};

export function LatencyPathPanel({ onHighlightPath, onClearHighlight }: LatencyPathPanelProps) {
  const { t } = useTranslation();
  const nodes = useArchitectureStore((s) => s.nodes);
  const edges = useArchitectureStore((s) => s.edges);

  const [isOpen, setIsOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'source' | 'target' | null>(null);
  const [protocolOverride, setProtocolOverride] = useState<ConnectionProtocol | undefined>(undefined);
  const [showComparison, setShowComparison] = useState(false);

  // Noeuds sélectionnables (pas les zones)
  const selectableNodes = useMemo(
    () => nodes.filter((n) => n.type !== 'network-zone'),
    [nodes]
  );

  const nodeLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, (n.data as Record<string, unknown>).label as string || n.id);
    }
    return map;
  }, [nodes]);

  // Calcul de latence
  const result: LatencyResult | null = useMemo(() => {
    if (!sourceId || !targetId) return null;
    return calculatePathLatency(sourceId, targetId, nodes, edges, protocolOverride);
  }, [sourceId, targetId, nodes, edges, protocolOverride]);

  // Comparaison protocoles
  const comparison = useMemo(() => {
    if (!showComparison || !sourceId || !targetId) return null;
    return compareProtocolLatencies(sourceId, targetId, nodes, edges);
  }, [showComparison, sourceId, targetId, nodes, edges]);

  // Surligner le chemin
  useEffect(() => {
    if (result && onHighlightPath) {
      onHighlightPath(result.path, result.edgePath);
    } else if (onClearHighlight) {
      onClearHighlight();
    }
    return () => onClearHighlight?.();
  }, [result, onHighlightPath, onClearHighlight]);

  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      if (selectionMode === 'source') {
        setSourceId(nodeId);
        setSelectionMode('target');
      } else if (selectionMode === 'target') {
        setTargetId(nodeId);
        setSelectionMode(null);
      }
    },
    [selectionMode]
  );

  const reset = useCallback(() => {
    setSourceId(null);
    setTargetId(null);
    setSelectionMode(null);
    setShowComparison(false);
    setProtocolOverride(undefined);
    onClearHighlight?.();
  }, [onClearHighlight]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] font-semibold border rounded-sm cursor-pointer transition-colors text-muted-foreground border-border hover:bg-muted/50 bg-background/80 backdrop-blur-sm"
        title={t('latency.title')}
      >
        <Route className="w-3 h-3" />
        LATENCY
      </button>
    );
  }

  return (
    <div
      className="w-80 bg-background/95 backdrop-blur-sm border border-border rounded-md shadow-lg font-mono text-xs animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-signal-active" />
          <span className="font-semibold text-[11px]">{t('latency.title')}</span>
        </div>
        <button
          onClick={() => { setIsOpen(false); reset(); }}
          className="text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Source / Target selection */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectionMode('source')}
            className={cn(
              'flex-1 px-2 py-1.5 border rounded text-left transition-colors cursor-pointer',
              selectionMode === 'source'
                ? 'border-signal-active bg-signal-active/10 text-signal-active'
                : 'border-border text-muted-foreground hover:border-muted-foreground'
            )}
          >
            <div className="text-[9px] uppercase tracking-wider opacity-60">Source</div>
            <div className="truncate text-foreground">
              {sourceId ? nodeLabels.get(sourceId) : t('latency.selectSource')}
            </div>
          </button>
          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          <button
            onClick={() => setSelectionMode('target')}
            className={cn(
              'flex-1 px-2 py-1.5 border rounded text-left transition-colors cursor-pointer',
              selectionMode === 'target'
                ? 'border-signal-active bg-signal-active/10 text-signal-active'
                : 'border-border text-muted-foreground hover:border-muted-foreground'
            )}
          >
            <div className="text-[9px] uppercase tracking-wider opacity-60">Destination</div>
            <div className="truncate text-foreground">
              {targetId ? nodeLabels.get(targetId) : t('latency.selectTarget')}
            </div>
          </button>
        </div>

        {/* Node dropdown when in selection mode */}
          {selectionMode && (
            <div
              className="overflow-hidden animate-in fade-in duration-150"
            >
              <div className="max-h-32 overflow-y-auto border border-border rounded bg-background">
                {selectableNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeSelect(node.id)}
                    className={cn(
                      'w-full px-2 py-1 text-left text-xs hover:bg-muted/50 transition-colors cursor-pointer',
                      (node.id === sourceId || node.id === targetId) && 'bg-muted/30'
                    )}
                  >
                    <span className="text-muted-foreground text-[9px] mr-1.5">{node.type}</span>
                    {(node.data as Record<string, unknown>).label as string || node.id}
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Protocol override toggle */}
        {sourceId && targetId && (
          <div className="flex items-center gap-1 pt-1">
            <span className="text-[9px] text-muted-foreground uppercase">Proto:</span>
            <button
              onClick={() => setProtocolOverride(undefined)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] cursor-pointer transition-colors',
                !protocolOverride
                  ? 'bg-signal-active/15 text-signal-active'
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              Auto
            </button>
            {(['rest', 'grpc', 'websocket', 'graphql'] as ConnectionProtocol[]).map((proto) => (
              <button
                key={proto}
                onClick={() => setProtocolOverride(proto)}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] uppercase cursor-pointer transition-colors',
                  protocolOverride === proto
                    ? `bg-signal-active/15 ${protocolColors[proto]}`
                    : 'text-muted-foreground hover:bg-muted/50'
                )}
              >
                {proto}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="border-t border-border">
          {/* Total */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
            <span className="text-muted-foreground">P50 estimé</span>
            <span className="text-lg font-bold text-foreground">
              {result.totalLatency.toFixed(1)}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">ms</span>
            </span>
          </div>

          {/* Hop breakdown */}
          <div className="max-h-48 overflow-y-auto">
            {result.hops.map((hop, i) => (
              <div
                key={hop.nodeId}
                className={cn(
                  'flex items-center justify-between px-3 py-1.5',
                  i % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[9px] text-muted-foreground w-3 text-right shrink-0">{i + 1}</span>
                  <span className="truncate text-foreground">{hop.nodeLabel}</span>
                  {hop.protocol && (
                    <span className={cn('text-[8px] uppercase', protocolColors[hop.protocol])}>
                      {hop.protocol}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-right">
                  {hop.interZoneLatency > 0 && (
                    <span className="text-[9px] text-signal-warning">+{hop.interZoneLatency}ms zone</span>
                  )}
                  <span className="w-14 text-right">
                    {(hop.processingLatency * hop.protocolMultiplier).toFixed(1)}ms
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Protocol comparison toggle */}
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full flex items-center justify-center gap-1 px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground hover:bg-muted/30 cursor-pointer transition-colors"
          >
            {showComparison ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {t('latency.compareProtocols')}
          </button>

          {/* Protocol comparison */}
            {showComparison && comparison && (
              <div
                className="overflow-hidden border-t border-border animate-in fade-in duration-150"
              >
                <div className="p-3 grid grid-cols-2 gap-2">
                  {(['grpc', 'websocket', 'rest', 'graphql'] as ConnectionProtocol[]).map((proto) => {
                    const latency = comparison[proto];
                    const isActive = protocolOverride === proto;
                    const isBest = latency !== null &&
                      Object.values(comparison).every((v) => v === null || latency <= v);
                    return (
                      <button
                        key={proto}
                        onClick={() => setProtocolOverride(proto)}
                        className={cn(
                          'flex items-center justify-between px-2 py-1.5 border rounded cursor-pointer transition-colors',
                          isActive
                            ? 'border-signal-active bg-signal-active/10'
                            : 'border-border hover:border-muted-foreground'
                        )}
                      >
                        <span className={cn('text-[10px] font-semibold uppercase', protocolColors[proto])}>
                          {protocolLabels[proto]}
                        </span>
                        <span className={cn('font-bold', isBest && 'text-signal-healthy')}>
                          {latency !== null ? `${latency.toFixed(1)}ms` : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Reset */}
          <div className="px-3 py-2 border-t border-border">
            <button
              onClick={reset}
              className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              {t('latency.reset')}
            </button>
          </div>
        </div>
      )}

      {/* No path found */}
      {sourceId && targetId && !result && (
        <div className="px-3 py-4 text-center text-muted-foreground border-t border-border">
          {t('latency.noPath')}
        </div>
      )}
    </div>
  );
}
