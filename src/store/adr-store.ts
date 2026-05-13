/**
 * Zustand store for Architecture Decision Records (A7.2).
 *
 * Not persisted directly to localStorage. Persistence is delegated to
 * `project-store.ts` (in a follow-up task) which mirrors the `adrs` field
 * onto the active `Project`.
 */

import { create } from 'zustand';
import type { ADR, ADRLink } from '@/types/adr';
import {
  applySupersede,
  createEmptyADR,
  dedupeLinks,
  nextAdrNumber,
  removeLinksToTarget,
} from '@/lib/adr-helpers';

interface AdrState {
  adrs: ADR[];

  /** Create a new proposed-state ADR with the next number; returns its id. */
  createADR: () => string;
  updateADR: (id: string, patch: Partial<ADR>) => void;
  deleteADR: (id: string) => void;
  addLink: (id: string, link: ADRLink) => void;
  removeLink: (id: string, link: ADRLink) => void;
  /** Mark `oldId` as superseded by `newId`. */
  supersede: (newId: string, oldId: string) => void;
  /** Replace the entire collection (used on project load + YAML import). */
  replaceAll: (adrs: ADR[]) => void;
  /** Called when a node/edge is deleted: prunes dangling links. */
  onGraphElementDeleted: (kind: 'node' | 'edge', targetId: string) => void;
}

export const useAdrStore = create<AdrState>((set, get) => ({
  adrs: [],

  createADR: () => {
    const adr = createEmptyADR(nextAdrNumber(get().adrs));
    set((s) => ({ adrs: [...s.adrs, adr] }));
    return adr.id;
  },

  updateADR: (id, patch) =>
    set((s) => ({
      adrs: s.adrs.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)),
    })),

  deleteADR: (id) => set((s) => ({ adrs: s.adrs.filter((a) => a.id !== id) })),

  addLink: (id, link) =>
    set((s) => ({
      adrs: s.adrs.map((a) => {
        if (a.id !== id) return a;
        const next = dedupeLinks([...(a.links ?? []), link]);
        return { ...a, links: next, updatedAt: Date.now() };
      }),
    })),

  removeLink: (id, link) =>
    set((s) => ({
      adrs: s.adrs.map((a) => {
        if (a.id !== id) return a;
        const next = (a.links ?? []).filter(
          (l) => !(l.kind === link.kind && l.targetId === link.targetId),
        );
        return { ...a, links: next, updatedAt: Date.now() };
      }),
    })),

  supersede: (newId, oldId) =>
    set((s) => ({ adrs: applySupersede({ supersederId: newId, supersededId: oldId }, s.adrs) })),

  replaceAll: (adrs) => set({ adrs }),

  onGraphElementDeleted: (kind, targetId) =>
    set((s) => ({ adrs: s.adrs.map((a) => removeLinksToTarget(a, kind, targetId)) })),
}));
