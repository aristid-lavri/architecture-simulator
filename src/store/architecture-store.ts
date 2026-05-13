import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GraphNode, GraphEdge, ArchitectureSnapshot } from '@/types';
import {
  createProjectMeta,
  DEFAULT_PROJECT_KIND,
  deleteHookRegistry,
  type ProjectKindMeta,
} from '@/plugins/extensions';
import { applyCustomRulesPack } from '@/lib/rules-engine/custom';
import { useAdrStore } from './adr-store';

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

  /**
   * Métadonnées extensibles du projet courant.
   * Le CE pose `kind: 'free'` par défaut. Les plugins peuvent ajouter des champs
   * (ex: niveau d'abstraction actif, drill-down). Persiste.
   */
  projectMeta: ProjectKindMeta;

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
  /** Met à jour le bloc `metadata` (annotations + ownership) d'un noeud. Conserve l'historique. */
  updateNodeMetadata: (nodeId: string, metadata: GraphNode['metadata']) => void;
  /**
   * Supprime un nœud et tous ses descendants.
   * @param nodeId ID du nœud à supprimer
   * @param options.bypassHooks Si vrai, ne consulte pas DeleteHookRegistry
   *   (utilisé par les plugins après confirmation utilisateur).
   */
  removeNode: (nodeId: string, options?: { bypassHooks?: boolean }) => void;
  reparentNode: (nodeId: string, newParentId: string | null) => void;
  addNode: (node: GraphNode) => void;
  addEdge: (edge: GraphEdge) => void;
  updateEdge: (edgeId: string, data: Partial<GraphEdge['data']>) => void;
  /**
   * Supprime un edge.
   * @param edgeId ID de l'edge à supprimer.
   * @param options.bypassHooks Si vrai, ne consulte pas DeleteHookRegistry (utilisé par
   *   les plugins quand ils confirment une suppression après un dialog).
   */
  removeEdge: (edgeId: string, options?: { bypassHooks?: boolean }) => void;
  clear: () => void;
  save: () => void;

  /** Met à jour le ProjectMeta (kind + champs additionnels des plugins). */
  setProjectMeta: (meta: ProjectKindMeta | ((prev: ProjectKindMeta) => ProjectKindMeta)) => void;

  /**
   * Met à jour le DSL custom rules du projet (A6.2). Applique immédiatement le pack
   * `project-custom` dans le ruleRegistry et persiste la string dans `projectMeta.customRulesYaml`.
   * Vide ou whitespace ⇒ retire le pack.
   */
  setCustomRulesYaml: (yaml: string) => void;

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

  // Chargement complet d'un diagramme (sans historique)
  loadDiagramState: (
    nodes: GraphNode[],
    edges: GraphEdge[],
    snapshots: ArchitectureSnapshot[],
    projectMeta?: ProjectKindMeta,
  ) => void;
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
        projectMeta: createProjectMeta(DEFAULT_PROJECT_KIND),
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

        updateNodeMetadata: (nodeId, metadata) => {
          pushHistory();
          set((state) => ({
            nodes: state.nodes.map((node) =>
              node.id === nodeId ? { ...node, metadata } : node,
            ),
            lastSaved: Date.now(),
          }));
        },

        removeNode: (nodeId, options) => {
          // Consultation des hooks de plugins (DeleteHookRegistry).
          // Un plugin peut intercepter pour afficher un dialog de confirmation.
          // Le plugin rappellera removeNode avec bypassHooks=true s'il confirme.
          if (!options?.bypassHooks && deleteHookRegistry.hasHooks()) {
            const state = get();
            const node = state.nodes.find((n) => n.id === nodeId);
            if (node) {
              const decision = deleteHookRegistry.consult({
                node,
                allNodes: state.nodes,
                allEdges: state.edges,
                projectMeta: state.projectMeta,
              });
              if (decision.kind === 'intercept') {
                // Le plugin prend la suite (typiquement via dialog).
                return;
              }
            }
          }

          pushHistory();
          set((state) => {
            // Suppression en cascade : trouver tous les descendants
            const descendants = findAllDescendants(nodeId, state.nodes);
            const idsToRemove = new Set([nodeId, ...descendants]);
            // ADR cleanup (A7.2) — retire les liens vers tout nœud/edge supprimé
            const adrStore = useAdrStore.getState();
            const removedEdgeIds = state.edges
              .filter((e) => idsToRemove.has(e.source) || idsToRemove.has(e.target))
              .map((e) => e.id);
            for (const id of idsToRemove) adrStore.onGraphElementDeleted('node', id);
            for (const eid of removedEdgeIds) adrStore.onGraphElementDeleted('edge', eid);
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

        removeEdge: (edgeId, options) => {
          // Consultation symétrique des edge hooks (cascade de raffinement côté EE C4 par ex.).
          if (!options?.bypassHooks && deleteHookRegistry.hasEdgeHooks()) {
            const state = get();
            const edge = state.edges.find((e) => e.id === edgeId);
            if (edge) {
              const decision = deleteHookRegistry.consultEdge({
                edge,
                allNodes: state.nodes,
                allEdges: state.edges,
                projectMeta: state.projectMeta,
              });
              if (decision.kind === 'intercept') {
                return;
              }
            }
          }

          pushHistory();
          // ADR cleanup (A7.2)
          useAdrStore.getState().onGraphElementDeleted('edge', edgeId);
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

        setProjectMeta: (meta) => {
          set((state) => ({
            projectMeta: typeof meta === 'function' ? meta(state.projectMeta) : meta,
            lastSaved: Date.now(),
          }));
        },

        setCustomRulesYaml: (yaml: string) => {
          // applyCustomRulesPack handles the empty-string case (clears the pack).
          applyCustomRulesPack(yaml);
          set((state) => ({
            projectMeta: {
              ...state.projectMeta,
              customRulesYaml: yaml.trim().length > 0 ? yaml : undefined,
            },
            lastSaved: Date.now(),
          }));
        },

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

        loadDiagramState: (
          nodes: GraphNode[],
          edges: GraphEdge[],
          snapshots: ArchitectureSnapshot[],
          projectMeta?: ProjectKindMeta,
        ) => {
          set({
            nodes,
            edges,
            snapshots,
            ...(projectMeta ? { projectMeta } : {}),
            past: [],
            future: [],
            lastSaved: Date.now(),
            _syncVersion: get()._syncVersion + 1,
          });
        },
      };
    },
    {
      name: 'architecture-simulator-storage',
      version: 3,
      // A6.2 — réapplique le pack `project-custom` après rehydrate du store, pour que le
      // ruleRegistry soit en sync avec la string persistée dans `projectMeta.customRulesYaml`.
      onRehydrateStorage: () => (state) => {
        const yaml = state?.projectMeta?.customRulesYaml;
        if (typeof yaml === 'string' && yaml.trim().length > 0) {
          applyCustomRulesPack(yaml);
        }
      },
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          // v1 → v2: ajout snapshots
          state.snapshots = state.snapshots || [];
        }
        if (version < 3) {
          // v2 → v3: ajout projectMeta
          state.projectMeta = state.projectMeta || createProjectMeta(DEFAULT_PROJECT_KIND);
        }
        return state as unknown as ArchitectureState;
      },
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        lastSaved: state.lastSaved,
        snapshots: state.snapshots,
        projectMeta: state.projectMeta,
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
