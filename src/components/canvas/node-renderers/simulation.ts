import { type ComponentContentRenderer, type NodeFooterMetrics, drawGaugeBar } from './types';

export const httpClientRenderer: ComponentContentRenderer = {
  icon: '▶',
  getContentLines(d) {
    const method = d.method ?? 'GET';
    const path = d.path ?? '/api';
    const mode = d.requestMode === 'loop' ? `▸ ${d.interval ?? 1000}ms` : 'single';
    return [`${method} ${path}`, mode];
  },
};

export const httpServerRenderer: ComponentContentRenderer = {
  icon: '◆',
  getContentLines(d) {
    const port = d.port ?? 8080;
    const status = d.responseStatus ?? 200;
    const delay = d.responseDelay ?? 100;
    const errRate = d.errorRate as number | undefined;
    const line1 = `:${port}  ${status}  ${delay}ms`;
    return errRate && errRate > 0 ? [line1, `err: ${errRate}%`] : [line1];
  },
  drawFooterGauges(g, metrics, x, y, w) {
    drawGaugeBar(g, x, y, w * 0.48, 3, metrics.cpu ?? 0);
    drawGaugeBar(g, x + w * 0.52, y, w * 0.48, 3, metrics.memory ?? 0);
    return 8;
  },
};

export const clientGroupRenderer: ComponentContentRenderer = {
  icon: '◈',
  getContentLines(d) {
    const count = d.clientCount ?? 10;
    const concurrent = d.concurrentRequests ?? 1;
    const dist = d.distribution ?? 'uniform';
    return [`${count} clients  ×${concurrent}`, dist];
  },
};
