import type { SimulationEvent, SimulationEventType, HttpMethod, HandlerDecisionAction, StateTransitionType } from '@/types';

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
  chainId?: string,
  enriched?: {
    queryType?: 'read' | 'write' | 'transaction';
    contentType?: 'static' | 'dynamic' | 'user-specific';
    payloadSizeBytes?: number;
    sourceIP?: string;
    virtualClientId?: number;
    authToken?: { tokenId: string; format: string; issuerId: string };
  }
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
      httpMethod: method,
      queryType: enriched?.queryType,
      contentType: enriched?.contentType,
      payloadSizeBytes: enriched?.payloadSizeBytes,
      sourceIP: enriched?.sourceIP,
      virtualClientId: enriched?.virtualClientId,
      authToken: enriched?.authToken,
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

export function createSpanStartEvent(
  nodeId: string,
  nodeType: string,
  chainId: string,
  spanId: string,
  parentSpanId?: string
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'SPAN_START',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: {
      spanId,
      nodeType,
      parentSpanId,
    },
  };
}

export function createSpanEndEvent(
  nodeId: string,
  chainId: string,
  spanId: string,
  isError: boolean = false
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'SPAN_END',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: {
      spanId,
      isError,
    },
  };
}

// --- Enriched trace events ---

export function createHandlerDecisionEvent(
  nodeId: string,
  nodeType: string,
  decision: HandlerDecisionAction,
  chainId: string,
  opts?: {
    reason?: string;
    targets?: string[];
    httpMethod?: HttpMethod;
    queryType?: 'read' | 'write' | 'transaction';
    contentType?: 'static' | 'dynamic' | 'user-specific';
    sourceIP?: string;
    virtualClientId?: number;
  }
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'HANDLER_DECISION',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: {
      nodeType,
      decision,
      reason: opts?.reason,
      targets: opts?.targets,
      httpMethod: opts?.httpMethod,
      queryType: opts?.queryType,
      contentType: opts?.contentType,
      sourceIP: opts?.sourceIP,
      virtualClientId: opts?.virtualClientId,
    },
  };
}

export function createQueueEnterEvent(
  nodeId: string,
  chainId: string,
  queueDepth: number,
  priority?: number
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'QUEUE_ENTER',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: { queueDepth, priority },
  };
}

export function createQueueExitEvent(
  nodeId: string,
  chainId: string,
  waitTime: number,
  queueDepth: number
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'QUEUE_EXIT',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: { waitTime, queueDepth },
  };
}

export function createStateTransitionEvent(
  nodeId: string,
  transition: StateTransitionType,
  previousState: string,
  newState: string,
  chainId?: string
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'STATE_TRANSITION',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: { transition, previousState, newState },
  };
}

export function createResourceSnapshotEvent(
  nodeId: string,
  chainId: string,
  snapshot: {
    cpu: number;
    memory: number;
    activeConnections: number;
    queuedRequests: number;
    throughput?: number;
    errorRate?: number;
  }
): SimulationEvent {
  return {
    id: generateEventId(),
    type: 'RESOURCE_SNAPSHOT',
    sourceNodeId: nodeId,
    chainId,
    timestamp: Date.now(),
    data: {
      cpu: snapshot.cpu,
      memory: snapshot.memory,
      activeConnections: snapshot.activeConnections,
      queuedRequests: snapshot.queuedRequests,
      throughput: snapshot.throughput,
      errorRate: snapshot.errorRate,
    },
  };
}

// Simple event emitter for simulation events
type EventHandler = (event: SimulationEvent) => void;

const MAX_STORED_EVENTS = 2000;

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
