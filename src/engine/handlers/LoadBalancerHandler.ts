import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { LoadBalancerNodeData } from '@/types';
import { LoadBalancerManager } from '../LoadBalancerManager';

/**
 * Handler pour les nœuds Load Balancer.
 * Utilise LoadBalancerManager pour la sélection de backend selon l'algorithme configuré.
 */
export class LoadBalancerHandler implements NodeRequestHandler {
  readonly nodeType = 'load-balancer';

  private manager: LoadBalancerManager;
  private readonly baseDelay = 5; // LB a une latence très faible

  constructor(manager: LoadBalancerManager) {
    this.manager = manager;
  }

  getProcessingDelay(_node: Node, speed: number): number {
    return this.baseDelay / speed;
  }

  initialize(node: Node): void {
    const data = node.data as LoadBalancerNodeData;
    this.manager.initializeLoadBalancer(node.id, data);
  }

  cleanup(nodeId: string): void {
    this.manager.cleanup(nodeId);
  }

  handleRequestArrival(
    node: Node,
    context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    // Pas d'edges sortants = pas de backends
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: true };
    }

    // Enregistrer les backends si pas déjà fait
    this.ensureBackendsRegistered(node.id, outgoingEdges);

    // Construire l'identifiant client pour sticky sessions / ip-hash
    const clientId = context.virtualClientId?.toString() ?? context.originNodeId;

    // Sélectionner un backend selon l'algorithme configuré
    const selectedBackendId = this.manager.selectBackend(node.id, clientId);

    if (!selectedBackendId) {
      // Aucun backend disponible/healthy
      return { action: 'reject', reason: 'capacity' };
    }

    // Trouver l'edge correspondant au backend sélectionné
    const selectedEdge = outgoingEdges.find((e) => e.target === selectedBackendId);

    if (!selectedEdge) {
      return { action: 'respond', isError: true };
    }

    // Enregistrer la requête envoyée
    this.manager.recordRequestSent(node.id, selectedBackendId);

    return {
      action: 'forward',
      targets: [
        {
          nodeId: selectedBackendId,
          edgeId: selectedEdge.id,
        },
      ],
    };
  }

  /**
   * S'assure que tous les backends (edges sortants) sont enregistrés
   */
  private ensureBackendsRegistered(lbNodeId: string, outgoingEdges: Edge[]): void {
    outgoingEdges.forEach((edge) => {
      // On enregistre avec un poids par défaut de 1
      // Le poids pourrait être extrait d'une propriété de l'edge si nécessaire
      this.manager.registerBackend(lbNodeId, edge.target, 1);
    });
  }

  /**
   * Appelé quand une réponse revient d'un backend
   * @param lbNodeId ID du load balancer
   * @param backendNodeId ID du backend
   * @param success true si succès, false si erreur
   */
  recordResponseReceived(lbNodeId: string, backendNodeId: string, success: boolean): void {
    this.manager.recordRequestCompleted(lbNodeId, backendNodeId, success);
  }
}
