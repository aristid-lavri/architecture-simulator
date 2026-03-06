'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { useSimulationStore, selectAverageLatency, selectSuccessRate } from '@/store/simulation-store';
import { useAppStore } from '@/store/app-store';
import { useSimulationEvents } from '@/hooks/useSimulationEvents';
import { OutputPanel } from './OutputPanel';
import { cn } from '@/lib/utils';

type BottomTab = 'metrics' | 'output';

function MetricsContent() {
  const metrics = useSimulationStore((s) => s.metrics);
  const avgLatency = useSimulationStore(selectAverageLatency);
  const successRate = useSimulationStore(selectSuccessRate);
  const resourceUtilizations = useSimulationStore((s) => s.resourceUtilizations);
  const clientGroupStats = useSimulationStore((s) => s.clientGroupStats);

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

      {/* Resource Utilization */}
      {resourceUtilizations.size > 0 && (
        <div>
          <span className="text-instrument text-[9px] text-muted-foreground block mb-1">SERVER UTILIZATION</span>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            {Array.from(resourceUtilizations.entries()).slice(0, 6).map(([nodeId, util]) => (
              <div key={nodeId} className="flex items-center justify-between px-2 py-1 bg-muted/30 border border-border" style={{ borderRadius: '2px' }}>
                <span className="text-muted-foreground truncate max-w-20">{nodeId.split('-')[0]}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    util.cpu > 90 ? 'text-signal-critical' : util.cpu > 70 ? 'text-signal-warning' : 'text-signal-healthy'
                  )}>{Math.round(util.cpu)}%</span>
                  <span className="text-border">/</span>
                  <span className={cn(
                    util.memory > 90 ? 'text-signal-critical' : util.memory > 70 ? 'text-signal-warning' : 'text-signal-healthy'
                  )}>{Math.round(util.memory)}%</span>
                  <span className="text-border">/</span>
                  <span className={cn(
                    util.network > 90 ? 'text-signal-critical' : util.network > 70 ? 'text-signal-warning' : 'text-signal-healthy'
                  )}>{Math.round(util.network)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 600;
const DEFAULT_PANEL_HEIGHT = 220;

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
  const { events } = useSimulationEvents();

  // Hide in edit mode or when no simulation data exists
  if (mode === 'edit' || (state === 'idle' && metrics.requestsSent === 0 && events.length === 0)) {
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
                    'px-2 py-0.5 text-[10px] font-mono uppercase transition-colors',
                    activeTab === 'output'
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground/70'
                  )}
                  style={{ borderRadius: '0 2px 2px 0' }}
                  onClick={(e) => { e.stopPropagation(); setActiveTab('output'); setIsExpanded(true); }}
                >
                  Output
                  {events.length > 0 && (
                    <span className="text-signal-flux ml-1">({events.length})</span>
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
                  className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-10 group flex items-center justify-center"
                >
                  <div className="w-8 h-0.5 rounded-full bg-border group-hover:bg-muted-foreground transition-colors" />
                </div>
                <div className="h-full overflow-y-auto">
                  {activeTab === 'metrics' ? (
                    <MetricsContent />
                  ) : (
                    <OutputPanel eventCount={events.length} panelHeight={panelHeight} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
