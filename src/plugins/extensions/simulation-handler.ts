import type { NodeRequestHandler } from '@/engine/handlers/types';

/**
 * Registre additionnel pour les handlers de simulation apportés par les plugins.
 * Le HandlerRegistry interne du moteur ([engine/handlers/HandlerRegistry.ts]) reste la source
 * d'enregistrement effectif. Cette extension fournit une API de plugin :
 *  - les plugins enregistrent leurs handlers ici (avec un id propre)
 *  - le moteur, lors de son bootstrap, appelle `flushIntoEngineRegistry()` pour les insérer.
 */
export interface SimulationHandlerEntry {
  /** Identifiant du plugin propriétaire (sert à unregister). */
  ownerId: string;
  /** Le handler. Son champ `nodeType` détermine la clé dans le registre moteur. */
  handler: NodeRequestHandler;
}

type SimulationHandlerListener = () => void;

class SimulationHandlerRegistryImpl {
  private entries: Map<string, SimulationHandlerEntry> = new Map();
  private listeners: Set<SimulationHandlerListener> = new Set();

  /**
   * Enregistre un handler de plugin pour un type de nœud.
   * La clé interne est `${ownerId}:${nodeType}` pour éviter les collisions entre plugins.
   */
  register(entry: SimulationHandlerEntry): void {
    const key = `${entry.ownerId}:${entry.handler.nodeType}`;
    this.entries.set(key, entry);
    this.notify();
  }

  /** Désenregistre tous les handlers d'un plugin. */
  unregisterOwner(ownerId: string): void {
    let changed = false;
    for (const key of Array.from(this.entries.keys())) {
      if (this.entries.get(key)?.ownerId === ownerId) {
        this.entries.delete(key);
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  /** Liste tous les handlers enregistrés. */
  list(): SimulationHandlerEntry[] {
    return Array.from(this.entries.values());
  }

  /** Retourne le handler pour un type de nœud (le 1er gagne en cas de doublons). */
  findByNodeType(nodeType: string): NodeRequestHandler | undefined {
    for (const { handler } of this.entries.values()) {
      if (handler.nodeType === nodeType) return handler;
    }
    return undefined;
  }

  hasHandlers(): boolean {
    return this.entries.size > 0;
  }

  subscribe(listener: SimulationHandlerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const simulationHandlerRegistry = new SimulationHandlerRegistryImpl();
