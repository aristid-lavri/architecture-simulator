import type { ComponentContentRenderer } from './types';

export const circuitBreakerRenderer: ComponentContentRenderer = {
  icon: '◎',
  getContentLines(d) {
    const state = (d.circuitState ?? 'closed').toString().toUpperCase();
    const threshold = (d.failureThreshold as number) ?? 5;
    const count = (d.failureCount as number) ?? 0;
    const filled = Math.min(count, threshold);
    const empty = Math.max(0, threshold - count);
    const dots = '●'.repeat(filled) + '○'.repeat(empty);
    const timeout = d.timeout as number | undefined;
    const lines = [`${state}  ${dots}  ${count}/${threshold}`];
    if (timeout) lines.push(`timeout: ${timeout / 1000}s`);
    return lines;
  },
};
