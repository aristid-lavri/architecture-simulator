import type { Node, Edge } from '@xyflow/react';
import {
  defaultClientGroupData,
  defaultServerResources,
  defaultDegradation,
  defaultDatabaseNodeData,
  defaultCacheNodeData,
  defaultLoadBalancerNodeData,
  defaultMessageQueueNodeData,
  defaultApiGatewayNodeData,
} from '@/types';

export interface ArchitectureTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  nodes: Node[];
  edges: Edge[];
}

// Template 1: Monolith Simple
// [Client Group] → [HTTP Server] → [Cache] → [Database]
// Architecture cache-aside : le serveur consulte le cache, puis la DB si miss
const monolithNodes: Node[] = [
  {
    id: 'monolith-client-group',
    type: 'client-group',
    position: { x: 100, y: 200 },
    data: {
      ...defaultClientGroupData,
      label: 'Clients',
      virtualClients: 20,
      baseInterval: 500,
    },
  },
  {
    id: 'monolith-http-server',
    type: 'http-server',
    position: { x: 350, y: 200 },
    data: {
      label: 'Serveur Principal',
      port: 8080,
      responseStatus: 200,
      responseBody: '{"success": true}',
      responseDelay: 50,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'monolith-cache',
    type: 'cache',
    position: { x: 600, y: 200 },
    data: {
      ...defaultCacheNodeData,
      label: 'Cache Redis',
    },
  },
  {
    id: 'monolith-database',
    type: 'database',
    position: { x: 850, y: 200 },
    data: {
      ...defaultDatabaseNodeData,
      label: 'Base de données',
    },
  },
];

const monolithEdges: Edge[] = [
  {
    id: 'monolith-edge-client-server',
    source: 'monolith-client-group',
    target: 'monolith-http-server',
    type: 'animated',
  },
  {
    id: 'monolith-edge-server-cache',
    source: 'monolith-http-server',
    target: 'monolith-cache',
    type: 'animated',
  },
  {
    id: 'monolith-edge-cache-db',
    source: 'monolith-cache',
    target: 'monolith-database',
    type: 'animated',
  },
];

// Template 2: Load Balanced
//                     ┌→ [Server 1] ─┐
// [Client Group] → [Load Balancer] → [Server 2] → [Database]
//                     └→ [Server 3] ─┘
const loadBalancedNodes: Node[] = [
  {
    id: 'lb-client-group',
    type: 'client-group',
    position: { x: 50, y: 250 },
    data: {
      ...defaultClientGroupData,
      label: 'Clients',
      virtualClients: 3,
      baseInterval: 1000,
    },
  },
  {
    id: 'lb-load-balancer',
    type: 'load-balancer',
    position: { x: 300, y: 250 },
    data: {
      ...defaultLoadBalancerNodeData,
      label: 'Load Balancer',
    },
  },
  {
    id: 'lb-http-server-1',
    type: 'http-server',
    position: { x: 550, y: 100 },
    data: {
      label: 'Serveur 1',
      port: 8081,
      responseStatus: 200,
      responseBody: '{"server": 1}',
      responseDelay: 50,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'lb-http-server-2',
    type: 'http-server',
    position: { x: 550, y: 250 },
    data: {
      label: 'Serveur 2',
      port: 8082,
      responseStatus: 200,
      responseBody: '{"server": 2}',
      responseDelay: 50,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'lb-http-server-3',
    type: 'http-server',
    position: { x: 550, y: 400 },
    data: {
      label: 'Serveur 3',
      port: 8083,
      responseStatus: 200,
      responseBody: '{"server": 3}',
      responseDelay: 50,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'lb-database',
    type: 'database',
    position: { x: 800, y: 250 },
    data: {
      ...defaultDatabaseNodeData,
      label: 'Base de données',
    },
  },
];

const loadBalancedEdges: Edge[] = [
  {
    id: 'lb-edge-client-lb',
    source: 'lb-client-group',
    target: 'lb-load-balancer',
    type: 'animated',
  },
  {
    id: 'lb-edge-lb-server1',
    source: 'lb-load-balancer',
    target: 'lb-http-server-1',
    type: 'animated',
  },
  {
    id: 'lb-edge-lb-server2',
    source: 'lb-load-balancer',
    target: 'lb-http-server-2',
    type: 'animated',
  },
  {
    id: 'lb-edge-lb-server3',
    source: 'lb-load-balancer',
    target: 'lb-http-server-3',
    type: 'animated',
  },
  {
    id: 'lb-edge-server1-db',
    source: 'lb-http-server-1',
    target: 'lb-database',
    type: 'animated',
  },
  {
    id: 'lb-edge-server2-db',
    source: 'lb-http-server-2',
    target: 'lb-database',
    type: 'animated',
  },
  {
    id: 'lb-edge-server3-db',
    source: 'lb-http-server-3',
    target: 'lb-database',
    type: 'animated',
  },
];

// Template 3: Microservices
// [Client Group] → [API Gateway] → [Service A] → [Database A]
//                                       ↓
//                                  [Service B] → [Cache]
const microservicesNodes: Node[] = [
  {
    id: 'ms-client-group',
    type: 'client-group',
    position: { x: 50, y: 200 },
    data: {
      ...defaultClientGroupData,
      label: 'Clients',
      virtualClients: 30,
      baseInterval: 300,
    },
  },
  {
    id: 'ms-api-gateway',
    type: 'api-gateway',
    position: { x: 300, y: 200 },
    data: {
      ...defaultApiGatewayNodeData,
      label: 'API Gateway',
    },
  },
  {
    id: 'ms-service-a',
    type: 'http-server',
    position: { x: 550, y: 100 },
    data: {
      label: 'Service A',
      port: 8081,
      responseStatus: 200,
      responseBody: '{"service": "A"}',
      responseDelay: 30,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'ms-service-b',
    type: 'http-server',
    position: { x: 550, y: 300 },
    data: {
      label: 'Service B',
      port: 8082,
      responseStatus: 200,
      responseBody: '{"service": "B"}',
      responseDelay: 40,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'ms-database',
    type: 'database',
    position: { x: 800, y: 100 },
    data: {
      ...defaultDatabaseNodeData,
      label: 'Database',
    },
  },
  {
    id: 'ms-cache',
    type: 'cache',
    position: { x: 800, y: 300 },
    data: {
      ...defaultCacheNodeData,
      label: 'Cache',
    },
  },
];

const microservicesEdges: Edge[] = [
  {
    id: 'ms-edge-client-gateway',
    source: 'ms-client-group',
    target: 'ms-api-gateway',
    type: 'animated',
  },
  {
    id: 'ms-edge-gateway-serviceA',
    source: 'ms-api-gateway',
    target: 'ms-service-a',
    type: 'animated',
  },
  {
    id: 'ms-edge-serviceA-db',
    source: 'ms-service-a',
    target: 'ms-database',
    type: 'animated',
  },
  {
    id: 'ms-edge-serviceA-serviceB',
    source: 'ms-service-a',
    target: 'ms-service-b',
    type: 'animated',
  },
  {
    id: 'ms-edge-serviceB-cache',
    source: 'ms-service-b',
    target: 'ms-cache',
    type: 'animated',
  },
];

// Template 4: Event-Driven Microservices with Message Queue
// [Client Group] → [API Gateway] → [Order Service] → [Message Queue] → [Notification Service]
//                                        ↓                    ↓
//                                   [Database]         [Inventory Service] → [Cache]
const eventDrivenNodes: Node[] = [
  {
    id: 'ev-client-group',
    type: 'client-group',
    position: { x: 50, y: 200 },
    data: {
      ...defaultClientGroupData,
      label: 'Clients',
      virtualClients: 25,
      baseInterval: 400,
      paths: ['/api/orders', '/api/products'],
    },
  },
  {
    id: 'ev-api-gateway',
    type: 'api-gateway',
    position: { x: 280, y: 200 },
    data: {
      ...defaultApiGatewayNodeData,
      label: 'API Gateway',
      routeRules: [
        { id: 'rule-1', pathPattern: '/api/orders', targetServiceName: 'order-service', priority: 1 },
        { id: 'rule-2', pathPattern: '/api/orders/**', targetServiceName: 'order-service', priority: 2 },
        { id: 'rule-3', pathPattern: '/api/products', targetServiceName: 'product-service', priority: 3 },
        { id: 'rule-4', pathPattern: '/api/products/**', targetServiceName: 'product-service', priority: 4 },
      ],
    },
  },
  {
    id: 'ev-product-service',
    type: 'http-server',
    position: { x: 510, y: 50 },
    data: {
      label: 'Product Service',
      serviceName: 'product-service',
      basePath: '/api/products',
      port: 8084,
      responseStatus: 200,
      responseBody: '{"productId": "P-001", "name": "Widget"}',
      responseDelay: 20,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'ev-order-service',
    type: 'http-server',
    position: { x: 510, y: 200 },
    data: {
      label: 'Order Service',
      serviceName: 'order-service',
      basePath: '/api/orders',
      port: 8081,
      responseStatus: 201,
      responseBody: '{"orderId": "12345", "status": "created"}',
      responseDelay: 25,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'ev-database',
    type: 'database',
    position: { x: 510, y: 380 },
    data: {
      ...defaultDatabaseNodeData,
      label: 'Orders DB',
    },
  },
  {
    id: 'ev-message-queue',
    type: 'message-queue',
    position: { x: 740, y: 200 },
    data: {
      ...defaultMessageQueueNodeData,
      label: 'Event Bus',
      queueType: 'kafka',
      mode: 'pubsub',
      consumerCount: 2,
    },
  },
  {
    id: 'ev-notification-service',
    type: 'http-server',
    position: { x: 970, y: 100 },
    data: {
      label: 'Notification Service',
      serviceName: 'notification-service',
      basePath: '/notifications',
      port: 8082,
      responseStatus: 200,
      responseBody: '{"sent": true}',
      responseDelay: 15,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'ev-inventory-service',
    type: 'http-server',
    position: { x: 970, y: 300 },
    data: {
      label: 'Inventory Service',
      serviceName: 'inventory-service',
      basePath: '/inventory',
      port: 8083,
      responseStatus: 200,
      responseBody: '{"updated": true}',
      responseDelay: 20,
      errorRate: 0,
      resources: defaultServerResources,
      degradation: defaultDegradation,
    },
  },
  {
    id: 'ev-cache',
    type: 'cache',
    position: { x: 1200, y: 300 },
    data: {
      ...defaultCacheNodeData,
      label: 'Inventory Cache',
    },
  },
];

const eventDrivenEdges: Edge[] = [
  {
    id: 'ev-edge-client-gateway',
    source: 'ev-client-group',
    target: 'ev-api-gateway',
    type: 'animated',
  },
  {
    id: 'ev-edge-gateway-order',
    source: 'ev-api-gateway',
    target: 'ev-order-service',
    type: 'animated',
  },
  {
    id: 'ev-edge-gateway-product',
    source: 'ev-api-gateway',
    target: 'ev-product-service',
    type: 'animated',
  },
  {
    id: 'ev-edge-order-db',
    source: 'ev-order-service',
    target: 'ev-database',
    type: 'animated',
  },
  {
    id: 'ev-edge-order-queue',
    source: 'ev-order-service',
    target: 'ev-message-queue',
    type: 'animated',
  },
  {
    id: 'ev-edge-queue-notification',
    source: 'ev-message-queue',
    target: 'ev-notification-service',
    type: 'animated',
  },
  {
    id: 'ev-edge-queue-inventory',
    source: 'ev-message-queue',
    target: 'ev-inventory-service',
    type: 'animated',
  },
  {
    id: 'ev-edge-inventory-cache',
    source: 'ev-inventory-service',
    target: 'ev-cache',
    type: 'animated',
  },
];

export const architectureTemplates: ArchitectureTemplate[] = [
  {
    id: 'monolith',
    nameKey: 'templates.monolith.name',
    descriptionKey: 'templates.monolith.description',
    nodes: monolithNodes,
    edges: monolithEdges,
  },
  {
    id: 'load-balanced',
    nameKey: 'templates.loadBalanced.name',
    descriptionKey: 'templates.loadBalanced.description',
    nodes: loadBalancedNodes,
    edges: loadBalancedEdges,
  },
  {
    id: 'microservices',
    nameKey: 'templates.microservices.name',
    descriptionKey: 'templates.microservices.description',
    nodes: microservicesNodes,
    edges: microservicesEdges,
  },
  {
    id: 'event-driven',
    nameKey: 'templates.eventDriven.name',
    descriptionKey: 'templates.eventDriven.description',
    nodes: eventDrivenNodes,
    edges: eventDrivenEdges,
  },
];

export function getTemplateById(id: string): ArchitectureTemplate | undefined {
  return architectureTemplates.find((t) => t.id === id);
}