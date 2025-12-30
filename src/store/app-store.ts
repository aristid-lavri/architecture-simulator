import { create } from 'zustand';
import type { AppMode } from '@/types';

interface AppState {
  // Mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // Sidebars
  isComponentsPanelOpen: boolean;
  isPropertiesPanelOpen: boolean;
  toggleComponentsPanel: () => void;
  togglePropertiesPanel: () => void;
  setComponentsPanelOpen: (open: boolean) => void;
  setPropertiesPanelOpen: (open: boolean) => void;

  // Selected node
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Selected edge
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Mode
  mode: 'edit',
  setMode: (mode) => set({ mode }),

  // Sidebars
  isComponentsPanelOpen: true,
  isPropertiesPanelOpen: false,
  toggleComponentsPanel: () =>
    set((state) => ({ isComponentsPanelOpen: !state.isComponentsPanelOpen })),
  togglePropertiesPanel: () =>
    set((state) => ({ isPropertiesPanelOpen: !state.isPropertiesPanelOpen })),
  setComponentsPanelOpen: (open) => set({ isComponentsPanelOpen: open }),
  setPropertiesPanelOpen: (open) => set({ isPropertiesPanelOpen: open }),

  // Selected node
  selectedNodeId: null,
  setSelectedNodeId: (id) =>
    set({
      selectedNodeId: id,
      selectedEdgeId: null, // Clear edge selection when node is selected
      isPropertiesPanelOpen: id !== null,
    }),

  // Selected edge
  selectedEdgeId: null,
  setSelectedEdgeId: (id) =>
    set({
      selectedEdgeId: id,
      selectedNodeId: null, // Clear node selection when edge is selected
      isPropertiesPanelOpen: id !== null,
    }),
}));
