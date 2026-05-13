// src/lib/markdown-export/sections/tags-index.ts
import type { GraphNode } from '@/types/graph';
import type { SectionResult } from '../types';

function getLabel(n: GraphNode): string {
  const l = (n.data as { label?: unknown } | undefined)?.label;
  return typeof l === 'string' && l.length > 0 ? l : n.id;
}

export function buildTagsIndex(input: { nodes: GraphNode[] }): SectionResult {
  const byTag = new Map<string, string[]>();
  for (const n of input.nodes) {
    for (const t of n.metadata?.tags ?? []) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t)!.push(getLabel(n));
    }
  }
  if (byTag.size === 0) {
    return { content: '## Tags Index\n\n_no tags used_\n' };
  }
  const sorted = [...byTag.entries()].sort(([a], [b]) => a.localeCompare(b));
  const lines = ['## Tags Index', ''];
  for (const [tag, labels] of sorted) {
    lines.push(`- **${tag}** : ${labels.join(', ')}`);
  }
  return { content: lines.join('\n') + '\n' };
}
