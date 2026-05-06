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

// Authenticated variants: gold/amber-tinted colors signaling a secured channel.
// Practical equivalent of a padlock at small particle dimensions (16x3.5px).
const PARTICLE_COLORS_AUTH: Record<ParticleType, number> = {
  'request':          0xfbbf24, // gold (vs blue) — secured request
  'response-success': 0x10b981, // emerald (vs lighter green) — secured success
  'response-error':   0xdc2626, // crimson (vs red) — secured error
  'token-request':    0xfbbf24, // unchanged (auth flow itself)
  'token-response':   0x86efac, // unchanged (auth flow itself)
};

const PARTICLE_GLOW_AUTH: Record<ParticleType, number> = {
  'request':          0xfde68a, // pale gold
  'response-success': 0x6ee7b7, // pale emerald
  'response-error':   0xfca5a5, // unchanged
  'token-request':    0xfde68a,
  'token-response':   0xbbf7d0,
};

// Leading-edge dot color for authenticated particles (gold "lock" dot, larger).
const AUTH_DOT_COLOR = 0xfde047; // bright gold
const AUTH_DOT_RADIUS = 2.5;     // larger than default 1.5px white dot
const DEFAULT_DOT_RADIUS = 1.5;

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
  private texturesAuth: Map<ParticleType, Texture> = new Map();
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
   *
   * Two variants are generated per type:
   * - Default (this.textures) — used when particle.data.authenticated is falsy
   * - Auth (this.texturesAuth) — gold/amber palette + larger gold leading dot,
   *   visually signaling that the chain carries an authToken (secured channel).
   */
  private createTextures(): void {
    const types: ParticleType[] = ['request', 'response-success', 'response-error', 'token-request', 'token-response'];

    for (const type of types) {
      // Default variant
      const g = new Graphics();

      // Glow (wider, semi-transparent)
      g.roundRect(-2, -2, PARTICLE_WIDTH + 4, PARTICLE_HEIGHT + 4, 3);
      g.fill({ color: PARTICLE_GLOW[type], alpha: 0.3 });

      // Core streak
      g.roundRect(0, 0, PARTICLE_WIDTH, PARTICLE_HEIGHT, 1.5);
      g.fill({ color: PARTICLE_COLORS[type], alpha: 0.9 });

      // Leading bright dot
      g.circle(PARTICLE_WIDTH - DEFAULT_DOT_RADIUS, PARTICLE_HEIGHT / 2, DEFAULT_DOT_RADIUS);
      g.fill({ color: 0xffffff, alpha: 0.8 });

      const texture = this.app.renderer.generateTexture({
        target: g,
        resolution: 2,
      });
      this.textures.set(type, texture);
      g.destroy();

      // Auth variant — gold/emerald/crimson palette + larger gold leading dot.
      // Token particles (token-request / token-response) use the same palette as
      // the default variant since they're already visually distinct as the auth flow,
      // but we still register an entry to keep the lookup branchless in renderFrame.
      const gAuth = new Graphics();

      gAuth.roundRect(-2, -2, PARTICLE_WIDTH + 4, PARTICLE_HEIGHT + 4, 3);
      gAuth.fill({ color: PARTICLE_GLOW_AUTH[type], alpha: 0.35 });

      gAuth.roundRect(0, 0, PARTICLE_WIDTH, PARTICLE_HEIGHT, 1.5);
      gAuth.fill({ color: PARTICLE_COLORS_AUTH[type], alpha: 0.95 });

      // Larger gold "lock" dot at the leading edge for the 3 affected types;
      // token particles keep the default white dot.
      const isLockable = type === 'request' || type === 'response-success' || type === 'response-error';
      const dotColor = isLockable ? AUTH_DOT_COLOR : 0xffffff;
      const dotRadius = isLockable ? AUTH_DOT_RADIUS : DEFAULT_DOT_RADIUS;
      gAuth.circle(PARTICLE_WIDTH - dotRadius, PARTICLE_HEIGHT / 2, dotRadius);
      gAuth.fill({ color: dotColor, alpha: 0.95 });

      const textureAuth = this.app.renderer.generateTexture({
        target: gAuth,
        resolution: 2,
      });
      this.texturesAuth.set(type, textureAuth);
      gAuth.destroy();
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
    // Guard: pool may be empty during HMR / after destroy() but before stopRenderLoop() takes effect
    if (this.pool.length === 0) return;

    let idx = 0;
    const poolSize = this.pool.length;

    for (const particle of particles.values()) {
      if (idx >= MAX_PARTICLES || idx >= poolSize) break;

      const pos = this.pathCache.getPositionOnPath(
        particle.edgeId,
        particle.progress,
        particle.direction,
      );

      if (!pos) {
        continue;
      }

      const sprite = this.pool[idx];
      if (!sprite) break;

      // Set texture for particle type (only if changed).
      // Pick the auth-variant texture when the chain carries an authToken
      // (signaled by data.authenticated === true). Token particles
      // (token-request / token-response) are unaffected since their auth-variant
      // textures intentionally use the same palette as the default.
      const isAuth = !!(particle.data && (particle.data as { authenticated?: boolean }).authenticated);
      const texMap = isAuth ? this.texturesAuth : this.textures;
      const tex = texMap.get(particle.type);
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
    for (const tex of this.texturesAuth.values()) {
      tex.destroy(true);
    }
    this.texturesAuth.clear();
    this.pathCache.clear();
  }
}
