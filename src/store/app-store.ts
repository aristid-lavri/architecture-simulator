import { create } from 'zustand';
import type { AppMode, ConnectionProtocol } from '@/types';
import type { ValidationResult } from '@/lib/simulation-validator';

type Theme = 'dark' | 'light';

export type EdgeRoutingMode = 'bezier' | 'orthogonal';

interface AppState {
  // Mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // Theme
  theme: Theme;
  toggleTheme: () => void;

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

  // Edge hover
  hoveredEdgeId: string | null;
  setHoveredEdgeId: (id: string | null) => void;

  // Edge protocol filters
  edgeProtocolFilters: Partial<Record<ConnectionProtocol | '_none', boolean>>;
  toggleEdgeProtocolFilter: (protocol: ConnectionProtocol | '_none') => void;
  resetEdgeProtocolFilters: () => void;

  // Edge routing mode
  edgeRoutingMode: EdgeRoutingMode;
  setEdgeRoutingMode: (mode: EdgeRoutingMode) => void;

  // Validation
  validationResult: ValidationResult | null;
  setValidationResult: (result: ValidationResult | null) => void;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('arch-sim-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('arch-sim-theme', theme);
}

export const useAppStore = create<AppState>((set) => {
  const initialTheme = getInitialTheme();
  // Apply on store creation (client-side)
  if (typeof window !== 'undefined') {
    applyTheme(initialTheme);
  }

  return {
    // Mode
    mode: 'edit',
    setMode: (mode) => set({ mode }),

    // Theme
    theme: initialTheme,
    toggleTheme: () =>
      set((state) => {
        const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        return { theme: next };
      }),

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
        selectedEdgeId: null,
        // Properties panel opened explicitly via cog icon, not on node click
      }),

    // Selected edge
    selectedEdgeId: null,
    setSelectedEdgeId: (id) =>
      set({
        selectedEdgeId: id,
        selectedNodeId: null,
        isPropertiesPanelOpen: id !== null,
      }),

    // Edge hover
    hoveredEdgeId: null,
    setHoveredEdgeId: (id) => set({ hoveredEdgeId: id }),

    // Edge protocol filters (all visible by default — empty object means no filters)
    edgeProtocolFilters: {},
    toggleEdgeProtocolFilter: (protocol) =>
      set((state) => {
        const current = state.edgeProtocolFilters[protocol];
        return {
          edgeProtocolFilters: {
            ...state.edgeProtocolFilters,
            [protocol]: current === undefined ? false : !current,
          },
        };
      }),
    resetEdgeProtocolFilters: () => set({ edgeProtocolFilters: {} }),

    // Edge routing mode
    edgeRoutingMode: 'bezier',
    setEdgeRoutingMode: (mode) => set({ edgeRoutingMode: mode }),

    // Validation
    validationResult: null,
    setValidationResult: (result) => set({ validationResult: result }),
  };
});
