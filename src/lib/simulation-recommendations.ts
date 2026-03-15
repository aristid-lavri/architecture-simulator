import type { SimulationReport } from '@/store/simulation-store';

export type RecommendationSeverity = 'critical' | 'warning' | 'info';
export type RecommendationCategory = 'performance' | 'capacity' | 'reliability' | 'architecture';

export interface Recommendation {
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  message: string;
  suggestion: string;
  affectedNodes: string[]; // nodeIds
}

/**
 * Genere des recommandations automatiques basees sur les donnees du rapport de simulation.
 */
export function generateRecommendations(report: SimulationReport): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { metrics, extendedMetrics, bottleneckAnalysis, resourceUtilizations, cacheStats, messageQueueStats, apiGatewayStats } = report;

  // 1. CPU saturation
  for (const [nodeId, util] of Object.entries(resourceUtilizations)) {
    if (util.cpu > 80) {
      recommendations.push({
        severity: util.cpu > 90 ? 'critical' : 'warning',
        category: 'capacity',
        message: `CPU saturé à ${Math.round(util.cpu)}%`,
        suggestion: 'Augmenter les cores CPU ou ajouter un load-balancer pour distribuer la charge',
        affectedNodes: [nodeId],
      });
    }
    if (util.memory > 85) {
      recommendations.push({
        severity: util.memory > 95 ? 'critical' : 'warning',
        category: 'capacity',
        message: `Mémoire saturée à ${Math.round(util.memory)}%`,
        suggestion: 'Augmenter la mémoire ou optimiser la consommation par requête',
        affectedNodes: [nodeId],
      });
    }
    if (util.queuedRequests > 0 && util.activeConnections > 0) {
      recommendations.push({
        severity: 'warning',
        category: 'capacity',
        message: `${util.queuedRequests} requêtes en file d'attente`,
        suggestion: 'Augmenter maxConcurrent ou ajouter des replicas via un load-balancer',
        affectedNodes: [nodeId],
      });
    }
  }

  // 2. SPOF detection
  if (bottleneckAnalysis?.spofNodes) {
    for (const nodeId of bottleneckAnalysis.spofNodes) {
      const info = bottleneckAnalysis.allNodes.find(n => n.nodeId === nodeId);
      recommendations.push({
        severity: 'critical',
        category: 'reliability',
        message: `${info?.nodeName ?? nodeId} est un point unique de défaillance`,
        suggestion: 'Ajouter de la redondance avec un load-balancer et au moins 2 instances',
        affectedNodes: [nodeId],
      });
    }
  }

  // 3. Cache hit ratio
  if (cacheStats) {
    for (const [nodeId, stats] of Object.entries(cacheStats)) {
      if (stats.hitRatio < 60 && (stats.hitCount + stats.missCount) > 10) {
        recommendations.push({
          severity: 'warning',
          category: 'performance',
          message: `Cache peu efficace (hit ratio ${Math.round(stats.hitRatio)}%)`,
          suggestion: 'Vérifier les clés de cache, augmenter le TTL ou la taille mémoire',
          affectedNodes: [nodeId],
        });
      }
    }
  }

  // 4. Message queue depth growing
  if (messageQueueStats) {
    for (const [nodeId, stats] of Object.entries(messageQueueStats)) {
      if (stats.queueDepth > 100) {
        recommendations.push({
          severity: stats.queueDepth > 1000 ? 'critical' : 'warning',
          category: 'capacity',
          message: `File de messages saturée (${stats.queueDepth} messages en attente)`,
          suggestion: 'Augmenter le nombre de consumers ou le throughput',
          affectedNodes: [nodeId],
        });
      }
      if (stats.messagesDeadLettered > 0) {
        recommendations.push({
          severity: 'warning',
          category: 'reliability',
          message: `${stats.messagesDeadLettered} message(s) en dead-letter`,
          suggestion: 'Vérifier les consumers et les erreurs de traitement',
          affectedNodes: [nodeId],
        });
      }
    }
  }

  // 5. Latency variance
  if (extendedMetrics) {
    const p50 = extendedMetrics.p50Latency;
    const p95 = extendedMetrics.p95Latency;
    if (p50 > 0 && p95 > p50 * 5) {
      recommendations.push({
        severity: 'warning',
        category: 'performance',
        message: `Forte variance de latence (P50=${Math.round(p50)}ms, P95=${Math.round(p95)}ms)`,
        suggestion: 'Vérifier les cold starts serverless, la contention DB ou les cache misses',
        affectedNodes: [],
      });
    }
  }

  // 6. Error rate
  const totalResponses = metrics.successCount + metrics.errorCount;
  const errorRate = totalResponses > 0 ? (metrics.errorCount / totalResponses) * 100 : 0;
  if (errorRate > 5) {
    recommendations.push({
      severity: 'critical',
      category: 'reliability',
      message: `Taux d'erreur élevé (${errorRate.toFixed(1)}%)`,
      suggestion: 'Vérifier les configurations d\'error rate et la capacité des composants',
      affectedNodes: [],
    });
  }

  // 7. API Gateway rate limiting
  if (apiGatewayStats) {
    for (const [nodeId, stats] of Object.entries(apiGatewayStats)) {
      if (stats.totalRequests > 0 && stats.rateLimitHits / stats.totalRequests > 0.1) {
        recommendations.push({
          severity: 'warning',
          category: 'capacity',
          message: `API Gateway rejette ${Math.round(stats.rateLimitHits / stats.totalRequests * 100)}% des requêtes (rate limit)`,
          suggestion: 'Augmenter le rate limit ou la capacité backend',
          affectedNodes: [nodeId],
        });
      }
    }
  }

  // 8. Rejection rate
  if (extendedMetrics && extendedMetrics.rejectionRate > 10) {
    recommendations.push({
      severity: 'critical',
      category: 'capacity',
      message: `Taux de rejet élevé (${extendedMetrics.rejectionRate.toFixed(1)}%)`,
      suggestion: 'Augmenter la capacité des composants saturés ou ajouter du load-balancing',
      affectedNodes: [],
    });
  }

  // Sort by severity
  const severityOrder: Record<RecommendationSeverity, number> = { critical: 0, warning: 1, info: 2 };
  recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return recommendations;
}
