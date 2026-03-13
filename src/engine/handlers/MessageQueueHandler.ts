import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { MessageQueueNodeData } from '@/types';

/**
 * Message dans la file
 */
interface QueuedMessage {
  id: string;
  chainId: string;
  priority: number;
  enqueuedAt: number;
}

/**
 * État runtime d'une message queue
 */
interface QueueState {
  nodeId: string;
  config: MessageQueueNodeData;
  messages: QueuedMessage[];
  messagesPublished: number;
  messagesConsumed: number;
  messagesDeadLettered: number;
}

/**
 * Handler pour les nœuds Message Queue.
 * Gère les modes FIFO, priority, et pubsub.
 */
export class MessageQueueHandler implements NodeRequestHandler {
  readonly nodeType = 'message-queue';

  private queueStates: Map<string, QueueState> = new Map();
  private messageCounter = 0;

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as MessageQueueNodeData;
    // Combinaison du publish et consume latency
    return (data.performance.publishLatencyMs + data.performance.consumeLatencyMs) / speed;
  }

  initialize(node: Node): void {
    const data = node.data as MessageQueueNodeData;
    this.queueStates.set(node.id, {
      nodeId: node.id,
      config: data,
      messages: [],
      messagesPublished: 0,
      messagesConsumed: 0,
      messagesDeadLettered: 0,
    });
  }

  cleanup(nodeId: string): void {
    this.queueStates.delete(nodeId);
  }

  handleRequestArrival(
    node: Node,
    context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    const data = node.data as MessageQueueNodeData;
    const state = this.getOrCreateState(node.id, data);

    // Vérifier la capacité de la file
    if (state.messages.length >= data.configuration.maxQueueSize) {
      state.messagesDeadLettered++;
      return { action: 'reject', reason: 'queue-full' };
    }

    // Publier le message dans la file
    const message: QueuedMessage = {
      id: `msg-${this.messageCounter++}`,
      chainId: context.chainId,
      priority: data.mode === 'priority' ? Math.floor(Math.random() * 10) : 0,
      enqueuedAt: Date.now(),
    };

    state.messages.push(message);
    state.messagesPublished++;

    // Trier par priorité si mode priority
    if (data.mode === 'priority') {
      state.messages.sort((a, b) => b.priority - a.priority);
    }

    // Si pas de consommateurs (edges sortants), accepter le message et répondre
    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    // Mode pubsub: notifier tous les consumers (fire-and-forget)
    if (data.mode === 'pubsub') {
      const targets = outgoingEdges.map((edge) => ({
        nodeId: edge.target,
        edgeId: edge.id,
        delay: data.configuration.deliveryDelayMs,
      }));

      // Consommer le message
      this.consumeMessage(node.id);

      // Notify: répond immédiatement au producteur, notifie les consumers async
      return {
        action: 'notify',
        targets,
      };
    }

    // Mode FIFO ou priority: notifier un seul consumer (round-robin implicite)
    const edgeIndex = state.messagesConsumed % outgoingEdges.length;
    const edge = outgoingEdges[edgeIndex];

    // Consommer le message
    this.consumeMessage(node.id);

    return {
      action: 'notify',
      targets: [
        {
          nodeId: edge.target,
          edgeId: edge.id,
          delay: data.configuration.deliveryDelayMs,
        },
      ],
    };
  }

  /**
   * Consomme un message de la file
   */
  private consumeMessage(nodeId: string): QueuedMessage | null {
    const state = this.queueStates.get(nodeId);
    if (!state || state.messages.length === 0) return null;

    const message = state.messages.shift()!;
    state.messagesConsumed++;
    return message;
  }

  /**
   * Récupère les statistiques de la file
   */
  getStats(nodeId: string): {
    queueDepth: number;
    messagesPublished: number;
    messagesConsumed: number;
    messagesDeadLettered: number;
  } | null {
    const state = this.queueStates.get(nodeId);
    if (!state) return null;

    return {
      queueDepth: state.messages.length,
      messagesPublished: state.messagesPublished,
      messagesConsumed: state.messagesConsumed,
      messagesDeadLettered: state.messagesDeadLettered,
    };
  }

  private getOrCreateState(nodeId: string, config: MessageQueueNodeData): QueueState {
    let state = this.queueStates.get(nodeId);
    if (!state) {
      state = {
        nodeId,
        config,
        messages: [],
        messagesPublished: 0,
        messagesConsumed: 0,
        messagesDeadLettered: 0,
      };
      this.queueStates.set(nodeId, state);
    }
    return state;
  }
}
