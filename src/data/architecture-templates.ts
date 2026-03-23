/**
 * Templates d'architecture chargés via YAML parser.
 * Chaque template est défini comme une string YAML, parsée au chargement
 * pour générer les GraphNode[]/GraphEdge[] utilisés par le moteur PixiJS.
 */
import type { GraphNode, GraphEdge } from '@/types/graph';
import { parseYamlArchitecture } from '@/lib/yaml-parser';

export interface ArchitectureTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function createTemplateFromYaml(
  id: string,
  nameKey: string,
  descriptionKey: string,
  yaml: string
): ArchitectureTemplate | null {
  const result = parseYamlArchitecture(yaml);
  if ('error' in result) {
    console.warn(`[Template] Failed to parse "${id}":`, result.error);
    return null;
  }
  return { id, nameKey, descriptionKey, nodes: result.nodes, edges: result.edges };
}

// ============================================
// Template 1 : Monolith Simple
// [Client Group] → [HTTP Server] → [Cache] → [Database]
// Architecture cache-aside : le serveur consulte le cache, puis la DB si miss
// ============================================
const monolithYaml = `
version: 1
name: "Monolith Simple"

components:
  clients:
    type: client-group
    position: { x: 100, y: 200 }
    config:
      label: "Clients"
      virtualClients: 20
      baseInterval: 500

  serveur-principal:
    type: http-server
    position: { x: 350, y: 200 }
    config:
      label: "Serveur Principal"
      port: 8080
      responseStatus: 200
      responseBody: '{"success": true}'
      responseDelay: 50
      errorRate: 0

  cache-redis:
    type: cache
    position: { x: 600, y: 200 }
    config:
      label: "Cache Redis"

  base-de-donnees:
    type: database
    position: { x: 850, y: 200 }
    config:
      label: "Base de données"

connections:
  - from: clients
    to: serveur-principal
  - from: serveur-principal
    to: cache-redis
  - from: cache-redis
    to: base-de-donnees
`;

// ============================================
// Template 2 : Load Balanced
//                     ┌→ [Server 1] ─┐
// [Client Group] → [Load Balancer] → [Server 2] → [Database]
//                     └→ [Server 3] ─┘
// Avec zone backend pour les serveurs et zone données pour la DB
// ============================================
const loadBalancedYaml = `
version: 1
name: "Load Balanced"

zones:
  backend:
    type: backend
    interZoneLatency: 1
    position: { x: 450, y: 50 }
    size: { width: 350, height: 500 }
  data:
    type: data
    interZoneLatency: 1
    position: { x: 850, y: 50 }
    size: { width: 250, height: 500 }

components:
  clients:
    type: client-group
    position: { x: 50, y: 250 }
    config:
      label: "Clients"
      virtualClients: 50
      baseInterval: 300
      rampUpEnabled: true
      rampUpDuration: 15000
      rampUpCurve: linear

  load-balancer:
    type: load-balancer
    position: { x: 250, y: 250 }
    config:
      label: "Load Balancer"

  serveur-1:
    type: api-service
    zone: backend
    config:
      label: "Serveur 1"
      serviceName: "server-1"
      basePath: "/api"
      responseTime: 50

  serveur-2:
    type: api-service
    zone: backend
    config:
      label: "Serveur 2"
      serviceName: "server-2"
      basePath: "/api"
      responseTime: 50

  serveur-3:
    type: api-service
    zone: backend
    config:
      label: "Serveur 3"
      serviceName: "server-3"
      basePath: "/api"
      responseTime: 50

  database:
    type: database
    zone: data
    config:
      label: "Base de données"

connections:
  - from: clients
    to: load-balancer
  - from: load-balancer
    to: serveur-1
  - from: load-balancer
    to: serveur-2
  - from: load-balancer
    to: serveur-3
  - from: serveur-1
    to: database
  - from: serveur-2
    to: database
  - from: serveur-3
    to: database
`;

