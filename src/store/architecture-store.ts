import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge } from '@xyflow/react';

interface ArchitectureState {
  nodes: Node[];
  edges: Edge[];
  lastSaved: number | null;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNode: (nodeId: string, data: Partial<Node['data']>) => void;
  removeNode: (nodeId: string) => void;
  addNode: (node: Node) => void;
  addEdge: (edge: Edge) => void;
  updateEdge: (edgeId: string, data: Partial<Edge['data']>) => void;
  removeEdge: (edgeId: string) => void;
  clear: () => void;
  save: () => void;
}

export const useArchitectureStore = create<ArchitectureState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      lastSaved: null,

      setNodes: (nodes) => set({ nodes, lastSaved: Date.now() }),

      setEdges: (edges) => set({ edges, lastSaved: Date.now() }),

      updateNode: (nodeId, data) =>
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...data } }
              : node
          ),
          lastSaved: Date.now(),
        })),

      removeNode: (nodeId) =>
        set((state) => ({
          nodes: state.nodes.filter((node) => node.id !== nodeId),
          edges: state.edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          ),
          lastSaved: Date.now(),
        })),

      addNode: (node) =>
        set((state) => ({
          nodes: [...state.nodes, node],
          lastSaved: Date.now(),
        })),

      addEdge: (edge) =>
        set((state) => ({
          edges: [...state.edges, edge],
          lastSaved: Date.now(),
        })),

      updateEdge: (edgeId, data) =>
        set((state) => ({
          edges: state.edges.map((edge) =>
            edge.id === edgeId
              ? { ...edge, data: { ...edge.data, ...data } }
              : edge
          ),
          lastSaved: Date.now(),
        })),

      removeEdge: (edgeId) =>
        set((state) => ({
          edges: state.edges.filter((edge) => edge.id !== edgeId),
          lastSaved: Date.now(),
        })),

      clear: () =>
        set({
          nodes: [],
          edges: [],
          lastSaved: Date.now(),
        }),

      save: () => set({ lastSaved: Date.now() }),
    }),
    {
      name: 'architecture-simulator-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        lastSaved: state.lastSaved,
      }),
    }
  )
);

// Utility function to export architecture as JSON
export function exportArchitecture(): string {
  const { nodes, edges } = useArchitectureStore.getState();
  return JSON.stringify({ nodes, edges, exportedAt: Date.now() }, null, 2);
}

// Utility function to import architecture from JSON
export function importArchitecture(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (data.nodes && data.edges) {
      useArchitectureStore.getState().setNodes(data.nodes);
      useArchitectureStore.getState().setEdges(data.edges);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
