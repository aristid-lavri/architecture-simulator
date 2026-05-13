// src/lib/rules-engine/custom/matchers.ts
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NetworkZoneNodeData } from '@/types';
import type { NodeMatcher, EdgeMatcher } from './types';

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function getAncestorZone(
  node: GraphNode,
  nodeMap: Map<string, GraphNode>,
): GraphNode | undefined {
  let current = node.parentId ? nodeMap.get(node.parentId) : undefined;
  while (current) {
    if (current.type === 'network-zone') return current;
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }
  return undefined;
}

export function getDottedField(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  if (typeof cur === 'string' && cur.trim().length > 0) return cur;
  if (typeof cur === 'number' || typeof cur === 'boolean') return String(cur);
  if (Array.isArray(cur) && cur.length > 0) return cur.map(String).join(',');
  return undefined;
}

export function matchNode(
  node: GraphNode,
  matcher: NodeMatcher,
  nodeMap?: Map<string, GraphNode>,
): boolean {
  const types = toArray(matcher.type);
  if (types.length > 0 && !types.includes(node.type as never)) return false;

  const wantedTags = toArray(matcher.tag);
  if (wantedTags.length > 0) {
    const tags = node.metadata?.tags ?? [];
    const hit = wantedTags.some((t) => tags.includes(t));
    if (!hit) return false;
  }

  if (matcher.owner_team !== undefined) {
    if (node.metadata?.owner?.team !== matcher.owner_team) return false;
  }

  if (matcher.in_zone_type !== undefined) {
    if (!nodeMap) return false;
    const zone = getAncestorZone(node, nodeMap);
    if (!zone) return false;
    const zoneType = (zone.data as NetworkZoneNodeData | undefined)?.zoneType;
    if (zoneType !== matcher.in_zone_type) return false;
  }

  return true;
}

export function matchEdge(
  edge: GraphEdge,
  matcher: EdgeMatcher,
  nodeMap: Map<string, GraphNode>,
): boolean {
  const protocols = toArray(matcher.protocol);
  if (protocols.length > 0) {
    const proto = (edge.data?.protocol as string | undefined) ?? '';
    if (!protocols.includes(proto)) return false;
  }
  if (matcher.tag !== undefined) {
    const tags = (edge.data?.tags as string[] | undefined) ?? [];
    if (!tags.includes(matcher.tag)) return false;
  }
  if (matcher.source) {
    const src = nodeMap.get(edge.source);
    if (!src || !matchNode(src, matcher.source, nodeMap)) return false;
  }
  if (matcher.target) {
    const tgt = nodeMap.get(edge.target);
    if (!tgt || !matchNode(tgt, matcher.target, nodeMap)) return false;
  }
  return true;
}
