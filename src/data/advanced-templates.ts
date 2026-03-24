/**
 * Templates avancés chargés via YAML parser.
 * Chaque template est défini comme une string YAML, parsée au chargement
 * pour générer les GraphNode[]/GraphEdge[] utilisés par le moteur PixiJS.
 */
import { parseYamlArchitecture } from '@/lib/yaml-parser';
import type { ArchitectureTemplate } from './architecture-templates';

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
// Template : Système de Gestion d'Impôt Provincial
// ============================================
const taxSystemYaml = `
version: 1
name: "Impôt Provincial"

zones:
  dmz:
    type: dmz
    interZoneLatency: 2
    position: { x: 50, y: 30 }
    size: { width: 1100, height: 280 }
  applicative:
    type: backend
    interZoneLatency: 1
    position: { x: 50, y: 360 }
    size: { width: 1100, height: 700 }
  data-securisee:
    type: data
    interZoneLatency: 1
    position: { x: 50, y: 1110 }
    size: { width: 1100, height: 380 }

hosts:
  host-declarations:
    zone: applicative
    ipAddress: "10.1.1.10"
    hostname: "decl-server-01"
    position: { x: 30, y: 60 }
    size: { width: 500, height: 350 }
    config:
      label: "Serveur Déclarations"
  host-paiements:
    zone: applicative
    ipAddress: "10.1.2.10"
    hostname: "paie-server-01"
    position: { x: 570, y: 60 }
    size: { width: 470, height: 250 }
    config:
      label: "Serveur Paiements & Avis"
  host-data:
    zone: data-securisee
    ipAddress: "10.2.1.10"
    hostname: "data-fiscal-01"
    position: { x: 30, y: 60 }
    size: { width: 750, height: 260 }
    config:
      label: "Données Fiscales"

components:
  contribuables-web:
    type: client-group
    config:
      label: "Contribuables Web"
      virtualClients: 500
      requestMode: parallel
      concurrentRequests: 25
      baseInterval: 500
      intervalVariance: 35
      distribution: burst
      burstSize: 60
      burstInterval: 4000
      rampUpEnabled: true
      rampUpDuration: 60000
      rampUpCurve: exponential
      method: GET
      requestDistribution:
        - method: GET
          path: "/api/compte/profil"
          weight: 20
        - method: POST
          path: "/api/declarations/soumettre"
          weight: 25
        - method: GET
          path: "/api/declarations/statut"
          weight: 20
        - method: GET
          path: "/api/calcul/simulation"
          weight: 15
        - method: POST
          path: "/api/paiements/effectuer"
          weight: 10
        - method: GET
          path: "/api/documents/avis"
          weight: 10

  mandataires:
    type: client-group
    config:
      label: "Comptables & Mandataires"
      virtualClients: 150
      requestMode: parallel
      concurrentRequests: 12
      baseInterval: 1000
      intervalVariance: 30
      distribution: burst
      burstSize: 15
      burstInterval: 10000
      rampUpEnabled: true
      rampUpDuration: 30000
      rampUpCurve: linear
      method: POST
      requestDistribution:
        - method: POST
          path: "/api/declarations/soumettre"
          weight: 35
        - method: GET
          path: "/api/declarations/statut"
          weight: 25
        - method: GET
          path: "/api/calcul/simulation"
          weight: 20
        - method: POST
          path: "/api/declarations/lot"
          weight: 20

  agents-fiscaux:
    type: client-group
    config:
      label: "Agents Fiscaux"
      virtualClients: 100
      requestMode: parallel
      concurrentRequests: 8
      baseInterval: 2000
      intervalVariance: 25
      distribution: uniform
      rampUpEnabled: false
      method: GET
      requestDistribution:
        - method: GET
          path: "/api/compte/recherche"
          weight: 30
        - method: GET
          path: "/api/declarations/detail"
          weight: 25
        - method: GET
          path: "/api/paiements/historique"
          weight: 25
        - method: PUT
          path: "/api/declarations/corriger"
          weight: 20

  waf-fiscal:
    type: waf
    zone: dmz
    config:
      label: "WAF Gouvernemental"
      provider: aws-waf
      inspectionLatencyMs: 3
      blockRate: 5
      rules:
        sqlInjection: true
        xss: true
        rateLimiting: true
        ipBlocking: true
        geoBlocking: true
      requestsPerSecond: 12000

  cdn-fiscal:
    type: cdn
    zone: dmz
    config:
      label: "CDN Portail"
      provider: cloudfront
      cacheHitRatio: 75
      edgeLatencyMs: 5
      originLatencyMs: 40
      bandwidthMbps: 5000
      cacheTTLSeconds: 7200

  gw-fiscal:
    type: api-gateway
    zone: dmz
    config:
      label: "API Gateway Fiscal"
      authType: jwt
      authFailureRate: 2
      rateLimiting:
        enabled: true
        requestsPerSecond: 600
        burstSize: 120
        windowMs: 1000
      routeRules:
        - id: route-declarations
          pathPattern: "/declarations/*"
          targetServiceName: "declarations-api"
          priority: 1
        - id: route-calcul
          pathPattern: "/calcul/*"
          targetServiceName: "calcul-api"
          priority: 2
        - id: route-paiements
          pathPattern: "/paiements/*"
          targetServiceName: "paiements-api"
          priority: 3
        - id: route-compte
          pathPattern: "/compte/*"
          targetServiceName: "compte-api"
          priority: 4
      baseLatencyMs: 5

  lb-fiscal:
    type: load-balancer
    zone: dmz
    config:
      label: "Load Balancer"
      algorithm: round-robin
      healthCheck:
        enabled: true
        intervalMs: 5000
        timeoutMs: 2000
        unhealthyThreshold: 3

  ct-declarations:
    type: container
    host: host-declarations
    config:
      label: "Container Déclarations"
      image: "declarations:latest"
      replicas: 3
      cpuLimitCores: 4
      memoryLimitMB: 2048
      autoScaling:
        enabled: true
        minReplicas: 2
        maxReplicas: 10
        targetCPU: 65

  ct-calcul:
    type: container
    host: host-declarations
    config:
      label: "Container Calcul"
      image: "calcul:latest"
      replicas: 2
      cpuLimitCores: 4
      memoryLimitMB: 2048
      autoScaling:
        enabled: true
        minReplicas: 2
        maxReplicas: 8
        targetCPU: 60

  svc-declarations:
    type: api-service
    container: ct-declarations
    config:
      label: "API Déclarations"
      serviceName: "declarations-api"
      basePath: "/api/declarations"
      authType: jwt
      authFailureRate: 0
      responseTime: 80
      errorRate: 1
      maxConcurrentRequests: 200

  svc-compte:
    type: api-service
    container: ct-declarations
    config:
      label: "API Compte"
      serviceName: "compte-api"
      basePath: "/api/compte"
      authType: jwt
      authFailureRate: 0
      responseTime: 40
      errorRate: 1
      maxConcurrentRequests: 250

  svc-calcul:
    type: api-service
    container: ct-calcul
    config:
      label: "API Calcul Impôt"
      serviceName: "calcul-api"
      basePath: "/api/calcul"
      authType: jwt
      authFailureRate: 0
      responseTime: 100
      errorRate: 1
      maxConcurrentRequests: 150

  cb-paiement:
    type: circuit-breaker
    container: ct-calcul
    config:
      label: "CB Paiement Ext."
      failureThreshold: 5
      successThreshold: 3
      timeout: 30000
      halfOpenMaxRequests: 3

  svc-paiements:
    type: api-service
    host: host-paiements
    config:
      label: "API Paiements"
      serviceName: "paiements-api"
      basePath: "/api/paiements"
      authType: jwt
      authFailureRate: 0
      responseTime: 150
      errorRate: 2
      maxConcurrentRequests: 80

  job-calcul-batch:
    type: background-job
    host: host-paiements
    config:
      label: "Worker Calcul Batch"
      jobType: worker
      concurrency: 8
      processingTimeMs: 500
      errorRate: 1
      batchSize: 200

  job-avis-pdf:
    type: background-job
    host: host-paiements
    config:
      label: "Worker Avis PDF"
      jobType: batch
      concurrency: 4
      processingTimeMs: 1500
      errorRate: 2
      batchSize: 100

  mq-calculs:
    type: message-queue
    zone: applicative
    config:
      label: "MQ Calculs"
      queueType: rabbitmq
      mode: fifo
      configuration:
        maxQueueSize: 50000
        deliveryDelayMs: 0
        visibilityTimeoutMs: 60000
      performance:
        publishLatencyMs: 2
        consumeLatencyMs: 5
        messagesPerSecond: 3000
      consumerCount: 3
      ackMode: manual
      retryEnabled: true
      maxRetries: 5
      deadLetterEnabled: true

  mq-notifications:
    type: message-queue
    zone: applicative
    config:
      label: "MQ Notifications"
      queueType: rabbitmq
      mode: pubsub
      configuration:
        maxQueueSize: 30000
        deliveryDelayMs: 500
        visibilityTimeoutMs: 15000
      performance:
        publishLatencyMs: 2
        consumeLatencyMs: 5
        messagesPerSecond: 5000
      consumerCount: 5
      ackMode: auto
      retryEnabled: true
      maxRetries: 3
      deadLetterEnabled: true

  sd-fiscal:
    type: service-discovery
    zone: applicative
    config:
      label: "Service Discovery"
      provider: consul

  idp-gouv:
    type: identity-provider
    zone: applicative
    config:
      label: "Auth Gouvernemental"
      providerType: keycloak
      protocol: oidc
      tokenFormat: jwt
      tokenValidationLatencyMs: 5
      tokenGenerationLatencyMs: 120
      mfaEnabled: true
      mfaLatencyMs: 3000
      errorRate: 1

  db-contribuables:
    type: database
    host: host-data
    config:
      label: "DB Contribuables"
      databaseType: postgresql
      connectionPool:
        maxConnections: 40
        minConnections: 8
      performance:
        readLatencyMs: 3
        writeLatencyMs: 12
        transactionLatencyMs: 30
      capacity:
        maxQueriesPerSecond: 4000

  db-declarations:
    type: database
    host: host-data
    config:
      label: "DB Déclarations"
      databaseType: postgresql
      connectionPool:
        maxConnections: 30
        minConnections: 5
      performance:
        readLatencyMs: 5
        writeLatencyMs: 20
        transactionLatencyMs: 45
      capacity:
        maxQueriesPerSecond: 2500

  db-transactions:
    type: database
    host: host-data
    config:
      label: "DB Transactions"
      databaseType: postgresql
      connectionPool:
        maxConnections: 20
        minConnections: 3
      performance:
        readLatencyMs: 4
        writeLatencyMs: 15
        transactionLatencyMs: 35
      capacity:
        maxQueriesPerSecond: 2000

  cache-baremes:
    type: cache
    host: host-data
    config:
      label: "Cache Barèmes"
      cacheType: redis
      configuration:
        maxMemoryMB: 256
        defaultTTLSeconds: 86400
        evictionPolicy: lfu
      initialHitRatio: 90

  cache-sessions:
    type: cache
    host: host-data
    config:
      label: "Cache Sessions"
      cacheType: redis
      configuration:
        maxMemoryMB: 512
        defaultTTLSeconds: 1800
        evictionPolicy: lru
      initialHitRatio: 85

  storage-documents:
    type: cloud-storage
    zone: data-securisee
    config:
      label: "S3 Documents"
      provider: aws
      readLatencyMs: 20
      writeLatencyMs: 50
      bandwidthMbps: 500
      maxRequestsPerSecond: 3000

connections:
  - from: contribuables-web
    to: waf-fiscal
  - from: mandataires
    to: waf-fiscal
  - from: agents-fiscaux
    to: waf-fiscal
  - from: waf-fiscal
    to: cdn-fiscal
  - from: cdn-fiscal
    to: gw-fiscal
  - from: waf-fiscal
    to: gw-fiscal
  - from: gw-fiscal
    to: lb-fiscal
  - from: gw-fiscal
    to: idp-gouv
  - from: idp-gouv
    to: cache-sessions
  - from: idp-gouv
    to: db-contribuables
  - from: lb-fiscal
    to: svc-declarations
  - from: lb-fiscal
    to: svc-compte
  - from: lb-fiscal
    to: svc-calcul
  - from: lb-fiscal
    to: svc-paiements
  - from: svc-declarations
    to: db-declarations
  - from: svc-declarations
    to: db-contribuables
  - from: svc-declarations
    to: mq-calculs
  - from: svc-compte
    to: db-contribuables
  - from: svc-compte
    to: db-declarations
  - from: svc-compte
    to: db-transactions
  - from: svc-compte
    to: cache-sessions
  - from: svc-calcul
    to: cache-baremes
  - from: svc-calcul
    to: db-contribuables
  - from: svc-calcul
    to: db-declarations
  - from: svc-paiements
    to: db-transactions
  - from: svc-paiements
    to: db-contribuables
  - from: svc-paiements
    to: cb-paiement
  - from: svc-paiements
    to: mq-notifications
  - from: cb-paiement
    to: mq-notifications
  - from: mq-calculs
    to: job-calcul-batch
  - from: job-calcul-batch
    to: db-declarations
  - from: job-calcul-batch
    to: db-contribuables
  - from: job-calcul-batch
    to: cache-baremes
  - from: job-calcul-batch
    to: mq-notifications
  - from: mq-notifications
    to: job-avis-pdf
  - from: job-avis-pdf
    to: storage-documents
  - from: job-avis-pdf
    to: db-contribuables
  - from: svc-declarations
    to: sd-fiscal
  - from: svc-calcul
    to: sd-fiscal
`;

