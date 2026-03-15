'use client';

import { useMemo } from 'react';
import type { SimulationReport } from '@/store/simulation-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { cn } from '@/lib/utils';

function SaturationBadge({ saturation }: { saturation: number }) {
  if (saturation >= 90) return <span className="text-[10px] px-1.5 py-0.5 bg-red-500/15 text-red-500 font-mono rounded">SATURE</span>;
  if (saturation >= 70) return <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/15 text-yellow-500 font-mono rounded">DEGRADE</span>;
  return <span className="text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-500 font-mono rounded">OK</span>;
}

export function BottlenecksTab({ report }: { report: SimulationReport }) {
  const { bottleneckAnalysis } = report;
  const nodes = useArchitectureStore((s) => s.nodes);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, (node.data as { label?: string }).label || node.id.split('-')[0]);
    }
    return map;
  }, [nodes]);

  if (!bottleneckAnalysis || bottleneckAnalysis.allNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Aucune analyse de goulots disponible pour cette simulation.
      </div>
    );
  }

  const { topBottlenecks, allNodes, spofNodes, criticalPath } = bottleneckAnalysis;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Critical Path */}
      {criticalPath && criticalPath.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Chemin critique</h3>
          <div className="flex items-center gap-1 flex-wrap">
            {criticalPath.map((nodeId, i) => {
              const info = allNodes.find(n => n.nodeId === nodeId);
              const heatColors = {
                green: 'bg-green-500/20 text-green-500 border-green-500/30',
                yellow: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
                orange: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
                red: 'bg-red-500/20 text-red-500 border-red-500/30',
              };
              const colorClass = heatColors[info?.heatmapLevel ?? 'green'];
              return (
                <div key={nodeId} className="flex items-center gap-1">
                  <span className={cn('px-2 py-1 text-xs font-mono border rounded', colorClass)}>
                    {labelMap.get(nodeId) ?? nodeId.slice(0, 8)}
                  </span>
                  {i < criticalPath.length - 1 && (
                    <span className="text-muted-foreground text-xs">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top 3 Bottlenecks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topBottlenecks.slice(0, 3).map((b, i) => (
          <div key={b.nodeId} className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{b.nodeName}</div>
                <div className="text-xs text-muted-foreground">{b.nodeType}</div>
              </div>
            </div>
            {/* Impact bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Impact</span>
                <span className={cn('font-mono', b.impactScore >= 70 ? 'text-red-500' : b.impactScore >= 40 ? 'text-yellow-500' : 'text-green-500')}>
                  {Math.round(b.impactScore)}/100
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', b.impactScore >= 70 ? 'bg-red-500' : b.impactScore >= 40 ? 'bg-yellow-500' : 'bg-green-500')}
                  style={{ width: `${b.impactScore}%` }}
                />
              </div>
            </div>
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saturation</span>
                <SaturationBadge saturation={b.saturation} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">P99</span>
                <span className="font-mono">{Math.round(b.p99Latency)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latence %</span>
                <span className="font-mono">{Math.round(b.latencyContribution)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Queue ±</span>
                <span className={cn('font-mono', b.queueGrowthRate > 0 ? 'text-orange-500' : '')}>
                  {b.queueGrowthRate > 0 ? '+' : ''}{b.queueGrowthRate.toFixed(1)}/s
                </span>
              </div>
            </div>
            {/* SPOF + reasons */}
            <div className="mt-2 flex flex-wrap gap-1">
              {b.isSpof && <span className="text-[10px] px-1.5 py-0.5 bg-red-500/15 text-red-500 font-semibold rounded">SPOF</span>}
              {b.reasons.slice(0, 2).map((r, ri) => (
                <span key={ri} className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">{r}</span>
              ))}
            </div>
            {/* Predicted saturation */}
            {b.predictedSaturationTime !== null && (
              <div className="mt-2 text-xs text-orange-500">
                Saturation prédite dans {Math.round(b.predictedSaturationTime)}s
              </div>
            )}
          </div>
        ))}
      </div>

      {/* SPOF Alerts */}
      {spofNodes.length > 0 && (
        <div className="bg-red-500/10 rounded-lg border border-red-500/20 p-4">
          <h3 className="text-sm font-medium text-red-500 mb-2">Points uniques de défaillance (SPOF)</h3>
          <div className="space-y-1">
            {spofNodes.map((nodeId) => {
              const info = allNodes.find(n => n.nodeId === nodeId);
              return (
                <div key={nodeId} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-medium">{info?.nodeName ?? labelMap.get(nodeId) ?? nodeId}</span>
                  <span className="text-xs text-muted-foreground">— Ajouter de la redondance (load-balancer + replicas)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Ranking Table */}
      <div className="bg-card rounded-lg border">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-medium">Classement complet</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left p-2 pl-4">#</th>
              <th className="text-left p-2">Composant</th>
              <th className="text-center p-2">État</th>
              <th className="text-right p-2">Latence %</th>
              <th className="text-right p-2">Queue ±/s</th>
              <th className="text-right p-2">Impact</th>
              <th className="text-center p-2">SPOF</th>
            </tr>
          </thead>
          <tbody>
            {allNodes.map((node) => (
              <tr key={node.nodeId} className="border-b border-border/50 hover:bg-muted/30">
                <td className="p-2 pl-4 font-mono text-muted-foreground">{node.rank}</td>
                <td className="p-2 font-medium">{node.nodeName}</td>
                <td className="p-2 text-center"><SaturationBadge saturation={node.saturation} /></td>
                <td className="p-2 text-right font-mono">{Math.round(node.latencyContribution)}%</td>
                <td className={cn('p-2 text-right font-mono', node.queueGrowthRate > 0 ? 'text-orange-500' : '')}>
                  {node.queueGrowthRate > 0 ? '+' : ''}{node.queueGrowthRate.toFixed(1)}
                </td>
                <td className="p-2 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', node.impactScore >= 70 ? 'bg-red-500' : node.impactScore >= 40 ? 'bg-yellow-500' : 'bg-green-500')}
                        style={{ width: `${node.impactScore}%` }} />
                    </div>
                    <span className="font-mono text-xs">{Math.round(node.impactScore)}</span>
                  </div>
                </td>
                <td className="p-2 text-center">{node.isSpof ? <span className="text-red-500">●</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
