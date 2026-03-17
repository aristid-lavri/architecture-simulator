'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle2, Clock, Zap, XCircle, TrendingUp, AlertTriangle, Users } from 'lucide-react';
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

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const END_REASON_LABELS: Record<string, string> = {
  manual: 'Arrêt manuel',
  timeout: 'Fin du délai',
  error: 'Erreur',
  completed: 'Terminée',
};

const END_REASON_COLORS: Record<string, string> = {
  manual: 'text-blue-400 bg-blue-500/10',
  timeout: 'text-green-400 bg-green-500/10',
  error: 'text-red-400 bg-red-500/10',
  completed: 'text-green-400 bg-green-500/10',
};

export function OverviewTab({ report }: { report: SimulationReport }) {
  const health = useMemo(() => calculateHealthScore(report), [report]);
  const recommendations = useMemo(() => generateRecommendations(report), [report]);
  const { metrics, extendedMetrics, timeSeries, resourceUtilizations, clientGroupStats } = report;

  const successRate = metrics.responsesReceived > 0
    ? Math.round((metrics.successCount / metrics.responsesReceived) * 100) : 0;
  const avgLatency = metrics.responsesReceived > 0
    ? Math.round(metrics.totalLatency / metrics.responsesReceived) : 0;
  const p50 = Math.round(extendedMetrics?.p50Latency ?? avgLatency);
  const p95 = Math.round(extendedMetrics?.p95Latency ?? 0);
  const p99 = Math.round(extendedMetrics?.p99Latency ?? 0);

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

  const hasCpuWarn = Object.values(resourceUtilizations).some(u => u.cpu > 90);
  const hasMemWarn = Object.values(resourceUtilizations).some(u => u.memory > 90);
  const hasWarnings = metrics.errorCount > 0 || hasCpuWarn || hasMemWarn;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Summary Header */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div>
          <h3 className="font-semibold">Résumé de la simulation</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(report.timestamp).toLocaleString('fr-FR')}
          </p>
        </div>
        <span className={cn('px-3 py-1 rounded-full text-xs font-medium', END_REASON_COLORS[report.endReason] ?? 'text-muted-foreground bg-muted')}>
          {END_REASON_LABELS[report.endReason] ?? report.endReason}
        </span>
      </div>

      {/* Health Score Hero */}
      <div className="flex items-center gap-8 p-5 bg-card rounded-lg border">
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
        <div className="flex-1">
          <h2 className={cn('text-xl font-semibold', vc.color)}>{vc.label}</h2>
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
        {/* Duration */}
        <div className="flex items-center gap-3 px-5 border-l shrink-0">
          <Clock className="w-8 h-8 text-muted-foreground" />
          <div>
            <div className="text-2xl font-bold">{formatDuration(report.duration)}</div>
            <div className="text-xs text-muted-foreground">
              {report.configuredDuration
                ? `Configurée: ${formatDuration(report.configuredDuration)}`
                : 'Durée illimitée'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Activity className="w-3.5 h-3.5" /> Requêtes envoyées
          </div>
          <div className="text-2xl font-bold">{formatNumber(metrics.requestsSent)}</div>
          <div className="text-xs text-muted-foreground">{metrics.responsesReceived} reçues</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Zap className="w-3.5 h-3.5" /> Throughput
          </div>
          <div className="text-2xl font-bold">{metrics.requestsPerSecond.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">req/s</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Taux de succès
          </div>
          <div className={cn('text-2xl font-bold', successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-yellow-500' : 'text-red-500')}>
            {successRate}%
          </div>
          <div className="text-xs text-muted-foreground">{metrics.successCount} succès</div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <XCircle className="w-3.5 h-3.5" /> Erreurs
          </div>
          <div className={cn('text-2xl font-bold', metrics.errorCount > 0 ? 'text-red-500' : 'text-green-500')}>
            {formatNumber(metrics.errorCount)}
          </div>
          <div className="text-xs text-muted-foreground">
            {metrics.responsesReceived > 0
              ? `${((metrics.errorCount / metrics.responsesReceived) * 100).toFixed(1)}% du total`
              : '—'}
          </div>
        </div>
      </div>

      {/* Latency Percentiles */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4" /> Latence
        </h3>
        <div className="grid grid-cols-6 gap-3 font-mono text-sm">
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
            <div className="font-semibold text-orange-500">{Math.round(metrics.maxLatency)}ms</div>
          </div>
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

      {/* Client Groups Stats */}
      {Object.keys(clientGroupStats).length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" /> Groupes de clients
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(clientGroupStats).map(([groupId, stats]) => (
              <div key={groupId} className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm font-medium truncate mb-1">
                  {groupId.split('-').slice(0, 2).join('-')}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Clients actifs</span>
                  <span className="font-mono">{stats.activeClients}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Requêtes</span>
                  <span className="font-mono">{formatNumber(stats.requestsSent)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-500 font-medium mb-2">
            <AlertTriangle className="w-4 h-4" /> Avertissements
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            {metrics.errorCount > 0 && metrics.responsesReceived > 0 && (
              <li>• {metrics.errorCount} requêtes ont échoué ({Math.round((metrics.errorCount / metrics.responsesReceived) * 100)}% du total)</li>
            )}
            {hasCpuWarn && <li>• Saturation CPU détectée sur certains serveurs</li>}
            {hasMemWarn && <li>• Saturation mémoire détectée sur certains serveurs</li>}
          </ul>
        </div>
      )}

      {/* Top Recommendations */}
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