// ============================================
// Template 3 : Microservices
// [Client Group] → [Zone DMZ: API Gateway]
//                       ↓
//                  [Zone Backend: Service A + Service B]
//                       ↓
//                  [Zone Données: Database + Cache]
// ============================================
const microservicesYaml = `
version: 1
name: "Microservices"

zones:
  dmz:
    type: dmz
    interZoneLatency: 2
    position: { x: 250, y: 30 }
    size: { width: 250, height: 200 }
  backend:
    type: backend
    interZoneLatency: 1
    position: { x: 250, y: 280 }
    size: { width: 500, height: 220 }
  data:
    type: data
    interZoneLatency: 1
    position: { x: 250, y: 550 }
    size: { width: 500, height: 200 }

components:
  clients:
    type: client-group
    position: { x: 50, y: 100 }
    config:
      label: "Clients"
      virtualClients: 30
      baseInterval: 300
      paths:
        - /api/service-a
        - /api/service-b

  api-gateway:
    type: api-gateway
    zone: dmz
    config:
      label: "API Gateway"
      routeRules:
        - id: rule-1
          pathPattern: "/api/service-a"
          targetServiceName: "service-a"
          priority: 1
        - id: rule-2
          pathPattern: "/api/service-a/**"
          targetServiceName: "service-a"
          priority: 2
        - id: rule-3
          pathPattern: "/api/service-b"
          targetServiceName: "service-b"
          priority: 3
        - id: rule-4
          pathPattern: "/api/service-b/**"
          targetServiceName: "service-b"
          priority: 4

  service-a:
    type: api-service
    zone: backend
    config:
      label: "Service A"
      serviceName: "service-a"
      basePath: "/api/service-a"
      responseTime: 30

  service-b:
    type: api-service
    zone: backend
    config:
      label: "Service B"
      serviceName: "service-b"
      basePath: "/api/service-b"
      responseTime: 40

  database:
    type: database
    zone: data
    config:
      label: "Database"

  cache:
    type: cache
    zone: data
    config:
      label: "Cache"

connections:
  - from: clients
    to: api-gateway
  - from: api-gateway
    to: service-a
  - from: api-gateway
    to: service-b
  - from: service-a
    to: database
  - from: service-b
    to: cache
`;

// ============================================
// Template 4 : Event-Driven Microservices
// [Client Group] → [Zone DMZ: API Gateway]
//                       ↓
//                  [Zone Backend: Order Service + Product Service]
//                       ↓
//                  [Zone Données: DB + Message Queue + Cache]
//                       ↓ (async)
//                  [Notification Service + Inventory Service]
// ============================================
const eventDrivenYaml = `
version: 1
name: "Event-Driven Microservices"

zones:
  dmz:
    type: dmz
    interZoneLatency: 2
    position: { x: 230, y: 30 }
    size: { width: 250, height: 200 }
  backend:
    type: backend
    interZoneLatency: 1
    position: { x: 100, y: 280 }
    size: { width: 700, height: 250 }
  data:
    type: data
    interZoneLatency: 1
    position: { x: 100, y: 580 }
    size: { width: 700, height: 200 }

components:
  clients:
    type: client-group
    position: { x: 30, y: 100 }
    config:
      label: "Clients"
      virtualClients: 25
      baseInterval: 400
      paths:
        - /api/orders
        - /api/products

  api-gateway:
    type: api-gateway
    zone: dmz
    config:
      label: "API Gateway"
      routeRules:
        - id: rule-1
          pathPattern: "/api/orders"
          targetServiceName: "order-service"
          priority: 1
        - id: rule-2
          pathPattern: "/api/orders/**"
          targetServiceName: "order-service"
          priority: 2
        - id: rule-3
          pathPattern: "/api/products"
          targetServiceName: "product-service"
          priority: 3
        - id: rule-4
          pathPattern: "/api/products/**"
          targetServiceName: "product-service"
          priority: 4

  product-service:
    type: api-service
    zone: backend
    config:
      label: "Product Service"
      serviceName: "product-service"
      basePath: "/api/products"
      responseTime: 20

  order-service:
    type: api-service
    zone: backend
    config:
      label: "Order Service"
      serviceName: "order-service"
      basePath: "/api/orders"
      responseTime: 25

  notification-service:
    type: api-service
    zone: backend
    config:
      label: "Notification Service"
      serviceName: "notification-service"
      basePath: "/notifications"
      responseTime: 15

  inventory-service:
    type: api-service
    zone: backend
    config:
      label: "Inventory Service"
      serviceName: "inventory-service"
      basePath: "/inventory"
      responseTime: 20

  orders-db:
    type: database
    zone: data
    config:
      label: "Orders DB"

  event-bus:
    type: message-queue
    zone: data
    config:
      label: "Event Bus"
      queueType: kafka
      mode: pubsub
      consumerCount: 2

  inventory-cache:
    type: cache
    zone: data
    config:
      label: "Inventory Cache"

connections:
  - from: clients
    to: api-gateway
  - from: api-gateway
    to: order-service
  - from: api-gateway
    to: product-service
  - from: order-service
    to: orders-db
  - from: order-service
    to: event-bus
  - from: event-bus
    to: notification-service
  - from: event-bus
    to: inventory-service
  - from: inventory-service
    to: inventory-cache
`;

