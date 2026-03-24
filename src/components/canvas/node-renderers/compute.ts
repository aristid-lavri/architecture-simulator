import { type ComponentContentRenderer, type NodeFooterMetrics, drawGaugeBar } from './types';

export const hostServerRenderer: ComponentContentRenderer = {
  icon: '▣',
  getContentLines(d) {
    const ip = d.ipAddress as string | undefined;
    return ip ? [ip] : [];
  },
};

export const containerRenderer: ComponentContentRenderer = {
  icon: '□',
  getContentLines(d) {
    const image = d.image ?? 'container';
    const replicas = d.replicas as number | undefined;
    const cpuLimit = d.cpuLimit as number | undefined;
    const memLimit = d.memoryLimitMb as number | undefined;
    const line1 = replicas && replicas > 1 ? `${image}  ×${replicas}` : `${image}`;
    const limits: string[] = [];
    if (cpuLimit) limits.push(`cpu: ${cpuLimit}`);
    if (memLimit) limits.push(`mem: ${memLimit}Mi`);
    return limits.length > 0 ? [line1, limits.join('  ')] : [line1];
  },
};

export const apiServiceRenderer: ComponentContentRenderer = {
  icon: '◆',
  getContentLines(d) {
    const protocol = d.protocol ?? 'rest';
    const basePath = d.basePath ?? '/api';
    const responseTime = d.responseTimeMs as number | undefined;
    const line1 = `${protocol}  ${basePath}`;
    return responseTime ? [line1, `p99: ${responseTime}ms`] : [line1];
  },
  drawFooterGauges(g, metrics, x, y, w) {
    drawGaugeBar(g, x, y, w * 0.48, 3, metrics.cpu ?? 0);
    drawGaugeBar(g, x + w * 0.52, y, w * 0.48, 3, metrics.memory ?? 0);
    return 8;
  },
};

export const backgroundJobRenderer: ComponentContentRenderer = {
  icon: '⟳',
  getContentLines(d) {
    const jobType = d.jobType ?? 'cron';
    const schedule = d.schedule as string | undefined;
    const concurrency = d.concurrency as number | undefined;
    const batchSize = d.batchSize as number | undefined;

    if (jobType === 'cron' && schedule) {
      return [`⟳ ${schedule}`, concurrency ? `concurrency: ${concurrency}` : ''];
    }
    if (jobType === 'batch' && batchSize) {
      return [`batch: ${batchSize}`, concurrency ? `concurrency: ${concurrency}` : ''];
    }
    return [String(jobType), concurrency ? `concurrency: ${concurrency}` : ''].filter(Boolean) as string[];
  },
  drawFooterGauges(g, metrics, x, y, w) {
    drawGaugeBar(g, x, y, w, 3, metrics.cpu ?? 0);
    return 8;
  },
};

export const serverlessRenderer: ComponentContentRenderer = {
  icon: 'λ',
  getContentLines(d) {
    const provider = d.provider ?? 'aws-lambda';
    const memory = d.memoryMb ?? 128;
    const coldStart = d.coldStartMs as number | undefined;
    const concurrency = d.concurrencyLimit as number | undefined;
    const line1 = `${provider}  ${memory}MB`;
    const parts: string[] = [];
    if (coldStart) parts.push(`cold: ${coldStart}ms`);
    if (concurrency) parts.push(`max: ${concurrency}`);
    return parts.length > 0 ? [line1, parts.join('  ')] : [line1];
  },
  drawFooterGauges(g, metrics, x, y, w) {
    const pct = metrics.maxInstances
      ? Math.min(100, ((metrics.activeInstances ?? 0) / metrics.maxInstances) * 100)
      : 0;
    drawGaugeBar(g, x, y, w, 2, pct);
    return 6;
  },
};
