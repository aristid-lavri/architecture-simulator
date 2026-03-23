import { Container, Graphics, Sprite, Texture, RenderTexture, Rectangle } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { Particle, ParticleType } from '@/types';
import { EdgePathCache } from './EdgePathCache';

const MAX_PARTICLES = 2000;

// Particle visual constants — sized by context
const PARTICLE_SIZES: Record<ParticleType, { w: number; h: number }> = {
  'request':          { w: 14, h: 3 },
  'response-success': { w: 12, h: 2.5 },
  'response-error':   { w: 16, h: 3.5 },  // larger to attract attention
  'token-request':    { w: 10, h: 2 },     // smaller, secondary flow
  'token-response':   { w: 10, h: 2 },
};
const PARTICLE_WIDTH = 16; // max for texture generation
const PARTICLE_HEIGHT = 3.5;

// Colors per particle type — red ONLY for errors
const PARTICLE_COLORS: Record<ParticleType, number> = {
  'request':          0x3b82f6, // blue
  'response-success': 0x4ade80, // bright green
  'response-error':   0xef4444, // red (error = legitimate)
  'token-request':    0xfbbf24, // amber
  'token-response':   0x86efac, // pale green
};

// Glow colors (lighter version for trail effect)
const PARTICLE_GLOW: Record<ParticleType, number> = {
  'request':          0x93c5fd,
  'response-success': 0xbbf7d0,
  'response-error':   0xfca5a5,
  'token-request':    0xfde68a,
  'token-response':   0xbbf7d0,
};

/**
 * GPU-accelerated particle renderer using sprite pooling.
 *
 * Instead of SVG elements triggering React reconciliation (old approach),
 * particles are rendered as pre-allocated sprites repositioned each frame.
 * This is a single draw call for all particles via sprite batching.
 */
export class ParticleRenderer {
  private pool: Sprite[] = [];
  private activeCount = 0;
  private textures: Map<ParticleType, Texture> = new Map();
  private pathCache: EdgePathCache;
  private animFrameId: number | null = null;

  constructor(
    private layer: Container,
    private app: Application,
  ) {
    this.pathCache = new EdgePathCache();
    this.createTextures();
    this.createPool();
  }

  /**
   * Generate streak textures for each particle type.
   * Each texture is a small rounded rectangle with glow.
   */
  private createTextures(): void {
    const types: ParticleType[] = ['request', 'response-success', 'response-error', 'token-request', 'token-response'];

    for (const type of types) {
      const g = new Graphics();

      // Glow (wider, semi-transparent)
      g.roundRect(-2, -2, PARTICLE_WIDTH + 4, PARTICLE_HEIGHT + 4, 3);
      g.fill({ color: PARTICLE_GLOW[type], alpha: 0.3 });

      // Core streak
      g.roundRect(0, 0, PARTICLE_WIDTH, PARTICLE_HEIGHT, 1.5);
      g.fill({ color: PARTICLE_COLORS[type], alpha: 0.9 });

      // Leading bright dot
      g.circle(PARTICLE_WIDTH - 1.5, PARTICLE_HEIGHT / 2, 1.5);
      g.fill({ color: 0xffffff, alpha: 0.8 });

      const texture = this.app.renderer.generateTexture({
        target: g,
        resolution: 2,
      });
      this.textures.set(type, texture);
      g.destroy();
    }
  }

  /**
   * Pre-allocate sprite pool. All sprites start invisible.
   */
  private createPool(): void {
    const defaultTexture = this.textures.get('request')!;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const sprite = new Sprite(defaultTexture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.eventMode = 'none';
      this.layer.addChild(sprite);
      this.pool.push(sprite);
    }
  }

  /**
   * Update the path cache when edges/nodes change.
   */
  rebuildPaths(edges: import('@/types/graph').GraphEdge[], nodes: import('@/types/graph').GraphNode[], routingMode: import('@/store/app-store').EdgeRoutingMode = 'bezier'): void {
    this.pathCache.rebuild(edges, nodes, routingMode);
  }

  /**
   * Start the render loop that reads particles from the store and positions sprites.
   * Runs at display refresh rate via requestAnimationFrame.
   */
  startRenderLoop(getParticles: () => Map<string, Particle>): void {
    this.stopRenderLoop();

    const render = () => {
      this.renderFrame(getParticles());
      this.animFrameId = requestAnimationFrame(render);
    };

    this.animFrameId = requestAnimationFrame(render);
  }

  /**
   * Stop the render loop.
   */
  stopRenderLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Render a single frame: position all active particles along their edge paths.
   */
  private renderFrame(particles: Map<string, Particle>): void {
    let idx = 0;

    for (const particle of particles.values()) {
      if (idx >= MAX_PARTICLES) break;

      const pos = this.pathCache.getPositionOnPath(
        particle.edgeId,
        particle.progress,
        particle.direction,
      );

      if (!pos) {
        continue;
      }

      const sprite = this.pool[idx];

      // Set texture for particle type (only if changed)
      const tex = this.textures.get(particle.type);
      if (tex && sprite.texture !== tex) {
        sprite.texture = tex;
      }

      sprite.position.set(pos.x, pos.y);
      sprite.rotation = pos.angle;
      sprite.visible = true;

      // Scale based on progress (slight growth at start, shrink at end)
      const progressScale = particle.progress < 0.1
        ? particle.progress / 0.1
        : particle.progress > 0.9
        ? (1 - particle.progress) / 0.1
        : 1;
      sprite.scale.set(progressScale, progressScale);

      // Alpha fade at edges
      sprite.alpha = Math.min(1, progressScale + 0.3);

      idx++;
    }

    // Hide unused sprites
    for (let i = idx; i < this.activeCount; i++) {
      this.pool[i].visible = false;
    }

    this.activeCount = idx;
  }

  /**
   * Hide all particles (e.g., when simulation stops).
   */
  hideAll(): void {
    for (let i = 0; i < this.activeCount; i++) {
      this.pool[i].visible = false;
    }
    this.activeCount = 0;
  }

  destroy(): void {
    this.stopRenderLoop();
    for (const sprite of this.pool) {
      sprite.destroy();
    }
    this.pool = [];
    for (const tex of this.textures.values()) {
      tex.destroy(true);
    }
    this.textures.clear();
    this.pathCache.clear();
  }
}
