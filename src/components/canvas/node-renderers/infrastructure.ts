import type { Graphics } from 'pixi.js';
import { type ComponentContentRenderer, type NodeFooterMetrics, gaugeColor, drawGaugeBar } from './types';

export const apiGatewayRenderer: ComponentContentRenderer = {
  icon: '◇',
  getContentLines(d) {
    const auth = d.authType ?? 'none';
    const rateLimiting = d.rateLimiting as boolean | undefined;
    return [
      `AUTH ${auth !== 'none' ? '✓' : '✕'}  RATE ${rateLimiting !== false ? '✓' : '✕'}  ROUTE ✓`,
    ];
  },
  drawFooterGauges(g, metrics, x, y, w) {
    drawGaugeBar(g, x, y, w * 0.48, 3, metrics.cpu ?? 0);
    drawGaugeBar(g, x + w * 0.52, y, w * 0.48, 3, metrics.memory ?? 0);
    return 8;
  },
};

export const loadBalancerRenderer: ComponentContentRenderer = {
  icon: '⇔',
  getContentLines(d) {
    const algo = d.algorithm ?? 'round-robin';
    return [algo];
  },
};

export const cdnRenderer: ComponentContentRenderer = {
  icon: '◉',
  getContentLines(d) {
    const provider = String(d.provider ?? 'cloudflare');
    const hitRatio = d.cacheHitRatio as number | undefined;
    const edgeLat = d.edgeLatencyMs as number | undefined;
    const parts: string[] = [provider];
    if (hitRatio != null || edgeLat != null) {
      const m: string[] = [];
      if (hitRatio != null) m.push(`hit: ${hitRatio}%`);
      if (edgeLat != null) m.push(`edge: ${edgeLat}ms`);
      parts.push(m.join('  '));
    }
    return parts;
  },
  drawFooterGauges(g, metrics, x, y, w) {
    drawGaugeBar(g, x, y, w, 2, metrics.hitRatio ?? 0);
    return 6;
  },
};

export const wafRenderer: ComponentContentRenderer = {
  icon: '⊘',
  getContentLines(d) {
    const provider = d.provider ?? 'aws-waf';
    const block = d.blockRate ?? 0;
    const inspect = d.inspectionLatencyMs ?? 5;
    return [provider, `block: ${block}%  inspect: ${inspect}ms`];
  },
  drawGauges(g: Graphics, d: Record<string, unknown>, x: number, y: number, w: number): number {
    const blockRate = (d.blockRate as number) ?? 0;
    const barW = w - 8;
    drawGaugeBar(g, x, y, barW, 2, blockRate);
    return 6;
  },
  drawFooterGauges(g, metrics, x, y, w) {
    drawGaugeBar(g, x, y, w, 2, metrics.blockRate ?? 0);
    return 6;
  },
};

export const firewallRenderer: ComponentContentRenderer = {
  icon: '⊗',
  getContentLines(d) {
    const action = (d.defaultAction ?? 'allow').toString().toUpperCase();
    const ports = Array.isArray(d.allowedPorts) ? (d.allowedPorts as number[]).join(', ') : '80, 443';
    const inspect = d.inspectionLatencyMs ?? 2;
    return [`${action} ▸ ${ports}`, `inspect: ${inspect}ms`];
  },
};

export const serviceDiscoveryRenderer: ComponentContentRenderer = {
  icon: '⊙',
  getContentLines(d) {
    const provider = String(d.provider ?? 'consul');
    const lookup = d.lookupLatencyMs as number | undefined;
    const ttl = d.healthCheckInterval as number | undefined;
    const parts: string[] = [provider];
    if (lookup != null || ttl != null) {
      const metrics: string[] = [];
      if (lookup != null) metrics.push(`lookup: ${lookup}ms`);
      if (ttl != null) metrics.push(`TTL: ${ttl}s`);
      parts.push(metrics.join('  '));
    }
    return parts;
  },
};

export const dnsRenderer: ComponentContentRenderer = {
  icon: '◈',
  getContentLines(d) {
    const latency = d.resolutionLatencyMs ?? 5;
    const ttl = d.ttl ?? 300;
    const failover = d.failoverEnabled as boolean | undefined;
    const lines = [`resolve: ${latency}ms  TTL: ${ttl}s`];
    if (failover != null) lines.push(`failover: ${failover ? '✓' : '✕'}`);
    return lines;
  },
};
