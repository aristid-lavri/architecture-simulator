import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { MessageQueueNodeData } from '@/types';

/**
 * Message dans la file avec support visibility timeout et retry
 */
interface QueuedMessage {
  id: string;
  chainId: string;
  priority: number;
  enqueuedAt: number;
  retryCount: number;
  invisibleUntil: number | null;  // timestamp when message becomes visible again
  deliveredAt: number | null;     // timestamp of last delivery (for avgProcessingTime)
}

/**
 * État runtime d'une message queue
 */
interface QueueState {
  nodeId: string;
  config: MessageQueueNodeData;
  messages: QueuedMessage[];
  messagesPublished: number;
  messagesConsumed: number;       // Permanently ACKed
  messagesDeadLettered: number;
  messagesRetried: number;        // Total redeliveries
  totalProcessingTime: number;    // Sum of ACK processing times (ms)
  ackedCount: number;             // Count of ACKed messages (for avg calculation)
}

/**
 * Handler pour les nœuds Message Queue.
 * Gère les modes FIFO, priority, et pubsub.
 * Implémente le pattern visibility timeout avec ACK, retry et Dead Letter Queue.
 */
export class MessageQueueHandler implements NodeRequestHandler {
  readonly nodeType = 'message-queue';

  private queueStates: Map<string, QueueState> = new Map();
  private messageCounter = 0;

  getProcessingDelay(node: Node, speed: number): number {
    const data = node.data as MessageQueueNodeData;
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
      messagesRetried: 0,
      totalProcessingTime: 0,
      ackedCount: 0,
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

    // Vérifier la capacité de la file (only count visible + invisible messages)
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
      retryCount: 0,
      invisibleUntil: null,
      deliveredAt: null,
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

      // Consommer le message (pubsub = immediate delivery, auto-ACK)
      this.consumeMessage(node.id);

      return {
        action: 'notify',
        targets,
      };
    }

    // Mode FIFO ou priority: deliver to one consumer (round-robin)
    const consumedCount = state.messagesConsumed + this.getInFlightCount(state);
    const edgeIndex = consumedCount % outgoingEdges.length;
    const edge = outgoingEdges[edgeIndex];

    // Deliver message: set invisibility instead of removing
    this.deliverMessage(node.id, data);

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
   * Delivers a message by making it invisible (not removing it).
   * In auto ACK mode, the message is consumed immediately.
   */
  private deliverMessage(nodeId: string, config: MessageQueueNodeData): QueuedMessage | null {
    const state = this.queueStates.get(nodeId);
    if (!state) return null;

    // Find the first visible message
    const index = state.messages.findIndex((m) => m.invisibleUntil === null);
    if (index === -1) return null;

    const message = state.messages[index];

    if (config.ackMode === 'auto') {
      // Auto ACK: remove immediately (backward-compatible behavior)
      state.messages.splice(index, 1);
      state.messagesConsumed++;
      return message;
    }

    // Manual ACK: set visibility timeout
    const now = Date.now();
    message.invisibleUntil = now + config.configuration.visibilityTimeoutMs;
    message.deliveredAt = now;
    return message;
  }

  /**
   * Acknowledge a message — permanently removes it from the queue.
   * Called when a consumer successfully processes the message.
   */
  acknowledgeMessage(nodeId: string, messageId: string): boolean {
    const state = this.queueStates.get(nodeId);
    if (!state) return false;

    const index = state.messages.findIndex((m) => m.id === messageId);
    if (index === -1) return false;

    const message = state.messages[index];

    // Track processing time
    if (message.deliveredAt) {
      state.totalProcessingTime += Date.now() - message.deliveredAt;
      state.ackedCount++;
    }

    state.messages.splice(index, 1);
    state.messagesConsumed++;
    return true;
  }

  /**
   * Tick called periodically (from SimulationEngine resource sampling).
   * Checks visibility timeouts and handles retry/DLQ routing.
   */
  tick(nodeId: string): void {
    const state = this.queueStates.get(nodeId);
    if (!state) return;

    const now = Date.now();
    const config = state.config;

    for (const message of state.messages) {
      // Skip visible messages (not in-flight)
      if (message.invisibleUntil === null) continue;

      // Check if visibility timeout has expired
      if (now < message.invisibleUntil) continue;

      // Timeout expired — message was not ACKed in time
      message.retryCount++;
      state.messagesRetried++;

      if (config.retryEnabled && message.retryCount <= config.maxRetries) {
        // Make message visible again for redelivery
        message.invisibleUntil = null;
        message.deliveredAt = null;
      } else {
        // Max retries exhausted → Dead Letter Queue
        state.messagesDeadLettered++;
        // Remove the message from the queue
        const index = state.messages.indexOf(message);
        if (index !== -1) {
          state.messages.splice(index, 1);
        }
      }
    }
  }

  /**
   * Backward-compatible consume for pubsub mode (immediate removal)
   */
  private consumeMessage(nodeId: string): QueuedMessage | null {
    const state = this.queueStates.get(nodeId);
    if (!state || state.messages.length === 0) return null;

    const message = state.messages.shift()!;
    state.messagesConsumed++;
    return message;
  }

  /**
   * Count messages currently in-flight (invisible)
   */
  private getInFlightCount(state: QueueState): number {
    return state.messages.filter((m) => m.invisibleUntil !== null).length;
  }

  /**
   * Récupère les statistiques de la file
   */
  getStats(nodeId: string): {
    queueDepth: number;
    messagesPublished: number;
    messagesConsumed: number;
    messagesDeadLettered: number;
    messagesInFlight: number;
    messagesRetried: number;
    avgProcessingTime: number;
  } | null {
    const state = this.queueStates.get(nodeId);
    if (!state) return null;

    const inFlight = this.getInFlightCount(state);

    return {
      queueDepth: state.messages.length - inFlight, // visible messages only
      messagesPublished: state.messagesPublished,
      messagesConsumed: state.messagesConsumed,
      messagesDeadLettered: state.messagesDeadLettered,
      messagesInFlight: inFlight,
      messagesRetried: state.messagesRetried,
      avgProcessingTime: state.ackedCount > 0
        ? state.totalProcessingTime / state.ackedCount
        : 0,
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
        messagesRetried: 0,
        totalProcessingTime: 0,
        ackedCount: 0,
      };
      this.queueStates.set(nodeId, state);
    }
    return state;
  }
}
