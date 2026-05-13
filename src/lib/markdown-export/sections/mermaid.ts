// src/lib/markdown-export/sections/mermaid.ts
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { SectionResult } from '../types';

function sanitizeId(id: string): string {
  return `n_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function escapeLabel(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/\|/g, '&#124;');
}

function getNodeLabel(node: GraphNode): string {
  const dataLabel = (node.data as { label?: unknown } | undefined)?.label;
  if (typeof dataLabel === 'string' && dataLabel.length > 0) return dataLabel;
  return node.id;
}

function getEdgeProtocol(edge: GraphEdge): string | undefined {
  const p = (edge.data as { protocol?: unknown } | undefined)?.protocol;
  return typeof p === 'string' ? p : undefined;
}

export function buildMermaid(input: { nodes: GraphNode[]; edges: GraphEdge[] }): SectionResult {
  const lines: string[] = ['```mermaid', 'flowchart LR'];

  if (input.nodes.length === 0 && input.edges.length === 0) {
    lines.push('  %% empty diagram', '```');
    return { content: lines.join('\n'), count: 0 };
  }

  for (const node of input.nodes) {
    const id = sanitizeId(node.id);
    const label = escapeLabel(`${node.type} — ${getNodeLabel(node)}`);
    lines.push(`  ${id}["${label}"]`);
  }

  for (const edge of input.edges) {
    const s = sanitizeId(edge.source);
    const t = sanitizeId(edge.target);
    const protocol = getEdgeProtocol(edge);
    lines.push(protocol ? `  ${s} -->|${escapeLabel(protocol)}| ${t}` : `  ${s} --> ${t}`);
  }

  lines.push('```');
  return { content: lines.join('\n'), count: input.nodes.length };
}
