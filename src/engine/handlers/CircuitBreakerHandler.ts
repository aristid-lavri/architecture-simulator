import type { Node, Edge } from '@xyflow/react';
import type { NodeRequestHandler, RequestContext, RequestDecision, ResponseDecision } from './types';
import type { CircuitBreakerNodeData, CircuitBreakerState } from '@/types';

interface CircuitBreakerNodeState {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  halfOpenRequests: number;
}

export class CircuitBreakerHandler implements NodeRequestHandler {
  readonly nodeType = 'circuit-breaker';

  private nodeStates: Map<string, CircuitBreakerNodeState> = new Map();

  getProcessingDelay(_node: Node, speed: number): number {
    return 2 / speed;
  }

  initialize(node: Node): void {
    this.nodeStates.set(node.id, {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      halfOpenRequests: 0,
    });
  }

  cleanup(nodeId: string): void {
    this.nodeStates.delete(nodeId);
  }

  handleRequestArrival(
    node: Node,
    _context: RequestContext,
    outgoingEdges: Edge[],
    _allNodes: Node[]
  ): RequestDecision {
    const data = node.data as CircuitBreakerNodeData;
    const cbState = this.getOrCreateState(node.id);

    // Check if timeout has passed for open state
    if (cbState.state === 'open') {
      const elapsed = Date.now() - cbState.lastFailureTime;
      if (elapsed >= data.timeout) {
        cbState.state = 'half-open';
        cbState.halfOpenRequests = 0;
        cbState.successCount = 0;
      } else {
        return { action: 'reject', reason: 'circuit-open' };
      }
    }

    // Half-open: limit concurrent requests
    if (cbState.state === 'half-open') {
      if (cbState.halfOpenRequests >= data.halfOpenMaxRequests) {
        return { action: 'reject', reason: 'circuit-open' };
      }
      cbState.halfOpenRequests++;
    }

    if (outgoingEdges.length === 0) {
      return { action: 'respond', isError: false };
    }

    const edge = outgoingEdges[0];
    return {
      action: 'forward',
      targets: [{ nodeId: edge.target, edgeId: edge.id }],
    };
  }

  handleResponsePassthrough(
    node: Node,
    _context: RequestContext,
    isError: boolean
  ): ResponseDecision {
    const data = node.data as CircuitBreakerNodeData;
    const cbState = this.getOrCreateState(node.id);

    if (isError) {
      cbState.failureCount++;
      cbState.lastFailureTime = Date.now();

      if (cbState.state === 'half-open') {
        // Any failure in half-open → re-open
        cbState.state = 'open';
        cbState.halfOpenRequests = 0;
      } else if (cbState.failureCount >= data.failureThreshold) {
        cbState.state = 'open';
      }
    } else {
      if (cbState.state === 'half-open') {
        cbState.successCount++;
        if (cbState.successCount >= data.successThreshold) {
          cbState.state = 'closed';
          cbState.failureCount = 0;
          cbState.successCount = 0;
          cbState.halfOpenRequests = 0;
        }
      } else {
        // Reset failure count on success in closed state
        cbState.failureCount = 0;
      }
    }

    return { action: 'passthrough', isError };
  }

  getCircuitState(nodeId: string): CircuitBreakerState {
    return this.getOrCreateState(nodeId).state;
  }

  getNodeState(nodeId: string): { state: CircuitBreakerState; failureCount: number } | null {
    const s = this.nodeStates.get(nodeId);
    if (!s) return null;
    return { state: s.state, failureCount: s.failureCount };
  }

  private getOrCreateState(nodeId: string): CircuitBreakerNodeState {
    let state = this.nodeStates.get(nodeId);
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        halfOpenRequests: 0,
      };
      this.nodeStates.set(nodeId, state);
    }
    return state;
  }
}
