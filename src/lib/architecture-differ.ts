import type { GraphNode, GraphEdge } from '@/types/graph';
import type { ArchitectureSnapshot } from '@/types';

export type NodeDiffStatus = 'unchanged' | 'added' | 'removed' | 'modified';
export type EdgeDiffStatus = 'unchanged' | 'added' | 'removed' | 'modified';

export interface NodeDiff {
  id: string;
  status: NodeDiffStatus;
  /** Champs modifiés (label, type, position, data.*). Vide si status !== 'modified'. */
  changedFields: string[];
  /** Snapshot du nœud côté baseline (null si added). */
  before: GraphNode | null;
  /** Snapshot du nœud côté target (null si removed). */
  after: GraphNode | null;
}

export interface EdgeDiff {
  id: string;
  status: EdgeDiffStatus;
  changedFields: string[];
  before: GraphEdge | null;
  after: GraphEdge | null;
}

export interface ArchitectureDiff {
  nodes: NodeDiff[];
  edges: EdgeDiff[];
  summary: {
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    edgesAdded: number;
    edgesRemoved: number;
    edgesModified: number;
  };
}

export function diffArchitectures(
  baseline: ArchitectureSnapshot,
  target: ArchitectureSnapshot,
): ArchitectureDiff {
  const baselineNodes = new Map(baseline.nodes.map((n) => [n.id, n]));
  const targetNodes = new Map(target.nodes.map((n) => [n.id, n]));
  const baselineEdges = new Map(baseline.edges.map((e) => [e.id, e]));
  const targetEdges = new Map(target.edges.map((e) => [e.id, e]));

  const allNodeIds = new Set([...baselineNodes.keys(), ...targetNodes.keys()]);
  const allEdgeIds = new Set([...baselineEdges.keys(), ...targetEdges.keys()]);

  const nodes: NodeDiff[] = [];
  for (const id of allNodeIds) {
    const before = baselineNodes.get(id) ?? null;
    const after = targetNodes.get(id) ?? null;
    if (before && !after) {
      nodes.push({ id, status: 'removed', changedFields: [], before, after: null });
    } else if (!before && after) {
      nodes.push({ id, status: 'added', changedFields: [], before: null, after });
    } else if (before && after) {
      const changedFields = compareNodes(before, after);
      nodes.push({
        id,
        status: changedFields.length > 0 ? 'modified' : 'unchanged',
        changedFields,
        before,
        after,
      });
    }
  }

  const edges: EdgeDiff[] = [];
  for (const id of allEdgeIds) {
    const before = baselineEdges.get(id) ?? null;
    const after = targetEdges.get(id) ?? null;
    if (before && !after) {
      edges.push({ id, status: 'removed', changedFields: [], before, after: null });
    } else if (!before && after) {
      edges.push({ id, status: 'added', changedFields: [], before: null, after });
    } else if (before && after) {
      const changedFields = compareEdges(before, after);
      edges.push({
        id,
        status: changedFields.length > 0 ? 'modified' : 'unchanged',
        changedFields,
        before,
        after,
      });
    }
  }

  return { nodes, edges, summary: computeSummary(nodes, edges) };
}

function compareNodes(a: GraphNode, b: GraphNode): string[] {
  const changed: string[] = [];
  if (a.type !== b.type) changed.push('type');
  if (a.position?.x !== b.position?.x || a.position?.y !== b.position?.y) changed.push('position');
  const aData = a.data ?? {};
  const bData = b.data ?? {};
  const dataKeys = new Set([...Object.keys(aData), ...Object.keys(bData)]);
  for (const k of dataKeys) {
    const av = (aData as Record<string, unknown>)[k];
    const bv = (bData as Record<string, unknown>)[k];
    if (typeof av === 'object' || typeof bv === 'object') {
      if (JSON.stringify(av) !== JSON.stringify(bv)) changed.push(`data.${k}`);
    } else if (av !== bv) {
      changed.push(`data.${k}`);
    }
  }
  return changed;
}

function compareEdges(a: GraphEdge, b: GraphEdge): string[] {
  const changed: string[] = [];
  if (a.source !== b.source) changed.push('source');
  if (a.target !== b.target) changed.push('target');
  if (JSON.stringify(a.data ?? {}) !== JSON.stringify(b.data ?? {})) changed.push('data');
  return changed;
}

function computeSummary(nodes: NodeDiff[], edges: EdgeDiff[]): ArchitectureDiff['summary'] {
  return {
    nodesAdded: nodes.filter((n) => n.status === 'added').length,
    nodesRemoved: nodes.filter((n) => n.status === 'removed').length,
    nodesModified: nodes.filter((n) => n.status === 'modified').length,
    edgesAdded: edges.filter((e) => e.status === 'added').length,
    edgesRemoved: edges.filter((e) => e.status === 'removed').length,
    edgesModified: edges.filter((e) => e.status === 'modified').length,
  };
}
