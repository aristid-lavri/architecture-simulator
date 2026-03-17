'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Zap,
  TrendingUp,
  Users,
  Server,
  AlertTriangle,
  Download,
  RotateCcw,
  ScrollText,
  ChevronDown,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimulationStore, type SimulationReport } from '@/store/simulation-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { cn } from '@/lib/utils';
import { calculateHealthScore, type HealthVerdict } from '@/lib/health-score';
import { generateRecommendations, type Recommendation, type RecommendationSeverity } from '@/lib/simulation-recommendations';
import type { SimulationEvent, SimulationEventType, TimeSeriesSnapshot } from '@/types';
import { MetricSparkline } from './MetricSparkline';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function SaturationBadge({ saturation }: { saturation: number }) {
  if (saturation >= 90) {
    return <span className="text-xs px-2 py-0.5 bg-red-500/15 text-red-500 font-medium rounded">SATURE</span>;
  }
  if (saturation >= 70) {
    return <span className="text-xs px-2 py-0.5 bg-yellow-500/15 text-yellow-500 font-medium rounded">DEGRADE</span>;
  }
  return <span className="text-xs px-2 py-0.5 bg-green-500/15 text-green-500 font-medium rounded">OK</span>;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}

function MetricCard({ icon, label, value, subValue, color = 'text-foreground' }: MetricCardProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {subValue && <div className="text-xs text-muted-foreground mt-1">{subValue}</div>}
    </div>
  );
}

