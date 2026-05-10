import type { GraphNode } from '@/types/graph';
import type { ProjectKindMeta } from './project-kind';
import type { ReactNode } from 'react';

/**
 * Item de menu contextuel injecté par un plugin pour un node donné. Rendu en dessous
 * des items chaos natifs (séparé par un divider).
 */
export interface NodeContextMenuItem {
  /** Identifiant unique de l'item (sert à l'unregister et à la key React). */
  id: string;
  /** Libellé affiché. */
  label: string;
  /** Icône React (typiquement lucide-react), rendue à gauche du label. */
  icon: ReactNode;
  /** Callback exécuté au clic. Le menu se ferme automatiquement après. */
  onClick: () => void;
  /** Classes Tailwind appliquées au bouton (couleurs, hover). */
  className?: string;
}

/**
 * Provider qui retourne les items de menu contextuel pour un node donné.
 * Retourner `[]` pour ne pas contribuer au menu pour ce node.
 */
export type NodeContextMenuProvider = (
  node: GraphNode,
  context: { projectMeta: ProjectKindMeta },
) => NodeContextMenuItem[];

interface ProviderEntry {
  id: string;
  provider: NodeContextMenuProvider;
  /** Priorité (asc) : items des providers à sortOrder bas apparaissent en premier. */
  sortOrder?: number;
}

class NodeContextMenuRegistryImpl {
  private providers: Map<string, ProviderEntry> = new Map();

  register(id: string, provider: NodeContextMenuProvider, sortOrder?: number): void {
    this.providers.set(id, { id, provider, sortOrder });
  }

  unregister(id: string): void {
    this.providers.delete(id);
  }

  /**
   * Collecte les items de tous les providers enregistrés, dans l'ordre des sortOrder asc.
   * Retourne un tableau vide si aucun provider ou si aucun ne contribue.
   */
  resolveItems(node: GraphNode, projectMeta: ProjectKindMeta): NodeContextMenuItem[] {
    if (this.providers.size === 0) return [];
    const sorted = Array.from(this.providers.values()).sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
    );
    const items: NodeContextMenuItem[] = [];
    for (const { provider } of sorted) {
      items.push(...provider(node, { projectMeta }));
    }
    return items;
  }

  hasProviders(): boolean {
    return this.providers.size > 0;
  }
}

export const nodeContextMenuRegistry = new NodeContextMenuRegistryImpl();
