import { Container, Graphics } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { GRID_MINOR_GAP, GRID_MAJOR_GAP, canvasTheme } from './constants';

/**
 * Renders an infinite-looking grid that follows the viewport.
 * Uses two Graphics layers: minor (thin) and major (thick).
 * Colors adapt to the active canvas theme.
 */
export class GridRenderer {
  private minor: Graphics;
  private major: Graphics;

  constructor(private layer: Container) {
    this.minor = new Graphics();
    this.major = new Graphics();
    layer.addChild(this.minor, this.major);
  }

  render(viewport: Viewport): void {
    const bounds = viewport.getVisibleBounds();
    const scale = viewport.scale.x;
    const theme = canvasTheme();

    // Only draw minor grid if zoomed in enough
    this.minor.clear();
    if (scale > 0.3) {
      const startX = Math.floor(bounds.x / GRID_MINOR_GAP) * GRID_MINOR_GAP;
      const startY = Math.floor(bounds.y / GRID_MINOR_GAP) * GRID_MINOR_GAP;
      const endX = bounds.x + bounds.width;
      const endY = bounds.y + bounds.height;

      this.minor.setStrokeStyle({ width: 1 / scale, color: theme.gridMinorColor, alpha: theme.gridMinorAlpha });
      for (let x = startX; x <= endX; x += GRID_MINOR_GAP) {
        this.minor.moveTo(x, bounds.y);
        this.minor.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += GRID_MINOR_GAP) {
        this.minor.moveTo(bounds.x, y);
        this.minor.lineTo(endX, y);
      }
      this.minor.stroke();
    }

    // Major grid always visible
    this.major.clear();
    const startX = Math.floor(bounds.x / GRID_MAJOR_GAP) * GRID_MAJOR_GAP;
    const startY = Math.floor(bounds.y / GRID_MAJOR_GAP) * GRID_MAJOR_GAP;
    const endX = bounds.x + bounds.width;
    const endY = bounds.y + bounds.height;

    this.major.setStrokeStyle({ width: 1 / scale, color: theme.gridMajorColor, alpha: theme.gridMajorAlpha });
    for (let x = startX; x <= endX; x += GRID_MAJOR_GAP) {
      this.major.moveTo(x, bounds.y);
      this.major.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += GRID_MAJOR_GAP) {
      this.major.moveTo(bounds.x, y);
      this.major.lineTo(endX, y);
    }
    this.major.stroke();
  }

  destroy(): void {
    this.minor.destroy();
    this.major.destroy();
  }
}
