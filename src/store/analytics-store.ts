import { create } from 'zustand';
import type { ComponentAnalytics, ComponentAnalyticsEvent, AnalyticsSynthesis } from '@/analytics/types';

interface AnalyticsStore {
  // Données per-composant, clé = nodeId
  components: Map<string, ComponentAnalytics>;

  // Composant sélectionné pour le panel inline
  selectedComponentId: string | null;

  // Synthèse post-simulation
  synthesis: AnalyticsSynthesis | null;

  // Visibilité du panel analytics
  isAnalyticsPanelOpen: boolean;

  // Actions
  setSelectedComponentId: (id: string | null) => void;
  setAnalyticsPanelOpen: (open: boolean) => void;
  updateComponentAnalytics: (event: ComponentAnalyticsEvent) => void;
  setSynthesis: (synthesis: AnalyticsSynthesis | null) => void;
  reset: () => void;
}

const initialState = {
  components: new Map<string, ComponentAnalytics>(),
  selectedComponentId: null,
  synthesis: null,
  isAnalyticsPanelOpen: false,
};

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  ...initialState,

  setSelectedComponentId: (id) => set({ selectedComponentId: id }),

  setAnalyticsPanelOpen: (open) => set({ isAnalyticsPanelOpen: open }),

  updateComponentAnalytics: (event) =>
    set((state) => {
      const next = new Map(state.components);
      next.set(event.nodeId, event.payload);
      return { components: next };
    }),

  setSynthesis: (synthesis) => set({ synthesis }),

  // Réinitialise les données runtime — NE touche PAS synthesis (préservée pour AnalysisView)
  reset: () =>
    set({
      components: new Map<string, ComponentAnalytics>(),
      selectedComponentId: null,
    }),
}));
