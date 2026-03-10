import type { SimulationEvent, SimulationEventType, HttpMethod } from '@/types';

// Generate unique ID for events
let eventCounter = 0;
export function generateEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

// Generate unique ID for particles
let particleCounter = 0;
export function generateParticleId(): string {
  return `particle_${Date.now()}_${++particleCounter}`;
}

// Create simulation events
export function createRequestSentEvent(
  sourceNodeId: string,
  targetNodeId: string,
  edgeId: string,
  method: HttpMethod,
  path: string,
  body?: string,
  chainId?: string
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'REQUEST_SENT',
    sourceNodeId,
    targetNodeId,
    edgeId,
    chainId,
    timestamp: Date.now(),
    data: {
      method,
      path,
      body,
    },
  };
}

export function createRequestReceivedEvent(
  sourceNodeId: string,
  targetNodeId: string,
  method: HttpMethod,
  path: string,
  chainId?: string
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'REQUEST_RECEIVED',
    sourceNodeId,
    targetNodeId,
    chainId,
    timestamp: Date.now(),
    data: {
      method,
      path,
    },
  };
}

export function createProcessingStartEvent(nodeId: string, chainId?: string): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'PROCESSING_START',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: {},
  };
}

export function createProcessingEndEvent(nodeId: string, chainId?: string): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'PROCESSING_END',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: {},
  };
}

export function createResponseSentEvent(
  sourceNodeId: string,
  targetNodeId: string,
  edgeId: string,
  status: number,
  body?: string,
  latency?: number,
  chainId?: string
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'RESPONSE_SENT',
    sourceNodeId,
    targetNodeId,
    edgeId,
    chainId,
    timestamp: Date.now(),
    data: {
      status,
      body,
      latency,
    },
  };
}

export function createResponseReceivedEvent(
  sourceNodeId: string,
  targetNodeId: string,
  status: number,
  latency: number,
  chainId?: string
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'RESPONSE_RECEIVED',
    sourceNodeId,
    targetNodeId,
    chainId,
    timestamp: Date.now(),
    data: {
      status,
      latency,
    },
  };
}

export function createErrorEvent(
  nodeId: string,
  error: string,
  chainId?: string
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'ERROR',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: {
      error,
    },
  };
}

// Simple event emitter for simulation events
type EventHandler = (event: SimulationEvent) => void;

const MAX_STORED_EVENTS = 500;

class SimulationEventEmitter {
  private handlers: Map<SimulationEventType | '*', Set<EventHandler>> = new Map();
  private storedEvents: SimulationEvent[] = [];

  on(type: SimulationEventType | '*', handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  emit(event: SimulationEvent): void {
    // Store event in ring buffer
    this.storedEvents.push(event);
    if (this.storedEvents.length > MAX_STORED_EVENTS) {
      this.storedEvents = this.storedEvents.slice(-MAX_STORED_EVENTS);
    }

    // Call specific handlers
    this.handlers.get(event.type)?.forEach((handler) => handler(event));
    // Call wildcard handlers
    this.handlers.get('*')?.forEach((handler) => handler(event));
  }

  /** Get all stored events (up to MAX_STORED_EVENTS). */
  getEvents(): SimulationEvent[] {
    return [...this.storedEvents];
  }

  /** Clear stored events buffer. */
  clearEvents(): void {
    this.storedEvents = [];
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const simulationEvents = new SimulationEventEmitter();
