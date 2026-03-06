import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../app-store';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      mode: 'edit',
      isComponentsPanelOpen: true,
      isPropertiesPanelOpen: false,
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  });

  describe('mode', () => {
    it('starts in edit mode', () => {
      expect(useAppStore.getState().mode).toBe('edit');
    });

    it('can switch to simulation mode', () => {
      useAppStore.getState().setMode('simulation');
      expect(useAppStore.getState().mode).toBe('simulation');
    });
  });

  describe('panels', () => {
    it('toggles components panel', () => {
      expect(useAppStore.getState().isComponentsPanelOpen).toBe(true);
      useAppStore.getState().toggleComponentsPanel();
      expect(useAppStore.getState().isComponentsPanelOpen).toBe(false);
      useAppStore.getState().toggleComponentsPanel();
      expect(useAppStore.getState().isComponentsPanelOpen).toBe(true);
    });

    it('toggles properties panel', () => {
      expect(useAppStore.getState().isPropertiesPanelOpen).toBe(false);
      useAppStore.getState().togglePropertiesPanel();
      expect(useAppStore.getState().isPropertiesPanelOpen).toBe(true);
    });

    it('sets panels directly', () => {
      useAppStore.getState().setComponentsPanelOpen(false);
      expect(useAppStore.getState().isComponentsPanelOpen).toBe(false);
      useAppStore.getState().setPropertiesPanelOpen(true);
      expect(useAppStore.getState().isPropertiesPanelOpen).toBe(true);
    });
  });

  describe('selection', () => {
    it('selects a node and opens properties panel', () => {
      useAppStore.getState().setSelectedNodeId('node-1');
      const state = useAppStore.getState();
      expect(state.selectedNodeId).toBe('node-1');
      expect(state.isPropertiesPanelOpen).toBe(true);
    });

    it('clears edge selection when selecting a node', () => {
      useAppStore.getState().setSelectedEdgeId('edge-1');
      useAppStore.getState().setSelectedNodeId('node-1');
      const state = useAppStore.getState();
      expect(state.selectedNodeId).toBe('node-1');
      expect(state.selectedEdgeId).toBeNull();
    });

    it('clears node selection when selecting an edge', () => {
      useAppStore.getState().setSelectedNodeId('node-1');
      useAppStore.getState().setSelectedEdgeId('edge-1');
      const state = useAppStore.getState();
      expect(state.selectedEdgeId).toBe('edge-1');
      expect(state.selectedNodeId).toBeNull();
    });

    it('closes properties panel when deselecting', () => {
      useAppStore.getState().setSelectedNodeId('node-1');
      useAppStore.getState().setSelectedNodeId(null);
      expect(useAppStore.getState().isPropertiesPanelOpen).toBe(false);
    });
  });
});