// ============================================
// Template 5 : E-Commerce Microservices avec Zones Réseau
// Architecture hiérarchique avec 3 zones : DMZ, Backend, Données
//
// [Client Group] → [Zone DMZ: WAF → LB → API Gateway]
//                       ↓
//                  [Zone Backend: 6 microservices + Service Discovery]
//                       ↓
//                  [Zone Données: 2 DB + 2 Cache + Message Queue]
// ============================================
const ecommerceYaml = `
version: 1
name: "E-Commerce Microservices"

zones:
  dmz:
    type: dmz
    interZoneLatency: 2
    position: { x: 250, y: 150 }
    size: { width: 350, height: 350 }
  backend:
    type: backend
    interZoneLatency: 2
    position: { x: 650, y: 30 }
    size: { width: 500, height: 680 }
  data:
    type: data
    interZoneLatency: 1
    position: { x: 1200, y: 30 }
    size: { width: 280, height: 680 }

components:
  clients-ecommerce:
    type: client-group
    position: { x: 30, y: 300 }
    config:
      label: "Clients E-Commerce"
      virtualClients: 40
      baseInterval: 300
      paths:
        - /api/users
        - /api/products
        - /api/cart
        - /api/orders
        - /api/payments

  waf:
    type: waf
    zone: dmz
    position: { x: 30, y: 60 }
    config:
      label: "WAF"

  load-balancer:
    type: load-balancer
    zone: dmz
    position: { x: 30, y: 190 }
    config:
      label: "Load Balancer"

  api-gateway:
    type: api-gateway
    zone: dmz
    position: { x: 180, y: 120 }
    config:
      label: "API Gateway"
      routeRules:
        - id: ecom-rule-1
          pathPattern: "/api/users"
          targetServiceName: "user-service"
          priority: 1
        - id: ecom-rule-2
          pathPattern: "/api/users/**"
          targetServiceName: "user-service"
          priority: 2
        - id: ecom-rule-3
          pathPattern: "/api/products"
          targetServiceName: "product-service"
          priority: 3
        - id: ecom-rule-4
          pathPattern: "/api/products/**"
          targetServiceName: "product-service"
          priority: 4
        - id: ecom-rule-5
          pathPattern: "/api/cart"
          targetServiceName: "cart-service"
          priority: 5
        - id: ecom-rule-6
          pathPattern: "/api/cart/**"
          targetServiceName: "cart-service"
          priority: 6
        - id: ecom-rule-7
          pathPattern: "/api/orders"
          targetServiceName: "order-service"
          priority: 7
        - id: ecom-rule-8
          pathPattern: "/api/orders/**"
          targetServiceName: "order-service"
          priority: 8
        - id: ecom-rule-9
          pathPattern: "/api/payments"
          targetServiceName: "payment-service"
          priority: 9
        - id: ecom-rule-10
          pathPattern: "/api/payments/**"
          targetServiceName: "payment-service"
          priority: 10
        - id: ecom-rule-11
          pathPattern: "/api/notifications"
          targetServiceName: "notification-service"
          priority: 11
        - id: ecom-rule-12
          pathPattern: "/api/notifications/**"
          targetServiceName: "notification-service"
          priority: 12

  user-service:
    type: api-service
    zone: backend
    position: { x: 30, y: 60 }
    config:
      label: "Service Utilisateurs"
      serviceName: "user-service"
      basePath: "/api/users"
      responseTime: 30

  product-service:
    type: api-service
    zone: backend
    position: { x: 260, y: 60 }
    config:
      label: "Service Produits"
      serviceName: "product-service"
      basePath: "/api/products"
      responseTime: 25

  cart-service:
    type: api-service
    zone: backend
    position: { x: 30, y: 200 }
    config:
      label: "Service Panier"
      serviceName: "cart-service"
      basePath: "/api/cart"
      responseTime: 20

  order-service:
    type: api-service
    zone: backend
    position: { x: 260, y: 200 }
    config:
      label: "Service Commandes"
      serviceName: "order-service"
      basePath: "/api/orders"
      responseTime: 35

  payment-service:
    type: api-service
    zone: backend
    position: { x: 30, y: 340 }
    config:
      label: "Service Paiements"
      serviceName: "payment-service"
      basePath: "/api/payments"
      responseTime: 50

  notification-service:
    type: api-service
    zone: backend
    position: { x: 260, y: 340 }
    config:
      label: "Service Notifications"
      serviceName: "notification-service"
      basePath: "/api/notifications"
      responseTime: 15

  service-discovery:
    type: service-discovery
    zone: backend
    position: { x: 150, y: 490 }
    config:
      label: "Service Discovery"
      provider: consul

  users-db:
    type: database
    zone: data
    position: { x: 50, y: 60 }
    config:
      label: "Base Utilisateurs"

  products-db:
    type: database
    zone: data
    position: { x: 50, y: 180 }
    config:
      label: "Base Produits"

  product-cache:
    type: cache
    zone: data
    position: { x: 50, y: 300 }
    config:
      label: "Cache Produits"

  cart-cache:
    type: cache
    zone: data
    position: { x: 50, y: 420 }
    config:
      label: "Cache Panier"

  message-queue:
    type: message-queue
    zone: data
    position: { x: 50, y: 540 }
    config:
      label: "Bus d'événements"
      queueType: rabbitmq
      mode: pubsub
      consumerCount: 2

connections:
  - from: clients-ecommerce
    to: waf
  - from: waf
    to: load-balancer
  - from: load-balancer
    to: api-gateway
  - from: api-gateway
    to: user-service
  - from: api-gateway
    to: product-service
  - from: api-gateway
    to: cart-service
  - from: api-gateway
    to: order-service
  - from: api-gateway
    to: payment-service
  - from: user-service
    to: users-db
  - from: product-service
    to: products-db
  - from: product-service
    to: product-cache
  - from: cart-service
    to: cart-cache
  - from: order-service
    to: users-db
  - from: order-service
    to: message-queue
  - from: message-queue
    to: notification-service
  - from: payment-service
    to: order-service
  - from: api-gateway
    to: service-discovery
`;

