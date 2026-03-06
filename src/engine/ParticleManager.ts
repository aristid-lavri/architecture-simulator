import type { Particle } from '@/types';

/**
 * Callbacks pour notifier React des changements de particules.
 */
export interface ParticleCallbacks {
  onAddParticle: (particle: Particle) => void;
  onRemoveParticle: (particleId: string) => void;
  onUpdateParticle: (particleId: string, updates: Partial<Particle>) => void;
}

/**
 * Gere les particules d'animation et la boucle requestAnimationFrame.
 * Responsable de la creation, suppression, mise a jour et animation
 * des particules representant les requetes/reponses en transit.
 */
export class ParticleManager {
  private activeParticles: Map<string, Particle> = new Map();
  private animationFrameId: number | null = null;
  private callbacks: ParticleCallbacks;

  constructor(callbacks: ParticleCallbacks) {
    this.callbacks = callbacks;
  }

  /** Ajoute une particule et notifie React. */
  add(particle: Particle): void {
    this.activeParticles.set(particle.id, particle);
    this.callbacks.onAddParticle(particle);
  }

  /** Supprime une particule et notifie React. */
  remove(particleId: string): void {
    this.activeParticles.delete(particleId);
    this.callbacks.onRemoveParticle(particleId);
  }

  /** Verifie si une particule existe. */
  has(particleId: string): boolean {
    return this.activeParticles.has(particleId);
  }

  /** Retourne une particule par son ID. */
  get(particleId: string): Particle | undefined {
    return this.activeParticles.get(particleId);
  }

  /** Demarre la boucle d'animation a 60fps. Met a jour la progression de chaque particule. */
  startAnimationLoop(getState: () => string): void {
    const animate = () => {
      if (getState() !== 'running') return;

      const now = Date.now();

      this.activeParticles.forEach((particle, id) => {
        const elapsed = now - particle.startTime;
        const progress = Math.min(1, elapsed / particle.duration);

        this.callbacks.onUpdateParticle(id, { progress });
        particle.progress = progress;
      });

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /** Arrete la boucle d'animation. */
  stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** Supprime toutes les particules et notifie React pour chacune. */
  clearAll(): void {
    this.activeParticles.forEach((_, id) => {
      this.callbacks.onRemoveParticle(id);
    });
    this.activeParticles.clear();
  }
}
