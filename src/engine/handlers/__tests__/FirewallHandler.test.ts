import { describe, it, expect } from 'vitest';
import { FirewallHandler } from '../FirewallHandler';
import type { GraphNode, GraphEdge } from '@/types/graph';
import type { RequestContext } from '../types';

function createFirewallNode(overrides: Record<string, unknown> = {}): GraphNode {
  return {
    id: 'fw-1',
    type: 'firewall',
    position: { x: 0, y: 0 },
    data: {
      label: 'Firewall',
      inspectionLatencyMs: 1,
      defaultAction: 'allow',
      allowedPorts: [80, 443, 8080],
      blockedIPs: [],
      ...overrides,
    },
  };
}

function createContext(targetPort?: number): RequestContext {
  return {
    chainId: 'chain-1',
    originNodeId: 'client-1',
    startTime: Date.now(),
    currentPath: ['client-1'],
    edgePath: [],
    targetPort,
  };
}

function createEdge(target: string): GraphEdge {
  return { id: `e-${target}`, source: 'fw-1', target };
}

describe('FirewallHandler', () => {
  const handler = new FirewallHandler();

  describe('getProcessingDelay', () => {
    it('returns inspectionLatencyMs / speed', () => {
      const node = createFirewallNode({ inspectionLatencyMs: 10 });
      expect(handler.getProcessingDelay(node, 2)).toBe(5);
    });
  });

  describe('defaultAction: deny', () => {
    it('blocks when no targetPort is provided', () => {
      const node = createFirewallNode({ defaultAction: 'deny' });
      const decision = handler.handleRequestArrival(node, createContext(), [createEdge('s-1')], []);
      expect(decision.action).toBe('reject');
      if (decision.action === 'reject') {
        expect(decision.reason).toBe('firewall-blocked');
      }
    });

    it('blocks when targetPort is not in allowedPorts', () => {
      const node = createFirewallNode({ defaultAction: 'deny', allowedPorts: [80, 443] });
      const decision = handler.handleRequestArrival(node, createContext(3000), [createEdge('s-1')], []);
      expect(decision.action).toBe('reject');
      if (decision.action === 'reject') {
        expect(decision.reason).toBe('firewall-blocked');
      }
    });

    it('allows when targetPort is in allowedPorts', () => {
      const node = createFirewallNode({ defaultAction: 'deny', allowedPorts: [80, 443] });
      const decision = handler.handleRequestArrival(node, createContext(443), [createEdge('s-1')], []);
      expect(decision.action).toBe('forward');
    });

    it('blocks everything when allowedPorts is empty', () => {
      const node = createFirewallNode({ defaultAction: 'deny', allowedPorts: [] });
      const decision = handler.handleRequestArrival(node, createContext(80), [createEdge('s-1')], []);
      expect(decision.action).toBe('reject');
    });
  });

  describe('defaultAction: allow', () => {
    it('allows when no targetPort is provided', () => {
      const node = createFirewallNode({ defaultAction: 'allow' });
      const decision = handler.handleRequestArrival(node, createContext(), [createEdge('s-1')], []);
      expect(decision.action).toBe('forward');
    });

    it('allows when targetPort is in allowedPorts', () => {
      const node = createFirewallNode({ defaultAction: 'allow', allowedPorts: [80, 443] });
      const decision = handler.handleRequestArrival(node, createContext(80), [createEdge('s-1')], []);
      expect(decision.action).toBe('forward');
    });

    it('blocks when targetPort is not in allowedPorts', () => {
      const node = createFirewallNode({ defaultAction: 'allow', allowedPorts: [80, 443] });
      const decision = handler.handleRequestArrival(node, createContext(3000), [createEdge('s-1')], []);
      expect(decision.action).toBe('reject');
      if (decision.action === 'reject') {
        expect(decision.reason).toBe('firewall-blocked');
      }
    });

    it('allows any port when allowedPorts is empty', () => {
      const node = createFirewallNode({ defaultAction: 'allow', allowedPorts: [] });
      const decision = handler.handleRequestArrival(node, createContext(9999), [createEdge('s-1')], []);
      expect(decision.action).toBe('forward');
    });
  });

  describe('forwarding', () => {
    it('responds when no outgoing edges', () => {
      const node = createFirewallNode();
      const decision = handler.handleRequestArrival(node, createContext(80), [], []);
      expect(decision.action).toBe('respond');
    });

    it('forwards to first outgoing edge', () => {
      const node = createFirewallNode();
      const edges = [createEdge('s-1'), createEdge('s-2')];
      const decision = handler.handleRequestArrival(node, createContext(80), edges, []);
      expect(decision.action).toBe('forward');
      if (decision.action === 'forward') {
        expect(decision.targets[0].nodeId).toBe('s-1');
      }
    });
  });
});
