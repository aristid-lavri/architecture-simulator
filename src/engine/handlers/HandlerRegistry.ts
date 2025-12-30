import type { Node } from '@xyflow/react';
import type { NodeRequestHandler } from './types';

/**
 * Registre singleton des handlers de nœuds.
 * Permet d'enregistrer et récupérer des handlers par type de nœud.
 */
export class HandlerRegistry {
  private handlers: Map<string, NodeRequestHandler> = new Map();
  private defaultHandler: NodeRequestHandler | null = null;

  /**
   * Enregistre un handler pour un type de nœud
   * @param handler Le handler à enregistrer
   */
  register(handler: NodeRequestHandler): void {
    this.handlers.set(handler.nodeType, handler);
  }

  /**
   * Enregistre plusieurs handlers à la fois
   * @param handlers Liste des handlers à enregistrer
   */
  registerAll(handlers: NodeRequestHandler[]): void {
    handlers.forEach((handler) => this.register(handler));
  }

  /**
   * Définit le handler par défaut pour les types de nœuds inconnus
   * @param handler Le handler par défaut
   */
  setDefaultHandler(handler: NodeRequestHandler): void {
    this.defaultHandler = handler;
  }

  /**
   * Récupère le handler pour un type de nœud
   * @param nodeType Type de nœud
   * @returns Le handler correspondant ou le handler par défaut
   * @throws Error si aucun handler n'est trouvé et pas de handler par défaut
   */
  getHandler(nodeType: string): NodeRequestHandler {
    const handler = this.handlers.get(nodeType);
    if (handler) {
      return handler;
    }

    if (this.defaultHandler) {
      return this.defaultHandler;
    }

    throw new Error(`No handler registered for node type: ${nodeType}`);
  }

  /**
   * Vérifie si un handler existe pour un type de nœud
   * @param nodeType Type de nœud
   * @returns true si un handler spécifique existe
   */
  hasHandler(nodeType: string): boolean {
    return this.handlers.has(nodeType);
  }

  /**
   * Initialise tous les handlers pour les nœuds donnés
   * Appelé au démarrage de la simulation
   * @param nodes Liste des nœuds à initialiser
   */
  initializeAll(nodes: Node[]): void {
    nodes.forEach((node) => {
      const nodeType = node.type ?? 'unknown';
      const handler = this.handlers.get(nodeType) ?? this.defaultHandler;
      if (handler?.initialize) {
        handler.initialize(node);
      }
    });
  }

  /**
   * Nettoie tous les handlers
   * Appelé à l'arrêt de la simulation
   * @param nodeIds Liste des IDs de nœuds à nettoyer
   */
  cleanupAll(nodeIds: string[]): void {
    // Appeler cleanup sur tous les handlers enregistrés
    this.handlers.forEach((handler) => {
      if (handler.cleanup) {
        nodeIds.forEach((nodeId) => handler.cleanup!(nodeId));
      }
    });

    // Appeler cleanup sur le handler par défaut
    if (this.defaultHandler?.cleanup) {
      nodeIds.forEach((nodeId) => this.defaultHandler!.cleanup!(nodeId));
    }
  }

  /**
   * Retourne tous les types de nœuds enregistrés
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Réinitialise le registre (utile pour les tests)
   */
  clear(): void {
    this.handlers.clear();
    this.defaultHandler = null;
  }
}
