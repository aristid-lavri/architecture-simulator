import { create } from 'zustand';
import type { AppMode } from '@/types';

type Theme = 'dark' | 'light';

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
        isPropertiesPanelOpen: id !== null,
      }),

    // Selected edge
    selectedEdgeId: null,
    setSelectedEdgeId: (id) =>
      set({
        selectedEdgeId: id,
        selectedNodeId: null,
        isPropertiesPanelOpen: id !== null,
      }),
  };
});
