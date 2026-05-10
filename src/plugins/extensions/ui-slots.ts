import type { ComponentType } from 'react';
import type { ProjectKindMeta } from './project-kind';

/**
 * Identifiants des slots UI nommés où un plugin peut monter du contenu.
 * Le CE instrumente ces points pour permettre l'extension sans modification.
 */
export type UISlotId =
  | 'under-header'         // Bandeau juste sous le header (barre d'onglets, breadcrumb...)
  | 'header-extra'         // Boutons/widgets additionnels dans le header
  | 'palette-extra'        // Section additionnelle dans le panneau des composants
  | 'properties-extra'     // Section additionnelle dans le panneau des propriétés
  | 'edge-properties-extra' // Panneau additionnel pour edges sélectionnés
  | 'breadcrumb'           // Slot pour breadcrumb spécifique au projet
  | 'cascade-dialog-provider' // Hôte invisible pour les dialogs de cascade-delete
  | 'project-kind-tile'    // Tuile dans le sélecteur "Nouveau projet"
  | 'canvas-overlay'       // Calque DOM positionné absolument au-dessus du canvas
  | 'snapshots-popover';   // Bas du DropdownMenu snapshots du Header (extras outils)

/**
 * Props passées aux composants montés dans un slot.
 * Les plugins peuvent ignorer ces props si non pertinentes.
 */
export interface UISlotProps {
  projectMeta?: ProjectKindMeta;
  /** Données contextuelles spécifiques au slot (ex: nodeId pour properties-extra). */
  context?: Record<string, unknown>;
}

/**
 * Une entrée dans le registre : un composant à monter dans un slot.
 */
export interface UISlotEntry {
  /** Identifiant unique de l'entrée (sert à l'unregister et à la key React). */
  id: string;
  /** Slot dans lequel monter le composant. */
  slotId: UISlotId;
  /** Composant React à rendre. Reçoit les UISlotProps. */
  component: ComponentType<UISlotProps>;
  /** Ordre d'affichage si plusieurs entrées partagent le slot (asc). */
  sortOrder?: number;
  /**
   * Filtre optionnel : le composant n'est rendu que si ce prédicat retourne true.
   * Utile pour "n'afficher cet onglet que pour les projets de kind X".
   */
  shouldRender?: (props: UISlotProps) => boolean;
}

type UISlotListener = () => void;

class UISlotRegistryImpl {
  private entries: Map<string, UISlotEntry> = new Map();
  private listeners: Set<UISlotListener> = new Set();

  register(entry: UISlotEntry): void {
    if (this.entries.has(entry.id)) {
      console.warn(`[UISlotRegistry] Entry "${entry.id}" already registered, overwriting.`);
    }
    this.entries.set(entry.id, entry);
    this.notify();
  }

  unregister(id: string): void {
    if (this.entries.delete(id)) {
      this.notify();
    }
  }

  /** Retourne les entrées d'un slot, triées par sortOrder. */
  getForSlot(slotId: UISlotId): UISlotEntry[] {
    const result: UISlotEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.slotId === slotId) result.push(entry);
    }
    return result.sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
  }

  list(): UISlotEntry[] {
    return Array.from(this.entries.values());
  }

  subscribe(listener: UISlotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const uiSlotRegistry = new UISlotRegistryImpl();
