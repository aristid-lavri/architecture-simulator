import { create } from 'zustand';
import type { Project, ProjectMeta, Diagram, GraphNode, GraphEdge, ArchitectureSnapshot } from '@/types';
import { useArchitectureStore } from './architecture-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyDiagram(name: string): Diagram {
  const now = Date.now();
  return {
    id: generateId('diag'),
    name,
    nodes: [],
    edges: [],
    snapshots: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const KEYS = {
  index: 'arch-sim-projects-index',
  activeProject: 'arch-sim-active-project',
  project: (id: string) => `arch-sim-project-${id}`,
  legacyStore: 'architecture-simulator-storage',
} as const;

function safeSetItem(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[project-store] localStorage quota exceeded for', key);
      localStorage.removeItem(key);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        console.error('[project-store] Failed to save after clearing', key);
      }
    }
  }
}

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function loadProjectsIndex(): ProjectMeta[] {
  return loadJSON<ProjectMeta[]>(KEYS.index) ?? [];
}

function saveProjectsIndex(meta: ProjectMeta[]): void {
  safeSetItem(KEYS.index, meta);
}

function loadProject(id: string): Project | null {
  return loadJSON<Project>(KEYS.project(id));
}

function saveProject(project: Project): void {
  safeSetItem(KEYS.project(project.id), project);
}

function deleteProjectStorage(id: string): void {
  localStorage.removeItem(KEYS.project(id));
}