const EVENT_TYPE_STYLES: Record<SimulationEventType, { label: string; color: string }> = {
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

interface ChainSummary {
  chainId: string;
  events: SimulationEvent[];
  hasError: boolean;
  totalLatency: number | null;
  status: 'success' | 'error' | 'incomplete';
}

function TracesSection({ events }: { events: SimulationEvent[] }) {
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const nodes = useArchitectureStore((s) => s.nodes);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, (node.data as { label?: string }).label || node.id.split('-')[0]);
    }
    return map;
  }, [nodes]);

  const getLabel = (id: string) => labelMap.get(id) || id.split('-')[0];

  const chains = useMemo((): ChainSummary[] => {
    const groups = new Map<string, SimulationEvent[]>();
    for (const e of events) {
      const key = e.chainId || '__no_chain__';
      const list = groups.get(key) || [];
      list.push(e);
      groups.set(key, list);
    }

    const result: ChainSummary[] = [];
    for (const [chainId, evts] of groups) {
      const hasError = evts.some((e) => e.type === 'ERROR');
      const responseSent = evts.find((e) => e.type === 'RESPONSE_SENT' && e.data.latency !== undefined);
      const hasResponse = evts.some((e) => e.type === 'RESPONSE_SENT' || e.type === 'RESPONSE_RECEIVED');
      result.push({
        chainId,
        events: evts,
        hasError,
        totalLatency: responseSent?.data.latency ?? null,
        status: hasError ? 'error' : hasResponse ? 'success' : 'incomplete',
      });
    }

    // Sort: errors first, then by time
    result.sort((a, b) => {
      if (a.hasError !== b.hasError) return a.hasError ? -1 : 1;
      return a.events[0].timestamp - b.events[0].timestamp;
    });

    return result;
  }, [events]);

  const toggleChain = (chainId: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(chainId)) next.delete(chainId);
      else next.add(chainId);
      return next;
    });
  };

  const statusCounts = useMemo(() => {
    const success = chains.filter((c) => c.status === 'success').length;
    const error = chains.filter((c) => c.status === 'error').length;
    const incomplete = chains.filter((c) => c.status === 'incomplete').length;
    return { success, error, incomplete };
  }, [chains]);

  if (events.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-medium flex items-center gap-2">
        <ScrollText className="h-4 w-4" />
        Traces des requêtes
      </h4>

      {/* Summary badges */}
      <div className="flex gap-3 text-xs mb-2">
        <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded">
          {statusCounts.success} succès
        </span>
        {statusCounts.error > 0 && (
          <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded">
            {statusCounts.error} erreurs
          </span>
        )}
        {statusCounts.incomplete > 0 && (
          <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">
            {statusCounts.incomplete} incomplètes
          </span>
        )}
        <span className="text-muted-foreground">{events.length} événements total</span>
      </div>

      {/* Chain list */}
      <div className="bg-muted/30 rounded-lg border max-h-80 overflow-y-auto">
        {chains.map((chain) => {
          const isExpanded = expandedChains.has(chain.chainId);
          const firstEvent = chain.events[0];
          return (
            <div key={chain.chainId} className="border-b border-border/30 last:border-0">
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/30 text-sm',
                  chain.hasError && 'bg-red-500/5'
                )}
                onClick={() => toggleChain(chain.chainId)}
              >
                {isExpanded
                  ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                }
                <span className="text-[10px] font-mono px-1 bg-muted/50 text-muted-foreground rounded">
                  {chain.chainId.slice(-6)}
                </span>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  chain.status === 'success' && 'bg-green-500/10 text-green-500',
                  chain.status === 'error' && 'bg-red-500/10 text-red-500',
                  chain.status === 'incomplete' && 'bg-yellow-500/10 text-yellow-500',
                )}>
                  {chain.status === 'success' ? 'OK' : chain.status === 'error' ? 'ERR' : '...'}
                </span>
                {chain.totalLatency !== null && (
                  <span className="text-xs text-blue-400">{chain.totalLatency}ms</span>
                )}
                <span className="text-xs text-muted-foreground">{chain.events.length} evt</span>
                {firstEvent.data.method && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {firstEvent.data.method} {firstEvent.data.path}
                  </span>
                )}
              </div>
              {isExpanded && (
                <div className="pl-6 pr-3 pb-2 font-mono text-[11px] leading-relaxed">
                  {chain.events.map((event) => {
                    const config = EVENT_TYPE_STYLES[event.type];
                    return (
                      <div key={event.id} className="flex gap-2">
                        <span className="text-muted-foreground/60 shrink-0">
                          {new Date(event.timestamp).toLocaleTimeString('fr-FR', { hour12: false, fractionalSecondDigits: 3 })}
                        </span>
                        <span className={cn('shrink-0 w-10', config.color)}>{config.label}</span>
                        <span className="text-foreground/80">{getLabel(event.sourceNodeId)}</span>
                        {event.targetNodeId && (
                          <>
                            <span className="text-muted-foreground/40">→</span>
                            <span className="text-foreground/80">{getLabel(event.targetNodeId)}</span>
                          </>
                        )}
                        {event.data.status && (
                          <span className={cn(
                            event.data.status >= 400 ? 'text-red-500' : 'text-green-500'
                          )}>{event.data.status}</span>
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

interface ReportContentProps {
  report: SimulationReport;
}

function HealthScoreDisplay({ report }: { report: SimulationReport }) {
  const health = useMemo(() => calculateHealthScore(report), [report]);
  const verdictConfig: Record<HealthVerdict, { label: string; color: string; bg: string }> = {
    healthy: { label: 'Architecture saine', color: 'text-green-500', bg: 'bg-green-500' },
    degraded: { label: 'Dégradation détectée', color: 'text-yellow-500', bg: 'bg-yellow-500' },
    critical: { label: 'Problèmes critiques', color: 'text-red-500', bg: 'bg-red-500' },
  };
  const config = verdictConfig[health.verdict];

  return (
    <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg border">
      {/* Score circle */}
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/50" />
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"
            className={config.color}
            strokeDasharray={`${health.score * 1.76} 176`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-lg font-bold', config.color)}>{health.score}</span>
        </div>
      </div>
      {/* Verdict + penalties */}
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-semibold', config.color)}>{config.label}</div>
        {health.penalties.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {health.penalties.slice(0, 3).map((p, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="text-signal-critical">-{p.points}</span>
                <span>{p.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendationsSection({ report }: { report: SimulationReport }) {
  const recommendations = useMemo(() => generateRecommendations(report), [report]);
  const severityConfig: Record<RecommendationSeverity, { icon: string; color: string; bg: string }> = {
    critical: { icon: '✗', color: 'text-red-500', bg: 'bg-red-500/10' },
    warning: { icon: '⚠', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    info: { icon: 'ℹ', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  };

  if (recommendations.length === 0) {
    return (
      <div className="p-4 bg-green-500/10 rounded-lg text-center">
        <span className="text-green-500 font-medium">Aucun problème détecté</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec, i) => {
        const config = severityConfig[rec.severity];
        return (
          <div key={i} className={cn('p-3 rounded-lg', config.bg)}>
            <div className="flex items-start gap-2">
              <span className={cn('text-sm shrink-0', config.color)}>{config.icon}</span>
              <div className="min-w-0">
                <div className={cn('text-sm font-medium', config.color)}>{rec.message}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{rec.suggestion}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportContent({ report }: ReportContentProps) {
  const { metrics, resourceUtilizations, clientGroupStats, duration, endReason } = report;

  const avgLatency = metrics.responsesReceived > 0
    ? Math.round(metrics.totalLatency / metrics.responsesReceived)
    : 0;

  const successRate = metrics.responsesReceived > 0
    ? Math.round((metrics.successCount / metrics.responsesReceived) * 100)
    : 0;

  const endReasonLabels: Record<string, string> = {
    manual: 'Arrêt manuel',
    timeout: 'Fin du délai',
    error: 'Erreur',
    completed: 'Terminée',
  };

  const endReasonColors: Record<string, string> = {
    manual: 'text-blue-500',
    timeout: 'text-green-500',
    error: 'text-red-500',
    completed: 'text-green-500',
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-semibold">Résumé de la simulation</h3>
          <p className="text-sm text-muted-foreground">
            {new Date(report.timestamp).toLocaleString('fr-FR')}
          </p>
        </div>
        <div className={cn('px-3 py-1 rounded-full text-sm font-medium', endReasonColors[endReason], 'bg-muted')}>
          {endReasonLabels[endReason]}
        </div>
      </div>

      {/* 1. Executive Summary — Health Score */}
      <HealthScoreDisplay report={report} />

      {/* Duration Info */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
        <Clock className="h-8 w-8 text-muted-foreground" />
        <div>
          <div className="text-2xl font-bold">{formatDuration(duration)}</div>
          <div className="text-sm text-muted-foreground">
            {report.configuredDuration
              ? `Durée configurée: ${formatDuration(report.configuredDuration)}`
              : 'Durée illimitée'}
          </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          label="Requêtes envoyées"
          value={formatNumber(metrics.requestsSent)}
        />
        <MetricCard
          icon={<Zap className="h-4 w-4" />}
          label="Requêtes/seconde"
          value={metrics.requestsPerSecond.toFixed(1)}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Taux de succès"
          value={`${successRate}%`}
          color={successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-yellow-500' : 'text-red-500'}
        />
        <MetricCard
          icon={<XCircle className="h-4 w-4" />}
          label="Erreurs"
          value={formatNumber(metrics.errorCount)}
          color={metrics.errorCount > 0 ? 'text-red-500' : 'text-green-500'}
        />
      </div>

      {/* Latency Metrics with Percentiles */}
      <div className="space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Latence
        </h4>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Min</div>
            <div className="text-lg font-semibold text-green-500">
              {metrics.minLatency === Infinity ? 0 : metrics.minLatency}ms
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">P50</div>
            <div className="text-lg font-semibold">
              {Math.round(report.extendedMetrics?.p50Latency ?? avgLatency)}ms
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Moy</div>
            <div className="text-lg font-semibold">{avgLatency}ms</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">P95</div>
            <div className={cn('text-lg font-semibold', (report.extendedMetrics?.p95Latency ?? 0) > 500 ? 'text-yellow-500' : '')}>
              {Math.round(report.extendedMetrics?.p95Latency ?? 0)}ms
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">P99</div>
            <div className={cn('text-lg font-semibold', (report.extendedMetrics?.p99Latency ?? 0) > 1000 ? 'text-orange-500' : '')}>
              {Math.round(report.extendedMetrics?.p99Latency ?? 0)}ms
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Max</div>
            <div className="text-lg font-semibold text-orange-500">{Math.round(metrics.maxLatency)}ms</div>
          </div>
        </div>
      </div>

      {/* Time Series Evolution */}
      {report.timeSeries && report.timeSeries.length > 2 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Évolution temporelle
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-2">RPS</div>
              <MetricSparkline
                data={report.timeSeries.map((s: TimeSeriesSnapshot) => s.metrics.requestsPerSecond)}
                width={200} height={40} color="text-blue-400"
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-2">Latence moyenne</div>
              <MetricSparkline
                data={report.timeSeries.map((s: TimeSeriesSnapshot) =>
                  s.metrics.responsesReceived > 0 ? Math.round(s.metrics.totalLatency / s.metrics.responsesReceived) : 0
                )}
                width={200} height={40} color="text-yellow-500"
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-2">Erreurs cumulées</div>
              <MetricSparkline
                data={report.timeSeries.map((s: TimeSeriesSnapshot) => s.metrics.errorCount)}
                width={200} height={40} color="text-red-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Client Groups Stats */}
      {Object.keys(clientGroupStats).length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Groupes de clients
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(clientGroupStats).map(([groupId, stats]) => (
              <div key={groupId} className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm font-medium truncate mb-1">
                  {groupId.split('-').slice(0, 2).join('-')}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Clients actifs</span>
                  <span className="font-medium">{stats.activeClients}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Requêtes</span>
                  <span className="font-medium">{formatNumber(stats.requestsSent)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Server Resource Utilization */}
      {Object.keys(resourceUtilizations).length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Server className="h-4 w-4" />
            Utilisation des ressources serveur
          </h4>
          <div className="space-y-2">
            {Object.entries(resourceUtilizations).map(([nodeId, util]) => {
              const saturation = Math.max(util.cpu, util.memory, util.network);
              return (
              <div key={nodeId} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium truncate">
                    {nodeId.split('-').slice(0, 2).join('-')}
                  </span>
                  <SaturationBadge saturation={saturation} />
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">CPU</span>
                    <div className={cn(
                      'font-medium',
                      util.cpu > 90 ? 'text-red-500' : util.cpu > 70 ? 'text-yellow-500' : 'text-green-500'
                    )}>
                      {Math.round(util.cpu)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mémoire</span>
                    <div className={cn(
                      'font-medium',
                      util.memory > 90 ? 'text-red-500' : util.memory > 70 ? 'text-yellow-500' : 'text-green-500'
                    )}>
                      {Math.round(util.memory)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Réseau</span>
                    <div className={cn(
                      'font-medium',
                      util.network > 90 ? 'text-red-500' : util.network > 70 ? 'text-yellow-500' : 'text-green-500'
                    )}>
                      {Math.round(util.network)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">File</span>
                    <div className={cn(
                      'font-medium',
                      util.queuedRequests > 0 ? 'text-orange-500' : 'text-green-500'
                    )}>
                      {util.queuedRequests}
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* Saturation Summary */}
      {Object.keys(resourceUtilizations).length > 0 && (() => {
        const entries = Object.values(resourceUtilizations);
        const saturated = entries.filter(u => Math.max(u.cpu, u.memory, u.network) >= 90).length;
        const degraded = entries.filter(u => { const s = Math.max(u.cpu, u.memory, u.network); return s >= 70 && s < 90; }).length;
        const healthy = entries.filter(u => Math.max(u.cpu, u.memory, u.network) < 70).length;
        return (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-500">{healthy}</div>
              <div className="text-xs text-muted-foreground">Serveurs OK</div>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-500">{degraded}</div>
              <div className="text-xs text-muted-foreground">Degraded</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-500">{saturated}</div>
              <div className="text-xs text-muted-foreground">Satures</div>
            </div>
          </div>
        );
      })()}

      {/* Warnings */}
      {(metrics.errorCount > 0 || Object.values(resourceUtilizations).some(u => u.cpu > 90 || u.memory > 90)) && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-500 font-medium mb-2">
            <AlertTriangle className="h-4 w-4" />
            Avertissements
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            {metrics.errorCount > 0 && (
              <li>• {metrics.errorCount} requêtes ont échoué ({Math.round((metrics.errorCount / metrics.responsesReceived) * 100)}% du total)</li>
            )}
            {Object.values(resourceUtilizations).some(u => u.cpu > 90) && (
              <li>• Saturation CPU détectée sur certains serveurs</li>
            )}
            {Object.values(resourceUtilizations).some(u => u.memory > 90) && (
              <li>• Saturation mémoire détectée sur certains serveurs</li>
            )}
          </ul>
        </div>
      )}

      {/* Bottleneck Summary */}
      {report.bottleneckAnalysis && report.bottleneckAnalysis.topBottlenecks.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Goulots d&apos;étranglement
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {report.bottleneckAnalysis.topBottlenecks.slice(0, 3).map((b, i) => (
              <div key={b.nodeId} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{['🥇', '🥈', '🥉'][i]}</span>
                  <span className="text-sm font-medium truncate">{b.nodeName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Impact: <span className={cn(
                    'font-semibold',
                    b.impactScore >= 70 ? 'text-red-500' : b.impactScore >= 40 ? 'text-yellow-500' : 'text-green-500'
                  )}>{Math.round(b.impactScore)}</span></span>
                  <span>·</span>
                  <SaturationBadge saturation={b.saturation} />
                  {b.isSpof && <span className="text-red-500 font-medium">SPOF</span>}
                </div>
                {b.reasons.length > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground truncate">
                    {b.reasons.slice(0, 2).join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <ScrollText className="h-4 w-4" />
          Recommandations
        </h4>
        <RecommendationsSection report={report} />
      </div>

      {/* Request Traces */}
      {report.events && report.events.length > 0 && (
        <TracesSection events={report.events} />
      )}
    </div>
  );
}

export function SimulationReportDrawer() {
  const report = useSimulationStore((s) => s.report);
  const showReport = useSimulationStore((s) => s.showReport);
  const setAnalysisMode = useSimulationStore((s) => s.setAnalysisMode);

  return (
    <AnimatePresence>
      {showReport && report && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 8 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          data-tour="report-drawer"
        >
          <Button
            size="lg"
            onClick={() => setAnalysisMode(true)}
            className="shadow-lg gap-2 px-6"
          >
            <BarChart3 className="h-5 w-5" />
            Analyse détaillée
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
