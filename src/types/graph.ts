import type { ComponentType } from './index';

// ============================================
// Renderer-agnostic graph types
// ============================================

/**
 * Noeud de graphe independant du renderer (React Flow, PixiJS, etc.).
 * Contient uniquement les champs utilises par l'engine, les handlers et la persistence.
 */
export interface GraphNode {
  id: string;
  type: ComponentType;
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
