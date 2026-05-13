import type { NodeType } from '@/types/graph';

/**
 * Type de composant en cours de drag depuis le ComponentsPanel.
 *
 * Why: pendant un `dragover` HTML5, `dataTransfer.getData()` renvoie une string
 * vide (sécurité navigateur). On ne peut donc pas lire le type pour calculer
 * un feedback visuel (highlight container, snap, etc.). Cette state partagée
 * synchrone résout le problème — un seul drag peut être actif à la fois.
 */
let currentDraggedComponentType: NodeType | null = null;

export function setDraggedComponentType(type: NodeType | null): void {
  currentDraggedComponentType = type;
}

export function getDraggedComponentType(): NodeType | null {
  return currentDraggedComponentType;
}

export function clearDraggedComponentType(): void {
  currentDraggedComponentType = null;
}