// ============================================
// Template : Centralisation Données Médicales
// ============================================
const medicalCentralYaml = `
version: 1
name: "Centralisation Médicale"

zones:
  dmz-sante:
    type: dmz
    interZoneLatency: 2
    position: { x: 50, y: 30 }
    size: { width: 1200, height: 260 }
  services:
    type: backend
    interZoneLatency: 1
    position: { x: 50, y: 340 }
    size: { width: 1200, height: 800 }
  data-protegee:
    type: data
    interZoneLatency: 1
    position: { x: 50, y: 1190 }
    size: { width: 1200, height: 380 }

hosts:
  host-lecture:
    zone: services
    ipAddress: "10.1.1.10"
    hostname: "read-server-01"
    position: { x: 30, y: 60 }
    size: { width: 500, height: 260 }
    config:
      label: "Serveur Lecture"
  host-ecriture:
    zone: services
    ipAddress: "10.1.2.10"
    hostname: "write-server-01"
    position: { x: 570, y: 60 }
    size: { width: 500, height: 280 }
    config:
      label: "Serveur Écriture"
  host-imagerie:
    zone: services
    ipAddress: "10.1.3.10"
    hostname: "img-server-01"
    position: { x: 30, y: 370 }
    size: { width: 380, height: 200 }
    config:
      label: "Serveur Imagerie"
  host-data:
    zone: data-protegee
    ipAddress: "10.2.1.10"
    hostname: "data-sante-01"
    position: { x: 30, y: 60 }
    size: { width: 850, height: 260 }
    config:
      label: "Données Primaires"

components:
  hopitaux:
    type: client-group
    config:
      label: "Hôpitaux (24/7)"
      virtualClients: 200
      requestMode: parallel
      concurrentRequests: 15
      baseInterval: 500
      intervalVariance: 40
      distribution: burst
      burstSize: 25
      burstInterval: 4000
      rampUpEnabled: true
      rampUpDuration: 30000
      rampUpCurve: linear
      method: GET
      requestDistribution:
        - method: GET
          path: "/api/patients/dossier"
          weight: 30
        - method: POST
          path: "/api/patients/admission"
          weight: 15
        - method: GET
          path: "/api/ordonnances"
          weight: 15
        - method: GET
          path: "/api/resultats"
          weight: 10
        - method: POST
          path: "/api/imagerie/upload"
          weight: 10
        - method: PUT
          path: "/api/patients/notes"
          weight: 20

  cliniques:
    type: client-group
    config:
      label: "Cliniques (8h-17h)"
      virtualClients: 300
      requestMode: parallel
      concurrentRequests: 15
      baseInterval: 600
      intervalVariance: 30
      distribution: uniform
      rampUpEnabled: true
      rampUpDuration: 45000
      rampUpCurve: exponential
      method: GET
      requestDistribution:
        - method: GET
          path: "/api/patients/dossier"
          weight: 35
        - method: GET
          path: "/api/ordonnances"
          weight: 20
        - method: GET
          path: "/api/resultats"
          weight: 15
        - method: POST
          path: "/api/ordonnances/prescrire"
          weight: 15
        - method: PUT
          path: "/api/patients/notes"
          weight: 15

  pharmacies:
    type: client-group
    config:
      label: "Pharmacies (90% lecture)"
      virtualClients: 150
      requestMode: parallel
      concurrentRequests: 12
      baseInterval: 400
      intervalVariance: 25
      distribution: uniform
      rampUpEnabled: false
      method: GET
      requestDistribution:
        - method: GET
          path: "/api/ordonnances/verifier"
          weight: 40
        - method: GET
          path: "/api/patients/allergies"
          weight: 25
        - method: GET
          path: "/api/patients/dossier"
          weight: 15
        - method: POST
          path: "/api/ordonnances/dispenser"
          weight: 10
        - method: GET
          path: "/api/ordonnances"
          weight: 10

  laboratoires:
    type: client-group
    config:
      label: "Laboratoires (70% écriture)"
      virtualClients: 100
      requestMode: parallel
      concurrentRequests: 8
      baseInterval: 800
      intervalVariance: 30
      distribution: uniform
      rampUpEnabled: false
      method: POST
      requestDistribution:
        - method: POST
          path: "/api/resultats/soumettre"
          weight: 40
        - method: POST
          path: "/api/resultats/lot"
          weight: 20
        - method: GET
          path: "/api/patients/dossier"
          weight: 15
        - method: GET
          path: "/api/ordonnances"
          weight: 15
        - method: PUT
          path: "/api/resultats/corriger"
          weight: 10

  clsc:
    type: client-group
    config:
      label: "CLSC (requêtes lourdes)"
      virtualClients: 80
      requestMode: parallel
      concurrentRequests: 5
      baseInterval: 2000
      intervalVariance: 35
      distribution: uniform
      rampUpEnabled: false
      method: GET
      requestDistribution:
        - method: GET
          path: "/api/patients/dossier-complet"
          weight: 35
        - method: GET
          path: "/api/patients/suivi"
          weight: 25
        - method: GET
          path: "/api/ordonnances"
          weight: 15
        - method: GET
          path: "/api/resultats"
          weight: 15
        - method: PUT
          path: "/api/patients/plan"
          weight: 10

  waf-sante:
    type: waf
    zone: dmz-sante
    config:
      label: "WAF Santé"
      provider: aws-waf
      inspectionLatencyMs: 3
      blockRate: 4
      requestsPerSecond: 10000

  gw-sante:
    type: api-gateway
    zone: dmz-sante
    config:
      label: "API Gateway Santé"
      authType: jwt
      authFailureRate: 1
      rateLimiting:
        enabled: true
        requestsPerSecond: 700
        burstSize: 150
        windowMs: 1000
      routeRules:
        - id: route-patients
          pathPattern: "/patients/*"
          targetServiceName: "patients-read"
          priority: 1
        - id: route-ordonnances-r
          pathPattern: "/ordonnances/verifier"
          targetServiceName: "ordonnances-read"
          priority: 2
        - id: route-ordonnances-w
          pathPattern: "/ordonnances/prescrire"
          targetServiceName: "ordonnances-write"
          priority: 3
        - id: route-resultats
          pathPattern: "/resultats/*"
          targetServiceName: "resultats-write"
          priority: 4
        - id: route-imagerie
          pathPattern: "/imagerie/*"
          targetServiceName: "imagerie-api"
          priority: 5
      baseLatencyMs: 5

  lb-lecture:
    type: load-balancer
    zone: dmz-sante
    config:
      label: "LB Lecture"
      algorithm: round-robin

  lb-ecriture:
    type: load-balancer
    zone: dmz-sante
    config:
      label: "LB Écriture"
      algorithm: least-connections

  ct-lecture:
    type: container
    host: host-lecture
    config:
      label: "Container Lecture"
      image: "sante-read:latest"
      replicas: 3
      cpuLimitCores: 4
      memoryLimitMB: 2048
      autoScaling:
        enabled: true
        minReplicas: 3
        maxReplicas: 10
        targetCPU: 65

  svc-patients-read:
    type: api-service
    container: ct-lecture
    config:
      label: "API Dossier Patient (R)"
      serviceName: "patients-read"
      basePath: "/api/patients"
      authType: jwt
      authFailureRate: 0
      responseTime: 30
      maxConcurrentRequests: 300

  svc-ordonnances-read:
    type: api-service
    container: ct-lecture
    config:
      label: "API Ordonnances (R)"
      serviceName: "ordonnances-read"
      basePath: "/api/ordonnances"
      authType: jwt
      authFailureRate: 0
      responseTime: 25
      maxConcurrentRequests: 250

  ct-ecriture:
    type: container
    host: host-ecriture
    config:
      label: "Container Écriture"
      image: "sante-write:latest"
      replicas: 2
      cpuLimitCores: 4
      memoryLimitMB: 2048
      autoScaling:
        enabled: true
        minReplicas: 2
        maxReplicas: 6
        targetCPU: 60

  svc-patients-write:
    type: api-service
    container: ct-ecriture
    config:
      label: "API Dossier Patient (W)"
      serviceName: "patients-write"
      authType: jwt
      authFailureRate: 0
      responseTime: 60
      errorRate: 1
      maxConcurrentRequests: 150

  svc-resultats-write:
    type: api-service
    container: ct-ecriture
    config:
      label: "API Résultats Labo"
      serviceName: "resultats-write"
      authType: jwt
      authFailureRate: 0
      responseTime: 80
      errorRate: 1
      maxConcurrentRequests: 120

  svc-ordonnances-write:
    type: api-service
    container: ct-ecriture
    config:
      label: "API Ordonnances (W)"
      serviceName: "ordonnances-write"
      authType: jwt
      authFailureRate: 0
      responseTime: 70
      errorRate: 1
      maxConcurrentRequests: 100

  svc-imagerie:
    type: api-service
    host: host-imagerie
    config:
      label: "API Imagerie Médicale"
      serviceName: "imagerie-api"
      authType: jwt
      authFailureRate: 0
      responseTime: 200
      errorRate: 2
      maxConcurrentRequests: 40

  job-images:
    type: background-job
    host: host-imagerie
    config:
      label: "Worker Images"
      jobType: worker
      concurrency: 4
      processingTimeMs: 2000
      errorRate: 2

  mq-events:
    type: message-queue
    zone: services
    config:
      label: "MQ Events Médicaux"
      queueType: kafka
      mode: pubsub
      configuration:
        maxQueueSize: 50000
        deliveryDelayMs: 0
        visibilityTimeoutMs: 30000
      performance:
        publishLatencyMs: 2
        consumeLatencyMs: 3
        messagesPerSecond: 8000
      consumerCount: 5
      ackMode: manual
      retryEnabled: true
      maxRetries: 5
      deadLetterEnabled: true

  mq-alertes:
    type: message-queue
    zone: services
    config:
      label: "MQ Alertes Cliniques"
      queueType: rabbitmq
      mode: priority
      configuration:
        maxQueueSize: 10000
        deliveryDelayMs: 0
        visibilityTimeoutMs: 10000
      performance:
        publishLatencyMs: 1
        consumeLatencyMs: 2
        messagesPerSecond: 5000
      consumerCount: 3
      ackMode: manual
      retryEnabled: true
      maxRetries: 3
      deadLetterEnabled: true

  job-audit:
    type: background-job
    zone: services
    config:
      label: "Worker Audit Trail"
      jobType: worker
      concurrency: 5
      processingTimeMs: 50

  job-alertes:
    type: background-job
    zone: services
    config:
      label: "Worker Alertes"
      jobType: worker
      concurrency: 3
      processingTimeMs: 200
      errorRate: 1

  job-sync-dsq:
    type: background-job
    zone: services
    config:
      label: "Worker Sync DSQ"
      jobType: worker
      concurrency: 4
      processingTimeMs: 100
      errorRate: 1

  sd-sante:
    type: service-discovery
    zone: services
    config:
      label: "Service Discovery"
      provider: consul

  idp-sante:
    type: identity-provider
    zone: services
    config:
      label: "Auth Santé"
      providerType: keycloak
      protocol: oidc
      tokenFormat: jwt
      mfaEnabled: true
      mfaLatencyMs: 2000
      errorRate: 1

  db-patients:
    type: database
    host: host-data
    config:
      label: "DB Patients (DSQ)"
      databaseType: postgresql
      connectionPool:
        maxConnections: 50
        minConnections: 10
      performance:
        readLatencyMs: 3
        writeLatencyMs: 12
        transactionLatencyMs: 30
      capacity:
        maxQueriesPerSecond: 5000

  db-ordonnances:
    type: database
    host: host-data
    config:
      label: "DB Ordonnances"
      databaseType: postgresql
      connectionPool:
        maxConnections: 30
        minConnections: 5
      performance:
        readLatencyMs: 3
        writeLatencyMs: 15
        transactionLatencyMs: 35
      capacity:
        maxQueriesPerSecond: 3000

  db-resultats:
    type: database
    host: host-data
    config:
      label: "DB Résultats Labo"
      databaseType: postgresql
      connectionPool:
        maxConnections: 25
        minConnections: 5
      performance:
        readLatencyMs: 4
        writeLatencyMs: 18
        transactionLatencyMs: 40
      capacity:
        maxQueriesPerSecond: 2000

  cache-dsq:
    type: cache
    host: host-data
    config:
      label: "Cache DSQ"
      cacheType: redis
      configuration:
        maxMemoryMB: 2048
        defaultTTLSeconds: 1800
        evictionPolicy: lfu
      initialHitRatio: 75

  cache-sessions:
    type: cache
    host: host-data
    config:
      label: "Cache Sessions"
      cacheType: redis
      configuration:
        maxMemoryMB: 512
        defaultTTLSeconds: 3600
        evictionPolicy: lru
      initialHitRatio: 85

  storage-dicom:
    type: cloud-storage
    zone: data-protegee
    config:
      label: "S3 Imagerie DICOM"
      provider: aws
      readLatencyMs: 30
      writeLatencyMs: 80
      bandwidthMbps: 1000

  storage-documents:
    type: cloud-storage
    zone: data-protegee
    config:
      label: "S3 Documents"
      provider: aws
      readLatencyMs: 20
      writeLatencyMs: 50
      bandwidthMbps: 500

connections:
  - from: hopitaux
    to: waf-sante
  - from: cliniques
    to: waf-sante
  - from: pharmacies
    to: waf-sante
  - from: laboratoires
    to: waf-sante
  - from: clsc
    to: waf-sante
  - from: waf-sante
    to: gw-sante
  - from: gw-sante
    to: lb-lecture
  - from: gw-sante
    to: lb-ecriture
  - from: gw-sante
    to: idp-sante
  - from: idp-sante
    to: cache-sessions
  - from: idp-sante
    to: db-patients
  - from: lb-lecture
    to: svc-patients-read
  - from: lb-lecture
    to: svc-ordonnances-read
  - from: lb-ecriture
    to: svc-patients-write
  - from: lb-ecriture
    to: svc-resultats-write
  - from: lb-ecriture
    to: svc-ordonnances-write
  - from: lb-ecriture
    to: svc-imagerie
  - from: svc-patients-read
    to: cache-dsq
  - from: svc-patients-read
    to: db-patients
  - from: svc-patients-read
    to: db-ordonnances
  - from: svc-patients-read
    to: db-resultats
  - from: svc-ordonnances-read
    to: cache-dsq
  - from: svc-ordonnances-read
    to: db-ordonnances
  - from: svc-ordonnances-read
    to: db-patients
  - from: svc-patients-write
    to: db-patients
  - from: svc-patients-write
    to: mq-events
  - from: svc-resultats-write
    to: db-resultats
  - from: svc-resultats-write
    to: db-patients
  - from: svc-resultats-write
    to: mq-events
  - from: svc-resultats-write
    to: mq-alertes
  - from: svc-ordonnances-write
    to: db-ordonnances
  - from: svc-ordonnances-write
    to: db-patients
  - from: svc-ordonnances-write
    to: mq-events
  - from: svc-imagerie
    to: storage-dicom
  - from: svc-imagerie
    to: db-patients
  - from: svc-imagerie
    to: mq-events
  - from: svc-imagerie
    to: job-images
  - from: mq-events
    to: job-audit
  - from: mq-events
    to: job-alertes
  - from: mq-events
    to: job-sync-dsq
  - from: mq-alertes
    to: job-alertes
  - from: job-audit
    to: storage-documents
  - from: job-sync-dsq
    to: cache-dsq
  - from: job-sync-dsq
    to: db-patients
  - from: job-images
    to: storage-dicom
  - from: job-images
    to: db-patients
  - from: svc-patients-read
    to: sd-sante
  - from: svc-patients-write
    to: sd-sante
`;

