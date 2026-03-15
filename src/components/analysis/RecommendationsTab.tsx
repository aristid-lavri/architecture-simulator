'use client';

import { useMemo } from 'react';
import type { SimulationReport } from '@/store/simulation-store';
import { generateRecommendations, type RecommendationSeverity, type RecommendationCategory } from '@/lib/simulation-recommendations';
import { useArchitectureStore } from '@/store/architecture-store';
import { cn } from '@/lib/utils';

const severityConfig: Record<RecommendationSeverity, { icon: string; label: string; color: string; bg: string }> = {
  critical: { icon: '✗', label: 'Critique', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  warning: { icon: '⚠', label: 'Attention', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  info: { icon: 'ℹ', label: 'Info', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
};

const categoryLabels: Record<RecommendationCategory, string> = {
  performance: 'Performance',
  capacity: 'Capacité',
  reliability: 'Fiabilité',
  architecture: 'Architecture',
};

export function RecommendationsTab({ report }: { report: SimulationReport }) {
  const recommendations = useMemo(() => generateRecommendations(report), [report]);
  const nodes = useArchitectureStore((s) => s.nodes);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, (node.data as { label?: string }).label || node.id.split('-')[0]);
    }
    return map;
  }, [nodes]);

  // Group by severity
  const grouped = useMemo(() => {
    const result: Record<RecommendationSeverity, typeof recommendations> = { critical: [], warning: [], info: [] };
    for (const rec of recommendations) {
      result[rec.severity].push(rec);
    }
    return result;
  }, [recommendations]);

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">✓</div>
        <div className="text-lg font-medium text-green-500">Aucun problème détecté</div>
        <div className="text-sm text-muted-foreground">L&apos;architecture semble saine selon les données de simulation.</div>
      </div>
    );
  }

  const summaryText = `${grouped.critical.length} critique(s), ${grouped.warning.length} attention(s), ${grouped.info.length} info(s)`;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Summary */}
      <div className="flex items-center gap-4 p-4 bg-card rounded-lg border">
        <div className="text-3xl font-bold">{recommendations.length}</div>
        <div>
          <div className="text-sm font-medium">Recommandations</div>
          <div className="text-xs text-muted-foreground">{summaryText}</div>
        </div>
      </div>

      {/* By severity */}
      {(['critical', 'warning', 'info'] as RecommendationSeverity[]).map((severity) => {
        const recs = grouped[severity];
        if (recs.length === 0) return null;
        const config = severityConfig[severity];

        return (
          <div key={severity}>
            <h3 className={cn('text-sm font-medium mb-3 flex items-center gap-2', config.color)}>
              <span>{config.icon}</span> {config.label} ({recs.length})
            </h3>
            <div className="space-y-2">
              {recs.map((rec, i) => (
                <div key={i} className={cn('p-4 rounded-lg border', config.bg)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('text-sm font-medium', config.color)}>{rec.message}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                          {categoryLabels[rec.category]}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">{rec.suggestion}</div>
                      {rec.affectedNodes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rec.affectedNodes.map((nodeId) => (
                            <span key={nodeId} className="text-[10px] px-1.5 py-0.5 bg-muted/50 rounded font-mono">
                              {labelMap.get(nodeId) ?? nodeId.slice(0, 8)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
