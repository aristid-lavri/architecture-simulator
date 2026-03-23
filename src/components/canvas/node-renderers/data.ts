import type { Graphics } from 'pixi.js';
import { type ComponentContentRenderer, type NodeFooterMetrics, gaugeColor, drawGaugeBar } from './types';

export const databaseRenderer: ComponentContentRenderer = {
  icon: '⊞',
  getContentLines(d) {
    const dbType = d.databaseType ?? d.dbType ?? 'postgresql';
    const pool = d.connectionPool as { maxConnections?: number } | undefined;
    const perf = d.performance as { readLatencyMs?: number } | undefined;
    const lines = [`${dbType}`];
    const metrics: string[] = [];
    if (pool?.maxConnections) metrics.push(`${pool.maxConnections} conn`);
    if (perf?.readLatencyMs) metrics.push(`${perf.readLatencyMs}ms read`);
    if (metrics.length > 0) lines.push(metrics.join('  '));
    return lines;
  },
  drawFooterGauges(g, metrics, x, y, w) {
    drawGaugeBar(g, x, y, w, 2, metrics.poolUsage ?? 0);
    return 6;
  },
};

export const cacheRenderer: ComponentContentRenderer = {
  icon: '⚡',
  getContentLines(d) {
    const cacheType = String(d.cacheType ?? 'redis');
    const maxMemory = d.maxMemoryMb as number | undefined;
    const lines: string[] = [cacheType];
    if (maxMemory) lines.push(`mem: ${maxMemory}MB`);
    return lines;
  },
  drawFooterGauges(g, metrics, x, y, w) {
    // Memory bar + hit ratio bar
    drawGaugeBar(g, x, y, w * 0.48, 2, metrics.memory ?? 0);
    drawGaugeBar(g, x + w * 0.52, y, w * 0.48, 2, metrics.hitRatio ?? 0);
    return 6;
  },
};

export const messageQueueRenderer: ComponentContentRenderer = {
  icon: '≡',
  getContentLines(d) {
    const mqType = d.queueType ?? 'rabbitmq';
    const mode = d.mode ?? 'pub/sub';
    const consumers = d.consumerCount as number | undefined;
    const line1 = `${mqType}  ${mode}`;
    return consumers ? [line1, `consumers: ${consumers}`] : [line1];
  },
  drawFooterGauges(g, metrics, x, y, w) {
    const pct = metrics.maxQueueDepth
      ? Math.min(100, ((metrics.queueDepth ?? 0) / metrics.maxQueueDepth) * 100)
      : 0;
    drawGaugeBar(g, x, y, w, 2, pct);
    return 6;
  },
};
