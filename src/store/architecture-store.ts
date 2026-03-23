import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GraphNode, GraphEdge, ArchitectureSnapshot } from '@/types';

const MAX_HISTORY = 50;

/**
 * Tri topologique des noeuds : les parents sont toujours avant leurs enfants.
 * React Flow exige cet ordre pour le rendu correct des groupes.
 */
function ensureNodeOrdering(nodes: GraphNode[]): GraphNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const result: GraphNode[] = [];

  function visit(node: GraphNode) {
    if (visited.has(node.id)) return;
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) visit(parent);
    }
    visited.add(node.id);
    result.push(node);
  }

  for (const node of nodes) {
    visit(node);
  }

  return result;
}

/**
 * Trouve tous les descendants d'un noeud (enfants, petits-enfants, etc.) via parentId.
 */
function findAllDescendants(nodeId: string, nodes: GraphNode[]): string[] {
  const descendants: string[] = [];
  const queue = [nodeId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const node of nodes) {
      if (node.parentId === currentId) {
        descendants.push(node.id);
        queue.push(node.id);
      }
    }
  }
  return descendants;
}

/** Genere un identifiant unique pour les snapshots. */
function generateId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Etat du graphe d'architecture (noeuds et aretes).
 * Inclut undo/redo et snapshots nommes.
 * Persiste dans localStorage via le middleware Zustand persist.
 */
interface ArchitectureState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lastSaved: number | null;

  // Undo/redo (non persiste)
  past: ArchitectureSnapshot[];
  future: ArchitectureSnapshot[];

  // Version counter — increments on undo/redo/restore/clear (non persiste)
  _syncVersion: number;

  // Snapshots nommes (persistes)
  snapshots: ArchitectureSnapshot[];

  // Actions
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  /** Sets both nodes and edges in a single operation (single pushHistory). */
  setNodesAndEdges: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  updateNode: (nodeId: string, data: Partial<GraphNode['data']>) => void;
  removeNode: (nodeId: string) => void;
  reparentNode: (nodeId: string, newParentId: string | null) => void;
  addNode: (node: GraphNode) => void;
  addEdge: (edge: GraphEdge) => void;
  updateEdge: (edgeId: string, data: Partial<GraphEdge['data']>) => void;
  removeEdge: (edgeId: string) => void;
  clear: () => void;
  save: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Snapshots nommes
  saveSnapshot: (name?: string) => void;
  getSnapshots: () => ArchitectureSnapshot[];
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
}

/**
 * Store Zustand pour le graphe d'architecture.
 * Persiste automatiquement noeuds, aretes, snapshots et timestamp dans localStorage
 * sous la cle 'architecture-simulator-storage'.
 */
