// src/lib/markdown-export/sections/connections.ts
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { SectionResult } from '../types';

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

function labelOf(nodeMap: Map<string, GraphNode>, id: string): string {
  const n = nodeMap.get(id);
  if (!n) return id;
  const l = (n.data as { label?: unknown } | undefined)?.label;
  return typeof l === 'string' && l.length > 0 ? l : id;
}

export function buildConnections(input: { nodes: GraphNode[]; edges: GraphEdge[] }): SectionResult {
  if (input.edges.length === 0) {
    return { content: '## Connections\n\n_no connections yet_\n', count: 0 };
  }
  const nodeMap = new Map(input.nodes.map((n) => [n.id, n]));
  const parts: string[] = [
    '## Connections',
    '',
    '| From | To | Protocol | Latency | Tags |',
    '|------|----|----------|---------|------|',
  ];
  for (const e of input.edges) {
    const proto = (e.data as { protocol?: unknown } | undefined)?.protocol;
    const latency = (e.data as { latency?: unknown } | undefined)?.latency;
    const tags = (e.data as { tags?: unknown } | undefined)?.tags;
    const tagsStr = Array.isArray(tags) ? tags.join(', ') : '';
    parts.push(
      `| ${escapeCell(labelOf(nodeMap, e.source))} | ${escapeCell(labelOf(nodeMap, e.target))} | ${escapeCell(String(proto ?? ''))} | ${escapeCell(String(latency ?? ''))} | ${escapeCell(tagsStr)} |`,
    );
  }
  return { content: parts.join('\n') + '\n', count: input.edges.length };
}
