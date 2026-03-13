'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useSimulationStore, selectAverageLatency, selectSuccessRate } from '@/store/simulation-store';
import { useAppStore } from '@/store/app-store';
import { useSimulationEvents } from '@/hooks/useSimulationEvents';
import { useArchitectureStore } from '@/store/architecture-store';
import { OutputPanel } from './OutputPanel';
import { ValidationPanel } from './ValidationPanel';
import { MetricSparkline } from './MetricSparkline';
import { cn } from '@/lib/utils';

type BottomTab = 'metrics' | 'output' | 'validation';

function SaturationBadge({ saturation }: { saturation: number }) {
  if (saturation >= 90) {
    return <span className="text-[8px] px-1 py-0 bg-signal-critical/15 text-signal-critical font-mono" style={{ borderRadius: '2px' }}>SATURE</span>;
  }
  if (saturation >= 70) {
    return <span className="text-[8px] px-1 py-0 bg-signal-warning/15 text-signal-warning font-mono" style={{ borderRadius: '2px' }}>DEGRADE</span>;
  }
  return <span className="text-[8px] px-1 py-0 bg-signal-healthy/15 text-signal-healthy font-mono" style={{ borderRadius: '2px' }}>OK</span>;
}

function MetricsContent() {
  const metrics = useSimulationStore((s) => s.metrics);
  const avgLatency = useSimulationStore(selectAverageLatency);
  const successRate = useSimulationStore(selectSuccessRate);
  const resourceUtilizations = useSimulationStore((s) => s.resourceUtilizations);
  const resourceHistory = useSimulationStore((s) => s.resourceHistory);
  const clientGroupStats = useSimulationStore((s) => s.clientGroupStats);
  const metricsTimeSeries = useSimulationStore((s) => s.metricsTimeSeries);
  const nodes = useArchitectureStore((s) => s.nodes);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);

  // Node label map (with type suffix for disambiguation)
  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      const label = (node.data as { label?: string }).label || node.id.split('-')[0];
      map.set(node.id, label);
    }
    return map;
  }, [nodes]);

  // Build sparkline data per server from resourceHistory
  const serverSparklines = useMemo(() => {
    const result = new Map<string, { cpu: number[]; memory: number[]; queue: number[] }>();
    const byNode = new Map<string, typeof resourceHistory>();
    for (const sample of resourceHistory) {
      const list = byNode.get(sample.nodeId) || [];
      list.push(sample);
      byNode.set(sample.nodeId, list);
    }
    for (const [nodeId, samples] of byNode) {
      const recent = samples.slice(-30);
      result.set(nodeId, {
        cpu: recent.map((s) => s.cpu),
        memory: recent.map((s) => s.memory),
        queue: recent.map((s) => s.queuedRequests),
      });
    }
    return result;
  }, [resourceHistory]);

  return (
    <div className="px-4 pb-3 border-t border-border pt-3 space-y-3">
      {/* Detailed latency */}
      <div className="grid grid-cols-4 gap-4 font-mono text-[11px]">
        <div>
          <span className="text-instrument text-[9px] text-muted-foreground block mb-0.5">MIN LATENCY</span>
          <span className="text-foreground">{metrics.minLatency === Infinity ? 0 : metrics.minLatency}ms</span>
        </div>
        <div>
          <span className="text-instrument text-[9px] text-muted-foreground block mb-0.5">AVG LATENCY</span>
          <span className="text-foreground">{avgLatency}ms</span>
        </div>
        <div>
          <span className="text-instrument text-[9px] text-muted-foreground block mb-0.5">MAX LATENCY</span>
          <span className="text-foreground">{metrics.maxLatency}ms</span>
        </div>
        <div>
          <span className="text-instrument text-[9px] text-muted-foreground block mb-0.5">SUCCESS RATE</span>
          <span className={cn(
            successRate >= 95 ? 'text-signal-healthy' : successRate >= 80 ? 'text-signal-warning' : 'text-signal-critical'
          )}>{successRate}%</span>
        </div>
      </div>

      {/* Time Series & Per-Component Filter */}
      {(metricsTimeSeries.length > 0 || resourceUtilizations.size > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-instrument text-[9px] text-muted-foreground">METRICS PAR COMPOSANT</span>
            <select
              value={selectedServer || ''}
              onChange={(e) => setSelectedServer(e.target.value || null)}
              className="bg-muted/30 border border-border/50 text-[10px] px-1.5 py-0.5 text-foreground focus:outline-none focus:border-blue-400/50 font-mono"
              style={{ borderRadius: '2px' }}
            >
              <option value="">Tous (global)</option>
              {Array.from(resourceUtilizations.keys()).map((nodeId) => (
                <option key={nodeId} value={nodeId}>
                  {labelMap.get(nodeId) || nodeId.split('-')[0]}
                </option>
              ))}
            </select>
          </div>

          {/* Per-server metrics when a server is selected */}
          {selectedServer && (() => {
            const util = resourceUtilizations.get(selectedServer);
            const sparklines = serverSparklines.get(selectedServer);
            if (!util) return null;

            // Build time-series data for this server from snapshots
            const serverTsRps = metricsTimeSeries
              .map((s) => s.perServer[selectedServer]?.requests ?? 0)
              .map((v, i, arr) => i > 0 ? Math.max(0, v - arr[i - 1]) : 0);
            const serverTsErrors = metricsTimeSeries
              .map((s) => s.perServer[selectedServer]?.errors ?? 0)
              .map((v, i, arr) => i > 0 ? Math.max(0, v - arr[i - 1]) : 0);

            return (
              <div className="px-2 py-1.5 bg-muted/30 border border-border font-mono text-[11px] space-y-1" style={{ borderRadius: '2px' }}>
                <div className="flex items-center justify-between">
                  <span className="text-foreground/80 font-semibold">{labelMap.get(selectedServer) || selectedServer.split('-')[0]}</span>
                  <SaturationBadge saturation={util.saturation ?? Math.max(util.cpu, util.memory, util.network)} />
                </div>
                <div className="grid grid-cols-4 gap-2 text-[10px]">
                  <div>
                    <span className="text-muted-foreground block">CPU</span>
                    <span className={cn(util.cpu > 90 ? 'text-signal-critical' : util.cpu > 70 ? 'text-signal-warning' : 'text-signal-healthy')}>
                      {Math.round(util.cpu)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">MEM</span>
                    <span className={cn(util.memory > 90 ? 'text-signal-critical' : util.memory > 70 ? 'text-signal-warning' : 'text-signal-healthy')}>
                      {Math.round(util.memory)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">RPS</span>
                    <span className="text-foreground">{util.throughput ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Err%</span>
                    <span className={cn(util.errorRate && util.errorRate > 0 ? 'text-signal-critical' : 'text-signal-healthy')}>
                      {util.errorRate?.toFixed(1) ?? '0'}%
                    </span>
                  </div>
                </div>
                {/* Sparklines for selected server */}
                {sparklines && sparklines.cpu.length > 2 && (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px] text-muted-foreground/50">CPU</span>
                      <MetricSparkline data={sparklines.cpu} width={100} height={28}
                        color={util.cpu > 90 ? 'text-signal-critical' : util.cpu > 70 ? 'text-signal-warning' : 'text-blue-400'} />
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px] text-muted-foreground/50">MEM</span>
                      <MetricSparkline data={sparklines.memory} width={100} height={28}
                        color={util.memory > 90 ? 'text-signal-critical' : util.memory > 70 ? 'text-signal-warning' : 'text-emerald-400'} />
                    </div>
                    {serverTsRps.length > 2 && (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[8px] text-muted-foreground/50">REQ/5s</span>
                        <MetricSparkline data={serverTsRps} width={100} height={28} color="text-blue-400" />
                      </div>
                    )}
                    {serverTsErrors.length > 2 && serverTsErrors.some(v => v > 0) && (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[8px] text-muted-foreground/50">ERR/5s</span>
                        <MetricSparkline data={serverTsErrors} width={100} height={28} color="text-signal-critical" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Global time-series sparklines when no server selected */}
          {!selectedServer && metricsTimeSeries.length > 2 && (
            <div className="flex items-center gap-3 px-2 py-1.5 bg-muted/30 border border-border" style={{ borderRadius: '2px' }}>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] text-muted-foreground/50">RPS</span>
                <MetricSparkline
                  data={metricsTimeSeries.map((s) => s.metrics.requestsPerSecond)}
                  width={120} height={28} color="text-blue-400"
                />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] text-muted-foreground/50">LATENCY</span>
                <MetricSparkline
                  data={metricsTimeSeries.map((s) => s.metrics.responsesReceived > 0 ? Math.round(s.metrics.totalLatency / s.metrics.responsesReceived) : 0)}
                  width={120} height={28} color="text-signal-warning"
                />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] text-muted-foreground/50">ERRORS</span>
                <MetricSparkline
                  data={metricsTimeSeries.map((s) => s.metrics.errorCount)}
                  width={120} height={28} color="text-signal-critical"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Client Groups */}
      {clientGroupStats.size > 0 && (
        <div>
          <span className="text-instrument text-[9px] text-muted-foreground block mb-1">CLIENT GROUPS</span>
          <div className="flex gap-3 font-mono text-[11px]">
            {Array.from(clientGroupStats.entries()).map(([groupId, stats]) => (
              <div key={groupId} className="flex items-center gap-2 px-2 py-1 bg-muted/30 border border-border" style={{ borderRadius: '2px' }}>
                <span className="text-signal-flux font-semibold">{stats.activeClients}</span>
                <span className="text-muted-foreground">clients</span>
                <span className="text-border">|</span>
                <span className="text-foreground">{stats.requestsSent}</span>
                <span className="text-muted-foreground">req</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resource Utilization - Enhanced */}
      {resourceUtilizations.size > 0 && (
        <div>
          <span className="text-instrument text-[9px] text-muted-foreground block mb-1">SERVER UTILIZATION</span>
          <div className="space-y-1.5">
            {Array.from(resourceUtilizations.entries()).slice(0, 8).map(([nodeId, util]) => {
              const sparklines = serverSparklines.get(nodeId);
              const saturation = util.saturation ?? Math.max(util.cpu, util.memory, util.network);

              return (
                <div key={nodeId} className="px-2 py-1.5 bg-muted/30 border border-border font-mono text-[11px]" style={{ borderRadius: '2px' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground/80 truncate max-w-24">{labelMap.get(nodeId) || nodeId.split('-')[0]}</span>
                      <SaturationBadge saturation={saturation} />
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      {util.throughput !== undefined && util.throughput > 0 && (
                        <span className="text-muted-foreground">
                          <span className="text-foreground">{util.throughput}</span> rps
                        </span>
                      )}
                      {util.errorRate !== undefined && util.errorRate > 0 && (
                        <span className="text-signal-critical">
                          {util.errorRate.toFixed(1)}% err
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={cn(
                        util.cpu > 90 ? 'text-signal-critical' : util.cpu > 70 ? 'text-signal-warning' : 'text-signal-healthy'
                      )}>CPU {Math.round(util.cpu)}%</span>
                      <span className="text-border">/</span>
                      <span className={cn(
                        util.memory > 90 ? 'text-signal-critical' : util.memory > 70 ? 'text-signal-warning' : 'text-signal-healthy'
                      )}>MEM {Math.round(util.memory)}%</span>
                      <span className="text-border">/</span>
                      <span className={cn(
                        util.network > 90 ? 'text-signal-critical' : util.network > 70 ? 'text-signal-warning' : 'text-signal-healthy'
                      )}>NET {Math.round(util.network)}%</span>
                    </div>
                    {sparklines && sparklines.cpu.length > 2 && (
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[8px] text-muted-foreground/50">CPU</span>
                          <MetricSparkline
                            data={sparklines.cpu}
                            width={100}
                            height={28}
                            color={util.cpu > 90 ? 'text-signal-critical' : util.cpu > 70 ? 'text-signal-warning' : 'text-blue-400'}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[8px] text-muted-foreground/50">MEM</span>
                          <MetricSparkline
                            data={sparklines.memory}
                            width={100}
                            height={28}
                            color={util.memory > 90 ? 'text-signal-critical' : util.memory > 70 ? 'text-signal-warning' : 'text-emerald-400'}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {util.queuedRequests > 0 && (
                    <div className="flex items-center gap-2 mt-0.5 text-[9px]">
                      <span className="text-signal-warning">queue: {util.queuedRequests}</span>
                      {sparklines && sparklines.queue.length > 2 && (
                        <MetricSparkline
                          data={sparklines.queue}
                          width={80}
                          height={20}
                          color="text-signal-warning"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 900;
const DEFAULT_PANEL_HEIGHT = 280;

export function MetricsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<BottomTab>('metrics');
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = panelHeight;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - ev.clientY;
      const newHeight = Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, startHeight.current + delta));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [panelHeight]);

  const state = useSimulationStore((s) => s.state);
  const metrics = useSimulationStore((s) => s.metrics);
  const avgLatency = useSimulationStore(selectAverageLatency);
  const successRate = useSimulationStore(selectSuccessRate);
  const mode = useAppStore((s) => s.mode);
  const validationResult = useAppStore((s) => s.validationResult);
  const { events } = useSimulationEvents();

  // Auto-expand when simulation starts
  useEffect(() => {
    if (state === 'running') {
      setIsExpanded(true);
    }
  }, [state]);

  // Auto-expand and switch to validation tab when validation has errors
  useEffect(() => {
    if (validationResult && validationResult.issues.length > 0) {
      setActiveTab('validation');
      setIsExpanded(true);
    }
  }, [validationResult]);

  const hasSimData = state !== 'idle' || metrics.requestsSent > 0 || events.length > 0;
  const hasValidation = validationResult !== null;

  // Hide when no data to show
  if (!hasSimData && !hasValidation) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-0 left-0 right-0 z-10"
      >
        <div className="bg-card/95 backdrop-blur-sm border-t border-border">
          {/* Compact telemetry bar — always visible */}
          <div
            className="flex items-center justify-between px-4 h-10 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-6 font-mono text-[11px]">
              {hasSimData ? (
                <>
                  {/* Status dot */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      state === 'running' && 'bg-signal-healthy signal-pulse',
                      state === 'paused' && 'bg-signal-warning',
                      state === 'idle' && 'bg-muted-foreground/30'
                    )} />
                    <span className="text-muted-foreground uppercase text-[10px]">{state}</span>
                  </div>

                  <span className="text-border">|</span>

                  {/* Key metrics inline */}
                  <span className="text-muted-foreground">
                    REQ:<span className="text-foreground ml-1">{metrics.requestsSent.toLocaleString()}</span>
                  </span>
                  <span className="text-muted-foreground">
                    RES:<span className="text-foreground ml-1">{metrics.successCount + metrics.errorCount}</span>
                  </span>
                  <span className="text-muted-foreground">
                    ERR:<span className={cn(
                      'ml-1',
                      metrics.errorCount > 0 ? 'text-signal-critical' : 'text-foreground'
                    )}>{metrics.errorCount}</span>
                    {metrics.requestsSent > 0 && (
                      <span className="text-muted-foreground ml-0.5">
                        ({(100 - successRate).toFixed(1)}%)
                      </span>
                    )}
                  </span>

                  <span className="text-border">|</span>

                  <span className="text-muted-foreground">
                    P50:<span className={cn(
                      'ml-1',
                      avgLatency < 100 ? 'text-signal-healthy' : avgLatency < 500 ? 'text-signal-warning' : 'text-signal-critical'
                    )}>{avgLatency}ms</span>
                  </span>
                  <span className="text-muted-foreground">
                    RPS:<span className="text-foreground ml-1">{metrics.requestsPerSecond}</span>
                  </span>
                </>
              ) : validationResult ? (
                <>
                  <span className="text-muted-foreground uppercase text-[10px]">VALIDATION</span>
                  <span className="text-border">|</span>
                  {validationResult.errorCount > 0 && (
                    <span className="text-signal-critical">
                      {validationResult.errorCount} err
                    </span>
                  )}
                  {validationResult.warningCount > 0 && (
                    <span className="text-signal-warning">
                      {validationResult.warningCount} warn
                    </span>
                  )}
                  {validationResult.isValid && validationResult.issues.length === 0 && (
                    <span className="text-signal-healthy">OK</span>
                  )}
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {/* Tab buttons */}
              <div className="flex gap-px" style={{ borderRadius: '2px' }}>
                <button
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono uppercase transition-colors',
                    activeTab === 'metrics'
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground/70'
                  )}
                  style={{ borderRadius: '2px 0 0 2px' }}
                  onClick={(e) => { e.stopPropagation(); setActiveTab('metrics'); setIsExpanded(true); }}
                >
                  Metrics
                </button>
                <button
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono uppercase transition-colors border-x border-border/30',
                    activeTab === 'output'
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground/70'
                  )}
                  onClick={(e) => { e.stopPropagation(); setActiveTab('output'); setIsExpanded(true); }}
                >
                  Output
                  {events.length > 0 && (
                    <span className="text-signal-flux ml-1">({events.length})</span>
                  )}
                </button>
                <button
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono uppercase transition-colors',
                    activeTab === 'validation'
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground/70'
                  )}
                  style={{ borderRadius: '0 2px 2px 0' }}
                  onClick={(e) => { e.stopPropagation(); setActiveTab('validation'); setIsExpanded(true); }}
                >
                  Valid
                  {validationResult && validationResult.errorCount > 0 && (
                    <span className="text-signal-critical ml-1">({validationResult.errorCount})</span>
                  )}
                  {validationResult && validationResult.errorCount === 0 && validationResult.warningCount > 0 && (
                    <span className="text-signal-warning ml-1">({validationResult.warningCount})</span>
                  )}
                </button>
              </div>

              <button className="text-muted-foreground hover:text-foreground transition-colors">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Expanded details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: panelHeight, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: isDragging.current ? 0 : 0.2 }}
                className="overflow-hidden relative"
              >
                {/* Resize handle */}
                <div
                  onMouseDown={handleResizeStart}
                  className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize z-10 group flex items-center justify-center"
                >
                  <div className="w-12 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-muted-foreground group-active:bg-foreground transition-colors" />
                </div>
                <div className="h-full overflow-y-auto">
                  {activeTab === 'metrics' && <MetricsContent />}
                  {activeTab === 'output' && <OutputPanel eventCount={events.length} panelHeight={panelHeight} />}
                  {activeTab === 'validation' && <ValidationPanel panelHeight={panelHeight} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
