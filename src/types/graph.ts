import type { ComponentType } from './index';

// ============================================
// Renderer-agnostic graph types
// ============================================

/**
 * Type d'un noeud du graphe.
 * Couvre :
 *  - Les 21 types simulateur natifs (`ComponentType`).
 *  - N'importe quel type plugin enregistré via `PluginNodeDefinition` (ex: `c4-person`, `c4-component`).
 *
 * Le second cas est représenté par `string` ; les sous-systèmes (NodeRenderer, drop handler,
 * node-defaults) consultent `pluginRegistry` en fallback pour les types non listés dans `ComponentType`.
 */
export type NodeType = ComponentType | (string & {});

/**
 * Metadonnees documentaires d'un noeud (transverses, hors logique simulation).
 *
 * Why: les utilisateurs veulent annoter leur architecture (notes de design, propriétaires,
 * dernière revue d'archi) sans polluer le `data` qui pilote la simulation. Regrouper ces
 * champs sous `metadata` evite de melanger documentation et configuration runtime — un
 * `notes` au top-level de `GraphNode` aurait dérivé en clé "magique" que les handlers
 * devraient ignorer un par un.
 *
 * Tous les champs sont optionnels et stockes en `undefined` quand vides (clean serialization
 * YAML/JSON, pas de strings vides qui polluent les diffs).
 */
export interface NodeMetadata {
  /** Notes libres en markdown/texte plain. Affichage textarea dans le Properties Panel. */
  notes?: string;
  /** Tags libres (ex: 'critique', 'PCI', 'legacy'). Stockes normalises (trim, no empty). */
  tags?: string[];
  /** Date ISO (YYYY-MM-DD) de la derniere revue d'architecture. */
  lastReviewed?: string;
  /** Proprietaire du composant — equipe et/ou personne nominee. */
  owner?: {
    team?: string;
    individual?: string;
  };
}

/**
 * Noeud de graphe independant du renderer (React Flow, PixiJS, etc.).
 * Contient uniquement les champs utilises par l'engine, les handlers et la persistence.
 */
export interface GraphNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  parentId?: string;
  width?: number;
  height?: number;
  /**
   * Annotations transverses (notes, tags, propriétaire, dernière revue).
   * Distinct de `data` (qui pilote la simulation) — `metadata` est purement documentaire
   * et ignoré par tous les handlers / l'engine.
   */
  metadata?: NodeMetadata;
}

/**
 * Arete de graphe independante du renderer.
 * Contient uniquement les champs utilises par l'engine et la persistence.
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: Record<string, unknown>;
}