function buildMeta(project: Project): ProjectMeta {
  return {
    id: project.id,
    name: project.name,
    diagramCount: project.diagrams.length,
    updatedAt: project.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ProjectStoreState {
  projectsMeta: ProjectMeta[];
  activeProjectId: string | null;
  activeDiagramId: string | null;
  initialized: boolean;

  // Init
  initialize: () => void;

  // Project CRUD
  createProject: (name: string) => string;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => string;

  // Diagram CRUD
  createDiagram: (name: string) => string;
  renameDiagram: (diagramId: string, name: string) => void;
  deleteDiagram: (diagramId: string) => void;
  duplicateDiagram: (diagramId: string) => string;

  // Navigation
  switchProject: (projectId: string) => void;
  switchDiagram: (diagramId: string) => void;

  // Persistence
  saveCurrentDiagram: () => void;

  // Helpers
  getActiveDiagrams: () => Diagram[];
  getActiveProjectName: () => string;
}

export const useProjectStore = create<ProjectStoreState>()((set, get) => {
  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /** Read current working copy from architecture-store into the active diagram slot. */
  function flushToProject(): void {
    const { activeProjectId, activeDiagramId } = get();
    if (!activeProjectId || !activeDiagramId) return;

    const project = loadProject(activeProjectId);
    if (!project) return;

    const archState = useArchitectureStore.getState();
    const now = Date.now();

    project.diagrams = project.diagrams.map((d) =>
      d.id === activeDiagramId
        ? {
            ...d,
            nodes: structuredClone(archState.nodes),
            edges: structuredClone(archState.edges),
            snapshots: structuredClone(archState.snapshots),
            updatedAt: now,
          }
        : d
    );
    project.updatedAt = now;
    saveProject(project);

    // Update index meta
    const meta = get().projectsMeta.map((m) =>
      m.id === activeProjectId ? buildMeta(project) : m
    );
    saveProjectsIndex(meta);
    set({ projectsMeta: meta });
  }

  /** Load a diagram's data into the architecture-store working copy. */
  function loadDiagramIntoStore(diagram: Diagram): void {
    useArchitectureStore.getState().loadDiagramState(
      structuredClone(diagram.nodes),
      structuredClone(diagram.edges),
      structuredClone(diagram.snapshots)
    );
  }

  // -----------------------------------------------------------------------
  // Store definition
  // -----------------------------------------------------------------------

  return {
    projectsMeta: [],
    activeProjectId: null,
    activeDiagramId: null,
    initialized: false,

    initialize: () => {
      if (get().initialized) return;

      let meta = loadProjectsIndex();

      if (meta.length === 0) {
        // Migration: read legacy architecture-store data
        const legacy = loadJSON<{ state?: { nodes?: GraphNode[]; edges?: GraphEdge[]; snapshots?: ArchitectureSnapshot[] } }>(KEYS.legacyStore);

        const now = Date.now();
        const diagram: Diagram = {
          id: generateId('diag'),
          name: 'Diagramme 1',
          nodes: legacy?.state?.nodes ?? [],
          edges: legacy?.state?.edges ?? [],
          snapshots: legacy?.state?.snapshots ?? [],
          createdAt: now,
          updatedAt: now,
        };

        const project: Project = {
          id: generateId('proj'),
          name: 'Mon Projet',
          activeDiagramId: diagram.id,
          diagrams: [diagram],
          createdAt: now,
          updatedAt: now,
        };

        saveProject(project);
        meta = [buildMeta(project)];
        saveProjectsIndex(meta);
        localStorage.setItem(KEYS.activeProject, project.id);
      }

      const activeProjectId = localStorage.getItem(KEYS.activeProject) ?? meta[0]?.id ?? null;
      let activeDiagramId: string | null = null;

      if (activeProjectId) {
        const project = loadProject(activeProjectId);
        if (project) {
          activeDiagramId = project.activeDiagramId ?? project.diagrams[0]?.id ?? null;
          const diagram = project.diagrams.find((d) => d.id === activeDiagramId);
          if (diagram) {
            loadDiagramIntoStore(diagram);
          }
        }
      }

      set({ projectsMeta: meta, activeProjectId, activeDiagramId, initialized: true });
    },

    // -- Project CRUD --

    createProject: (name) => {
      flushToProject();

      const diagram = createEmptyDiagram('Diagramme 1');
      const now = Date.now();
      const project: Project = {
        id: generateId('proj'),
        name,
        activeDiagramId: diagram.id,
        diagrams: [diagram],
        createdAt: now,
        updatedAt: now,
      };

      saveProject(project);
      const meta = [...get().projectsMeta, buildMeta(project)];
      saveProjectsIndex(meta);
      localStorage.setItem(KEYS.activeProject, project.id);

      loadDiagramIntoStore(diagram);

      set({
        projectsMeta: meta,
        activeProjectId: project.id,
        activeDiagramId: diagram.id,
      });

      return project.id;
    },

    renameProject: (id, name) => {
      const project = loadProject(id);
      if (!project) return;

      project.name = name;
      project.updatedAt = Date.now();
      saveProject(project);

      const meta = get().projectsMeta.map((m) =>
        m.id === id ? { ...m, name, updatedAt: project.updatedAt } : m
      );
      saveProjectsIndex(meta);
      set({ projectsMeta: meta });
    },

    deleteProject: (id) => {
      const { projectsMeta, activeProjectId } = get();
      if (projectsMeta.length <= 1) return; // cannot delete last project

      deleteProjectStorage(id);
      const meta = projectsMeta.filter((m) => m.id !== id);
      saveProjectsIndex(meta);

      if (activeProjectId === id) {
        // Switch to the first remaining project
        const nextId = meta[0].id;
        const nextProject = loadProject(nextId);
        if (nextProject) {
          const diagramId = nextProject.activeDiagramId ?? nextProject.diagrams[0]?.id;
          const diagram = nextProject.diagrams.find((d) => d.id === diagramId);
          if (diagram) loadDiagramIntoStore(diagram);
          localStorage.setItem(KEYS.activeProject, nextId);
          set({ projectsMeta: meta, activeProjectId: nextId, activeDiagramId: diagramId ?? null });
        } else {
          set({ projectsMeta: meta, activeProjectId: null, activeDiagramId: null });
        }
      } else {
        set({ projectsMeta: meta });
      }
    },

    duplicateProject: (id) => {
      flushToProject();

      const original = loadProject(id);
      if (!original) return id;

      const now = Date.now();
      const newDiagrams = original.diagrams.map((d) => ({
        ...structuredClone(d),
        id: generateId('diag'),
        createdAt: now,
        updatedAt: now,
      }));

      const project: Project = {
        id: generateId('proj'),
        name: `${original.name} (copie)`,
        activeDiagramId: newDiagrams[0]?.id ?? '',
        diagrams: newDiagrams,
        createdAt: now,
        updatedAt: now,
      };

      saveProject(project);
      const meta = [...get().projectsMeta, buildMeta(project)];
      saveProjectsIndex(meta);
      set({ projectsMeta: meta });

      return project.id;
    },

    // -- Diagram CRUD --

    createDiagram: (name) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return '';

      flushToProject();

      const project = loadProject(activeProjectId);
      if (!project) return '';

      const diagram = createEmptyDiagram(name);
      project.diagrams.push(diagram);
      project.activeDiagramId = diagram.id;
      project.updatedAt = Date.now();
      saveProject(project);

      const meta = get().projectsMeta.map((m) =>
        m.id === activeProjectId ? buildMeta(project) : m
      );
      saveProjectsIndex(meta);

      loadDiagramIntoStore(diagram);

      set({ projectsMeta: meta, activeDiagramId: diagram.id });
      return diagram.id;
    },

    renameDiagram: (diagramId, name) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return;

      const project = loadProject(activeProjectId);
      if (!project) return;

      project.diagrams = project.diagrams.map((d) =>
        d.id === diagramId ? { ...d, name, updatedAt: Date.now() } : d
      );
      project.updatedAt = Date.now();
      saveProject(project);

      const meta = get().projectsMeta.map((m) =>
        m.id === activeProjectId ? buildMeta(project) : m
      );
      saveProjectsIndex(meta);
      set({ projectsMeta: meta });
    },

    deleteDiagram: (diagramId) => {
      const { activeProjectId, activeDiagramId } = get();
      if (!activeProjectId) return;

      const project = loadProject(activeProjectId);
      if (!project || project.diagrams.length <= 1) return; // keep at least 1

      project.diagrams = project.diagrams.filter((d) => d.id !== diagramId);
      project.updatedAt = Date.now();

      if (activeDiagramId === diagramId) {
        const next = project.diagrams[0];
        project.activeDiagramId = next.id;
        loadDiagramIntoStore(next);
        saveProject(project);

        const meta = get().projectsMeta.map((m) =>
          m.id === activeProjectId ? buildMeta(project) : m
        );
        saveProjectsIndex(meta);
        set({ projectsMeta: meta, activeDiagramId: next.id });
      } else {
        saveProject(project);
        const meta = get().projectsMeta.map((m) =>
          m.id === activeProjectId ? buildMeta(project) : m
        );
        saveProjectsIndex(meta);
        set({ projectsMeta: meta });
      }
    },

    duplicateDiagram: (diagramId) => {
      const { activeProjectId } = get();
      if (!activeProjectId) return '';

      flushToProject();

      const project = loadProject(activeProjectId);
      if (!project) return '';

      const original = project.diagrams.find((d) => d.id === diagramId);
      if (!original) return '';

      const now = Date.now();
      const copy: Diagram = {
        ...structuredClone(original),
        id: generateId('diag'),
        name: `${original.name} (copie)`,
        createdAt: now,
        updatedAt: now,
      };

      project.diagrams.push(copy);
      project.updatedAt = now;
      saveProject(project);

      const meta = get().projectsMeta.map((m) =>
        m.id === activeProjectId ? buildMeta(project) : m
      );
      saveProjectsIndex(meta);
      set({ projectsMeta: meta });

      return copy.id;
    },

    // -- Navigation --

    switchProject: (projectId) => {
      const { activeProjectId } = get();
      if (projectId === activeProjectId) return;

      flushToProject();

      const project = loadProject(projectId);
      if (!project) return;

      const diagramId = project.activeDiagramId ?? project.diagrams[0]?.id;
      const diagram = project.diagrams.find((d) => d.id === diagramId);
      if (diagram) loadDiagramIntoStore(diagram);

      localStorage.setItem(KEYS.activeProject, projectId);
      set({ activeProjectId: projectId, activeDiagramId: diagramId ?? null });
    },

    switchDiagram: (diagramId) => {
      const { activeProjectId, activeDiagramId } = get();
      if (diagramId === activeDiagramId || !activeProjectId) return;

      flushToProject();

      const project = loadProject(activeProjectId);
      if (!project) return;

      const diagram = project.diagrams.find((d) => d.id === diagramId);
      if (!diagram) return;

      project.activeDiagramId = diagramId;
      saveProject(project);

      loadDiagramIntoStore(diagram);
      set({ activeDiagramId: diagramId });
    },

    // -- Persistence --

    saveCurrentDiagram: () => {
      flushToProject();
    },

    // -- Helpers --

    getActiveDiagrams: () => {
      const { activeProjectId } = get();
      if (!activeProjectId) return [];
      const project = loadProject(activeProjectId);
      return project?.diagrams ?? [];
    },

    getActiveProjectName: () => {
      const { activeProjectId, projectsMeta } = get();
      return projectsMeta.find((m) => m.id === activeProjectId)?.name ?? '';
    },
  };
});

// ---------------------------------------------------------------------------
// Auto-save: debounced sync from architecture-store to active project/diagram
// ---------------------------------------------------------------------------

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

useArchitectureStore.subscribe(() => {
  const { initialized, activeProjectId, activeDiagramId } = useProjectStore.getState();
  if (!initialized || !activeProjectId || !activeDiagramId) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    useProjectStore.getState().saveCurrentDiagram();
  }, 2000);
});
