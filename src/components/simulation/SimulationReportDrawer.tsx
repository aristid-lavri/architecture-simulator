'use client';

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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimulationStore, type SimulationReport } from '@/store/simulation-store';
import { cn } from '@/lib/utils';

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

interface ReportContentProps {
  report: SimulationReport;
}

function ReportContent({ report }: ReportContentProps) {
  const { metrics, resourceUtilizations, clientGroupStats, duration, endReason } = report;

  const avgLatency = metrics.responsesReceived > 0
    ? Math.round(metrics.totalLatency / metrics.responsesReceived)
    : 0;

  const successRate = metrics.responsesReceived > 0
    ? Math.round((metrics.successCount / metrics.responsesReceived) * 100)
    : 0;

  const endReasonLabels = {
    manual: 'Arrêt manuel',
    timeout: 'Fin du délai',
    error: 'Erreur',
  };

  const endReasonColors = {
    manual: 'text-blue-500',
    timeout: 'text-green-500',
    error: 'text-red-500',
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

      {/* Latency Metrics */}
      <div className="space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Latence
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Minimum</div>
            <div className="text-lg font-semibold text-green-500">
              {metrics.minLatency === Infinity ? 0 : metrics.minLatency}ms
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Moyenne</div>
            <div className="text-lg font-semibold">{avgLatency}ms</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Maximum</div>
            <div className="text-lg font-semibold text-orange-500">{metrics.maxLatency}ms</div>
          </div>
        </div>
      </div>

      {/* Client Groups Stats */}
      {clientGroupStats.size > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Groupes de clients
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from(clientGroupStats.entries()).map(([groupId, stats]) => (
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
      {resourceUtilizations.size > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Server className="h-4 w-4" />
            Utilisation des ressources serveur
          </h4>
          <div className="space-y-2">
            {Array.from(resourceUtilizations.entries()).map(([nodeId, util]) => (
              <div key={nodeId} className="bg-muted/50 rounded-lg p-3">
                <div className="text-sm font-medium mb-2 truncate">
                  {nodeId.split('-').slice(0, 2).join('-')}
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
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {(metrics.errorCount > 0 || Array.from(resourceUtilizations.values()).some(u => u.cpu > 90 || u.memory > 90)) && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-500 font-medium mb-2">
            <AlertTriangle className="h-4 w-4" />
            Avertissements
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            {metrics.errorCount > 0 && (
              <li>• {metrics.errorCount} requêtes ont échoué ({Math.round((metrics.errorCount / metrics.responsesReceived) * 100)}% du total)</li>
            )}
            {Array.from(resourceUtilizations.values()).some(u => u.cpu > 90) && (
              <li>• Saturation CPU détectée sur certains serveurs</li>
            )}
            {Array.from(resourceUtilizations.values()).some(u => u.memory > 90) && (
              <li>• Saturation mémoire détectée sur certains serveurs</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SimulationReportDrawer() {
  const report = useSimulationStore((s) => s.report);
  const showReport = useSimulationStore((s) => s.showReport);
  const setShowReport = useSimulationStore((s) => s.setShowReport);
  const clearReport = useSimulationStore((s) => s.clearReport);
  const reset = useSimulationStore((s) => s.reset);

  const handleClose = () => {
    setShowReport(false);
  };

  const handleNewSimulation = () => {
    clearReport();
    reset();
  };

  const handleExport = () => {
    if (!report) return;

    const exportData = {
      ...report,
      resourceUtilizations: Object.fromEntries(report.resourceUtilizations),
      clientGroupStats: Object.fromEntries(report.clientGroupStats),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {showReport && report && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 right-0 z-50 bg-background border-b shadow-xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <h2 className="text-xl font-bold">Rapport de simulation</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
                <Button variant="outline" size="sm" onClick={handleNewSimulation}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Nouvelle simulation
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-4xl mx-auto">
                <ReportContent report={report} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
