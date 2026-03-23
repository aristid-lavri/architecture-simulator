import type { ComponentContentRenderer } from './types';

export const cloudStorageRenderer: ComponentContentRenderer = {
  icon: '☁',
  getContentLines(d) {
    const provider = String(d.provider ?? 's3');
    const storageClass = d.storageClass as string | undefined;
    const replication = d.replicationFactor as number | undefined;
    const lines: string[] = [provider];
    const meta: string[] = [];
    if (storageClass) meta.push(storageClass);
    if (replication) meta.push(`×${replication}`);
    if (meta.length > 0) lines.push(meta.join('  '));
    return lines;
  },
};

export const cloudFunctionRenderer: ComponentContentRenderer = {
  icon: 'ƒ',
  getContentLines(d) {
    const runtime = d.runtime as string | undefined;
    const memory = d.memoryMb as number | undefined;
    const parts: string[] = [];
    if (runtime) parts.push(runtime);
    if (memory) parts.push(`${memory}MB`);
    return parts.length > 0 ? [parts.join('  ')] : [] as string[];
  },
};
