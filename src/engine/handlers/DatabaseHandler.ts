import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { DatabaseNodeData } from '@/types';
import { DatabaseManager } from '../DatabaseManager';

/**
 * Handler pour les nœuds Database.
 * Utilise DatabaseManager pour la gestion des connexions et la latence.
 */
export class DatabaseHandler implements NodeRequestHandler {
  readonly nodeType = 'database';

  private manager: DatabaseManager;
  private queryCounter = 0;

  constructor(manager: DatabaseManager) {
    this.manager = manager;
  }

  getProcessingDelay(node: Node, speed: number, context?: RequestContext): number {
    const data = node.data as DatabaseNodeData;
    const queryType = context?.queryType || 'read';
    switch (queryType) {
      case 'write':
        return data.performance.writeLatencyMs / speed;
      case 'transaction':
        return data.performance.transactionLatencyMs / speed;
      case 'read':
      default:
        return data.performance.readLatencyMs / speed;
    }
  }

  initialize(node: Node): void {
    const data = node.data as DatabaseNodeData;
    this.manager.initializeDatabase(node.id, data);
  }

  cleanup(nodeId: string): void {
    this.manager.cleanup(nodeId);
  }

  handleRequestArrival(
    node: Node,
    context: RequestContext,
    _outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    // Vérifier si la DB peut accepter la requête
    const acceptStatus = this.manager.canAcceptQuery(node.id);

    if (acceptStatus === 'reject') {
      return { action: 'reject', reason: 'capacity' };
    }

    // Générer un ID de requête unique
    const queryId = `${context.chainId}-${this.queryCounter++}`;

    // Exécuter la requête avec le type dérivé du contexte
    const queryType = context.queryType || 'read';
    const { accepted } = this.manager.executeQuery(node.id, queryId, queryType);

    if (!accepted) {
      return { action: 'reject', reason: 'capacity' };
    }

    // Vérifier si la requête doit échouer (simuler les erreurs)
    const isError = this.manager.shouldQueryFail(node.id);

    // Compléter la requête immédiatement (la latence est gérée par le delay)
    this.manager.completeQuery(node.id, queryId);

    // Database est toujours un point terminal, on répond
    return {
      action: 'respond',
      isError,
    };
  }

  /**
   * Récupère l'utilisation actuelle de la base de données
   */
  getUtilization(nodeId: string) {
    return this.manager.getUtilization(nodeId);
  }
}