// ============================================
// Template : Groupe Bancaire Multi-Pôles
// ============================================
const bankingYaml = `
version: 1
name: "Groupe Bancaire Multi-Pôles"

zones:
  edge:
    type: dmz
    interZoneLatency: 2
    position: { x: 50, y: 30 }
    size: { width: 1300, height: 280 }
  qc:
    type: backend
    interZoneLatency: 1
    position: { x: 50, y: 360 }
    size: { width: 1300, height: 800 }
  ontario:
    type: backend
    interZoneLatency: 5
    position: { x: 50, y: 1210 }
    size: { width: 620, height: 400 }
  bc:
    type: backend
    interZoneLatency: 8
    position: { x: 720, y: 1210 }
    size: { width: 620, height: 400 }
  data-centrale:
    type: data
    interZoneLatency: 1
    position: { x: 50, y: 1660 }
    size: { width: 1300, height: 500 }

hosts:
  host-banque-qc:
    zone: qc
    ipAddress: "10.1.1.10"
    hostname: "banque-qc-01"
    position: { x: 30, y: 60 }
    size: { width: 600, height: 380 }
    config:
      label: "Pôle Banque QC"
  host-assurance-qc:
    zone: qc
    ipAddress: "10.1.2.10"
    hostname: "assurance-qc-01"
    position: { x: 670, y: 60 }
    size: { width: 560, height: 270 }
    config:
      label: "Pôle Assurance QC"
  host-compta-qc:
    zone: qc
    ipAddress: "10.1.3.10"
    hostname: "compta-qc-01"
    position: { x: 670, y: 370 }
    size: { width: 560, height: 230 }
    config:
      label: "Pôle Comptabilité QC"
  host-on:
    zone: ontario
    ipAddress: "10.2.1.10"
    hostname: "services-on-01"
    position: { x: 30, y: 60 }
    size: { width: 560, height: 280 }
    config:
      label: "Services Ontario"
  host-bc:
    zone: bc
    ipAddress: "10.3.1.10"
    hostname: "services-bc-01"
    position: { x: 30, y: 60 }
    size: { width: 560, height: 280 }
    config:
      label: "Services C.-B."
  host-data:
    zone: data-centrale
    ipAddress: "10.10.1.10"
    hostname: "data-master-01"
    position: { x: 30, y: 60 }
    size: { width: 850, height: 380 }
    config:
      label: "Data Primaire"

components:
  clients-web:
    type: client-group
    config:
      label: "Clients Web"
      virtualClients: 500
      requestMode: parallel
      concurrentRequests: 25
      baseInterval: 400
      intervalVariance: 30
      distribution: burst
      burstSize: 40
      burstInterval: 5000
      rampUpEnabled: true
      rampUpDuration: 60000
      rampUpCurve: exponential
      method: GET
      requestDistribution:
        - method: GET
          path: "/api/comptes/solde"
          weight: 35
        - method: GET
          path: "/api/comptes/historique"
          weight: 20
        - method: POST
          path: "/api/virements"
          weight: 15
        - method: GET
          path: "/api/assurance/polices"
          weight: 10
        - method: POST
          path: "/api/auth/login"
          weight: 10
        - method: GET
          path: "/api/prets/simulation"
          weight: 10

  clients-mobile:
    type: client-group
    config:
      label: "Clients Mobile"
      virtualClients: 300
      requestMode: parallel
      concurrentRequests: 15
      baseInterval: 600
      intervalVariance: 40
      distribution: burst
      burstSize: 30
      burstInterval: 8000
      rampUpEnabled: true
      rampUpDuration: 45000
      rampUpCurve: linear
      method: GET
      requestDistribution:
        - method: GET
          path: "/api/comptes/solde"
          weight: 50
        - method: POST
          path: "/api/virements"
          weight: 20
        - method: GET
          path: "/api/notifications"
          weight: 15
        - method: POST
          path: "/api/auth/login"
          weight: 15

  app-crm-banque:
    type: client-group
    config:
      label: "CRM Banque (interne)"
      virtualClients: 120
      requestMode: parallel
      concurrentRequests: 10
      baseInterval: 1000
      intervalVariance: 25
      distribution: uniform
      rampUpEnabled: false
      method: GET
      requestDistribution:
        - method: GET
          path: "/internal/clients/recherche"
          weight: 30
        - method: GET
          path: "/internal/comptes/detail"
          weight: 25
        - method: POST
          path: "/internal/prets/demande"
          weight: 15
        - method: GET
          path: "/internal/assurance/polices"
          weight: 15
        - method: PUT
          path: "/internal/clients/modifier"
          weight: 15

  app-crm-assurance:
    type: client-group
    config:
      label: "CRM Assurance (interne)"
      virtualClients: 80
      requestMode: parallel
      concurrentRequests: 6
      baseInterval: 1500
      intervalVariance: 30
      distribution: uniform
      rampUpEnabled: false
      method: GET
      requestDistribution:
        - method: GET
          path: "/internal/clients/recherche"
          weight: 25
        - method: POST
          path: "/internal/assurance/souscription"
          weight: 25
        - method: GET
          path: "/internal/patrimoine/portefeuille"
          weight: 20
        - method: GET
          path: "/internal/comptes/solvabilite"
          weight: 15
        - method: POST
          path: "/internal/assurance/sinistre"
          weight: 15

  waf-principal:
    type: waf
    zone: edge
    config:
      label: "WAF Bancaire"
      provider: aws-waf
      inspectionLatencyMs: 3
      blockRate: 4
      requestsPerSecond: 15000

  cdn-portail:
    type: cdn
    zone: edge
    config:
      label: "CDN Portail"
      provider: cloudfront
      cacheHitRatio: 80
      edgeLatencyMs: 5
      originLatencyMs: 40
      bandwidthMbps: 10000

  gw-central:
    type: api-gateway
    zone: edge
    config:
      label: "API Gateway Central"
      authType: jwt
      authFailureRate: 2
      rateLimiting:
        enabled: true
        requestsPerSecond: 800
        burstSize: 150
        windowMs: 1000
      routeRules:
        - id: route-comptes
          pathPattern: "/comptes/*"
          targetServiceName: "comptes-particuliers"
          priority: 1
        - id: route-virements
          pathPattern: "/virements/*"
          targetServiceName: "virements-api"
          priority: 2
        - id: route-prets
          pathPattern: "/prets/*"
          targetServiceName: "prets-api"
          priority: 3
        - id: route-assurance
          pathPattern: "/assurance/*"
          targetServiceName: "assurance-particulier"
          priority: 4
        - id: route-patrimoine
          pathPattern: "/patrimoine/*"
          targetServiceName: "patrimoine-api"
          priority: 5
        - id: route-comptabilite
          pathPattern: "/comptabilite/*"
          targetServiceName: "grand-livre-api"
          priority: 6
      baseLatencyMs: 5

  gw-interne:
    type: api-gateway
    zone: edge
    config:
      label: "GW Interne (service accounts)"
      authType: oauth2
      authFailureRate: 1
      rateLimiting:
        enabled: true
        requestsPerSecond: 2000
        burstSize: 500
        windowMs: 1000
      routeRules:
        - id: int-comptes
          pathPattern: "/comptes/*"
          targetServiceName: "comptes-particuliers"
          priority: 1
        - id: int-assurance
          pathPattern: "/assurance/*"
          targetServiceName: "assurance-particulier"
          priority: 2
        - id: int-comptabilite
          pathPattern: "/comptabilite/*"
          targetServiceName: "grand-livre-api"
          priority: 3
      baseLatencyMs: 3

  lb-geo:
    type: load-balancer
    zone: edge
    config:
      label: "LB Géo-Routage"
      algorithm: least-connections
      stickySessions: true

  ct-banque:
    type: container
    host: host-banque-qc
    config:
      label: "Container Banque"
      image: "banque:latest"
      replicas: 3
      cpuLimitCores: 4
      memoryLimitMB: 2048
      autoScaling:
        enabled: true
        minReplicas: 3
        maxReplicas: 8
        targetCPU: 70

  ct-transactions:
    type: container
    host: host-banque-qc
    config:
      label: "Container Transactions"
      image: "transactions:latest"
      replicas: 2
      cpuLimitCores: 2
      memoryLimitMB: 1024
      autoScaling:
        enabled: true
        minReplicas: 2
        maxReplicas: 6
        targetCPU: 65

  svc-comptes-part:
    type: api-service
    container: ct-banque
    config:
      label: "API Comptes Particuliers"
      serviceName: "comptes-particuliers"
      authType: jwt
      authFailureRate: 0
      responseTime: 40
      errorRate: 1
      maxConcurrentRequests: 300

  svc-comptes-ent:
    type: api-service
    container: ct-banque
    config:
      label: "API Comptes Entreprise"
      serviceName: "comptes-entreprise"
      authType: jwt
      authFailureRate: 0
      responseTime: 60
      errorRate: 1
      maxConcurrentRequests: 150

  svc-virements:
    type: api-service
    container: ct-transactions
    config:
      label: "API Virements"
      serviceName: "virements-api"
      authType: jwt
      authFailureRate: 0
      responseTime: 120
      errorRate: 2
      maxConcurrentRequests: 100

  svc-prets:
    type: api-service
    container: ct-transactions
    config:
      label: "API Prêts"
      serviceName: "prets-api"
      authType: jwt
      authFailureRate: 0
      responseTime: 150
      errorRate: 1
      maxConcurrentRequests: 80

  cb-paiement-ext:
    type: circuit-breaker
    container: ct-transactions
    config:
      label: "CB Paiement Ext."
      failureThreshold: 5
      successThreshold: 3
      timeout: 30000
      halfOpenMaxRequests: 3

  ct-assurance:
    type: container
    host: host-assurance-qc
    config:
      label: "Container Assurance"
      image: "assurance:latest"
      replicas: 2
      cpuLimitCores: 3
      memoryLimitMB: 1536
      autoScaling:
        enabled: true
        minReplicas: 2
        maxReplicas: 5
        targetCPU: 70

  svc-assur-part:
    type: api-service
    container: ct-assurance
    config:
      label: "API Assurance Particulier"
      serviceName: "assurance-particulier"
      authType: jwt
      authFailureRate: 0
      responseTime: 80
      errorRate: 1
      maxConcurrentRequests: 120

  svc-patrimoine:
    type: api-service
    container: ct-assurance
    config:
      label: "API Patrimoine"
      serviceName: "patrimoine-api"
      authType: jwt
      authFailureRate: 0
      responseTime: 100
      errorRate: 1
      maxConcurrentRequests: 80

  svc-assur-groupe:
    type: api-service
    container: ct-assurance
    config:
      label: "API Assurance Groupe"
      serviceName: "assurance-groupe"
      authType: jwt
      authFailureRate: 0
      responseTime: 90
      errorRate: 1
      maxConcurrentRequests: 60

  svc-grand-livre:
    type: api-service
    host: host-compta-qc
    config:
      label: "API Grand Livre"
      serviceName: "grand-livre-api"
      authType: oauth2
      authFailureRate: 0
      responseTime: 100
      errorRate: 1
      maxConcurrentRequests: 60

  svc-rapprochement:
    type: api-service
    host: host-compta-qc
    config:
      label: "API Rapprochement"
      serviceName: "rapprochement-api"
      authType: oauth2
      authFailureRate: 0
      responseTime: 200
      errorRate: 2
      maxConcurrentRequests: 30

  job-reporting:
    type: background-job
    host: host-compta-qc
    config:
      label: "Worker Reporting"
      jobType: batch
      concurrency: 3
      processingTimeMs: 2000
      errorRate: 1
      batchSize: 100

  ct-replica-on:
    type: container
    host: host-on
    config:
      label: "Réplica ON"
      image: "services-replica:latest"
      replicas: 2
      cpuLimitCores: 2
      memoryLimitMB: 1024

  svc-comptes-on:
    type: api-service
    container: ct-replica-on
    config:
      label: "API Comptes (ON)"
      serviceName: "comptes-on"
      authType: jwt
      authFailureRate: 0
      responseTime: 45
      errorRate: 1
      maxConcurrentRequests: 150

  svc-assur-on:
    type: api-service
    container: ct-replica-on
    config:
      label: "API Assurance (ON)"
      serviceName: "assurance-on"
      authType: jwt
      authFailureRate: 0
      responseTime: 85
      errorRate: 1
      maxConcurrentRequests: 80

  cache-on:
    type: cache
    host: host-on
    config:
      label: "Cache ON"
      cacheType: redis
      initialHitRatio: 65

  db-replica-on:
    type: database
    host: host-on
    config:
      label: "DB Replica ON"
      databaseType: postgresql
      connectionPool:
        maxConnections: 15
      performance:
        readLatencyMs: 4
        writeLatencyMs: 50
      capacity:
        maxQueriesPerSecond: 1500

  ct-replica-bc:
    type: container
    host: host-bc
    config:
      label: "Réplica BC"
      image: "services-replica:latest"
      replicas: 2
      cpuLimitCores: 2
      memoryLimitMB: 1024

  svc-comptes-bc:
    type: api-service
    container: ct-replica-bc
    config:
      label: "API Comptes (BC)"
      serviceName: "comptes-bc"
      authType: jwt
      authFailureRate: 0
      responseTime: 50
      errorRate: 1
      maxConcurrentRequests: 120

  svc-assur-bc:
    type: api-service
    container: ct-replica-bc
    config:
      label: "API Assurance (BC)"
      serviceName: "assurance-bc"
      authType: jwt
      authFailureRate: 0
      responseTime: 90
      errorRate: 1
      maxConcurrentRequests: 60

  cache-bc:
    type: cache
    host: host-bc
    config:
      label: "Cache BC"
      cacheType: redis
      initialHitRatio: 60

  db-replica-bc:
    type: database
    host: host-bc
    config:
      label: "DB Replica BC"
      databaseType: postgresql
      connectionPool:
        maxConnections: 10
      performance:
        readLatencyMs: 5
        writeLatencyMs: 60
      capacity:
        maxQueriesPerSecond: 1000

  db-clients:
    type: database
    host: host-data
    config:
      label: "DB Clients Centrale"
      databaseType: postgresql
      connectionPool:
        maxConnections: 50
        minConnections: 10
      performance:
        readLatencyMs: 3
        writeLatencyMs: 12
        transactionLatencyMs: 30
      capacity:
        maxQueriesPerSecond: 5000

  db-comptes:
    type: database
    host: host-data
    config:
      label: "DB Comptes/Transactions"
      databaseType: postgresql
      connectionPool:
        maxConnections: 40
        minConnections: 8
      performance:
        readLatencyMs: 4
        writeLatencyMs: 15
        transactionLatencyMs: 35
      capacity:
        maxQueriesPerSecond: 4000

  db-contrats:
    type: database
    host: host-data
    config:
      label: "DB Contrats Assurance"
      databaseType: postgresql
      connectionPool:
        maxConnections: 25
        minConnections: 5
      performance:
        readLatencyMs: 4
        writeLatencyMs: 18
        transactionLatencyMs: 40
      capacity:
        maxQueriesPerSecond: 2000

  db-compta:
    type: database
    host: host-data
    config:
      label: "DB Comptabilité"
      databaseType: postgresql
      connectionPool:
        maxConnections: 15
      performance:
        readLatencyMs: 5
        writeLatencyMs: 20
        transactionLatencyMs: 50
      capacity:
        maxQueriesPerSecond: 1500

  cache-clients:
    type: cache
    host: host-data
    config:
      label: "Cache Clients"
      cacheType: redis
      configuration:
        maxMemoryMB: 2048
        evictionPolicy: lfu
      initialHitRatio: 80

  cache-sessions:
    type: cache
    host: host-data
    config:
      label: "Cache Sessions SSO"
      cacheType: redis
      configuration:
        maxMemoryMB: 512
        evictionPolicy: lru
      initialHitRatio: 85

  mq-interpoles:
    type: message-queue
    zone: data-centrale
    config:
      label: "MQ Inter-Pôles"
      queueType: kafka
      mode: pubsub
      configuration:
        maxQueueSize: 50000
        visibilityTimeoutMs: 30000
      performance:
        publishLatencyMs: 2
        consumeLatencyMs: 3
        messagesPerSecond: 10000
      consumerCount: 5
      ackMode: manual
      retryEnabled: true
      maxRetries: 5
      deadLetterEnabled: true

  mq-replication:
    type: message-queue
    zone: data-centrale
    config:
      label: "MQ Réplication"
      queueType: kafka
      mode: fifo
      configuration:
        maxQueueSize: 100000
        visibilityTimeoutMs: 60000
      performance:
        publishLatencyMs: 1
        consumeLatencyMs: 2
        messagesPerSecond: 15000
      consumerCount: 3
      ackMode: manual
      retryEnabled: true
      maxRetries: 10
      deadLetterEnabled: true

  mq-notifications:
    type: message-queue
    zone: data-centrale
    config:
      label: "MQ Notifications"
      queueType: rabbitmq
      mode: pubsub
      configuration:
        maxQueueSize: 20000
        deliveryDelayMs: 500
      performance:
        publishLatencyMs: 2
        consumeLatencyMs: 5
        messagesPerSecond: 5000
      consumerCount: 5
      ackMode: auto
      retryEnabled: true
      maxRetries: 3
      deadLetterEnabled: true

  sd-central:
    type: service-discovery
    zone: data-centrale
    config:
      label: "Service Discovery"
      provider: consul

  idp-sso:
    type: identity-provider
    zone: data-centrale
    config:
      label: "SSO Groupe"
      providerType: keycloak
      protocol: oidc
      tokenFormat: jwt
      mfaEnabled: true
      mfaLatencyMs: 2000
      errorRate: 1

  job-sync:
    type: background-job
    zone: data-centrale
    config:
      label: "Worker Sync Réplication"
      jobType: worker
      concurrency: 5
      processingTimeMs: 100
      errorRate: 1

  storage-documents:
    type: cloud-storage
    zone: data-centrale
    config:
      label: "S3 Documents"
      provider: aws
      readLatencyMs: 25
      writeLatencyMs: 60
      bandwidthMbps: 500

connections:
  - from: clients-web
    to: waf-principal
  - from: clients-mobile
    to: waf-principal
  - from: app-crm-banque
    to: gw-interne
  - from: app-crm-assurance
    to: gw-interne
  - from: waf-principal
    to: cdn-portail
  - from: cdn-portail
    to: gw-central
  - from: waf-principal
    to: gw-central
  - from: gw-central
    to: lb-geo
  - from: gw-interne
    to: lb-geo
  - from: gw-central
    to: idp-sso
  - from: gw-interne
    to: idp-sso
  - from: idp-sso
    to: cache-sessions
  - from: idp-sso
    to: db-clients
  - from: lb-geo
    to: svc-comptes-part
  - from: lb-geo
    to: svc-comptes-ent
  - from: lb-geo
    to: svc-virements
  - from: lb-geo
    to: svc-prets
  - from: lb-geo
    to: svc-assur-part
  - from: lb-geo
    to: svc-patrimoine
  - from: lb-geo
    to: svc-assur-groupe
  - from: lb-geo
    to: svc-grand-livre
  - from: lb-geo
    to: svc-rapprochement
  - from: lb-geo
    to: svc-comptes-on
  - from: lb-geo
    to: svc-assur-on
  - from: lb-geo
    to: svc-comptes-bc
  - from: lb-geo
    to: svc-assur-bc
  - from: svc-comptes-part
    to: cache-clients
  - from: svc-comptes-part
    to: db-clients
  - from: svc-comptes-part
    to: db-comptes
  - from: svc-comptes-part
    to: mq-replication
  - from: svc-comptes-ent
    to: cache-clients
  - from: svc-comptes-ent
    to: db-clients
  - from: svc-comptes-ent
    to: db-comptes
  - from: svc-virements
    to: db-comptes
  - from: svc-virements
    to: cb-paiement-ext
  - from: svc-virements
    to: mq-interpoles
  - from: svc-virements
    to: mq-replication
  - from: svc-prets
    to: db-comptes
  - from: svc-prets
    to: db-clients
  - from: svc-assur-part
    to: cache-clients
  - from: svc-assur-part
    to: db-clients
  - from: svc-assur-part
    to: db-contrats
  - from: svc-assur-part
    to: mq-interpoles
  - from: svc-assur-part
    to: mq-replication
  - from: svc-patrimoine
    to: db-contrats
  - from: svc-patrimoine
    to: db-comptes
  - from: svc-patrimoine
    to: cache-clients
  - from: svc-assur-groupe
    to: db-contrats
  - from: svc-assur-groupe
    to: db-clients
  - from: svc-grand-livre
    to: db-compta
  - from: svc-grand-livre
    to: db-comptes
  - from: svc-grand-livre
    to: db-contrats
  - from: svc-rapprochement
    to: db-compta
  - from: svc-rapprochement
    to: db-comptes
  - from: svc-rapprochement
    to: db-contrats
  - from: mq-interpoles
    to: svc-grand-livre
  - from: mq-interpoles
    to: svc-assur-part
  - from: mq-interpoles
    to: svc-comptes-part
  - from: mq-interpoles
    to: mq-notifications
  - from: mq-replication
    to: job-sync
  - from: job-sync
    to: db-replica-on
  - from: job-sync
    to: db-replica-bc
  - from: job-sync
    to: cache-on
  - from: job-sync
    to: cache-bc
  - from: svc-comptes-on
    to: cache-on
  - from: svc-comptes-on
    to: db-replica-on
  - from: svc-assur-on
    to: cache-on
  - from: svc-assur-on
    to: db-replica-on
  - from: svc-comptes-bc
    to: cache-bc
  - from: svc-comptes-bc
    to: db-replica-bc
  - from: svc-assur-bc
    to: cache-bc
  - from: svc-assur-bc
    to: db-replica-bc
  - from: job-reporting
    to: db-compta
  - from: job-reporting
    to: storage-documents
  - from: cb-paiement-ext
    to: mq-notifications
  - from: svc-comptes-part
    to: sd-central
  - from: svc-assur-part
    to: sd-central
  - from: svc-grand-livre
    to: sd-central
  - from: svc-comptes-part
    to: svc-assur-part
  - from: svc-assur-part
    to: svc-comptes-part
  - from: svc-rapprochement
    to: svc-comptes-part
  - from: svc-rapprochement
    to: svc-assur-part
`;

// ============================================
// Construction des templates
// ============================================
export const advancedTemplates: ArchitectureTemplate[] = [
  createTemplateFromYaml(
    'tax-system',
    'templates.taxSystem.name',
    'templates.taxSystem.description',
    taxSystemYaml
  ),
  createTemplateFromYaml(
    'medical-central',
    'templates.medicalCentral.name',
    'templates.medicalCentral.description',
    medicalCentralYaml
  ),
  createTemplateFromYaml(
    'banking-multipole',
    'templates.bankingMultipole.name',
    'templates.bankingMultipole.description',
    bankingYaml
  ),
].filter((t): t is ArchitectureTemplate => t !== null);