// ============================================
// Build template list
// ============================================
const basicTemplateConfigs = [
  { id: 'monolith', nameKey: 'templates.monolith.name', descriptionKey: 'templates.monolith.description', yaml: monolithYaml },
  { id: 'load-balanced', nameKey: 'templates.loadBalanced.name', descriptionKey: 'templates.loadBalanced.description', yaml: loadBalancedYaml },
  { id: 'microservices', nameKey: 'templates.microservices.name', descriptionKey: 'templates.microservices.description', yaml: microservicesYaml },
  { id: 'event-driven', nameKey: 'templates.eventDriven.name', descriptionKey: 'templates.eventDriven.description', yaml: eventDrivenYaml },
  { id: 'ecommerce', nameKey: 'templates.ecommerce.name', descriptionKey: 'templates.ecommerce.description', yaml: ecommerceYaml },
] as const;

const basicTemplates: ArchitectureTemplate[] = basicTemplateConfigs
  .map(({ id, nameKey, descriptionKey, yaml }) => createTemplateFromYaml(id, nameKey, descriptionKey, yaml))
  .filter((t): t is ArchitectureTemplate => t !== null);

import { advancedTemplates } from './advanced-templates';

export const architectureTemplates: ArchitectureTemplate[] = [
  ...basicTemplates,
  ...advancedTemplates,
];

export function getTemplateById(id: string): ArchitectureTemplate | undefined {
  return architectureTemplates.find((t) => t.id === id);
}
