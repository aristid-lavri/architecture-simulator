import type { Node, Edge } from '@xyflow/react';

/**
 * Context immutable passé à chaque handler lors du traitement d'une requête
 */
export interface RequestContext {
  chainId: string;
  originNodeId: string;
  virtualClientId?: number;
  startTime: number;
  currentPath: string[];
  edgePath: string[];
  // Path HTTP de la requête (ex: "/api/orders", "/api/users")
  requestPath?: string;
  // Port cible sur le nœud courant (provient de l'edge data targetPort)
  targetPort?: number;
  // Enriched context fields (Issue #4)
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  queryType?: 'read' | 'write' | 'transaction';
  contentType?: 'static' | 'dynamic' | 'user-specific';
  payloadSizeBytes?: number;
  sourceIP?: string;

  // État spécifique au cache-aside pattern
  cacheHit?: boolean;
  cacheNodeId?: string;
  waitingForDb?: boolean;
}

/**
 * Cible pour le forwarding d'une requête
 */
export interface ForwardTarget {
  nodeId: string;
  edgeId: string;
  delay?: number;
}

/**
 * Raisons de rejet possibles par les handlers
 */
export type RejectionReason =
  | 'rate-limit'
  | 'auth-failure'
  | 'capacity'
  | 'waf-blocked'
  | 'firewall-blocked'
  | 'timeout'
  | 'circuit-open'
  | 'oom-killed'
  | 'dns-failure'
  | 'queue-full';

/**
 * Décision retournée par un handler après traitement
 */
export type RequestDecision =
  | { action: 'forward'; targets: ForwardTarget[] }
  | { action: 'respond'; isError: boolean; delay?: number }
  | { action: 'reject'; reason: RejectionReason }
  | { action: 'queue'; priority?: number }
  | { action: 'cache-miss'; dbTarget: ForwardTarget; cacheNodeId: string }
  | { action: 'notify'; targets: ForwardTarget[] }; // Fire-and-forget: répond immédiatement, notifie les consumers async

/**
 * Décision pour le passthrough des réponses
 */
export type ResponseDecision =
  | { action: 'passthrough'; isError: boolean }
  | { action: 'store-and-respond'; isError: boolean };

/**
 * Interface principale du Strategy Pattern pour les handlers de nœuds
 */
export interface NodeRequestHandler {
  /** Type de nœud géré par ce handler */
  readonly nodeType: string;

  /**
   * Calcule le délai de processing pour ce type de nœud
   * @param node Le nœud à traiter
   * @param speed Multiplicateur de vitesse de simulation
   * @returns Délai en millisecondes
   */
  getProcessingDelay(node: Node, speed: number, context?: RequestContext): number;

  /**
   * Gère l'arrivée d'une requête sur un nœud
   * @param node Le nœud cible
   * @param context Contexte de la requête
   * @param outgoingEdges Edges sortants du nœud
   * @param allNodes Tous les nœuds du graphe
   * @returns Décision sur le traitement de la requête
   */
  handleRequestArrival(
    node: Node,
    context: RequestContext,
    outgoingEdges: Edge[],
    allNodes: Node[]
  ): RequestDecision;

  /**
   * Gère le passthrough d'une réponse (optionnel)
   * @param node Le nœud traversé
   * @param context Contexte de la requête
   * @param isError Si la réponse est une erreur
   * @returns Décision sur le traitement de la réponse
   */
  handleResponsePassthrough?(
    node: Node,
    context: RequestContext,
    isError: boolean
  ): ResponseDecision;

  /**
   * Initialise l'état du handler pour un nœud (optionnel)
   * Appelé au démarrage de la simulation
   * @param node Le nœud à initialiser
   */
  initialize?(node: Node): void;

  /**
   * Nettoie l'état du handler pour un nœud (optionnel)
   * Appelé à l'arrêt de la simulation
   * @param nodeId ID du nœud à nettoyer
   */
  cleanup?(nodeId: string): void;

  /**
   * Calcule le délai de processing en tenant compte des latences hiérarchiques (optionnel)
   * @param node Le nœud à traiter
   * @param parentLatencies Latences cumulées des parents dans la hiérarchie
   * @param speed Multiplicateur de vitesse de simulation
   * @returns Délai ajusté en millisecondes
   */
  getHierarchicalProcessingDelay?(node: Node, parentLatencies: number[], speed: number): number;

  /**
   * Vérifie si le nœud peut accepter une requête au niveau du parent (optionnel)
   * @param nodeId ID du nœud cible
   * @param parentId ID du nœud parent
   * @param utilization Utilisation courante du parent
   * @returns true si la requête peut être acceptée
   */
  canAcceptAtParentLevel?(nodeId: string, parentId: string, utilization: import('@/types').ResourceUtilization): boolean;
}

/**
 * Type helper pour les données de nœud typées
 */
export type NodeData = Record<string, unknown>;
