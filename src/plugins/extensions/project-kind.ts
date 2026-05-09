import type { ReactNode } from 'react';

/**
 * Métadonnées d'un projet, extensibles par les plugins.
 * Le champ `kind` identifie le type de projet (ex: 'free', autre via plugin).
 * Les plugins peuvent ajouter des champs supplémentaires (typés via leur propre extension).
 */
export interface ProjectKindMeta {
  /** Identifiant du type de projet (doit correspondre à un ProjectKindDefinition enregistré). */
  kind: string;
  /** Champs additionnels apportés par les plugins (ex: niveau actif, drill-down...). */
  [key: string]: unknown;
}

/**
 * Définition d'un type de projet enregistré par un plugin.
 * Permet à un plugin d'apparaître comme alternative dans le sélecteur "Nouveau projet".
 */
export interface ProjectKindDefinition {
  /** Identifiant unique du kind (ex: 'free' pour le projet libre par défaut, ou un id apporté par un plugin). */
  id: string;
  /** Label affiché à l'utilisateur (clé i18n ou chaîne brute). */
  label: string;
  /** Description courte affichée dans le sélecteur. */
  description?: string;
  /** Icône (composant React, généralement Lucide). */
  icon?: ReactNode;
  /**
   * Indique si ce type nécessite une licence (gating UI).
   * Le gate effectif reste géré par le plugin (ex: <EnterpriseGate>).
   */
  requiresLicense?: boolean;
  /** Métadonnées par défaut posées au moment de la création d'un projet de ce kind. */
  defaultMeta?: Partial<ProjectKindMeta>;
  /** Ordre d'affichage dans le sélecteur (asc). */
  sortOrder?: number;
  /**
   * Si vrai, masque la barre d'onglets de diagrammes pour ce kind de projet.
   * Utile pour les kinds qui apportent leur propre navigation par niveau (ex: C4).
   */
  hideDiagramTabs?: boolean;
}

type ProjectKindListener = () => void;

/**
 * Registre des types de projets disponibles.
 * Le CE enregistre 'free' par défaut. Les plugins (ex: EE) en ajoutent d'autres.
 */
class ProjectKindRegistryImpl {
  private kinds: Map<string, ProjectKindDefinition> = new Map();
  private listeners: Set<ProjectKindListener> = new Set();
  /** Snapshot mis en cache pour `useSyncExternalStore` (référence stable entre mutations). */
  private cachedList: ProjectKindDefinition[] | null = null;

  register(definition: ProjectKindDefinition): void {
    if (this.kinds.has(definition.id)) {
      console.warn(`[ProjectKindRegistry] Kind "${definition.id}" already registered, overwriting.`);
    }
    this.kinds.set(definition.id, definition);
    this.cachedList = null;
    this.notify();
  }

  unregister(id: string): void {
    if (this.kinds.delete(id)) {
      this.cachedList = null;
      this.notify();
    }
  }

  get(id: string): ProjectKindDefinition | undefined {
    return this.kinds.get(id);
  }

  has(id: string): boolean {
    return this.kinds.has(id);
  }

  list(): ProjectKindDefinition[] {
    if (this.cachedList === null) {
      const all = Array.from(this.kinds.values());
      this.cachedList = all.sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
    }
    return this.cachedList;
  }

  subscribe(listener: ProjectKindListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const projectKindRegistry = new ProjectKindRegistryImpl();

/** Identifiant du kind par défaut (livré avec le CE). */
export const DEFAULT_PROJECT_KIND = 'free';

// Enregistrement du kind par défaut "free" — tous les projets existants en relèvent.
projectKindRegistry.register({
  id: DEFAULT_PROJECT_KIND,
  label: 'project.kind.free.label',
  description: 'project.kind.free.description',
  sortOrder: 0,
});

/** Crée un ProjectKindMeta minimal pour un kind donné, en mergeant les defaults du registry. */
export function createProjectMeta(kindId: string = DEFAULT_PROJECT_KIND): ProjectKindMeta {
  const def = projectKindRegistry.get(kindId);
  return { kind: kindId, ...(def?.defaultMeta ?? {}) };
}
