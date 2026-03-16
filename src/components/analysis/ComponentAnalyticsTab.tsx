'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle, Info, ArrowUpDown } from 'lucide-react';
import { useAnalyticsStore } from '@/store/analytics-store';
import { cn } from '@/lib/utils';
import type { ComponentAnalytics } from '@/analytics/types';

type SortKey = 'name' | 'avgLatency' | 'rps' | 'errorRate' | 'cpu' | 'memory';
type SortDir = 'asc' | 'desc';

function fmt1(n: number) { return n.toFixed(1); }
function fmtMs(ms: number) { return ms > 0 ? `${Math.round(ms)}ms` : '—'; }
function fmtPct(n?: number) { return n !== undefined ? `${Math.round(n)}%` : '—'; }

function LatencyCell({ ms }: { ms: number }) {
  if (ms <= 0) return <span className="text-muted-foreground">—</span>;
  const cls = ms < 100 ? 'text-signal-healthy' : ms < 500 ? 'text-signal-warning' : 'text-signal-critical';
  return <span className={cls}>{fmtMs(ms)}</span>;
}

function ErrorCell({ rate }: { rate: number }) {
  if (rate <= 0) return <span className="text-signal-healthy">0%</span>;
  const cls = rate < 1 ? 'text-signal-healthy' : rate < 10 ? 'text-signal-warning' : 'text-signal-critical';
  return <span className={cls}>{fmt1(rate)}%</span>;
}

function CpuCell({ pct }: { pct?: number }) {
  if (pct === undefined) return <span className="text-muted-foreground">—</span>;
  const cls = pct < 70 ? 'text-foreground' : pct < 85 ? 'text-signal-warning' : 'text-signal-critical';
  return <span className={cls}>{Math.round(pct)}%</span>;
}

function TopCard({ title, value, name, color }: { title: string; value: string; name: string; color: string }) {
  return (
    <div className={cn('rounded border border-border/50 p-3 space-y-1', color)}>
      <div className="text-[10px] uppercase font-mono text-muted-foreground">{title}</div>
      <div className="text-lg font-mono font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground truncate">{name}</div>
    </div>
  );
}

function SortButton({ label, col, current, dir, onClick }: {
  label: string; col: SortKey; current: SortKey; dir: SortDir; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-0.5 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={cn('w-3 h-3', current === col ? 'text-foreground' : 'text-muted-foreground/50')} />
      {current === col && <span className="text-[9px]">{dir === 'desc' ? '↓' : '↑'}</span>}
    </button>
  );
}

/** Onglet "Analytics" dans AnalysisView — synthèse post-simulation per-composant. */
export function ComponentAnalyticsTab() {
  const synthesis = useAnalyticsStore((s) => s.synthesis);
  const [sortKey, setSortKey] = useState<SortKey>('avgLatency');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const rows = useMemo<ComponentAnalytics[]>(() => {
    if (!synthesis) return [];
    const all = Object.values(synthesis.components);
    return [...all].sort((a, b) => {
      let av = 0, bv = 0;
      switch (sortKey) {
        case 'name': return sortDir === 'asc'
          ? a.nodeName.localeCompare(b.nodeName)
          : b.nodeName.localeCompare(a.nodeName);
        case 'avgLatency': av = a.avgLatency; bv = b.avgLatency; break;
        case 'rps': av = a.rps; bv = b.rps; break;
        case 'errorRate': av = a.errorRate; bv = b.errorRate; break;
        case 'cpu': av = a.cpu ?? 0; bv = b.cpu ?? 0; break;
        case 'memory': av = a.memory ?? 0; bv = b.memory ?? 0; break;
      }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [synthesis, sortKey, sortDir]);

  if (!synthesis) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <Info className="w-5 h-5" />
        <p className="text-sm">Aucune donnée analytics — lancez et arrêtez une simulation.</p>
      </div>
    );
  }

  const top1Latency = synthesis.topByLatency[0];
  const top1Error = synthesis.topByErrorRate[0];
  const top1Cpu = synthesis.topByCpuUsage[0];

  return (
    <div className="space-y-6">
      {/* Top 3 cards */}
      <div className="grid grid-cols-3 gap-4">
        {top1Latency && (
          <TopCard
            title="Latence max"
            value={fmtMs(top1Latency.avgLatency)}
            name={top1Latency.nodeName}
            color="bg-signal-warning/5"
          />
        )}
        {top1Error && (
          <TopCard
            title="Taux d'erreur max"
            value={`${fmt1(top1Error.errorRate)}%`}
            name={top1Error.nodeName}
            color="bg-signal-critical/5"
          />
        )}
        {top1Cpu && (
          <TopCard
            title="CPU max"
            value={fmtPct(top1Cpu.cpu)}
            name={top1Cpu.nodeName}
            color="bg-signal-warning/5"
          />
        )}
      </div>

      {/* Observations */}
      {synthesis.observations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Observations</h3>
          <div className="space-y-1.5">
            {synthesis.observations.map((obs, i) => {
              const isWarning = obs.includes('élevé') || obs.includes('Saturation') || obs.includes('profonde');
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 px-3 py-2 rounded text-sm',
                    isWarning ? 'bg-signal-warning/10 text-signal-warning' : 'bg-muted/30 text-muted-foreground',
                  )}
                >
                  {isWarning
                    ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    : <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  }
                  {obs}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tableau per-composant */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Composants ({rows.length})</h3>
          <span className="text-[11px] text-muted-foreground font-mono">
            Durée : {Math.round(synthesis.durationMs / 1000)}s
          </span>
        </div>
        <div className="border border-border/50 rounded overflow-hidden">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">
                  <SortButton label="Nom" col="name" current={sortKey} dir={sortDir} onClick={() => handleSort('name')} />
                </th>
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">Type</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-normal">
                  <SortButton label="Latence moy" col="avgLatency" current={sortKey} dir={sortDir} onClick={() => handleSort('avgLatency')} />
                </th>
                <th className="text-right px-3 py-2 text-muted-foreground font-normal">
                  <SortButton label="RPS" col="rps" current={sortKey} dir={sortDir} onClick={() => handleSort('rps')} />
                </th>
                <th className="text-right px-3 py-2 text-muted-foreground font-normal">
                  <SortButton label="Erreurs" col="errorRate" current={sortKey} dir={sortDir} onClick={() => handleSort('errorRate')} />
                </th>
                <th className="text-right px-3 py-2 text-muted-foreground font-normal">
                  <SortButton label="CPU" col="cpu" current={sortKey} dir={sortDir} onClick={() => handleSort('cpu')} />
                </th>
                <th className="text-right px-3 py-2 text-muted-foreground font-normal">
                  <SortButton label="Mém" col="memory" current={sortKey} dir={sortDir} onClick={() => handleSort('memory')} />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.nodeId}
                  className={cn(
                    'border-b border-border/30 last:border-0',
                    i % 2 === 0 ? 'bg-transparent' : 'bg-muted/10',
                  )}
                >
                  <td className="px-3 py-1.5 text-foreground font-medium truncate max-w-[140px]">
                    {row.nodeName}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    <span className="px-1 bg-muted/30" style={{ borderRadius: '2px' }}>
                      {row.nodeType}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <LatencyCell ms={row.avgLatency} />
                  </td>
                  <td className="px-3 py-1.5 text-right text-foreground">
                    {row.rps > 0 ? fmt1(row.rps) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <ErrorCell rate={row.errorRate} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <CpuCell pct={row.cpu} />
                  </td>
                  <td className="px-3 py-1.5 text-right text-foreground">
                    {fmtPct(row.memory)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
