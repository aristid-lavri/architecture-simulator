import type { Node, Edge } from '@xyflow/react';
import type {
  Particle,
  ParticleType,
  SimulationState,
  ClientGroupNodeData,
  HttpServerNodeData as HttpServerNodeDataExtended,
  ServerResources,
  ResourceUtilization,
} from '@/types';
import type { HttpClientNodeData } from '@/components/nodes/HttpClientNode';
import type { HttpServerNodeData } from '@/components/nodes/HttpServerNode';
import {
  generateParticleId,
  createRequestSentEvent,
  createResponseSentEvent,
  simulationEvents,
} from './events';
import { MetricsCollector } from './metrics';
import { ResourceManager } from './ResourceManager';
import { VirtualClientManager } from './VirtualClientManager';
import { defaultServerResources, defaultDegradation } from '@/types';

interface SimulationCallbacks {
  onStateChange: (state: SimulationState) => void;
  onAddParticle: (particle: Particle) => void;
  onRemoveParticle: (particleId: string) => void;
  onUpdateParticle: (particleId: string, updates: Partial<Particle>) => void;
  onNodeStatusChange: (nodeId: string, status: 'idle' | 'processing' | 'success' | 'error') => void;
  onMetricsUpdate: (metrics: ReturnType<MetricsCollector['getMetrics']>) => void;
  onResourceUpdate?: (nodeId: string, utilization: ResourceUtilization) => void;
  onClientGroupUpdate?: (groupId: string, activeClients: number, requestsSent: number) => void;
}

interface ServerState {
  nodeId: string;
  resources: ServerResources;
  utilization: ResourceUtilization;
  activeRequests: Map<string, ActiveRequest>;
}

interface ActiveRequest {
  id: string;
  startedAt: number;
  estimatedCompletion: number;
}

interface QueuedRequest {
  id: string;
  clientGroupId?: string;
  virtualClientId?: number;
  queuedAt: number;
  edgeId: string;
  sourceNode: Node;
}

export class SimulationEngine {
  private nodes: Node[] = [];
  private edges: Edge[] = [];
  private state: SimulationState = 'idle';
  private speed: number = 1;
  private callbacks: SimulationCallbacks;
  private metrics: MetricsCollector;

  // Animation frame and timers
  private animationFrameId: number | null = null;
  private clientTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private activeParticles: Map<string, Particle> = new Map();

  // Stress testing - Resource management
  private virtualClientManager: VirtualClientManager = new VirtualClientManager();
  private serverStates: Map<string, ServerState> = new Map();
  private requestQueues: Map<string, QueuedRequest[]> = new Map();
  private resourceSamplingInterval: ReturnType<typeof setInterval> | null = null;
  private clientGroupTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(callbacks: SimulationCallbacks) {
    this.callbacks = callbacks;
    this.metrics = new MetricsCollector();
  }

