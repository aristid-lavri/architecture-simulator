'use client';

import { useMemo } from 'react';
import { Shield, TrendingUp, Clock } from 'lucide-react';
import { useSimulationStore } from '@/store/simulation-store';
import { useAppStore } from '@/store/app-store';
import { useTranslation } from '@/i18n';
import type { BottleneckInfo, HeatmapLevel } from '@/types';

const heatmapColors: Record<HeatmapLevel, string> = {
  green: 'text-signal-healthy',
  yellow: 'text-signal-warning',
  orange: 'text-orange-400',
  red: 'text-signal-critical',
};

const heatmapBgColors: Record<HeatmapLevel, string> = {
  green: 'bg-signal-healthy/10',
  yellow: 'bg-signal-warning/10',
  orange: 'bg-orange-400/10',
  red: 'bg-signal-critical/10',
};

const rankLabels = ['🥇', '🥈', '🥉'];

function ImpactBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-signal-critical' :
    score >= 40 ? 'bg-signal-warning' :
    'bg-signal-healthy';

  return (
    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(score, 100)}%` }}
      />
    </div>
  );
}

function SaturationBadge({ level, value }: { level: HeatmapLevel; value: number }) {
  return (
    <span className={`text-[8px] px-1 py-0 ${heatmapBgColors[level]} ${heatmapColors[level]} font-mono`} style={{ borderRadius: '2px' }}>
      {Math.round(value)}%
    </span>
  );
}

export function BottleneckPanel({ panelHeight }: { panelHeight: number }) {
  const { t } = useTranslation();
  const bottleneckAnalysis = useSimulationStore((s) => s.bottleneckAnalysis);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);

  const { topBottlenecks, allNodes, spofNodes } = useMemo(() => {
    if (!bottleneckAnalysis) return { topBottlenecks: [], allNodes: [], spofNodes: [] };
    return {
      topBottlenecks: bottleneckAnalysis.topBottlenecks,
      allNodes: bottleneckAnalysis.allNodes,
      spofNodes: bottleneckAnalysis.spofNodes,
    };
  }, [bottleneckAnalysis]);

  if (!bottleneckAnalysis || allNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-[11px] font-mono">
        <Clock className="w-3 h-3 mr-1.5 opacity-50" />
        {t('bottleneck.noData')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 overflow-y-auto font-mono" style={{ maxHeight: panelHeight - 40 }}>
      {/* Top 3 Bottlenecks */}
      <div className="flex gap-1.5">
        {topBottlenecks.map((info, i) => (
          <TopBottleneckCard
            key={info.nodeId}
            info={info}
            rankIndex={i}
            onClick={() => setSelectedNodeId(info.nodeId)}
          />
        ))}
      </div>

      {/* SPOF Warning */}
      {spofNodes.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-signal-critical/5 border border-signal-critical/20 text-[10px]" style={{ borderRadius: '3px' }}>
          <Shield className="w-3 h-3 text-signal-critical flex-shrink-0" />
          <span className="text-signal-critical font-semibold">{t('bottleneck.spofNodes')}</span>
          <span className="text-muted-foreground">
            {spofNodes.length} {spofNodes.length > 1 ? 'composants' : 'composant'}
          </span>
        </div>
      )}

      {/* Full Ranking Table */}
      <div className="border border-border" style={{ borderRadius: '3px' }}>
        <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 border-b border-border text-[9px] text-muted-foreground uppercase tracking-wider">
          <span className="w-6">#</span>
          <span className="flex-1">{t('bottleneck.tab')}</span>
          <span className="w-12 text-right">{t('bottleneck.saturation')}</span>
          <span className="w-12 text-right">{t('bottleneck.latencyContrib')}</span>
          <span className="w-14 text-right">{t('bottleneck.queueGrowth')}</span>
          <span className="w-16 text-right">{t('bottleneck.impact')}</span>
          <span className="w-6 text-center">SPOF</span>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {allNodes.map((info) => (
            <BottleneckRow
              key={info.nodeId}
              info={info}
              onClick={() => setSelectedNodeId(info.nodeId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TopBottleneckCard({
  info,
  rankIndex,
  onClick,
}: {
  info: BottleneckInfo;
  rankIndex: number;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className={`flex-1 border border-border p-2 text-left hover:bg-muted/30 transition-colors cursor-pointer ${
        rankIndex === 0 ? 'border-signal-critical/30' : ''
      }`}
      style={{ borderRadius: '3px' }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px]">{rankLabels[rankIndex]}</span>
        <span className="text-[10px] font-semibold text-foreground truncate">{info.nodeName}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <SaturationBadge level={info.heatmapLevel} value={info.saturation} />
        <ImpactBar score={info.impactScore} />
        <span className="text-[9px] text-muted-foreground">{info.impactScore}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {info.reasons.slice(0, 2).map((reason, i) => (
          <span key={i} className="text-[8px] px-1 py-0 bg-muted text-muted-foreground" style={{ borderRadius: '2px' }}>
            {reason}
          </span>
        ))}
      </div>
      {info.predictedSaturationTime !== null && (
        <div className="flex items-center gap-1 mt-1 text-[8px] text-signal-warning">
          <TrendingUp className="w-2.5 h-2.5" />
          {t('bottleneck.predictedSat').replace('{time}', String(info.predictedSaturationTime))}
        </div>
      )}
      {info.isSpof && (
        <div className="flex items-center gap-1 mt-0.5 text-[8px] text-signal-critical">
          <Shield className="w-2.5 h-2.5" />
          SPOF
        </div>
      )}
    </button>
  );
}

function BottleneckRow({ info, onClick }: { info: BottleneckInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1 w-full text-left hover:bg-muted/30 transition-colors border-b border-border/50 last:border-b-0 cursor-pointer"
      title={`${info.nodeName}: ${info.reasons.join(', ')}`}
    >
      <span className="w-6 text-[9px] text-muted-foreground">{info.rank}</span>
      <span className="flex-1 text-[10px] text-foreground truncate">{info.nodeName}</span>
      <span className="w-12 text-right">
        <SaturationBadge level={info.heatmapLevel} value={info.saturation} />
      </span>
      <span className="w-12 text-right text-[9px] text-muted-foreground">
        {info.latencyContribution > 0 ? `${info.latencyContribution.toFixed(1)}%` : '—'}
      </span>
      <span className="w-14 text-right text-[9px]">
        {info.queueGrowthRate > 0.5 ? (
          <span className="text-signal-warning">+{info.queueGrowthRate.toFixed(1)}/s</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
      <span className="w-16 text-right">
        <ImpactBar score={info.impactScore} />
      </span>
      <span className="w-6 text-center">
        {info.isSpof && <Shield className="w-3 h-3 text-signal-critical inline" />}
      </span>
    </button>
  );
}
