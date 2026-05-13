// src/lib/markdown-export/sections/overview.ts
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ADR } from '@/types/adr';
import type { SectionResult } from '../types';

export function buildOverview(input: {
  nodes: GraphNode[]; edges: GraphEdge[]; adrs?: ADR[];
}): SectionResult {
  const cats = new Set<string>();
  for (const n of input.nodes) cats.add(n.type);
  const adrsTotal = input.adrs?.length ?? 0;
  const adrsAccepted = (input.adrs ?? []).filter((a) => a.status === 'accepted').length;
  const adrsProposed = (input.adrs ?? []).filter((a) => a.status === 'proposed').length;

  const lines = [
    '## Overview',
    '',
    `- ${input.nodes.length} components across ${cats.size} types`,
    `- ${input.edges.length} connections`,
    `- ${adrsTotal} ADRs${adrsTotal > 0 ? ` (${adrsAccepted} accepted, ${adrsProposed} proposed)` : ''}`,
  ];
  return { content: lines.join('\n') + '\n' };
}
