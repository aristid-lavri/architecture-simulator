'use client';

import { useMemo } from 'react';
import type { SimulationReport } from '@/store/simulation-store';
import { MetricSparkline } from '@/components/simulation/MetricSparkline';
import { cn } from '@/lib/utils';

export function PerformanceTab({ report }: { report: SimulationReport }) {
  const { metrics, extendedMetrics, timeSeries } = report;

  const avgLatency = metrics.responsesReceived > 0
    ? Math.round(metrics.totalLatency / metrics.responsesReceived) : 0;
  const successRate = metrics.responsesReceived > 0
    ? Math.round((metrics.successCount / metrics.responsesReceived) * 100) : 0;
  const p50 = Math.round(extendedMetrics?.p50Latency ?? avgLatency);
  const p95 = Math.round(extendedMetrics?.p95Latency ?? 0);
  const p99 = Math.round(extendedMetrics?.p99Latency ?? 0);

  // Latency distribution bar segments
  const maxLat = Math.max(metrics.maxLatency, 1);
  const segments = useMemo(() => {
    if (maxLat === 0) return [];
    return [
      { label: 'P50', value: p50, pct: (p50 / maxLat) * 100, color: 'bg-green-500' },
      { label: 'P95', value: p95, pct: ((p95 - p50) / maxLat) * 100, color: 'bg-yellow-500' },
      { label: 'P99', value: p99, pct: ((p99 - p95) / maxLat) * 100, color: 'bg-orange-500' },
      { label: 'Max', value: Math.round(maxLat), pct: ((maxLat - p99) / maxLat) * 100, color: 'bg-red-500' },
    ];
  }, [p50, p95, p99, maxLat]);

  // Time-series data
  const rpsData = useMemo(() => timeSeries.map(s => s.metrics.requestsPerSecond), [timeSeries]);
  const latencyData = useMemo(() => timeSeries.map(s => {
    const r = s.metrics.responsesReceived;
    return r > 0 ? Math.round(s.metrics.totalLatency / r) : 0;
  }), [timeSeries]);
  const errorData = useMemo(() => timeSeries.map(s => s.metrics.errorCount), [timeSeries]);

  // Rejections breakdown
  const rejections = useMemo(() => {
    if (!extendedMetrics?.rejectionsByReason) return [];
    const map = extendedMetrics.rejectionsByReason instanceof Map
      ? extendedMetrics.rejectionsByReason
      : new Map(Object.entries(extendedMetrics.rejectionsByReason));
    const entries = [...map.entries()].sort((a, b) => (b[1] as number) - (a[1] as number));
    const total = entries.reduce((s, [, v]) => s + (v as number), 0);
    return entries.map(([reason, count]) => ({
      reason: reason as string,
      count: count as number,
      pct: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
    }));
  }, [extendedMetrics]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Latency Overview */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-4">Distribution des latences</h3>
        <div className="grid grid-cols-6 gap-3 mb-4 font-mono text-sm">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Min</div>
            <div className="font-semibold text-green-500">{metrics.minLatency === Infinity ? 0 : metrics.minLatency}ms</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">P50</div>
            <div className="font-semibold">{p50}ms</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Moy</div>
            <div className="font-semibold">{avgLatency}ms</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">P95</div>
            <div className={cn('font-semibold', p95 > 500 ? 'text-yellow-500' : '')}>{p95}ms</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">P99</div>
            <div className={cn('font-semibold', p99 > 1000 ? 'text-orange-500' : '')}>{p99}ms</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Max</div>
            <div className="font-semibold text-red-500">{Math.round(maxLat)}ms</div>
          </div>
        </div>
        {/* Distribution bar */}
        <div className="h-6 flex rounded-md overflow-hidden">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className={cn(seg.color, 'relative group')}
              style={{ width: `${Math.max(seg.pct, 1)}%` }}
              title={`${seg.label}: ${seg.value}ms`}
            >
              {seg.pct > 10 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/80">
                  {seg.label}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono">
          <span>0ms</span>
          <span>{p50}ms</span>
          <span>{p95}ms</span>
          <span>{Math.round(maxLat)}ms</span>
        </div>
      </div>

      {/* Time-series Charts */}
      {timeSeries.length > 2 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-4">Évolution temporelle</h3>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Requêtes par seconde (RPS)</div>
              <MetricSparkline data={rpsData} width={700} height={60} color="text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Latence moyenne (ms)</div>
              <MetricSparkline data={latencyData} width={700} height={60} color="text-yellow-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Erreurs cumulées</div>
              <MetricSparkline data={errorData} width={700} height={60} color="text-red-500" />
            </div>
          </div>
        </div>
      )}

      {/* Metrics Summary Table */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-3">Résumé</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Requêtes envoyées</span><span className="font-mono">{metrics.requestsSent}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Réponses reçues</span><span className="font-mono">{metrics.responsesReceived}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Taux de succès</span><span className={cn('font-mono', successRate >= 95 ? 'text-green-500' : 'text-yellow-500')}>{successRate}%</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Taux d&apos;erreur</span><span className={cn('font-mono', metrics.errorCount > 0 ? 'text-red-500' : '')}>{metrics.responsesReceived > 0 ? ((metrics.errorCount / metrics.responsesReceived) * 100).toFixed(1) : 0}%</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Rejets totaux</span><span className="font-mono">{extendedMetrics?.requestsRejected ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Taux de rejet</span><span className="font-mono">{(extendedMetrics?.rejectionRate ?? 0).toFixed(1)}%</span></div>
        </div>
      </div>

      {/* Rejections Breakdown */}
      {rejections.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Rejets par raison</h3>
          <div className="space-y-2">
            {rejections.map((r) => (
              <div key={r.reason} className="flex items-center gap-3">
                <span className="text-xs font-mono w-32 shrink-0 text-muted-foreground">{r.reason}</span>
                <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                  <div className="h-full bg-red-500/60 rounded-sm" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-xs font-mono w-16 text-right">{r.count} ({r.pct}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
