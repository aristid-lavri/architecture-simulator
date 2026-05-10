/**
 * Registry minimal pour exposer une API d'animation viewport au plugin (reservee a un seul
 * client a la fois — `register` ecrase). Permet a un handler plugin de declencher un
 * zoom-into anime avant de muter le store de drill.
 *
 * L'API est consciemment minimale : seules les operations canvas-agnostic sont exposees.
 * Le client (PixiCanvas) implemente l'animation via pixi-viewport.animate() ; tout l'etat
 * (current zoom, viewport bounds, easing) reste local au CE.
 */
export interface ViewportAnimator {
  /**
   * Anime le viewport pour cadrer les bounds donnes (en world coords). Quand l'animation
   * se termine, la promesse resoud — le caller peut ensuite muter le store.
   *
   * @param bounds rectangle world-coords (x, y, width, height)
   * @param durationMs duree de l'animation. Defaut 350ms.
   */
  animateZoomInto(
    bounds: { x: number; y: number; width: number; height: number },
    durationMs?: number,
  ): Promise<void>;
  /**
   * Anime le viewport pour revenir a un zoom global (fit-world). Symetrique de zoomInto.
   */
  animateZoomOut(durationMs?: number): Promise<void>;
}

class ViewportAnimatorRegistryImpl {
  private current: ViewportAnimator | null = null;

  register(animator: ViewportAnimator): void {
    this.current = animator;
  }

  unregister(animator: ViewportAnimator): void {
    if (this.current === animator) this.current = null;
  }

  get(): ViewportAnimator | null {
    return this.current;
  }
}

export const viewportAnimatorRegistry = new ViewportAnimatorRegistryImpl();
