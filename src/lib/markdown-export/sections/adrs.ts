// src/lib/markdown-export/sections/adrs.ts
import type { ADR } from '@/types/adr';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { SectionResult } from '../types';

function labelOfNode(map: Map<string, GraphNode>, id: string): string {
  const n = map.get(id);
  if (!n) return id;
  const l = (n.data as { label?: unknown } | undefined)?.label;
  return typeof l === 'string' && l.length > 0 ? l : id;
}

function labelOfEdge(emap: Map<string, GraphEdge>, nmap: Map<string, GraphNode>, id: string): string {
  const e = emap.get(id);
  if (!e) return id;
  return `${labelOfNode(nmap, e.source)} → ${labelOfNode(nmap, e.target)}`;
}

export function buildAdrs(input: { adrs: ADR[]; nodes: GraphNode[]; edges: GraphEdge[] }): SectionResult {
  if (input.adrs.length === 0) {
    return { content: '## Architecture Decisions\n\n_no architecture decisions recorded_\n', count: 0 };
  }
  const sorted = [...input.adrs].sort((a, b) => a.number - b.number);
  const nmap = new Map(input.nodes.map((n) => [n.id, n]));
  const emap = new Map(input.edges.map((e) => [e.id, e]));

  const parts: string[] = ['## Architecture Decisions'];
  for (const a of sorted) {
    parts.push('');
    parts.push(`### ADR-${String(a.number).padStart(4, '0')} — ${a.title || '(untitled)'}`);
    const meta = [
      `**Status:** ${a.status}`,
      `**Date:** ${a.date}`,
    ];
    if (a.author) meta.push(`**Author:** ${a.author}`);
    if (a.supersededBy) meta.push(`**Superseded by:** ADR (id ${a.supersededBy})`);
    if (a.supersedes?.length) meta.push(`**Supersedes:** ${a.supersedes.join(', ')}`);
    parts.push(meta.join(' · '));
    parts.push('');
    parts.push('#### Context'); parts.push(''); parts.push(a.context); parts.push('');
    parts.push('#### Decision'); parts.push(''); parts.push(a.decision); parts.push('');
    parts.push('#### Consequences'); parts.push(''); parts.push(a.consequences); parts.push('');
    if (a.alternatives && a.alternatives.trim().length > 0) {
      parts.push('#### Alternatives'); parts.push(''); parts.push(a.alternatives); parts.push('');
    }
    if (a.links && a.links.length > 0) {
      const refs = a.links.map((l) =>
        l.kind === 'node'
          ? `${labelOfNode(nmap, l.targetId)} (node)`
          : `${labelOfEdge(emap, nmap, l.targetId)} (edge)`,
      );
      parts.push(`**Linked elements:** ${refs.join(', ')}`);
      parts.push('');
    }
    if (a.tags && a.tags.length > 0) {
      parts.push(`**Tags:** ${a.tags.join(', ')}`);
      parts.push('');
    }
    parts.push('---');
  }
  return { content: parts.join('\n') + '\n', count: sorted.length };
}
