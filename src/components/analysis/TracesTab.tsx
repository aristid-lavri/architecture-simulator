'use client';

import { useMemo } from 'react';
import type { SimulationReport } from '@/store/simulation-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { cn } from '@/lib/utils';

export function TracesTab({ report }: { report: SimulationReport }) {
  const { traces, events, cacheStats, databaseStats, messageQueueStats, apiGatewayStats } = report;
  const nodes = useArchitectureStore((s) => s.nodes);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, (node.data as { label?: string }).label || node.id.split('-')[0]);
    }
    return map;
  }, [nodes]);

  // Sort traces by duration (slowest first)
  const sortedTraces = useMemo(() => {
    if (!traces || traces.length === 0) return [];
    return [...traces]
      .filter(t => t.status === 'completed' || t.status === 'error')
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 50);
  }, [traces]);

  // Event chain count
  const chainCount = useMemo(() => {
    const chains = new Set<string>();
    for (const e of events) {
      if (e.chainId) chains.add(e.chainId);
    }
    return chains.size;
  }, [events]);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{chainCount}</div>
          <div className="text-xs text-muted-foreground">Chaînes de requêtes</div>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{events.length}</div>
          <div className="text-xs text-muted-foreground">Événements capturés</div>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{sortedTraces.length}</div>
          <div className="text-xs text-muted-foreground">Traces complètes</div>
        </div>
      </div>

      {/* Slowest Traces */}
      {sortedTraces.length > 0 && (
        <div className="bg-card rounded-lg border">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-medium">Traces les plus lentes</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {sortedTraces.slice(0, 20).map((trace) => {
              const maxDuration = sortedTraces[0]?.totalDuration || 1;
              return (
                <div key={trace.chainId} className="flex items-center gap-3 px-4 py-2 border-b border-border/50 hover:bg-muted/30">
                  <span className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    trace.status === 'error' ? 'bg-red-500' : 'bg-green-500'
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {trace.chainId.slice(-8)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {trace.spans.length} spans · {trace.spans[0]?.nodeName ?? '?'}
                      </span>
                    </div>
                    {/* Duration bar */}
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', trace.status === 'error' ? 'bg-red-500' : 'bg-blue-500')}
                        style={{ width: `${Math.max((trace.totalDuration / maxDuration) * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                  <span className={cn(
                    'text-xs font-mono shrink-0',
                    trace.totalDuration > 1000 ? 'text-red-500' : trace.totalDuration > 200 ? 'text-yellow-500' : ''
                  )}>
                    {Math.round(trace.totalDuration)}ms
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Handler Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Database Stats */}
        {databaseStats && Object.keys(databaseStats).length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">Base de données</h3>
            {Object.entries(databaseStats).map(([nodeId, stats]) => (
              <div key={nodeId} className="mb-3 last:mb-0">
                <div className="text-xs font-medium mb-1">{labelMap.get(nodeId) ?? nodeId}</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Queries/s</span><span className="font-mono">{stats.queriesPerSecond.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pool</span><span className="font-mono">{Math.round(stats.connectionPoolUsage)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Connexions</span><span className="font-mono">{stats.activeConnections}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Moy query</span><span className="font-mono">{Math.round(stats.avgQueryTime)}ms</span></div>
                  {stats.queriesByType && (
                    <div className="col-span-2 flex gap-3 text-muted-foreground">
                      <span>R:{stats.queriesByType.read}</span>
                      <span>W:{stats.queriesByType.write}</span>
                      <span>T:{stats.queriesByType.transaction}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cache Stats */}
        {cacheStats && Object.keys(cacheStats).length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">Cache</h3>
            {Object.entries(cacheStats).map(([nodeId, stats]) => (
              <div key={nodeId} className="mb-3 last:mb-0">
                <div className="text-xs font-medium mb-1">{labelMap.get(nodeId) ?? nodeId}</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Hit ratio</span>
                    <span className={cn('font-mono', stats.hitRatio < 60 ? 'text-yellow-500' : 'text-green-500')}>{Math.round(stats.hitRatio)}%</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Clés</span><span className="font-mono">{stats.keyCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Hits</span><span className="font-mono text-green-500">{stats.hitCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Misses</span><span className="font-mono text-orange-500">{stats.missCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mémoire</span><span className="font-mono">{Math.round(stats.memoryUsage)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Évictions</span><span className="font-mono">{stats.evictionCount}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Message Queue Stats */}
        {messageQueueStats && Object.keys(messageQueueStats).length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">Files de messages</h3>
            {Object.entries(messageQueueStats).map(([nodeId, stats]) => (
              <div key={nodeId} className="mb-3 last:mb-0">
                <div className="text-xs font-medium mb-1">{labelMap.get(nodeId) ?? nodeId}</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Profondeur</span>
                    <span className={cn('font-mono', stats.queueDepth > 100 ? 'text-orange-500' : '')}>{stats.queueDepth}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Publiés</span><span className="font-mono">{stats.messagesPublished}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Consommés</span><span className="font-mono">{stats.messagesConsumed}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">En vol</span><span className="font-mono">{stats.messagesInFlight}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">DLQ</span>
                    <span className={cn('font-mono', stats.messagesDeadLettered > 0 ? 'text-red-500' : '')}>{stats.messagesDeadLettered}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Retries</span><span className="font-mono">{stats.messagesRetried}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* API Gateway Stats */}
        {apiGatewayStats && Object.keys(apiGatewayStats).length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">API Gateway</h3>
            {Object.entries(apiGatewayStats).map(([nodeId, stats]) => {
              const successPct = stats.totalRequests > 0
                ? Math.round(((stats.totalRequests - stats.blockedRequests) / stats.totalRequests) * 100) : 100;
              return (
                <div key={nodeId} className="mb-3 last:mb-0">
                  <div className="text-xs font-medium mb-1">{labelMap.get(nodeId) ?? nodeId}</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono">{stats.totalRequests}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Succès</span>
                      <span className={cn('font-mono', successPct < 90 ? 'text-yellow-500' : 'text-green-500')}>{successPct}%</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Bloqués</span>
                      <span className={cn('font-mono', stats.blockedRequests > 0 ? 'text-red-500' : '')}>{stats.blockedRequests}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Auth fail</span><span className="font-mono">{stats.authFailures}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Rate limit</span><span className="font-mono">{stats.rateLimitHits}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
