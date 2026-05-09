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
