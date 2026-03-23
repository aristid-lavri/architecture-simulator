import type { GraphNode, GraphEdge } from '@/types/graph';
import type {
  ComponentType,
  HostServerNodeData,
  FirewallNodeData,
  ApiGatewayNodeData,
  HttpServerNodeData,
  DatabaseNodeData,
  CacheNodeData,
  ClientGroupNodeData,
  ApiServiceNodeData,
  ServerlessNodeData,
  BackgroundJobNodeData,
  MessageQueueNodeData,
  CDNNodeData,
  ContainerNodeData,
  CircuitBreakerNodeData,
  LoadBalancerNodeData,
  HttpClientConfig,
} from '@/types';
import { CONTAINER_TYPES } from '@/types';

// ============================================
// Validation Types
// ============================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationCategory =
  | 'connection'
  | 'port'
  | 'routing'
  | 'resource'
  | 'required-fields'
  | 'disconnected'
  | 'configuration'
  | 'hierarchy';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: ValidationCategory;
  messageKey: string;
  messageParams?: Record<string, string | number>;
  nodeIds?: string[];
  edgeIds?: string[];
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  isValid: boolean;
}

// ============================================
// Helpers
// ============================================

function getNodeLabel(node: GraphNode): string {
  return (node.data as { label?: string })?.label || node.id;
}

function getNodeType(node: GraphNode): ComponentType {
  return node.type as ComponentType;
}

function outgoingEdges(edges: GraphEdge[], nodeId: string): GraphEdge[] {
  return edges.filter((e) => e.source === nodeId);
}

function incomingEdges(edges: GraphEdge[], nodeId: string): GraphEdge[] {
  return edges.filter((e) => e.target === nodeId);
}

// ============================================
// Category 1: Connection Rules
// ============================================

