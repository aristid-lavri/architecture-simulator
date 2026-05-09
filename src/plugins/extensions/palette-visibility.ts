import type { ProjectKindMeta } from './project-kind';

/**
 * Contexte fourni aux filtres de visibilité de la palette de composants.
 * Permet aux plugins de masquer des catégories ou items selon le kind de projet,
 * un mode UI actif (ex: niveau C4), etc.
 */
export interface PaletteVisibilityContext {
  projectMeta: ProjectKindMeta;
}

/**
 * Catégorie de la palette telle que vue par un filtre.
 */
export interface PaletteCategoryDescriptor {
  key: string;
  label: string;
}

/**
 * Item de la palette tel que vu par un filtre.
 */
export interface PaletteItemDescriptor {
  type: string;
  category: string;
}

/**
 * Filtre de visibilité d'une catégorie de palette.
 * Une catégorie est rendue si TOUS les filtres enregistrés retournent true.
 * Un registre vide = tout visible (comportement par défaut).
 */
export type PaletteCategoryFilter = (
  category: PaletteCategoryDescriptor,
  context: PaletteVisibilityContext,
) => boolean;

/**
 * Filtre de visibilité d'un item de palette.
 */
export type PaletteItemFilter = (
  item: PaletteItemDescriptor,
  context: PaletteVisibilityContext,
) => boolean;

interface CategoryFilterEntry {
  id: string;
  filter: PaletteCategoryFilter;
}

interface ItemFilterEntry {
  id: string;
  filter: PaletteItemFilter;
}

type PaletteVisibilityListener = () => void;

class PaletteVisibilityRegistryImpl {
  private categoryFilters: Map<string, CategoryFilterEntry> = new Map();
  private itemFilters: Map<string, ItemFilterEntry> = new Map();
  private listeners: Set<PaletteVisibilityListener> = new Set();

  registerCategoryFilter(id: string, filter: PaletteCategoryFilter): void {
    this.categoryFilters.set(id, { id, filter });
    this.notify();
  }

  registerItemFilter(id: string, filter: PaletteItemFilter): void {
    this.itemFilters.set(id, { id, filter });
    this.notify();
  }

  unregister(id: string): void {
    let changed = false;
    if (this.categoryFilters.delete(id)) changed = true;
    if (this.itemFilters.delete(id)) changed = true;
    if (changed) this.notify();
  }

  shouldShowCategory(
    category: PaletteCategoryDescriptor,
    context: PaletteVisibilityContext,
  ): boolean {
    if (this.categoryFilters.size === 0) return true;
    for (const { filter } of this.categoryFilters.values()) {
      if (!filter(category, context)) return false;
    }
    return true;
  }

  shouldShowItem(
    item: PaletteItemDescriptor,
    context: PaletteVisibilityContext,
  ): boolean {
    if (this.itemFilters.size === 0) return true;
    for (const { filter } of this.itemFilters.values()) {
      if (!filter(item, context)) return false;
    }
    return true;
  }

  hasFilters(): boolean {
    return this.categoryFilters.size > 0 || this.itemFilters.size > 0;
  }

  subscribe(listener: PaletteVisibilityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifie manuellement les abonnés. Utile quand un plugin sait qu'un changement
   * d'état externe (ex: niveau C4 actif) doit re-déclencher les filtres,
   * sans qu'aucun (un)register n'ait été effectué.
   */
  notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const paletteVisibilityRegistry = new PaletteVisibilityRegistryImpl();