  setNodesAndEdges(nodes: Node[], edges: Edge[]): void {
    this.nodes = nodes;
    this.edges = edges;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.5, Math.min(4, speed));
  }

  getState(): SimulationState {
    return this.state;
  }

  start(): void {
    if (this.state === 'running') return;

    this.state = 'running';
    this.callbacks.onStateChange('running');
    this.metrics.start();

    // Initialize server states for stress testing
    this.initializeServerStates();

    // Start all HTTP clients
    this.startHttpClients();

    // Start client groups for stress testing
    this.startClientGroups();

    // Start resource sampling
    this.startResourceSampling();

    // Start animation loop
    this.startAnimationLoop();
  }

  pause(): void {
    if (this.state !== 'running') return;

    this.state = 'paused';
    this.callbacks.onStateChange('paused');

    // Stop animation but keep state
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resume(): void {
    if (this.state !== 'paused') return;

    this.state = 'running';
    this.callbacks.onStateChange('running');

    // Resume animation
    this.startAnimationLoop();
  }

  stop(): void {
    this.state = 'idle';
    this.callbacks.onStateChange('idle');

    // Clear all timers
    this.clientTimers.forEach((timer) => clearInterval(timer));
    this.clientTimers.clear();

    // Clear client group timers
    this.clientGroupTimers.forEach((timer) => clearInterval(timer));
    this.clientGroupTimers.clear();

    // Cleanup virtual client manager
    this.virtualClientManager.cleanupAll();

    // Stop resource sampling
    if (this.resourceSamplingInterval) {
      clearInterval(this.resourceSamplingInterval);
      this.resourceSamplingInterval = null;
    }

    // Clear request queues
    this.requestQueues.clear();
    this.serverStates.clear();

    // Stop animation
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clear particles
    this.activeParticles.forEach((_, id) => {
      this.callbacks.onRemoveParticle(id);
    });
    this.activeParticles.clear();

    // Reset node states
    this.nodes.forEach((node) => {
      this.callbacks.onNodeStatusChange(node.id, 'idle');
    });

    // Reset metrics
    this.metrics.reset();
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());
  }

  reset(): void {
    this.stop();
  }

  private startHttpClients(): void {
    console.log('startHttpClients - nodes:', this.nodes);
    console.log('startHttpClients - edges:', this.edges);

    const httpClients = this.nodes.filter((node) => node.type === 'http-client');
    console.log('Found HTTP clients:', httpClients);

    httpClients.forEach((client) => {
      const data = client.data as HttpClientNodeData;
      const connectedEdges = this.edges.filter((edge) => edge.source === client.id);
      console.log('Client', client.id, 'connected edges:', connectedEdges);

      if (connectedEdges.length === 0) {
        console.log('No connected edges for client', client.id);
        return;
      }

      // Send initial request
      this.sendRequest(client, connectedEdges[0]);

      // If loop mode, set up interval
      if (data.requestMode === 'loop') {
        const interval = (data.interval || 1000) / this.speed;
        const timer = setInterval(() => {
          if (this.state === 'running') {
            this.sendRequest(client, connectedEdges[0]);
          }
        }, interval);

        this.clientTimers.set(client.id, timer);
      }
    });
  }

  private sendRequest(client: Node, edge: Edge): void {
    console.log('sendRequest called for client:', client.id, 'edge:', edge.id);
    const data = client.data as HttpClientNodeData;
    const targetNode = this.nodes.find((n) => n.id === edge.target);

    if (!targetNode) {
      console.log('Target node not found for edge:', edge.target);
      return;
    }
    console.log('Target node found:', targetNode.id);

    // Update client status
    this.callbacks.onNodeStatusChange(client.id, 'processing');

    // Record metric
    this.metrics.recordRequestSent();
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());

    // Create request event
    const event = createRequestSentEvent(
      client.id,
      edge.target,
      edge.id,
      data.method,
      data.path
    );
    simulationEvents.emit(event);

    // Create request particle (forward: client → server)
    const requestDuration = 2000 / this.speed; // Base duration adjusted by speed (2 seconds)
    const particle: Particle = {
      id: generateParticleId(),
      edgeId: edge.id,
      type: 'request',
      direction: 'forward',
      progress: 0,
      duration: requestDuration,
      startTime: Date.now(),
    };

    this.activeParticles.set(particle.id, particle);
    this.callbacks.onAddParticle(particle);

    // Schedule request arrival
    setTimeout(() => {
      this.handleRequestArrival(particle, client, targetNode, edge);
    }, requestDuration);
  }

  private handleRequestArrival(
    requestParticle: Particle,
    client: Node,
    server: Node,
    edge: Edge
  ): void {
    if (this.state !== 'running') return;

    // Remove request particle
    this.activeParticles.delete(requestParticle.id);
    this.callbacks.onRemoveParticle(requestParticle.id);

    // Update client to idle, server to processing
    this.callbacks.onNodeStatusChange(client.id, 'idle');
    this.callbacks.onNodeStatusChange(server.id, 'processing');

    const serverData = server.data as HttpServerNodeData;
    const processingDelay = (serverData.responseDelay || 100) / this.speed;

    // Simulate server processing
    setTimeout(() => {
      this.sendResponse(client, server, edge, serverData);
    }, processingDelay);
  }

  private sendResponse(
    client: Node,
    server: Node,
    edge: Edge,
    serverData: HttpServerNodeData
  ): void {
    if (this.state !== 'running') return;

    // Determine if this response is an error (based on errorRate)
    const isError =
      serverData.errorRate > 0 && Math.random() * 100 < serverData.errorRate;
    const responseStatus = isError ? 500 : serverData.responseStatus;
    const particleType: ParticleType = isError
      ? 'response-error'
      : 'response-success';

    // Update server status
    this.callbacks.onNodeStatusChange(
      server.id,
      isError ? 'error' : 'success'
    );

    // Create response event
    const event = createResponseSentEvent(
      server.id,
      client.id,
      edge.id,
      responseStatus,
      serverData.responseBody?.toString(),
      serverData.responseDelay
    );
    simulationEvents.emit(event);

    // Create response particle (backward: server → client)
    const responseDuration = 2000 / this.speed; // 2 seconds
    const particle: Particle = {
      id: generateParticleId(),
      edgeId: edge.id,
      type: particleType,
      direction: 'backward',
      progress: 0,
      duration: responseDuration,
      startTime: Date.now(),
    };

    this.activeParticles.set(particle.id, particle);
    this.callbacks.onAddParticle(particle);

    // Schedule response arrival
    setTimeout(() => {
      this.handleResponseArrival(particle, client, server, isError);
    }, responseDuration);
  }

  private handleResponseArrival(
    responseParticle: Particle,
    client: Node,
    server: Node,
    isError: boolean
  ): void {
    if (this.state !== 'running') return;

    // Remove response particle
    this.activeParticles.delete(responseParticle.id);
    this.callbacks.onRemoveParticle(responseParticle.id);

    // Update node states
    this.callbacks.onNodeStatusChange(server.id, 'idle');
    this.callbacks.onNodeStatusChange(
      client.id,
      isError ? 'error' : 'success'
    );

    // Record response metric
    const latency = Date.now() - responseParticle.startTime;
    this.metrics.recordResponse(!isError, latency);
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());

    // Reset client status after a short delay
    setTimeout(() => {
      if (this.state === 'running') {
        this.callbacks.onNodeStatusChange(client.id, 'idle');
      }
    }, 300 / this.speed);
  }

  private startAnimationLoop(): void {
    const animate = () => {
      if (this.state !== 'running') return;

      const now = Date.now();

      // Update all particle progress
      this.activeParticles.forEach((particle, id) => {
        const elapsed = now - particle.startTime;
        const progress = Math.min(1, elapsed / particle.duration);

        this.callbacks.onUpdateParticle(id, { progress });

        // Update local reference
        particle.progress = progress;
      });

      // Continue animation
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  // ============================================
  // Stress Testing Methods
  // ============================================

  /**
   * Initialize server states with resource configuration
   */
  private initializeServerStates(): void {
    const servers = this.nodes.filter((n) => n.type === 'http-server');

    servers.forEach((server) => {
      const data = server.data as HttpServerNodeDataExtended;
      const resources = data.resources || defaultServerResources;

      this.serverStates.set(server.id, {
        nodeId: server.id,
        resources,
        utilization: ResourceManager.createInitialUtilization(),
        activeRequests: new Map(),
      });
      this.requestQueues.set(server.id, []);
    });
  }

  /**
   * Start all client groups for stress testing
   */
  private startClientGroups(): void {
    const clientGroups = this.nodes.filter((n) => n.type === 'client-group');

    clientGroups.forEach((group) => {
      const data = group.data as ClientGroupNodeData;
      const edges = this.edges.filter((e) => e.source === group.id);

      if (edges.length === 0) return;

      // Initialize the group
      this.virtualClientManager.initializeGroup(group.id, data);

      // Start request scheduling for this group
      this.scheduleGroupRequests(group, edges[0], data);
    });
  }

  /**
   * Schedule requests for a client group
   */
  private scheduleGroupRequests(
    group: Node,
    edge: Edge,
    data: ClientGroupNodeData
  ): void {
    const checkInterval = 50; // Check every 50ms

    const timer = setInterval(() => {
      if (this.state !== 'running') return;

      const activeClients = this.virtualClientManager.getActiveClients(group.id);
      const stats = this.virtualClientManager.getGroupStats(group.id);

      // Update client group stats
      this.callbacks.onClientGroupUpdate?.(
        group.id,
        stats.activeClients,
        stats.totalRequests
      );

      // For each active client, check if they should send a request
      activeClients.forEach((client) => {
        if (this.virtualClientManager.shouldSendRequest(group.id, client.id, data)) {
          this.sendClientGroupRequest(group, edge, data, client.id);
          this.virtualClientManager.recordRequestSent(group.id, client.id);
        }
      });
    }, checkInterval);

    this.clientGroupTimers.set(group.id, timer);
  }

  /**
   * Send a request from a client group
   */
  private sendClientGroupRequest(
    group: Node,
    edge: Edge,
    data: ClientGroupNodeData,
    virtualClientId: number
  ): void {
    const targetNode = this.nodes.find((n) => n.id === edge.target);
    if (!targetNode) return;

    // Check server capacity
    const serverState = this.serverStates.get(targetNode.id);
    if (serverState) {
      const decision = ResourceManager.canAcceptRequest(
        serverState.resources,
        serverState.utilization
      );

      if (decision === 'reject') {
        // Record rejection
        this.metrics.recordRejection();
        this.callbacks.onMetricsUpdate(this.metrics.getMetrics());
        return;
      }

      if (decision === 'queue') {
        // Add to queue
        const queue = this.requestQueues.get(targetNode.id) || [];
        queue.push({
          id: generateParticleId(),
          clientGroupId: group.id,
          virtualClientId,
          queuedAt: Date.now(),
          edgeId: edge.id,
          sourceNode: group,
        });
        this.requestQueues.set(targetNode.id, queue);
        serverState.utilization.queuedRequests = queue.length;
        this.metrics.recordQueued(queue.length);
        return;
      }
    }

    // Update group status
    this.callbacks.onNodeStatusChange(group.id, 'processing');

    // Record metric
    this.metrics.recordRequestSent();
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());

    // Create request event
    const event = createRequestSentEvent(
      group.id,
      edge.target,
      edge.id,
      data.method,
      data.path
    );
    simulationEvents.emit(event);

    // Create request particle with client group info
    const requestDuration = 2000 / this.speed;
    const particle: Particle = {
      id: generateParticleId(),
      edgeId: edge.id,
      type: 'request',
      direction: 'forward',
      progress: 0,
      duration: requestDuration,
      startTime: Date.now(),
      data: {
        clientGroupId: group.id,
        virtualClientId,
      },
    };

    this.activeParticles.set(particle.id, particle);
    this.callbacks.onAddParticle(particle);

    // Track active request on server
    if (serverState) {
      serverState.activeRequests.set(particle.id, {
        id: particle.id,
        startedAt: Date.now(),
        estimatedCompletion: Date.now() + requestDuration,
      });
      serverState.utilization.activeConnections = serverState.activeRequests.size;
    }

    // Schedule request arrival
    setTimeout(() => {
      this.handleClientGroupRequestArrival(particle, group, targetNode, edge, virtualClientId);
    }, requestDuration);
  }

  /**
   * Handle client group request arrival at server
   */
  private handleClientGroupRequestArrival(
    requestParticle: Particle,
    clientGroup: Node,
    server: Node,
    edge: Edge,
    virtualClientId: number
  ): void {
    if (this.state !== 'running') return;

    // Remove request particle
    this.activeParticles.delete(requestParticle.id);
    this.callbacks.onRemoveParticle(requestParticle.id);

    // Update statuses
    this.callbacks.onNodeStatusChange(clientGroup.id, 'idle');
    this.callbacks.onNodeStatusChange(server.id, 'processing');

    const serverData = server.data as HttpServerNodeData;
    const serverState = this.serverStates.get(server.id);

    // Calculate degraded latency based on server load
    let processingDelay = (serverData.responseDelay || 100) / this.speed;

    if (serverState) {
      const extendedData = server.data as HttpServerNodeDataExtended;
      const degradation = extendedData.degradation || defaultDegradation;

      processingDelay = ResourceManager.calculateDegradedLatency(
        serverData.responseDelay || 100,
        serverState.utilization,
        degradation
      ) / this.speed;
    }

    // Simulate server processing
    setTimeout(() => {
      // Remove from active requests
      if (serverState) {
        serverState.activeRequests.delete(requestParticle.id);
        serverState.utilization.activeConnections = serverState.activeRequests.size;

        // Process next queued request if any
        this.processQueuedRequest(server.id);
      }

      this.sendClientGroupResponse(clientGroup, server, edge, serverData, virtualClientId);
    }, processingDelay);
  }

  /**
   * Send response for a client group request (tracks virtual client completion)
   */
  private sendClientGroupResponse(
    clientGroup: Node,
    server: Node,
    edge: Edge,
    serverData: HttpServerNodeData,
    virtualClientId: number
  ): void {
    if (this.state !== 'running') return;

    // Determine if this response is an error (based on errorRate)
    const isError =
      serverData.errorRate > 0 && Math.random() * 100 < serverData.errorRate;
    const responseStatus = isError ? 500 : serverData.responseStatus;
    const particleType: ParticleType = isError
      ? 'response-error'
      : 'response-success';

    // Update server status
    this.callbacks.onNodeStatusChange(
      server.id,
      isError ? 'error' : 'success'
    );

    // Create response event
    const event = createResponseSentEvent(
      server.id,
      clientGroup.id,
      edge.id,
      responseStatus,
      serverData.responseBody?.toString(),
      serverData.responseDelay
    );
    simulationEvents.emit(event);

    // Create response particle (backward: server → client)
    const responseDuration = 2000 / this.speed;
    const particle: Particle = {
      id: generateParticleId(),
      edgeId: edge.id,
      type: particleType,
      direction: 'backward',
      progress: 0,
      duration: responseDuration,
      startTime: Date.now(),
      data: {
        clientGroupId: clientGroup.id,
        virtualClientId,
      },
    };

    this.activeParticles.set(particle.id, particle);
    this.callbacks.onAddParticle(particle);

    // Schedule response arrival
    setTimeout(() => {
      this.handleClientGroupResponseArrival(particle, clientGroup, server, isError, virtualClientId);
    }, responseDuration);
  }

  /**
   * Handle client group response arrival
   */
  private handleClientGroupResponseArrival(
    responseParticle: Particle,
    clientGroup: Node,
    server: Node,
    isError: boolean,
    virtualClientId: number
  ): void {
    if (this.state !== 'running') return;

    // Remove response particle
    this.activeParticles.delete(responseParticle.id);
    this.callbacks.onRemoveParticle(responseParticle.id);

    // Update node states
    this.callbacks.onNodeStatusChange(server.id, 'idle');
    this.callbacks.onNodeStatusChange(
      clientGroup.id,
      isError ? 'error' : 'success'
    );

    // Record response metric
    const latency = Date.now() - responseParticle.startTime;
    this.metrics.recordResponse(!isError, latency);
    this.callbacks.onMetricsUpdate(this.metrics.getMetrics());

    // Mark request as completed for this virtual client (allows new parallel requests)
    this.virtualClientManager.recordRequestCompleted(clientGroup.id, virtualClientId);

    // Reset client status after a short delay
    setTimeout(() => {
      if (this.state === 'running') {
        this.callbacks.onNodeStatusChange(clientGroup.id, 'idle');
      }
    }, 300 / this.speed);
  }

  /**
   * Process the next queued request for a server
   */
  private processQueuedRequest(serverId: string): void {
    const queue = this.requestQueues.get(serverId);
    const serverState = this.serverStates.get(serverId);

    if (!queue || queue.length === 0 || !serverState) return;

    // Check if server can accept more requests
    if (serverState.activeRequests.size >= serverState.resources.connections.maxConcurrent) {
      return;
    }

    // Dequeue the oldest request
    const queuedRequest = queue.shift();
    if (!queuedRequest) return;

    serverState.utilization.queuedRequests = queue.length;

    // Record queue time
    const waitTime = Date.now() - queuedRequest.queuedAt;
    this.metrics.recordDequeued(waitTime);

    // Find the edge and send the request
    const edge = this.edges.find((e) => e.id === queuedRequest.edgeId);
    const server = this.nodes.find((n) => n.id === serverId);

    if (edge && server && queuedRequest.clientGroupId) {
      const groupData = queuedRequest.sourceNode.data as ClientGroupNodeData;
      this.sendClientGroupRequest(
        queuedRequest.sourceNode,
        edge,
        groupData,
        queuedRequest.virtualClientId || 0
      );
    }
  }

  /**
   * Start periodic resource sampling
   */
  private startResourceSampling(): void {
    this.resourceSamplingInterval = setInterval(() => {
      if (this.state !== 'running') return;

      this.serverStates.forEach((state, nodeId) => {
        const queue = this.requestQueues.get(nodeId) || [];

        // Calculate current utilization
        const utilization = ResourceManager.calculateUtilization(
          state.resources,
          state.activeRequests.size,
          queue.length,
          this.metrics.getMetrics().requestsPerSecond
        );

        state.utilization = utilization;

        // Notify callback
        this.callbacks.onResourceUpdate?.(nodeId, utilization);

        // Record sample for metrics
        this.metrics.recordResourceSample({
          timestamp: Date.now(),
          nodeId,
          cpu: utilization.cpu,
          memory: utilization.memory,
          network: utilization.network,
          disk: utilization.disk,
          activeConnections: utilization.activeConnections,
          queuedRequests: utilization.queuedRequests,
        });
      });
    }, 100); // Sample every 100ms
  }
}
