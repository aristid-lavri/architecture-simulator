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
  defaultApiServiceData,
  defaultServiceDiscoveryData,
  defaultWAFNodeData,
  zoneColors,
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
      virtualClients: 50,
      baseInterval: 300,
      rampUpEnabled: true,
      rampUpDuration: 15000,
      rampUpCurve: 'linear' as const,
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
      paths: ['/api/service-a', '/api/service-b'],
    },
  },
  {
    id: 'ms-api-gateway',
    type: 'api-gateway',
    position: { x: 300, y: 200 },
    data: {
      ...defaultApiGatewayNodeData,
      label: 'API Gateway',
      routeRules: [
        { id: 'ms-rule-1', pathPattern: '/api/service-a', targetServiceName: 'service-a', priority: 1 },
        { id: 'ms-rule-2', pathPattern: '/api/service-a/**', targetServiceName: 'service-a', priority: 2 },
        { id: 'ms-rule-3', pathPattern: '/api/service-b', targetServiceName: 'service-b', priority: 3 },
        { id: 'ms-rule-4', pathPattern: '/api/service-b/**', targetServiceName: 'service-b', priority: 4 },
      ],
    },
  },
  {
    id: 'ms-service-a',
    type: 'http-server',
    position: { x: 550, y: 100 },
    data: {
      label: 'Service A',
      serviceName: 'service-a',
      basePath: '/api/service-a',
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
      serviceName: 'service-b',
      basePath: '/api/service-b',
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
    id: 'ms-edge-gateway-serviceB',
    source: 'ms-api-gateway',
    target: 'ms-service-b',
    type: 'animated',
  },
  {
    id: 'ms-edge-serviceA-db',
    source: 'ms-service-a',
    target: 'ms-database',
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

// Template 5: E-Commerce Microservices avec Zones Réseau
// Architecture hiérarchique avec 3 zones : DMZ, Backend, Données
//
// [Client Group] → [Zone DMZ: WAF → LB → API Gateway]
//                       ↓
//                  [Zone Backend: 6 microservices + Service Discovery]
//                       ↓
//                  [Zone Données: 2 DB + 2 Cache + Message Queue]
const ecommerceNodes: Node[] = [
  // --- Hors zones (non-nestable) ---
  {
    id: 'ecom-client-group',
    type: 'client-group',
    position: { x: 30, y: 300 },
    data: {
      ...defaultClientGroupData,
      label: 'Clients E-Commerce',
      virtualClients: 40,
      baseInterval: 300,
      paths: ['/api/users', '/api/products', '/api/cart', '/api/orders', '/api/payments'],
    },
  },

  // --- Zone DMZ ---
  {
    id: 'ecom-zone-dmz',
    type: 'network-zone',
    position: { x: 250, y: 150 },
    style: { width: 350, height: 350 },
    data: {
      label: 'Zone DMZ',
      zoneType: 'dmz' as const,
      color: zoneColors.dmz,
      interZoneLatency: 2,
    },
  },
  {
    id: 'ecom-waf',
    type: 'waf',
    position: { x: 30, y: 60 },
    parentId: 'ecom-zone-dmz',
    extent: 'parent' as const,
    data: {
      ...defaultWAFNodeData,
      label: 'WAF',
    },
  },
  {
    id: 'ecom-load-balancer',
    type: 'load-balancer',
    position: { x: 30, y: 190 },
    parentId: 'ecom-zone-dmz',
    extent: 'parent' as const,
    data: {
      ...defaultLoadBalancerNodeData,
      label: 'Load Balancer',
    },
  },
  {
    id: 'ecom-api-gateway',
    type: 'api-gateway',
    position: { x: 180, y: 120 },
    parentId: 'ecom-zone-dmz',
    extent: 'parent' as const,
    data: {
      ...defaultApiGatewayNodeData,
      label: 'API Gateway',
      routeRules: [
        { id: 'ecom-rule-1', pathPattern: '/api/users', targetServiceName: 'user-service', priority: 1 },
        { id: 'ecom-rule-2', pathPattern: '/api/users/**', targetServiceName: 'user-service', priority: 2 },
        { id: 'ecom-rule-3', pathPattern: '/api/products', targetServiceName: 'product-service', priority: 3 },
        { id: 'ecom-rule-4', pathPattern: '/api/products/**', targetServiceName: 'product-service', priority: 4 },
        { id: 'ecom-rule-5', pathPattern: '/api/cart', targetServiceName: 'cart-service', priority: 5 },
        { id: 'ecom-rule-6', pathPattern: '/api/cart/**', targetServiceName: 'cart-service', priority: 6 },
        { id: 'ecom-rule-7', pathPattern: '/api/orders', targetServiceName: 'order-service', priority: 7 },
        { id: 'ecom-rule-8', pathPattern: '/api/orders/**', targetServiceName: 'order-service', priority: 8 },
        { id: 'ecom-rule-9', pathPattern: '/api/payments', targetServiceName: 'payment-service', priority: 9 },
        { id: 'ecom-rule-10', pathPattern: '/api/payments/**', targetServiceName: 'payment-service', priority: 10 },
        { id: 'ecom-rule-11', pathPattern: '/api/notifications', targetServiceName: 'notification-service', priority: 11 },
        { id: 'ecom-rule-12', pathPattern: '/api/notifications/**', targetServiceName: 'notification-service', priority: 12 },
      ],
    },
  },

  // --- Zone Backend ---
  {
    id: 'ecom-zone-backend',
    type: 'network-zone',
    position: { x: 650, y: 30 },
    style: { width: 500, height: 680 },
    data: {
      label: 'Zone Backend',
      zoneType: 'backend' as const,
      color: zoneColors.backend,
      interZoneLatency: 2,
    },
  },
  {
    id: 'ecom-user-service',
    type: 'api-service',
    position: { x: 30, y: 60 },
    parentId: 'ecom-zone-backend',
    extent: 'parent' as const,
    data: {
      ...defaultApiServiceData,
      label: 'Service Utilisateurs',
      serviceName: 'user-service',
      basePath: '/api/users',
      responseTime: 30,
    },
  },
  {
    id: 'ecom-product-service',
    type: 'api-service',
    position: { x: 260, y: 60 },
    parentId: 'ecom-zone-backend',
    extent: 'parent' as const,
    data: {
      ...defaultApiServiceData,
      label: 'Service Produits',
      serviceName: 'product-service',
      basePath: '/api/products',
      responseTime: 25,
    },
  },
  {
    id: 'ecom-cart-service',
    type: 'api-service',
    position: { x: 30, y: 200 },
    parentId: 'ecom-zone-backend',
    extent: 'parent' as const,
    data: {
      ...defaultApiServiceData,
      label: 'Service Panier',
      serviceName: 'cart-service',
      basePath: '/api/cart',
      responseTime: 20,
    },
  },
  {
    id: 'ecom-order-service',
    type: 'api-service',
    position: { x: 260, y: 200 },
    parentId: 'ecom-zone-backend',
    extent: 'parent' as const,
    data: {
      ...defaultApiServiceData,
      label: 'Service Commandes',
      serviceName: 'order-service',
      basePath: '/api/orders',
      responseTime: 35,
    },
  },
  {
    id: 'ecom-payment-service',
    type: 'api-service',
    position: { x: 30, y: 340 },
    parentId: 'ecom-zone-backend',
    extent: 'parent' as const,
    data: {
      ...defaultApiServiceData,
      label: 'Service Paiements',
      serviceName: 'payment-service',
      basePath: '/api/payments',
      responseTime: 50,
    },
  },
  {
    id: 'ecom-notification-service',
    type: 'api-service',
    position: { x: 260, y: 340 },
    parentId: 'ecom-zone-backend',
    extent: 'parent' as const,
    data: {
      ...defaultApiServiceData,
      label: 'Service Notifications',
      serviceName: 'notification-service',
      basePath: '/api/notifications',
      responseTime: 15,
    },
  },
  {
    id: 'ecom-service-discovery',
    type: 'service-discovery',
    position: { x: 150, y: 490 },
    parentId: 'ecom-zone-backend',
    extent: 'parent' as const,
    data: {
      ...defaultServiceDiscoveryData,
      label: 'Service Discovery',
      provider: 'consul',
    },
  },

  // --- Zone Données ---
  {
    id: 'ecom-zone-data',
    type: 'network-zone',
    position: { x: 1200, y: 30 },
    style: { width: 280, height: 680 },
    data: {
      label: 'Zone Données',
      zoneType: 'data' as const,
      color: zoneColors.data,
      interZoneLatency: 1,
    },
  },
  {
    id: 'ecom-users-db',
    type: 'database',
    position: { x: 50, y: 60 },
    parentId: 'ecom-zone-data',
    extent: 'parent' as const,
    data: {
      ...defaultDatabaseNodeData,
      label: 'Base Utilisateurs',
    },
  },
  {
    id: 'ecom-products-db',
    type: 'database',
    position: { x: 50, y: 180 },
    parentId: 'ecom-zone-data',
    extent: 'parent' as const,
    data: {
      ...defaultDatabaseNodeData,
      label: 'Base Produits',
    },
  },
  {
    id: 'ecom-product-cache',
    type: 'cache',
    position: { x: 50, y: 300 },
    parentId: 'ecom-zone-data',
    extent: 'parent' as const,
    data: {
      ...defaultCacheNodeData,
      label: 'Cache Produits',
    },
  },
  {
    id: 'ecom-cart-cache',
    type: 'cache',
    position: { x: 50, y: 420 },
    parentId: 'ecom-zone-data',
    extent: 'parent' as const,
    data: {
      ...defaultCacheNodeData,
      label: 'Cache Panier',
    },
  },
  {
    id: 'ecom-message-queue',
    type: 'message-queue',
    position: { x: 50, y: 540 },
    parentId: 'ecom-zone-data',
    extent: 'parent' as const,
    data: {
      ...defaultMessageQueueNodeData,
      label: "Bus d'événements",
      queueType: 'rabbitmq',
      mode: 'pubsub',
      consumerCount: 2,
    },
  },
];

const ecommerceEdges: Edge[] = [
  // Client → Zone DMZ
  { id: 'ecom-edge-client-waf', source: 'ecom-client-group', target: 'ecom-waf', type: 'animated' },
  { id: 'ecom-edge-waf-lb', source: 'ecom-waf', target: 'ecom-load-balancer', type: 'animated' },
  { id: 'ecom-edge-lb-gateway', source: 'ecom-load-balancer', target: 'ecom-api-gateway', type: 'animated' },
  // API Gateway → Microservices (Zone Backend)
  { id: 'ecom-edge-gw-users', source: 'ecom-api-gateway', target: 'ecom-user-service', type: 'animated' },
  { id: 'ecom-edge-gw-products', source: 'ecom-api-gateway', target: 'ecom-product-service', type: 'animated' },
  { id: 'ecom-edge-gw-cart', source: 'ecom-api-gateway', target: 'ecom-cart-service', type: 'animated' },
  { id: 'ecom-edge-gw-orders', source: 'ecom-api-gateway', target: 'ecom-order-service', type: 'animated' },
  { id: 'ecom-edge-gw-payments', source: 'ecom-api-gateway', target: 'ecom-payment-service', type: 'animated' },
  // Microservices → Zone Données
  { id: 'ecom-edge-users-db', source: 'ecom-user-service', target: 'ecom-users-db', type: 'animated' },
  { id: 'ecom-edge-products-db', source: 'ecom-product-service', target: 'ecom-products-db', type: 'animated' },
  { id: 'ecom-edge-products-cache', source: 'ecom-product-service', target: 'ecom-product-cache', type: 'animated' },
  { id: 'ecom-edge-cart-cache', source: 'ecom-cart-service', target: 'ecom-cart-cache', type: 'animated' },
  { id: 'ecom-edge-orders-db', source: 'ecom-order-service', target: 'ecom-users-db', type: 'animated' },
  { id: 'ecom-edge-orders-queue', source: 'ecom-order-service', target: 'ecom-message-queue', type: 'animated' },
  // Async : Message Queue → Notification Service
  { id: 'ecom-edge-queue-notif', source: 'ecom-message-queue', target: 'ecom-notification-service', type: 'animated' },
  // Inter-service
  { id: 'ecom-edge-payment-order', source: 'ecom-payment-service', target: 'ecom-order-service', type: 'animated' },
  // Service Discovery
  { id: 'ecom-edge-gw-discovery', source: 'ecom-api-gateway', target: 'ecom-service-discovery', type: 'animated' },
];

import { advancedTemplates } from './advanced-templates';

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
  {
    id: 'ecommerce',
    nameKey: 'templates.ecommerce.name',
    descriptionKey: 'templates.ecommerce.description',
    nodes: ecommerceNodes,
    edges: ecommerceEdges,
  },
  ...advancedTemplates,
];

export function getTemplateById(id: string): ArchitectureTemplate | undefined {
  return architectureTemplates.find((t) => t.id === id);
}