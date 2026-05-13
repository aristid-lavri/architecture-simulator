/**
 * Grid snapping helper (A3.2).
 *
 * Why: positions libres au pixel donnent des diagrammes désalignés et
 * amateuristes. Un snap à 20px aligne nodes & containers — mais le
 * raccourci Shift permet de désactiver le snap pour le placement fin.
 */
export const GRID_SIZE = 20;

export function snapToGrid(
  pos: { x: number; y: number },
  enabled: boolean,
  bypass: boolean = false,
): { x: number; y: number } {
  if (!enabled || bypass) return pos;
  return {
    x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
  };
}

export function snapValue(value: number, enabled: boolean, bypass: boolean = false): number {
  if (!enabled || bypass) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}
