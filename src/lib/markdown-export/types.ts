// src/lib/markdown-export/types.ts
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ADR } from '@/types/adr';

export interface MarkdownExportInput {
  name: string;
  description?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  adrs?: ADR[];
  /** Override export date (used by tests for deterministic output). Default: now. */
  exportedAt?: Date;
}

export interface SectionResult {
  /** Markdown for the section (without trailing newline; the builder adds the separator). */
  content: string;
  /** Number of items the section represented (for the overview counters). */
  count?: number;
}
