'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Users,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { useState } from 'react';
import { useSimulationStore, selectAverageLatency, selectSuccessRate } from '@/store/simulation-store';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  color?: string;
}

function MetricCard({ icon, label, value, suffix, color = 'text-foreground' }: MetricCardProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
      <div className={cn('text-muted-foreground', color)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={cn('text-sm font-semibold', color)}>
          {value}
          {suffix && <span className="text-xs font-normal ml-0.5">{suffix}</span>}
        </p>
      </div>
    </div>
  );
}

export function MetricsPanel() {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  const state = useSimulationStore((s) => s.state);
  const metrics = useSimulationStore((s) => s.metrics);
  const avgLatency = useSimulationStore(selectAverageLatency);
  const successRate = useSimulationStore(selectSuccessRate);
  const resourceUtilizations = useSimulationStore((s) => s.resourceUtilizations);
  const clientGroupStats = useSimulationStore((s) => s.clientGroupStats);

  // Only show when simulation is running or has run
  if (state === 'idle' && metrics.requestsSent === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="bg-background/95 backdrop-blur border rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b cursor-pointer hover:bg-muted/50"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{t('metrics.title')}</span>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  state === 'running' && 'bg-green-500/20 text-green-500',
                  state === 'paused' && 'bg-yellow-500/20 text-yellow-500',
                  state === 'idle' && 'bg-muted text-muted-foreground'
                )}
              >
                {t(`simulation.${state}`)}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Metrics Grid */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="p-3 grid grid-cols-4 gap-2 min-w-[500px]">
                  <MetricCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    label={t('metrics.requestsSent')}
                    value={metrics.requestsSent}
                  />
                  <MetricCard
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    label={t('metrics.successRate')}
                    value={successRate}
                    suffix="%"
                    color={successRate >= 95 ? 'text-green-500' : successRate >= 80 ? 'text-yellow-500' : 'text-red-500'}
                  />
                  <MetricCard
                    icon={<Clock className="h-4 w-4" />}
                    label={t('metrics.avgLatency')}
                    value={avgLatency}
                    suffix="ms"
                    color={avgLatency < 100 ? 'text-green-500' : avgLatency < 500 ? 'text-yellow-500' : 'text-red-500'}
                  />
                  <MetricCard
                    icon={<Zap className="h-4 w-4" />}
                    label={t('metrics.requestsPerSecond')}
                    value={metrics.requestsPerSecond}
                    suffix="rps"
                  />
                </div>

                {/* Additional stats row */}
                <div className="px-3 pb-3 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span>{metrics.successCount} success</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span>{metrics.errorCount} errors</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Min: {metrics.minLatency === Infinity ? 0 : metrics.minLatency}ms</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Max: {metrics.maxLatency}ms</span>
                  </div>
                </div>

                {/* Stress Testing Stats (if client groups are active) */}
                {clientGroupStats.size > 0 && (
                  <div className="px-3 pb-3 border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-3 w-3 text-blue-500" />
                      <span className="text-xs font-medium">Groupes de clients</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {Array.from(clientGroupStats.entries()).map(([groupId, stats]) => (
                        <div key={groupId} className="bg-muted/50 rounded p-2">
                          <div className="font-medium truncate">{stats.activeClients} clients</div>
                          <div className="text-muted-foreground">{stats.requestsSent} req</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resource Utilization Summary */}
                {resourceUtilizations.size > 0 && (
                  <div className="px-3 pb-3 border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-3 w-3 text-purple-500" />
                      <span className="text-xs font-medium">Utilisation serveurs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Array.from(resourceUtilizations.entries()).slice(0, 4).map(([nodeId, util]) => (
                        <div key={nodeId} className="flex items-center justify-between bg-muted/50 rounded p-2">
                          <span className="text-muted-foreground">CPU/Mem/Net</span>
                          <div className="flex items-center gap-1">
                            <span className={cn(
                              util.cpu > 90 ? 'text-red-500' : util.cpu > 70 ? 'text-yellow-500' : 'text-green-500'
                            )}>{Math.round(util.cpu)}%</span>
                            <span>/</span>
                            <span className={cn(
                              util.memory > 90 ? 'text-red-500' : util.memory > 70 ? 'text-yellow-500' : 'text-green-500'
                            )}>{Math.round(util.memory)}%</span>
                            <span>/</span>
                            <span className={cn(
                              util.network > 90 ? 'text-red-500' : util.network > 70 ? 'text-yellow-500' : 'text-green-500'
                            )}>{Math.round(util.network)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Queue/Reject warnings */}
                    {Array.from(resourceUtilizations.values()).some(u => u.queuedRequests > 0) && (
                      <div className="flex items-center gap-1 mt-2 text-orange-500">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-xs">Requêtes en file d'attente</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