function connectionRules(nodes: GraphNode[], edges: GraphEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    const type = getNodeType(node);

    // http-client without outgoing edges
    if (type === 'http-client' && outgoingEdges(edges, node.id).length === 0) {
      issues.push({
        id: `conn-no-outgoing-${node.id}`,
        severity: 'error',
        category: 'connection',
        messageKey: 'validation.rules.httpClientNoOutgoing',
        messageParams: { label: getNodeLabel(node) },
        nodeIds: [node.id],
      });
    }

    // client-group without outgoing edges
    if (type === 'client-group' && outgoingEdges(edges, node.id).length === 0) {
      issues.push({
        id: `conn-no-outgoing-${node.id}`,
        severity: 'error',
        category: 'connection',
        messageKey: 'validation.rules.clientGroupNoOutgoing',
        messageParams: { label: getNodeLabel(node) },
        nodeIds: [node.id],
      });
    }

    // load-balancer without backend edges
    if (type === 'load-balancer' && outgoingEdges(edges, node.id).length === 0) {
      issues.push({
        id: `conn-lb-no-backends-${node.id}`,
        severity: 'error',
        category: 'connection',
        messageKey: 'validation.rules.loadBalancerNoBackends',
        messageParams: { label: getNodeLabel(node) },
        nodeIds: [node.id],
      });
    }

    // circuit-breaker without incoming edges (useless)
    if (type === 'circuit-breaker' && incomingEdges(edges, node.id).length === 0) {
      issues.push({
        id: `conn-cb-no-incoming-${node.id}`,
        severity: 'error',
        category: 'connection',
        messageKey: 'validation.rules.circuitBreakerNoIncoming',
        messageParams: { label: getNodeLabel(node) },
        nodeIds: [node.id],
      });
    }

    // circuit-breaker without outgoing edges (nowhere to forward)
    if (type === 'circuit-breaker' && outgoingEdges(edges, node.id).length === 0) {
      issues.push({
        id: `conn-cb-no-outgoing-${node.id}`,
        severity: 'error',
        category: 'connection',
        messageKey: 'validation.rules.circuitBreakerNoOutgoing',
        messageParams: { label: getNodeLabel(node) },
        nodeIds: [node.id],
      });
    }

    // cache without outgoing edges (no DB fallback on miss)
    if (type === 'cache' && outgoingEdges(edges, node.id).length === 0 && incomingEdges(edges, node.id).length > 0) {
      issues.push({
        id: `conn-cache-no-fallback-${node.id}`,
        severity: 'warning',
        category: 'connection',
        messageKey: 'validation.rules.cacheNoFallback',
        messageParams: { label: getNodeLabel(node) },
        nodeIds: [node.id],
      });
    }

    // CDN without outgoing edge but cache hit ratio < 100 (miss path broken)
    if (type === 'cdn') {
      const data = node.data as CDNNodeData;
      if (data.cacheHitRatio < 100 && outgoingEdges(edges, node.id).length === 0 && incomingEdges(edges, node.id).length > 0) {
        issues.push({
          id: `conn-cdn-no-origin-${node.id}`,
          severity: 'warning',
          category: 'connection',
          messageKey: 'validation.rules.cdnNoOrigin',
          messageParams: { label: getNodeLabel(node), hitRatio: data.cacheHitRatio },
          nodeIds: [node.id],
        });
      }
    }

    // load-balancer with only 1 backend
    if (type === 'load-balancer' && outgoingEdges(edges, node.id).length === 1) {
      issues.push({
        id: `conn-lb-single-backend-${node.id}`,
        severity: 'info',
        category: 'connection',
        messageKey: 'validation.rules.loadBalancerSingleBackend',
        messageParams: { label: getNodeLabel(node) },
        nodeIds: [node.id],
      });
    }

    // message-queue without outgoing edges (no consumers)
    if (type === 'message-queue' && outgoingEdges(edges, node.id).length === 0 && incomingEdges(edges, node.id).length > 0) {
      issues.push({
        id: `conn-mq-no-consumers-${node.id}`,
        severity: 'warning',
        category: 'connection',
        messageKey: 'validation.rules.messageQueueNoConsumers',
        messageParams: { label: getNodeLabel(node) },
        nodeIds: [node.id],
      });
    }

    // host-server with portMappings but no incoming edges
    if (type === 'host-server') {
      const data = node.data as HostServerNodeData;
      if (data.portMappings?.length > 0 && incomingEdges(edges, node.id).length === 0) {
        issues.push({
          id: `conn-host-mappings-no-incoming-${node.id}`,
          severity: 'warning',
          category: 'connection',
          messageKey: 'validation.rules.hostServerMappingsNoIncoming',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }
  }

  // edges with non-existent target or source
  for (const edge of edges) {
    if (!nodeIds.has(edge.target)) {
      issues.push({
        id: `conn-dangling-target-${edge.id}`,
        severity: 'error',
        category: 'connection',
        messageKey: 'validation.rules.edgeDanglingTarget',
        messageParams: { nodeId: edge.target },
        edgeIds: [edge.id],
      });
    }
    if (!nodeIds.has(edge.source)) {
      issues.push({
        id: `conn-dangling-source-${edge.id}`,
        severity: 'error',
        category: 'connection',
        messageKey: 'validation.rules.edgeDanglingSource',
        messageParams: { nodeId: edge.source },
        edgeIds: [edge.id],
      });
    }
  }

  return issues;
}

// ============================================
// Category 2: Port Rules
// ============================================

function portRules(nodes: GraphNode[], edges: GraphEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const edge of edges) {
    const targetNode = nodeMap.get(edge.target);
    if (!targetNode) continue;
    const targetType = getNodeType(targetNode);
    const edgeData = edge.data as { targetPort?: number } | undefined;
    const targetPort = edgeData?.targetPort;

    // edge to host-server without targetPort
    if (targetType === 'host-server' && targetPort == null) {
      issues.push({
        id: `port-no-target-port-${edge.id}`,
        severity: 'error',
        category: 'port',
        messageKey: 'validation.rules.edgeToHostNoPort',
        messageParams: { label: getNodeLabel(targetNode) },
        edgeIds: [edge.id],
        nodeIds: [targetNode.id],
      });
    }

    // edge to firewall without targetPort
    if (targetType === 'firewall' && targetPort == null) {
      issues.push({
        id: `port-no-target-port-fw-${edge.id}`,
        severity: 'warning',
        category: 'port',
        messageKey: 'validation.rules.edgeToFirewallNoPort',
        messageParams: { label: getNodeLabel(targetNode) },
        edgeIds: [edge.id],
        nodeIds: [targetNode.id],
      });
    }

    // targetPort doesn't match any host-server portMapping
    if (targetType === 'host-server' && targetPort != null) {
      const hostData = targetNode.data as HostServerNodeData;
      const mappings = hostData.portMappings || [];
      const hasMatch = mappings.some((m) => m.hostPort === targetPort);
      if (!hasMatch && mappings.length > 0) {
        issues.push({
          id: `port-mismatch-${edge.id}`,
          severity: 'error',
          category: 'port',
          messageKey: 'validation.rules.portMismatch',
          messageParams: { port: targetPort, label: getNodeLabel(targetNode) },
          edgeIds: [edge.id],
          nodeIds: [targetNode.id],
        });
      }
    }
  }

  for (const node of nodes) {
    const type = getNodeType(node);

    // firewall with deny default and no allowed ports
    if (type === 'firewall') {
      const data = node.data as FirewallNodeData;
      if (data.defaultAction === 'deny' && (!data.allowedPorts || data.allowedPorts.length === 0)) {
        issues.push({
          id: `port-fw-blocks-all-${node.id}`,
          severity: 'error',
          category: 'port',
          messageKey: 'validation.rules.firewallBlocksAll',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }

    // host-server portMappings referencing non-existent containers
    if (type === 'host-server') {
      const data = node.data as HostServerNodeData;
      for (const mapping of data.portMappings || []) {
        if (!nodeMap.has(mapping.containerNodeId)) {
          issues.push({
            id: `port-mapping-dangling-${node.id}-${mapping.id}`,
            severity: 'error',
            category: 'port',
            messageKey: 'validation.rules.portMappingDangling',
            messageParams: { label: getNodeLabel(node) },
            nodeIds: [node.id],
          });
        }
      }
    }
  }

  return issues;
}

// ============================================
// Category 3: Routing Rules
// ============================================

function routingRules(nodes: GraphNode[], edges: GraphEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    const type = getNodeType(node);

    if (type === 'api-gateway') {
      const data = node.data as ApiGatewayNodeData;
      const rules = data.routeRules || [];
      if (rules.length === 0) continue;

      const out = outgoingEdges(edges, node.id);

      // API Gateway with rules but no edges
      if (out.length === 0) {
        issues.push({
          id: `routing-gw-rules-no-edges-${node.id}`,
          severity: 'warning',
          category: 'routing',
          messageKey: 'validation.rules.apiGatewayRulesNoEdges',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
        continue;
      }

      // route rules targeting services not connected
      const connectedServiceNames = new Set<string>();
      for (const edge of out) {
        const target = nodeMap.get(edge.target);
        if (!target) continue;
        const targetType = getNodeType(target);
        if (targetType === 'http-server') {
          const sn = (target.data as HttpServerNodeData).serviceName;
          if (sn) connectedServiceNames.add(sn);
        }
        if (targetType === 'api-service') {
          const sn = (target.data as ApiServiceNodeData).serviceName;
          if (sn) connectedServiceNames.add(sn);
        }
      }

      for (const rule of rules) {
        if (!connectedServiceNames.has(rule.targetServiceName)) {
          issues.push({
            id: `routing-gw-dangling-rule-${node.id}-${rule.id}`,
            severity: 'warning',
            category: 'routing',
            messageKey: 'validation.rules.apiGatewayDanglingRoute',
            messageParams: {
              label: getNodeLabel(node),
              pattern: rule.pathPattern,
              service: rule.targetServiceName,
            },
            nodeIds: [node.id],
          });
        }
      }

      // duplicate route rule priorities
      const priorityCounts = new Map<number, number>();
      for (const rule of rules) {
        priorityCounts.set(rule.priority, (priorityCounts.get(rule.priority) || 0) + 1);
      }
      for (const [priority, count] of priorityCounts) {
        if (count > 1) {
          issues.push({
            id: `routing-gw-dup-priority-${node.id}-${priority}`,
            severity: 'warning',
            category: 'routing',
            messageKey: 'validation.rules.apiGatewayDuplicatePriority',
            messageParams: { label: getNodeLabel(node), priority, count },
            nodeIds: [node.id],
          });
          break; // one warning is enough
        }
      }
    }

    // API Service without serviceName
    if (type === 'api-service') {
      const data = node.data as ApiServiceNodeData;
      if (!data.serviceName || data.serviceName.trim() === '') {
        issues.push({
          id: `routing-api-no-name-${node.id}`,
          severity: 'warning',
          category: 'routing',
          messageKey: 'validation.rules.apiServiceNoName',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }
  }

  return issues;
}

// ============================================
// Category 4: Resource Rules
// ============================================

function resourceRules(nodes: GraphNode[], edges: GraphEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    const type = getNodeType(node);

    // client-group overloading target server
    if (type === 'client-group') {
      const cgData = node.data as ClientGroupNodeData;
      if (cgData.virtualClients > 100) {
        const out = outgoingEdges(edges, node.id);
        for (const edge of out) {
          const target = nodeMap.get(edge.target);
          if (!target) continue;
          if (getNodeType(target) === 'http-server') {
            const serverData = target.data as HttpServerNodeData;
            if (serverData.resources?.connections?.maxConcurrent < 50) {
              issues.push({
                id: `resource-overload-${node.id}-${target.id}`,
                severity: 'warning',
                category: 'resource',
                messageKey: 'validation.rules.clientGroupOverloads',
                messageParams: {
                  clientLabel: getNodeLabel(node),
                  clients: cgData.virtualClients,
                  maxConc: serverData.resources.connections.maxConcurrent,
                },
                nodeIds: [node.id, target.id],
              });
            }
          }
        }
      }
    }

    // server with 0ms processing
    if (type === 'http-server') {
      const data = node.data as HttpServerNodeData;
      if (
        data.responseDelay === 0 &&
        data.resources?.cpu?.processingTimePerRequest === 0
      ) {
        issues.push({
          id: `resource-zero-delay-${node.id}`,
          severity: 'info',
          category: 'resource',
          messageKey: 'validation.rules.serverZeroDelay',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }
  }

  return issues;
}

// ============================================
// Category 5: Required Fields Rules
// ============================================

function requiredFieldsRules(nodes: GraphNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const node of nodes) {
    const type = getNodeType(node);

    // HTTP server without resources
    if (type === 'http-server') {
      const data = node.data as HttpServerNodeData;
      if (!data.resources) {
        issues.push({
          id: `required-no-resources-${node.id}`,
          severity: 'error',
          category: 'required-fields',
          messageKey: 'validation.rules.httpServerNoResources',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }

    // Database without performance
    if (type === 'database') {
      const data = node.data as DatabaseNodeData;
      if (!data.performance) {
        issues.push({
          id: `required-no-perf-db-${node.id}`,
          severity: 'error',
          category: 'required-fields',
          messageKey: 'validation.rules.databaseNoPerformance',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }

    // Cache without performance
    if (type === 'cache') {
      const data = node.data as CacheNodeData;
      if (!data.performance) {
        issues.push({
          id: `required-no-perf-cache-${node.id}`,
          severity: 'error',
          category: 'required-fields',
          messageKey: 'validation.rules.cacheNoPerformance',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }
  }

  return issues;
}

// ============================================
// Category 6: Disconnected Rules
// ============================================

function disconnectedRules(nodes: GraphNode[], edges: GraphEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const node of nodes) {
    const type = getNodeType(node);
    const hasIncoming = incomingEdges(edges, node.id).length > 0;
    const hasOutgoing = outgoingEdges(edges, node.id).length > 0;

    // fully isolated node (skip containers which don't need edges)
    if (!hasIncoming && !hasOutgoing && !CONTAINER_TYPES.includes(type)) {
      issues.push({
        id: `disconnected-isolated-${node.id}`,
        severity: 'warning',
        category: 'disconnected',
        messageKey: 'validation.rules.fullyIsolated',
        messageParams: { label: getNodeLabel(node) },
        nodeIds: [node.id],
      });
    }

    // terminal nodes never accessed
    const terminalTypes: ComponentType[] = ['database', 'cache', 'cloud-storage'];
    if (terminalTypes.includes(type) && !hasIncoming) {
      // Don't duplicate with fully isolated already reported
      if (hasOutgoing) {
        issues.push({
          id: `disconnected-terminal-${node.id}`,
          severity: 'warning',
          category: 'disconnected',
          messageKey: 'validation.rules.terminalNeverAccessed',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }
  }

  return issues;
}

// ============================================
// Category 7: Configuration Rules
// ============================================

function configurationRules(nodes: GraphNode[], edges: GraphEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const node of nodes) {
    const type = getNodeType(node);

    // Serverless: timeout < coldStart (every cold start will timeout)
    if (type === 'serverless' || type === 'cloud-function') {
      const data = node.data as ServerlessNodeData;
      if (data.timeoutMs < data.coldStartMs) {
        issues.push({
          id: `config-serverless-timeout-${node.id}`,
          severity: 'error',
          category: 'configuration',
          messageKey: 'validation.rules.serverlessTimeoutLessThanColdStart',
          messageParams: { label: getNodeLabel(node), timeout: data.timeoutMs, coldStart: data.coldStartMs },
          nodeIds: [node.id],
        });
      }

      // minInstances > maxInstances
      if (data.minInstances > data.maxInstances) {
        issues.push({
          id: `config-serverless-min-max-${node.id}`,
          severity: 'error',
          category: 'configuration',
          messageKey: 'validation.rules.serverlessMinGreaterThanMax',
          messageParams: { label: getNodeLabel(node), min: data.minInstances, max: data.maxInstances },
          nodeIds: [node.id],
        });
      }

      // concurrencyLimit = 0
      if (data.concurrencyLimit === 0) {
        issues.push({
          id: `config-serverless-zero-concurrency-${node.id}`,
          severity: 'error',
          category: 'configuration',
          messageKey: 'validation.rules.serverlessZeroConcurrency',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }

    // Background Job: cron without schedule
    if (type === 'background-job') {
      const data = node.data as BackgroundJobNodeData;
      if (data.jobType === 'cron' && (!data.schedule || data.schedule.trim() === '')) {
        issues.push({
          id: `config-bg-cron-no-schedule-${node.id}`,
          severity: 'error',
          category: 'configuration',
          messageKey: 'validation.rules.backgroundJobCronNoSchedule',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }

      // batch without batchSize
      if (data.jobType === 'batch' && (!data.batchSize || data.batchSize <= 0)) {
        issues.push({
          id: `config-bg-batch-no-size-${node.id}`,
          severity: 'error',
          category: 'configuration',
          messageKey: 'validation.rules.backgroundJobBatchNoSize',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }

    // Client Group: virtualClients = 0
    if (type === 'client-group') {
      const data = node.data as ClientGroupNodeData;
      if (data.virtualClients <= 0) {
        issues.push({
          id: `config-cg-zero-clients-${node.id}`,
          severity: 'error',
          category: 'configuration',
          messageKey: 'validation.rules.clientGroupZeroClients',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
      if (data.concurrentRequests <= 0) {
        issues.push({
          id: `config-cg-zero-concurrent-${node.id}`,
          severity: 'error',
          category: 'configuration',
          messageKey: 'validation.rules.clientGroupZeroConcurrent',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }

    // HTTP Client: loop mode with interval = 0
    if (type === 'http-client') {
      const data = node.data as unknown as HttpClientConfig;
      if (data.requestMode === 'loop' && data.requestInterval === 0) {
        issues.push({
          id: `config-http-client-zero-interval-${node.id}`,
          severity: 'warning',
          category: 'configuration',
          messageKey: 'validation.rules.httpClientZeroInterval',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }

    // API Service: maxConcurrentRequests = 0
    if (type === 'api-service') {
      const data = node.data as ApiServiceNodeData;
      if (data.maxConcurrentRequests === 0) {
        issues.push({
          id: `config-api-service-zero-conc-${node.id}`,
          severity: 'error',
          category: 'configuration',
          messageKey: 'validation.rules.apiServiceZeroConcurrent',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }

    // HTTP Server / API Service with errorRate > 80%
    if (type === 'http-server') {
      const data = node.data as HttpServerNodeData;
      if (data.errorRate > 80) {
        issues.push({
          id: `config-server-high-error-rate-${node.id}`,
          severity: 'warning',
          category: 'configuration',
          messageKey: 'validation.rules.highErrorRate',
          messageParams: { label: getNodeLabel(node), rate: data.errorRate },
          nodeIds: [node.id],
        });
      }
    }

    // Load Balancer: weighted algorithm — info about default weights
    if (type === 'load-balancer') {
      const data = node.data as LoadBalancerNodeData;
      if (data.algorithm === 'weighted') {
        issues.push({
          id: `config-lb-weighted-${node.id}`,
          severity: 'info',
          category: 'configuration',
          messageKey: 'validation.rules.lbWeightedNoWeights',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      }
    }

    // Circuit Breaker: timeout too tight warning
    if (type === 'circuit-breaker') {
      const data = node.data as CircuitBreakerNodeData;
      if (data.timeout < 5000) {
        issues.push({
          id: `config-cb-tight-timeout-${node.id}`,
          severity: 'info',
          category: 'configuration',
          messageKey: 'validation.rules.circuitBreakerTightTimeout',
          messageParams: { label: getNodeLabel(node), timeout: data.timeout },
          nodeIds: [node.id],
        });
      }
    }
  }

  return issues;
}

// ============================================
// Category 8: Hierarchy Rules
// ============================================

function hierarchyRules(nodes: GraphNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    const type = getNodeType(node);
    const parentId = (node as { parentId?: string }).parentId;

    // Container without host-server parent
    if (type === 'container') {
      if (!parentId) {
        issues.push({
          id: `hierarchy-container-no-parent-${node.id}`,
          severity: 'error',
          category: 'hierarchy',
          messageKey: 'validation.rules.containerNoParent',
          messageParams: { label: getNodeLabel(node) },
          nodeIds: [node.id],
        });
      } else {
        const parent = nodeMap.get(parentId);
        if (parent && getNodeType(parent) !== 'host-server') {
          issues.push({
            id: `hierarchy-container-wrong-parent-${node.id}`,
            severity: 'error',
            category: 'hierarchy',
            messageKey: 'validation.rules.containerWrongParent',
            messageParams: { label: getNodeLabel(node), parentLabel: getNodeLabel(parent) },
            nodeIds: [node.id, parentId],
          });
        }
      }
    }

    // Host-server portMapping container not a child of this host
    if (type === 'host-server') {
      const data = node.data as HostServerNodeData;
      const childIds = nodes
        .filter((n) => (n as { parentId?: string }).parentId === node.id)
        .map((n) => n.id);

      for (const mapping of data.portMappings || []) {
        if (nodeMap.has(mapping.containerNodeId) && !childIds.includes(mapping.containerNodeId)) {
          issues.push({
            id: `hierarchy-port-mapping-not-child-${node.id}-${mapping.id}`,
            severity: 'error',
            category: 'hierarchy',
            messageKey: 'validation.rules.portMappingNotChild',
            messageParams: { label: getNodeLabel(node), port: mapping.hostPort },
            nodeIds: [node.id, mapping.containerNodeId],
          });
        }
      }
    }
  }

  return issues;
}

// ============================================
// Main Validation Function
// ============================================

export function validateArchitecture(nodes: GraphNode[], edges: GraphEdge[]): ValidationResult {
  const issues: ValidationIssue[] = [
    ...connectionRules(nodes, edges),
    ...portRules(nodes, edges),
    ...routingRules(nodes, edges),
    ...resourceRules(nodes, edges),
    ...requiredFieldsRules(nodes),
    ...disconnectedRules(nodes, edges),
    ...configurationRules(nodes, edges),
    ...hierarchyRules(nodes),
  ];

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return {
    issues,
    errorCount,
    warningCount,
    infoCount,
    isValid: errorCount === 0,
  };
}
