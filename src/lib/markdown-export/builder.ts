// src/lib/markdown-export/builder.ts
import type { MarkdownExportInput } from './types';
import { buildOverview } from './sections/overview';
import { buildMermaid } from './sections/mermaid';
import { buildComponents } from './sections/components';
import { buildConnections } from './sections/connections';
import { buildAdrs } from './sections/adrs';
import { buildTagsIndex } from './sections/tags-index';

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildMarkdown(input: MarkdownExportInput): string {
  const date = input.exportedAt ?? new Date();
  const head = [
    `# ${input.name}`,
    '',
    `> Exported on ${formatDate(date)} by Architecture Simulator`,
    '',
  ];
  if (input.description) {
    head.push(input.description, '');
  }

  const parts: string[] = [head.join('\n')];
  parts.push(buildOverview({ nodes: input.nodes, edges: input.edges, adrs: input.adrs }).content);
  parts.push('## Diagram\n');
  parts.push(buildMermaid({ nodes: input.nodes, edges: input.edges }).content);
  parts.push(buildComponents({ nodes: input.nodes }).content);
  parts.push(buildConnections({ nodes: input.nodes, edges: input.edges }).content);
  parts.push(buildAdrs({ adrs: input.adrs ?? [], nodes: input.nodes, edges: input.edges }).content);
  parts.push(buildTagsIndex({ nodes: input.nodes }).content);

  return parts.join('\n');
}
