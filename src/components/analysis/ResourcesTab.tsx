'use client';

import { useState, useMemo } from 'react';
import type { SimulationReport } from '@/store/simulation-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { MetricSparkline } from '@/components/simulation/MetricSparkline';
import { cn } from '@/lib/utils';

function SaturationBadge({ saturation }: { saturation: number }) {
  if (saturation >= 90) return <span className="text-[10px] px-1.5 py-0.5 bg-red-500/15 text-red-500 font-mono rounded">SATURE</span>;
  if (saturation >= 70) return <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/15 text-yellow-500 font-mono rounded">DEGRADE</span>;
  return <span className="text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-500 font-mono rounded">OK</span>;
}

export function ResourcesTab({ report }: { report: SimulationReport }) {
  const { resourceUtilizations, resourceHistory, hierarchicalUtilizations } = report;
  const nodes = useArchitectureStore((s) => s.nodes);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'cpu' | 'memory' | 'network' | 'saturation'>('saturation');

  const labelMap = useMemo(() => {
    const map = new Map<string, { label: string; type: string }>();
    for (const node of nodes) {
      map.set(node.id, {
        label: (node.data as { label?: string }).label || node.id.split('-')[0],
        type: node.type || 'unknown',
      });
    }
    return map;
  }, [nodes]);

  // Build sorted list of servers with utilization
  const serverList = useMemo(() => {
    const list = Object.entries(resourceUtilizations).map(([nodeId, util]) => {
      const info = labelMap.get(nodeId);
      const saturation = Math.max(util.cpu ?? 0, util.memory ?? 0, util.network ?? 0);
      return { nodeId, ...util, saturation, label: info?.label ?? nodeId, type: info?.type ?? 'unknown' };
    });
    list.sort((a, b) => {
      switch (sortBy) {
        case 'cpu': return b.cpu - a.cpu;
        case 'memory': return b.memory - a.memory;
        case 'network': return b.network - a.network;
        default: return b.saturation - a.saturation;
      }
    });
    return list;
  }, [resourceUtilizations, labelMap, sortBy]);

  // Sparklines for selected node
  const selectedSparklines = useMemo(() => {
    if (!selectedNode || !resourceHistory) return null;
    const samples = resourceHistory.filter(s => s.nodeId === selectedNode);
    if (samples.length === 0) return null;
    return {
      cpu: samples.map(s => s.cpu),
      memory: samples.map(s => s.memory),
      network: samples.map(s => s.network),
      queue: samples.map(s => s.queuedRequests),
    };
  }, [selectedNode, resourceHistory]);

  // Saturation summary
  const saturationSummary = useMemo(() => {
    let ok = 0, degraded = 0, saturated = 0;
    for (const srv of serverList) {
      if (srv.saturation >= 90) saturated++;
      else if (srv.saturation >= 70) degraded++;
      else ok++;
    }
    return { ok, degraded, saturated };
  }, [serverList]);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Saturation Summary */}
      <div className="flex gap-4">
        <div className="flex-1 bg-green-500/10 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-500">{saturationSummary.ok}</div>
          <div className="text-xs text-muted-foreground">OK</div>
        </div>
        <div className="flex-1 bg-yellow-500/10 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-500">{saturationSummary.degraded}</div>
          <div className="text-xs text-muted-foreground">Dégradés</div>
        </div>
        <div className="flex-1 bg-red-500/10 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-500">{saturationSummary.saturated}</div>
          <div className="text-xs text-muted-foreground">Saturés</div>
        </div>
      </div>

      {/* Server Table */}
      <div className="bg-card rounded-lg border">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-medium">Utilisation des ressources</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left p-2 pl-4">Composant</th>
              <th className="text-left p-2">Type</th>
              <th className="text-right p-2 cursor-pointer hover:text-foreground" onClick={() => setSortBy('cpu')}>
                CPU% {sortBy === 'cpu' && '▼'}
              </th>
              <th className="text-right p-2 cursor-pointer hover:text-foreground" onClick={() => setSortBy('memory')}>
                MEM% {sortBy === 'memory' && '▼'}
              </th>
              <th className="text-right p-2 cursor-pointer hover:text-foreground" onClick={() => setSortBy('network')}>
                NET% {sortBy === 'network' && '▼'}
              </th>
              <th className="text-right p-2">Conn.</th>
              <th className="text-right p-2">Queue</th>
              <th className="text-center p-2 cursor-pointer hover:text-foreground" onClick={() => setSortBy('saturation')}>
                État {sortBy === 'saturation' && '▼'}
              </th>
            </tr>
          </thead>
          <tbody>
            {serverList.map((srv) => (
              <tr
                key={srv.nodeId}
                className={cn(
                  'border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors',
                  selectedNode === srv.nodeId && 'bg-muted/50'
                )}
                onClick={() => setSelectedNode(selectedNode === srv.nodeId ? null : srv.nodeId)}
              >
                <td className="p-2 pl-4 font-medium">{srv.label}</td>
                <td className="p-2 text-muted-foreground text-xs">{srv.type}</td>
                <td className={cn('p-2 text-right font-mono', srv.cpu > 80 ? 'text-red-500' : srv.cpu > 60 ? 'text-yellow-500' : '')}>
                  {Math.round(srv.cpu)}%
                </td>
                <td className={cn('p-2 text-right font-mono', srv.memory > 80 ? 'text-red-500' : srv.memory > 60 ? 'text-yellow-500' : '')}>
                  {Math.round(srv.memory)}%
                </td>
                <td className={cn('p-2 text-right font-mono', srv.network > 80 ? 'text-red-500' : '')}>
                  {Math.round(srv.network)}%
                </td>
                <td className="p-2 text-right font-mono">{srv.activeConnections}</td>
                <td className={cn('p-2 text-right font-mono', srv.queuedRequests > 0 ? 'text-orange-500' : '')}>
                  {srv.queuedRequests}
                </td>
                <td className="p-2 text-center"><SaturationBadge saturation={srv.saturation} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Node Detail */}
      {selectedNode && selectedSparklines && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">
            Détail: {labelMap.get(selectedNode)?.label ?? selectedNode}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">CPU</div>
              <MetricSparkline data={selectedSparklines.cpu} width={200} height={40} color="text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Mémoire</div>
              <MetricSparkline data={selectedSparklines.memory} width={200} height={40} color="text-green-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Réseau</div>
              <MetricSparkline data={selectedSparklines.network} width={200} height={40} color="text-purple-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">File d&apos;attente</div>
              <MetricSparkline data={selectedSparklines.queue} width={200} height={40} color="text-orange-400" />
            </div>
          </div>
        </div>
      )}

      {/* Hierarchical View */}
      {hierarchicalUtilizations && Object.keys(hierarchicalUtilizations).length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Vue hiérarchique</h3>
          <div className="space-y-3">
            {Object.entries(hierarchicalUtilizations).map(([parentId, data]) => {
              const parentInfo = labelMap.get(parentId);
              const aggSat = Math.max(data.aggregated.cpu, data.aggregated.memory, data.aggregated.network);
              return (
                <div key={parentId} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{parentInfo?.label ?? parentId}</span>
                    <SaturationBadge saturation={aggSat} />
                  </div>
                  <div className="flex gap-4 text-xs font-mono mb-2">
                    <span>CPU: {Math.round(data.aggregated.cpu)}%</span>
                    <span>MEM: {Math.round(data.aggregated.memory)}%</span>
                    <span>NET: {Math.round(data.aggregated.network)}%</span>
                  </div>
                  {data.children.length > 0 && (
                    <div className="pl-4 border-l-2 border-muted space-y-1">
                      {data.children.map((child) => {
                        const childInfo = labelMap.get(child.childId);
                        return (
                          <div key={child.childId} className="flex items-center gap-4 text-xs">
                            <span className="w-32 truncate">{childInfo?.label ?? child.childId}</span>
                            <div className="flex-1 flex gap-3 font-mono text-muted-foreground">
                              <span>CPU: {Math.round(child.utilization.cpu)}%</span>
                              <span>MEM: {Math.round(child.utilization.memory)}%</span>
                            </div>
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
      )}
    </div>
  );
}
