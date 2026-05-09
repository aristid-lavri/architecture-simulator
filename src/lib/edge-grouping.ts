import type { GraphEdge } from '@/types/graph';

/**
 * Membership info for an edge inside its parallel group (edges sharing the same node pair).
 *
 * - `size` is the count of edges in the group (always ≥ 1).
 * - `index` is a centred ordinal: for size n, indices range over [-(n-1)/2, +(n-1)/2].
 *   Even sizes use half-steps (e.g. n=4 → -1.5, -0.5, +0.5, +1.5).
 * - `isReversed` is true when the edge's direction is opposite to the canonical group direction
 *   (group direction is alphabetical: smaller node id is the canonical "source").
 */
export interface ParallelGroupInfo {
  groupKey: string;
  size: number;
  index: number;
  isReversed: boolean;
}

export interface ParallelGroups {
  /** Edge id → membership info. Edges where source === target are excluded. */
  groupOf: Map<string, ParallelGroupInfo>;
}

/**
 * Detect groups of parallel edges (sharing the same unordered pair of nodes) and assign
 * each member a centred index used for perpendicular offsetting.
 *
 * Direction is canonicalised: A→B and B→A end up in the same group. The canonical
 * direction is alphabetical (min(source, target) → max). Edges going against this
 * direction are flagged via `isReversed`.
 *
 * Groups are sorted by `edge.id` (stable, deterministic) to avoid visual flips on re-render.
 */
export function computeParallelGroups(edges: GraphEdge[]): ParallelGroups {
  // Bucket edges by canonical key.
  const buckets = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const a = edge.source < edge.target ? edge.source : edge.target;
    const b = edge.source < edge.target ? edge.target : edge.source;
    const key = `${a}::${b}`;
    const arr = buckets.get(key);
    if (arr) arr.push(edge);
    else buckets.set(key, [edge]);
  }

  const groupOf = new Map<string, ParallelGroupInfo>();
  for (const [groupKey, members] of buckets) {
    members.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const size = members.length;
    const [canonicalSource] = groupKey.split('::');
    for (let i = 0; i < size; i++) {
      const edge = members[i];
      groupOf.set(edge.id, {
        groupKey,
        size,
        index: i - (size - 1) / 2,
        isReversed: edge.source !== canonicalSource,
      });
    }
  }

  return { groupOf };
}

/** Spacing in pixels between parallel edges within a group (perpendicular to the line). */
export const PARALLEL_EDGE_SPACING = 14;

/** Convenience: returns the perpendicular offset in px for an edge given its group info. */
export function parallelOffset(info: ParallelGroupInfo | undefined): number {
  if (!info || info.size <= 1) return 0;
  // Reversed edges flip sign so A→B and B→A end up on opposite sides.
  const sign = info.isReversed ? -1 : 1;
  return sign * info.index * PARALLEL_EDGE_SPACING;
}

/** Range over which labels are staggered along a curve (centre ±15%). */
const LABEL_STAGGER_RANGE = 0.30;
const LABEL_STAGGER_CENTER = 0.5;

/**
 * Position along the curve (`t ∈ [0, 1]`) for the protocol label of an edge in a parallel group.
 *
 * Solo edges sit at the midpoint (t=0.5). Members of a group of size n are spaced evenly on
 * `[centre − range/2, centre + range/2]` so badges don't overlap.
 */
export function staggeredLabelT(info: ParallelGroupInfo | undefined): number {
  if (!info || info.size <= 1) return LABEL_STAGGER_CENTER;
  const half = (info.size - 1) / 2; // max absolute index value
  const normalized = info.index / half; // ∈ [-1, 1]
  return LABEL_STAGGER_CENTER + (normalized * LABEL_STAGGER_RANGE) / 2;
}