export const useArchitectureStore = create<ArchitectureState>()(
  persist(
    (set, get) => {
      /** Capture l'etat courant comme snapshot. */
      function captureState(): ArchitectureSnapshot {
        const { nodes, edges } = get();
        return {
          id: generateId(),
          name: '',
          timestamp: Date.now(),
          nodes: structuredClone(nodes),
          edges: structuredClone(edges),
        };
      }

      /** Pousse l'etat courant dans past et vide future avant une mutation. */
      function pushHistory() {
        const snapshot = captureState();
        const past = [...get().past, snapshot].slice(-MAX_HISTORY);
        set({ past, future: [] });
      }

      return {
        nodes: [],
        edges: [],
        lastSaved: null,
        past: [],
        future: [],
        _syncVersion: 0,
        snapshots: [],

        setNodes: (nodes) => {
          pushHistory();
          set({ nodes, lastSaved: Date.now() });
        },

        setEdges: (edges) => {
          pushHistory();
          set({ edges, lastSaved: Date.now() });
        },

        setNodesAndEdges: (nodes, edges) => {
          pushHistory();
          set({ nodes, edges, lastSaved: Date.now() });
        },

        updateNode: (nodeId, data) => {
          pushHistory();
          set((state) => ({
            nodes: state.nodes.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, ...data } }
                : node
            ),
            lastSaved: Date.now(),
          }));
        },

        removeNode: (nodeId) => {
          pushHistory();
          set((state) => {
            // Suppression en cascade : trouver tous les descendants
            const descendants = findAllDescendants(nodeId, state.nodes);
            const idsToRemove = new Set([nodeId, ...descendants]);
            return {
              nodes: state.nodes.filter((node) => !idsToRemove.has(node.id)),
              edges: state.edges.filter(
                (edge) => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target)
              ),
              lastSaved: Date.now(),
            };
          });
        },

        reparentNode: (nodeId, newParentId) => {
          pushHistory();
          set((state) => {
            const node = state.nodes.find((n) => n.id === nodeId);
            if (!node) return state;

            // Calculer la position absolue du noeud
            function getAbsolutePos(n: GraphNode): { x: number; y: number } {
              let x = n.position.x;
              let y = n.position.y;
              let current = n;
              while (current.parentId) {
                const parent = state.nodes.find((p) => p.id === current.parentId);
                if (!parent) break;
                x += parent.position.x;
                y += parent.position.y;
                current = parent;
              }
              return { x, y };
            }

            const absPos = getAbsolutePos(node);

            const updatedNodes = state.nodes.map((n) => {
              if (n.id !== nodeId) return n;

              if (newParentId) {
                const newParent = state.nodes.find((p) => p.id === newParentId);
                if (!newParent) return n;
                const parentAbsPos = getAbsolutePos(newParent);
                return {
                  ...n,
                  position: {
                    x: absPos.x - parentAbsPos.x,
                    y: absPos.y - parentAbsPos.y,
                  },
                  parentId: newParentId,
                };
              } else {
                // Détacher du parent
                return {
                  ...n,
                  position: absPos,
                  parentId: undefined,
                };
              }
            });

            return {
              nodes: ensureNodeOrdering(updatedNodes),
              lastSaved: Date.now(),
            };
          });
        },

        addNode: (node) => {
          pushHistory();
          set((state) => ({
            nodes: [...state.nodes, node],
            lastSaved: Date.now(),
          }));
        },

        addEdge: (edge) => {
          pushHistory();
          set((state) => ({
            edges: [...state.edges, edge],
            lastSaved: Date.now(),
          }));
        },

        updateEdge: (edgeId, data) => {
          pushHistory();
          set((state) => ({
            edges: state.edges.map((edge) =>
              edge.id === edgeId
                ? { ...edge, data: { ...edge.data, ...data } }
                : edge
            ),
            lastSaved: Date.now(),
          }));
        },

        removeEdge: (edgeId) => {
          pushHistory();
          set((state) => ({
            edges: state.edges.filter((edge) => edge.id !== edgeId),
            lastSaved: Date.now(),
          }));
        },

        clear: () => {
          pushHistory();
          set({
            nodes: [],
            edges: [],
            lastSaved: Date.now(),
            _syncVersion: get()._syncVersion + 1,
          });
        },

        save: () => set({ lastSaved: Date.now() }),

        // --- Undo/Redo ---

        undo: () => {
          const { past, _syncVersion } = get();
          if (past.length === 0) return;

          const current = captureState();
          const previous = past[past.length - 1];

          set({
            nodes: previous.nodes,
            edges: previous.edges,
            past: past.slice(0, -1),
            future: [current, ...get().future].slice(0, MAX_HISTORY),
            lastSaved: Date.now(),
            _syncVersion: _syncVersion + 1,
          });
        },

        redo: () => {
          const { future, _syncVersion } = get();
          if (future.length === 0) return;

          const current = captureState();
          const next = future[0];

          set({
            nodes: next.nodes,
            edges: next.edges,
            past: [...get().past, current].slice(-MAX_HISTORY),
            future: future.slice(1),
            lastSaved: Date.now(),
            _syncVersion: _syncVersion + 1,
          });
        },

        canUndo: () => get().past.length > 0,
        canRedo: () => get().future.length > 0,

        // --- Snapshots nommes ---

        saveSnapshot: (name?: string) => {
          const snapshot = captureState();
          snapshot.name = name || '';
          set((state) => ({
            snapshots: [...state.snapshots, snapshot],
          }));
        },

        getSnapshots: () => get().snapshots,

        restoreSnapshot: (id: string) => {
          const snapshot = get().snapshots.find((s) => s.id === id);
          if (!snapshot) return;

          pushHistory();
          set({
            nodes: structuredClone(snapshot.nodes),
            edges: structuredClone(snapshot.edges),
            lastSaved: Date.now(),
            _syncVersion: get()._syncVersion + 1,
          });
        },

        deleteSnapshot: (id: string) => {
          set((state) => ({
            snapshots: state.snapshots.filter((s) => s.id !== id),
          }));
        },
      };
    },
    {
      name: 'architecture-simulator-storage',
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          // v1 → v2: ajout snapshots
          state.snapshots = state.snapshots || [];
        }
        return state as unknown as ArchitectureState;
      },
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        lastSaved: state.lastSaved,
        snapshots: state.snapshots,
        // past et future ne sont PAS persistes
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            // Quota exceeded — clear old data and retry once
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
              console.warn('[architecture-store] localStorage quota exceeded, clearing old data');
              localStorage.removeItem(name);
              try {
                localStorage.setItem(name, JSON.stringify(value));
              } catch {
                console.error('[architecture-store] Failed to save after clearing');
              }
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

/**
 * Exporte l'architecture courante au format JSON.
 * @returns Chaine JSON contenant les noeuds, aretes et timestamp d'export.
 */
export function exportArchitecture(): string {
  const { nodes, edges } = useArchitectureStore.getState();
  return JSON.stringify({ nodes, edges, exportedAt: Date.now() }, null, 2);
}

/**
 * Importe une architecture depuis une chaine JSON.
 * @param json - JSON contenant les proprietes nodes et edges.
 * @returns true si l'import a reussi, false sinon.
 */
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
