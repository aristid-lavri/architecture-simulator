/**
 * Pure helpers for the Architecture Decision Records (ADR) system — A7.2.
 *
 * Implemented as side-effect-free functions so they can be exercised in
 * isolation by unit tests and reused by both the store and YAML round-trip.
 */

import type { ADR, ADRLink, ADRStatus } from '@/types/adr';

function generateAdrId(): string {
  return `adr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build a fresh proposed-state ADR with the supplied numeric handle. */
export function createEmptyADR(number: number): ADR {
  const now = Date.now();
  return {
    id: generateAdrId(),
    number,
    title: '',
    status: 'proposed' as ADRStatus,
    date: todayIso(),
    context: '',
    decision: '',
    consequences: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Returns an array of field names that are missing or empty. Empty array means valid. */
export function validateADR(adr: ADR): string[] {
  const missing: string[] = [];
  if (!adr.title.trim()) missing.push('title');
  if (!adr.date.trim()) missing.push('date');
  if (!adr.context.trim()) missing.push('context');
  if (!adr.decision.trim()) missing.push('decision');
  if (!adr.consequences.trim()) missing.push('consequences');
  return missing;
}

/** Next monotonically increasing display number. */
export function nextAdrNumber(adrs: ADR[]): number {
  let max = 0;
  for (const a of adrs) if (a.number > max) max = a.number;
  return max + 1;
}

/**
 * Apply a supersession (B supersedes A) to the collection.
 * - Marks A as `superseded` and points `supersededBy` at B.
 * - Adds A to B's `supersedes` set (idempotent).
 */
export function applySupersede(
  { supersederId, supersededId }: { supersederId: string; supersededId: string },
  adrs: ADR[],
): ADR[] {
  return adrs.map((a) => {
    if (a.id === supersededId) {
      return { ...a, status: 'superseded' as ADRStatus, supersededBy: supersederId, updatedAt: Date.now() };
    }
    if (a.id === supersederId) {
      const set = new Set(a.supersedes ?? []);
      set.add(supersededId);
      return { ...a, supersedes: Array.from(set), updatedAt: Date.now() };
    }
    return a;
  });
}

/** Order-preserving dedupe of `(kind, targetId)` link tuples. */
export function dedupeLinks(links: ADRLink[]): ADRLink[] {
  const seen = new Set<string>();
  const out: ADRLink[] = [];
  for (const l of links) {
    const k = `${l.kind}:${l.targetId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

/** Remove any links to a graph element that no longer exists. Returns the
 * same reference when nothing changed so callers can short-circuit. */
export function removeLinksToTarget(adr: ADR, kind: 'node' | 'edge', targetId: string): ADR {
  if (!adr.links?.length) return adr;
  const filtered = adr.links.filter((l) => !(l.kind === kind && l.targetId === targetId));
  if (filtered.length === adr.links.length) return adr;
  return { ...adr, links: filtered, updatedAt: Date.now() };
}
