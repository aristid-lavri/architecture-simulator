// src/lib/markdown-export/sections/components.ts
import type { GraphNode } from '@/types/graph';
import type { ComponentType } from '@/types';
import type { SectionResult } from '../types';

const CATEGORY_OF: Record<string, string> = {
  // Simulation
  'http-client': 'Simulation', 'http-server': 'Simulation', 'client-group': 'Simulation',
  // Infrastructure
  'api-gateway': 'Infrastructure', 'load-balancer': 'Infrastructure', 'cdn': 'Infrastructure',
  'waf': 'Infrastructure', 'firewall': 'Infrastructure', 'service-discovery': 'Infrastructure',
  'dns': 'Infrastructure',
  // Data
  'database': 'Data', 'cache': 'Data', 'message-queue': 'Data',
  // Resilience
  'circuit-breaker': 'Resilience',
  // Compute
  'host-server': 'Compute', 'serverless': 'Compute', 'container': 'Compute',
  'api-service': 'Compute', 'background-job': 'Compute',
  // Cloud
  'cloud-storage': 'Cloud', 'cloud-function': 'Cloud',
  // Zone
  'network-zone': 'Zone',
  // Security
  'identity-provider': 'Security',
};

const CATEGORY_ORDER = ['Simulation', 'Infrastructure', 'Data', 'Resilience', 'Compute', 'Cloud', 'Zone', 'Security', 'Other'];

function categoryOf(type: string): string {
  return CATEGORY_OF[type] ?? 'Other';
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

function getLabel(n: GraphNode): string {
  const l = (n.data as { label?: unknown } | undefined)?.label;
  return typeof l === 'string' && l.length > 0 ? l : n.id;
}

export function buildComponents(input: { nodes: GraphNode[] }): SectionResult {
  if (input.nodes.length === 0) {
    return { content: '## Components\n\n_no components yet_\n', count: 0 };
  }

  const byCat = new Map<string, GraphNode[]>();
  for (const n of input.nodes) {
    const cat = categoryOf(n.type as ComponentType);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(n);
  }

  const parts: string[] = ['## Components'];
  for (const cat of CATEGORY_ORDER) {
    const nodes = byCat.get(cat);
    if (!nodes || nodes.length === 0) continue;
    parts.push(`\n### ${cat}\n`);
    parts.push('| Name | Type | Tags | Owner | Notes |');
    parts.push('|------|------|------|-------|-------|');
    for (const n of nodes) {
      const tags = (n.metadata?.tags ?? []).join(', ');
      const owner = n.metadata?.owner?.individual
        || n.metadata?.owner?.team
        || '';
      const notes = n.metadata?.notes ?? '';
      parts.push(`| ${escapeCell(getLabel(n))} | ${n.type} | ${escapeCell(tags)} | ${escapeCell(owner)} | ${escapeCell(notes)} |`);
    }
  }
  return { content: parts.join('\n') + '\n', count: input.nodes.length };
}
