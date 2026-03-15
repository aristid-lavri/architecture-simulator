import type { SimulationReport } from '@/store/simulation-store';

export type HealthVerdict = 'healthy' | 'degraded' | 'critical';

export interface HealthScore {
  score: number; // 0-100
  verdict: HealthVerdict;
  penalties: { reason: string; points: number }[];
}

/**
 * Calcule un score de sante global (0-100) pour une simulation.
 * Score = 100 - somme des penalites.
 */
export function calculateHealthScore(report: SimulationReport): HealthScore {
  const penalties: { reason: string; points: number }[] = [];

  const { metrics, extendedMetrics, bottleneckAnalysis, resourceUtilizations } = report;

  // Error rate penalty
  const totalResponses = metrics.successCount + metrics.errorCount;
  const errorRate = totalResponses > 0 ? (metrics.errorCount / totalResponses) * 100 : 0;
  if (errorRate > 5) {
    penalties.push({ reason: `Taux d'erreur élevé (${errorRate.toFixed(1)}%)`, points: 30 });
  } else if (errorRate > 1) {
    penalties.push({ reason: `Taux d'erreur modéré (${errorRate.toFixed(1)}%)`, points: 15 });
  }

  // P95 latency penalty
  const p95 = extendedMetrics?.p95Latency ?? 0;
  if (p95 > 1000) {
    penalties.push({ reason: `P95 latence critique (${Math.round(p95)}ms)`, points: 25 });
  } else if (p95 > 500) {
    penalties.push({ reason: `P95 latence élevée (${Math.round(p95)}ms)`, points: 15 });
  } else if (p95 > 200) {
    penalties.push({ reason: `P95 latence modérée (${Math.round(p95)}ms)`, points: 5 });
  }

  // Saturation penalty
  const utilizations = Object.values(resourceUtilizations);
  const maxSaturation = utilizations.reduce((max, u) => {
    const sat = Math.max(u.cpu ?? 0, u.memory ?? 0, u.network ?? 0);
    return Math.max(max, sat);
  }, 0);
  if (maxSaturation > 90) {
    penalties.push({ reason: `Saturation critique (${Math.round(maxSaturation)}%)`, points: 20 });
  } else if (maxSaturation > 70) {
    penalties.push({ reason: `Saturation modérée (${Math.round(maxSaturation)}%)`, points: 10 });
  }

  // SPOF penalty
  const spofCount = bottleneckAnalysis?.spofNodes?.length ?? 0;
  if (spofCount > 0) {
    penalties.push({ reason: `${spofCount} point(s) unique(s) de défaillance`, points: 15 });
  }

  // Queue growth penalty
  const hasQueueGrowth = bottleneckAnalysis?.allNodes?.some(n => n.queueGrowthRate > 0) ?? false;
  if (hasQueueGrowth) {
    penalties.push({ reason: 'Files d\'attente en croissance', points: 10 });
  }

  const totalPenalty = penalties.reduce((sum, p) => sum + p.points, 0);
  const score = Math.max(0, 100 - totalPenalty);

  let verdict: HealthVerdict;
  if (score >= 80) verdict = 'healthy';
  else if (score >= 50) verdict = 'degraded';
  else verdict = 'critical';

  return { score, verdict, penalties };
}
