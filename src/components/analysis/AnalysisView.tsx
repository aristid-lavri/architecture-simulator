'use client';

import { useState } from 'react';
import { ArrowLeft, Download, BarChart3, Activity, Server, AlertTriangle, GitBranch, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimulationStore, type SimulationReport } from '@/store/simulation-store';
import { calculateHealthScore } from '@/lib/health-score';
import { cn } from '@/lib/utils';
import { OverviewTab } from './OverviewTab';
import { PerformanceTab } from './PerformanceTab';
import { ResourcesTab } from './ResourcesTab';
import { BottlenecksTab } from './BottlenecksTab';
import { TracesTab } from './TracesTab';
import { RecommendationsTab } from './RecommendationsTab';

type AnalysisTab = 'overview' | 'performance' | 'resources' | 'bottlenecks' | 'traces' | 'recommendations';

const tabs: { id: AnalysisTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'performance', label: 'Performance', icon: <Activity className="w-4 h-4" /> },
  { id: 'resources', label: 'Ressources', icon: <Server className="w-4 h-4" /> },
  { id: 'bottlenecks', label: 'Goulots', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'traces', label: 'Traces', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'recommendations', label: 'Recommandations', icon: <ScrollText className="w-4 h-4" /> },
];

export function AnalysisView() {
  const storedReport = useSimulationStore((s) => s.report);
  const generateLiveReport = useSimulationStore((s) => s.generateLiveReport);
  const setAnalysisMode = useSimulationStore((s) => s.setAnalysisMode);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');

  // Use stored report (post-stop) or generate live snapshot (pause/running)
  const report = storedReport ?? generateLiveReport();

  if (!report) {
    setAnalysisMode(false);
    return null;
  }

  const health = calculateHealthScore(report);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, (_key, value) => {
      if (value instanceof Map) return Object.fromEntries(value);
      if (value instanceof Set) return [...value];
      return value;
    }, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setAnalysisMode(false)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Retour au canvas</span>
          </Button>
          <span className="text-border">|</span>
          <span className="text-sm font-medium">Analyse des résultats</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Health score badge */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            health.verdict === 'healthy' && 'bg-green-500/15 text-green-500',
            health.verdict === 'degraded' && 'bg-yellow-500/15 text-yellow-500',
            health.verdict === 'critical' && 'bg-red-500/15 text-red-500',
          )}>
            Score: {health.score}/100
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Main content with sidebar nav */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left nav */}
        <nav className="w-48 border-r border-border bg-card/30 py-2 shrink-0 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left',
                activeTab === tab.id
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && <OverviewTab report={report} />}
          {activeTab === 'performance' && <PerformanceTab report={report} />}
          {activeTab === 'resources' && <ResourcesTab report={report} />}
          {activeTab === 'bottlenecks' && <BottlenecksTab report={report} />}
          {activeTab === 'traces' && <TracesTab report={report} />}
          {activeTab === 'recommendations' && <RecommendationsTab report={report} />}
        </main>
      </div>
    </div>
  );
}
