'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle2, Clock, Zap } from 'lucide-react';
import type { SimulationReport } from '@/store/simulation-store';
import { calculateHealthScore } from '@/lib/health-score';
import { generateRecommendations } from '@/lib/simulation-recommendations';
import { MetricSparkline } from '@/components/simulation/MetricSparkline';
import { cn } from '@/lib/utils';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function OverviewTab({ report }: { report: SimulationReport }) {
  const health = useMemo(() => calculateHealthScore(report), [report]);
  const recommendations = useMemo(() => generateRecommendations(report), [report]);
  const { metrics, extendedMetrics, timeSeries } = report;

  const successRate = metrics.responsesReceived > 0
    ? Math.round((metrics.successCount / metrics.responsesReceived) * 100) : 0;
  const avgLatency = metrics.responsesReceived > 0
    ? Math.round(metrics.totalLatency / metrics.responsesReceived) : 0;

  // Time-series data for sparklines
  const rpsData = useMemo(() => timeSeries.map(s => s.metrics.requestsPerSecond), [timeSeries]);
  const latencyData = useMemo(() => timeSeries.map(s => {
    const r = s.metrics.responsesReceived;
    return r > 0 ? Math.round(s.metrics.totalLatency / r) : 0;
  }), [timeSeries]);
  const errorData = useMemo(() => timeSeries.map(s => s.metrics.errorCount), [timeSeries]);

  const verdictConfig = {
    healthy: { label: 'Architecture saine', color: 'text-green-500', bg: 'bg-green-500' },
    degraded: { label: 'Dégradation détectée', color: 'text-yellow-500', bg: 'bg-yellow-500' },
    critical: { label: 'Problèmes critiques', color: 'text-red-500', bg: 'bg-red-500' },
  };
  const vc = verdictConfig[health.verdict];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Health Score Hero */}
      <div className="flex items-center gap-8 p-6 bg-card rounded-lg border">
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
            <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="6"
              className={vc.color} strokeDasharray={`${health.score * 2.64} 264`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-3xl font-bold', vc.color)}>{health.score}</span>
          </div>
        </div>
        <div>
          <h2 className={cn('text-xl font-semibold', vc.color)}>{vc.label}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Durée: {formatDuration(report.duration)} · {metrics.requestsSent} requêtes envoyées
          </p>
          {health.penalties.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {health.penalties.map((p, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
                  -{p.points} {p.reason}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Zap className="w-3.5 h-3.5" /> Throughput
          </div>
          <div className="text-2xl font-bold">{metrics.requestsPerSecond}</div>
          <div className="text-xs text-muted-foreground">req/s</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Fiabilité
          </div>
          <div className={cn('text-2xl font-bold', successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-yellow-500' : 'text-red-500')}>
            {successRate}%
          </div>
          <div className="text-xs text-muted-foreground">taux de succès</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Clock className="w-3.5 h-3.5" /> Latence P95
          </div>
          <div className={cn('text-2xl font-bold', (extendedMetrics?.p95Latency ?? 0) > 500 ? 'text-yellow-500' : '')}>
            {Math.round(extendedMetrics?.p95Latency ?? avgLatency)}ms
          </div>
          <div className="text-xs text-muted-foreground">percentile 95</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Activity className="w-3.5 h-3.5" /> Goulots
          </div>
          <div className={cn('text-2xl font-bold', (report.bottleneckAnalysis?.topBottlenecks.length ?? 0) > 0 ? 'text-orange-500' : 'text-green-500')}>
            {report.bottleneckAnalysis?.topBottlenecks.length ?? 0}
          </div>
          <div className="text-xs text-muted-foreground">détectés</div>
        </div>
      </div>

      {/* Time-series sparklines */}
      {timeSeries.length > 2 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-2">RPS (évolution)</div>
            <MetricSparkline data={rpsData} width={280} height={50} color="text-blue-400" />
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-2">Latence moyenne</div>
            <MetricSparkline data={latencyData} width={280} height={50} color="text-yellow-500" />
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-2">Erreurs cumulées</div>
            <MetricSparkline data={errorData} width={280} height={50} color="text-red-500" />
          </div>
        </div>
      )}

      {/* Top 3 Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Top recommandations</h3>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className={cn(
                'flex items-start gap-2 p-2 rounded text-sm',
                rec.severity === 'critical' ? 'bg-red-500/10' : rec.severity === 'warning' ? 'bg-yellow-500/10' : 'bg-blue-400/10'
              )}>
                <span className={cn('shrink-0', rec.severity === 'critical' ? 'text-red-500' : rec.severity === 'warning' ? 'text-yellow-500' : 'text-blue-400')}>
                  {rec.severity === 'critical' ? '✗' : rec.severity === 'warning' ? '⚠' : 'ℹ'}
                </span>
                <div>
                  <span className="font-medium">{rec.message}</span>
                  <span className="text-muted-foreground ml-1">— {rec.suggestion}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
