'use client';

import { useMemo, useEffect } from 'react';
import { useAnalyticsStore } from '@/store/analytics-store';
import { useSimulationStore } from '@/store/simulation-store';
import { MetricSparkline } from './MetricSparkline';
import { cn } from '@/lib/utils';
import type { ComponentAnalytics } from '@/analytics/types';

// ─── Utilitaires ────────────────────────────────────────────────────────────

function fmt1(n: number) { return n.toFixed(1); }

function latencyColor(ms: number) {
  if (ms <= 0) return 'text-muted-foreground';
  return ms < 100 ? 'text-signal-healthy' : ms < 500 ? 'text-signal-warning' : 'text-signal-critical';
}

function errorColor(rate: number) {
  return rate < 1 ? 'text-signal-healthy' : rate < 10 ? 'text-signal-warning' : 'text-signal-critical';
}

function cpuColor(pct: number) {
  return pct < 70 ? 'text-signal-healthy' : pct < 85 ? 'text-signal-warning' : 'text-signal-critical';
}

// ─── Sidebar item ────────────────────────────────────────────────────────────

function ComponentListItem({
  analytics,
  isSelected,
  onClick,
}: {
  analytics: ComponentAnalytics;
  isSelected: boolean;
  onClick: () => void;
}) {
  const errClass = errorColor(analytics.errorRate);
  const hasErr = analytics.errorRate > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-2 py-1.5 flex flex-col gap-0.5 transition-colors border-b border-border/20 last:border-0',
        isSelected
          ? 'bg-muted/60 text-foreground'
          : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-mono truncate max-w-25">{analytics.nodeName}</span>
        {hasErr && (
          <span className={cn('text-[9px] font-mono shrink-0', errClass)}>
            {fmt1(analytics.errorRate)}%
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <span
          className="text-[8px] uppercase text-muted-foreground/60 truncate"
          style={{ maxWidth: '80px' }}
        >
          {analytics.nodeType}
        </span>
        {analytics.avgLatency > 0 && (
          <span className={cn('text-[9px] font-mono shrink-0', latencyColor(analytics.avgLatency))}>
            {Math.round(analytics.avgLatency)}ms
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Panneau de détail ────────────────────────────────────────────────────────

function MiniBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  return (
    <div className="flex-1 h-0.5 bg-muted/30 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ComponentDetail({ analytics }: { analytics: ComponentAnalytics }) {
  const hasCpu = analytics.cpu !== undefined;
  const hasMem = analytics.memory !== undefined;
  const hasQueue = analytics.queueDepth !== undefined;

  return (
    <div className="px-3 py-2 space-y-3 font-mono text-[11px] overflow-y-auto h-full">
      {/* En-tête */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-1.5 py-0 text-[9px] uppercase bg-muted/40 text-muted-foreground"
          style={{ borderRadius: '2px' }}
        >
          {analytics.nodeType}
        </span>
        <span className="text-foreground font-semibold">{analytics.nodeName}</span>
      </div>

      {/* Métriques principales — 3 colonnes */}
      <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-2">
        <div>
          <span className="text-muted-foreground block text-[9px] uppercase">Requêtes</span>
          <span className="text-foreground">{analytics.totalRequests.toLocaleString()}</span>
          <span className="text-muted-foreground block">{fmt1(analytics.rps)} rps</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[9px] uppercase">Latence</span>
          <span className={latencyColor(analytics.avgLatency)}>
            {analytics.avgLatency > 0 ? `${Math.round(analytics.avgLatency)}ms` : '—'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[9px] uppercase">Erreurs</span>
          <span className={errorColor(analytics.errorRate)}>{fmt1(analytics.errorRate)}%</span>
          <span className="text-muted-foreground block">{analytics.totalErrors} err</span>
        </div>
      </div>

      {/* Ressources */}
      {(hasCpu || hasMem || hasQueue) && (
        <div className="space-y-1.5 border-t border-border/40 pt-2">
          {hasCpu && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-8">CPU</span>
              <MiniBar
                value={analytics.cpu!}
                color={analytics.cpu! > 85 ? 'bg-signal-critical' : analytics.cpu! > 70 ? 'bg-signal-warning' : 'bg-signal-healthy'}
              />
              <span className={cpuColor(analytics.cpu!)}>{Math.round(analytics.cpu!)}%</span>
              {analytics.cpuHistory.length >= 2 && (
                <MetricSparkline
                  data={analytics.cpuHistory}
                  width={80}
                  height={28}
                  color={analytics.cpu! > 85 ? 'text-signal-critical' : 'text-signal-warning'}
                />
              )}
            </div>
          )}
          {hasMem && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-8">MEM</span>
              <MiniBar
                value={analytics.memory!}
                color={analytics.memory! > 85 ? 'bg-signal-critical' : analytics.memory! > 70 ? 'bg-signal-warning' : 'bg-muted-foreground/60'}
              />
              <span className={analytics.memory! > 85 ? 'text-signal-critical' : analytics.memory! > 70 ? 'text-signal-warning' : 'text-foreground'}>
                {Math.round(analytics.memory!)}%
              </span>
              {analytics.memoryHistory.length >= 2 && (
                <MetricSparkline
                  data={analytics.memoryHistory}
                  width={80}
                  height={28}
                  color="text-blue-400"
                />
              )}
            </div>
          )}
          {hasQueue && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-8">QUEUE</span>
              <MiniBar value={analytics.queueDepth!} max={Math.max(analytics.queueDepth! * 2, 10)} color="bg-signal-flux/70" />
              <span className="text-foreground">{analytics.queueDepth}</span>
            </div>
          )}
        </div>
      )}

      {/* Sparklines historique — layout vertical, pleine largeur */}
      {analytics.latencyHistory.length >= 2 && (
        <div className="space-y-3 border-t border-border/40 pt-2">
          <div className="space-y-1">
            <span className="text-muted-foreground text-[9px] uppercase block">Latence / 5s</span>
            <MetricSparkline data={analytics.latencyHistory} width={220} height={48} color="text-signal-warning" />
          </div>
          {analytics.rpsHistory.length >= 2 && (
            <div className="space-y-1">
              <span className="text-muted-foreground text-[9px] uppercase block">RPS / 5s</span>
              <MetricSparkline data={analytics.rpsHistory} width={220} height={48} color="text-signal-healthy" />
            </div>
          )}
          {analytics.errorHistory.length >= 2 && (
            <div className="space-y-1">
              <span className="text-muted-foreground text-[9px] uppercase block">Erreurs % / 5s</span>
              <MetricSparkline data={analytics.errorHistory} width={220} height={48} color="text-signal-critical" />
            </div>
          )}
        </div>
      )}

      {/* API Gateway */}
      {analytics.gatewayUtilization && (
        <div className="border-t border-border/40 pt-2 space-y-1">
          <span className="text-muted-foreground text-[9px] uppercase block">Gateway</span>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-muted-foreground block">Bloqués</span>
              <span className={analytics.gatewayUtilization.blockedRequests > 0 ? 'text-signal-critical' : 'text-foreground'}>
                {analytics.gatewayUtilization.blockedRequests}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Auth</span>
              <span className={analytics.gatewayUtilization.authFailures > 0 ? 'text-signal-warning' : 'text-foreground'}>
                {analytics.gatewayUtilization.authFailures}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Rate</span>
              <span className={analytics.gatewayUtilization.rateLimitHits > 0 ? 'text-signal-critical' : 'text-foreground'}>
                {analytics.gatewayUtilization.rateLimitHits}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Message Queue */}
      {analytics.queueUtilization && (
        <div className="border-t border-border/40 pt-2 space-y-1">
          <span className="text-muted-foreground text-[9px] uppercase block">Queue</span>
          <div className="grid grid-cols-4 gap-1">
            <div>
              <span className="text-muted-foreground block">Depth</span>
              <span className="text-foreground">{analytics.queueUtilization.queueDepth}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Pub</span>
              <span className="text-foreground">{analytics.queueUtilization.messagesPublished}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Cons</span>
              <span className="text-foreground">{analytics.queueUtilization.messagesConsumed}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">DLQ</span>
              <span className={analytics.queueUtilization.messagesDeadLettered > 0 ? 'text-signal-critical' : 'text-foreground'}>
                {analytics.queueUtilization.messagesDeadLettered}
              </span>
            </div>
          </div>
        </div>
      )}

      {analytics.isAggregated && analytics.childrenCount !== undefined && (
        <div className="border-t border-border/40 pt-2 text-muted-foreground text-[9px]">
          Agrégé sur {analytics.childrenCount} enfant(s)
        </div>
      )}
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

/** Panel affiché dans l'onglet "Composant" de MetricsPanel. */
export function ComponentAnalyticsPanel({ panelHeight }: { panelHeight: number }) {
  const state = useSimulationStore((s) => s.state);
  const components = useAnalyticsStore((s) => s.components);
  const selectedComponentId = useAnalyticsStore((s) => s.selectedComponentId);
  const setSelectedComponentId = useAnalyticsStore((s) => s.setSelectedComponentId);

  // Trier par nodeType puis nodeName pour un affichage stable
  const sortedComponents = useMemo(
    () =>
      Array.from(components.values()).sort((a, b) => {
        const typeOrder = a.nodeType.localeCompare(b.nodeType);
        return typeOrder !== 0 ? typeOrder : a.nodeName.localeCompare(b.nodeName);
      }),
    [components],
  );

  // Sélectionner automatiquement le premier composant disponible
  useEffect(() => {
    if (!selectedComponentId && sortedComponents.length > 0) {
      setSelectedComponentId(sortedComponents[0].nodeId);
    }
  }, [selectedComponentId, sortedComponents, setSelectedComponentId]);

  const selectedAnalytics = selectedComponentId
    ? components.get(selectedComponentId)
    : undefined;

  if (state === 'idle' || sortedComponents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-[11px] font-mono">
        Démarrer la simulation pour voir les composants
      </div>
    );
  }

  const contentHeight = panelHeight - 16;

  return (
    <div className="flex h-full" style={{ height: contentHeight }}>
      {/* Sidebar — liste des composants */}
      <div className="w-36 shrink-0 border-r border-border/40 overflow-y-auto">
        {sortedComponents.map((a) => (
          <ComponentListItem
            key={a.nodeId}
            analytics={a}
            isSelected={a.nodeId === selectedComponentId}
            onClick={() => setSelectedComponentId(a.nodeId)}
          />
        ))}
      </div>

      {/* Détail à droite */}
      <div className="flex-1 overflow-y-auto">
        {selectedAnalytics ? (
          <ComponentDetail analytics={selectedAnalytics} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-[11px] font-mono">
            Sélectionner un composant
          </div>
        )}
      </div>
    </div>
  );
}
