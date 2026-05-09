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
  return {
    id,
    nameKey,
    descriptionKey,
    nodes: result.nodes,
    edges: result.edges,
    projectMeta: result.projectMeta,
  };
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
  - from: cache-baremes
    to: db-contribuables
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
      topics:
        - name: medical-events
          partitions: 6
          retentionMs: 604800000

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
  - from: cache-dsq
    to: db-patients
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
    topic: medical-events
  - from: svc-resultats-write
    to: db-resultats
  - from: svc-resultats-write
    to: db-patients
  - from: svc-resultats-write
    to: mq-events
    topic: medical-events
  - from: svc-resultats-write
    to: mq-alertes
  - from: svc-ordonnances-write
    to: db-ordonnances
  - from: svc-ordonnances-write
    to: db-patients
  - from: svc-ordonnances-write
    to: mq-events
    topic: medical-events
  - from: svc-imagerie
    to: storage-dicom
  - from: svc-imagerie
    to: db-patients
  - from: svc-imagerie
    to: mq-events
    topic: medical-events
  - from: svc-imagerie
    to: job-images
  - from: mq-events
    to: job-audit
    topic: medical-events
  - from: mq-events
    to: job-alertes
    topic: medical-events
  - from: mq-events
    to: job-sync-dsq
    topic: medical-events
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
      topics:
        - name: inter-pole-events
          partitions: 6
          retentionMs: 604800000

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
      topics:
        - name: replication-stream
          partitions: 12
          retentionMs: 259200000

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
  - from: cache-clients
    to: db-clients
  - from: svc-comptes-part
    to: db-clients
  - from: svc-comptes-part
    to: db-comptes
  - from: svc-comptes-part
    to: mq-replication
    topic: replication-stream
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
    topic: inter-pole-events
  - from: svc-virements
    to: mq-replication
    topic: replication-stream
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
    topic: inter-pole-events
  - from: svc-assur-part
    to: mq-replication
    topic: replication-stream
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
    topic: inter-pole-events
  - from: mq-interpoles
    to: svc-assur-part
    topic: inter-pole-events
  - from: mq-interpoles
    to: svc-comptes-part
    topic: inter-pole-events
  - from: mq-interpoles
    to: mq-notifications
  - from: mq-replication
    to: job-sync
    topic: replication-stream
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
// Template : Banque Online (démo focusée)
// Parcours bancaire à 13 composants, calibré pour démo:
//   - Charge faible OK -> charge forte: dégradation visible
//   - Désactivation cache: effondrement reads
//   - Kill DB-Transactions: circuit breaker s'ouvre, cascade contenue
// ============================================
const bankingOnlineYaml = `
version: 1
name: "Banque Online"

zones:
  edge:
    type: dmz
    interZoneLatency: 2
    position: { x: 280, y: 30 }
    size: { width: 800, height: 220 }
  backend:
    type: backend
    interZoneLatency: 1
    position: { x: 280, y: 290 }
    size: { width: 800, height: 250 }
  data:
    type: data
    interZoneLatency: 1
    position: { x: 280, y: 580 }
    size: { width: 800, height: 250 }

components:
  clients-mobile:
    type: client-group
    position: { x: 50, y: 100 }
    config:
      label: "Clients Mobile/Web"
      virtualClients: 100
      requestMode: parallel
      concurrentRequests: 10
      baseInterval: 500
      intervalVariance: 30
      distribution: burst
      burstSize: 20
      burstInterval: 5000
      rampUpEnabled: true
      rampUpDuration: 30000
      rampUpCurve: linear
      method: GET
      requestDistribution:
        - method: GET
          path: "/api/comptes/solde"
          weight: 47
        - method: GET
          path: "/api/comptes/historique"
          weight: 27
        - method: POST
          path: "/api/virements"
          weight: 26

  waf:
    type: waf
    zone: edge
    config:
      label: "WAF"
      provider: aws-waf
      inspectionLatencyMs: 3
      blockRate: 3
      requestsPerSecond: 5000

  cdn:
    type: cdn
    zone: edge
    config:
      label: "CDN"
      provider: cloudfront
      cacheHitRatio: 15
      edgeLatencyMs: 5
      originLatencyMs: 30
      bandwidthMbps: 2000

  api-gateway:
    type: api-gateway
    zone: edge
    config:
      label: "API Gateway"
      authType: jwt
      authFailureRate: 1
      rateLimiting:
        enabled: true
        requestsPerSecond: 500
        burstSize: 100
        windowMs: 1000
      routeRules:
        - id: route-auth
          pathPattern: "/auth/*"
          targetServiceName: "auth-keycloak"
          priority: 1
        - id: route-comptes
          pathPattern: "/api/comptes/**"
          targetServiceName: "comptes-api"
          priority: 2
        - id: route-virements
          pathPattern: "/api/virements/**"
          targetServiceName: "virements-api"
          priority: 3
      baseLatencyMs: 5

  idp:
    type: identity-provider
    zone: backend
    config:
      label: "Auth (Keycloak)"
      serviceName: "auth-keycloak"
      providerType: keycloak
      protocol: oidc
      tokenFormat: jwt
      tokenValidationLatencyMs: 5
      tokenGenerationLatencyMs: 100
      mfaEnabled: true
      mfaLatencyMs: 2000
      errorRate: 1

  svc-comptes:
    type: api-service
    zone: backend
    config:
      label: "Service Comptes"
      serviceName: "comptes-api"
      basePath: "/api/comptes"
      authType: jwt
      authFailureRate: 0
      responseTime: 40
      errorRate: 1
      maxConcurrentRequests: 200

  svc-virements:
    type: api-service
    zone: backend
    config:
      label: "Service Virements"
      serviceName: "virements-api"
      basePath: "/api/virements"
      authType: jwt
      authFailureRate: 0
      responseTime: 100
      errorRate: 2
      maxConcurrentRequests: 80

  cb-paiement-ext:
    type: circuit-breaker
    zone: backend
    config:
      label: "CB Paiement Ext."
      failureThreshold: 5
      successThreshold: 3
      timeout: 30000
      halfOpenMaxRequests: 3

  worker-notifications:
    type: background-job
    zone: backend
    config:
      label: "Worker Notifications"
      jobType: worker
      concurrency: 3
      processingTimeMs: 50
      errorRate: 1

  external-paiement:
    type: http-server
    position: { x: 1120, y: 380 }
    config:
      label: "Paiement Externe (Interac)"
      port: 443
      responseStatus: 200
      responseDelay: 200
      errorRate: 3

  db-comptes:
    type: database
    zone: data
    config:
      label: "DB Comptes"
      databaseType: postgresql
      connectionPool:
        maxConnections: 30
        minConnections: 5
      performance:
        readLatencyMs: 4
        writeLatencyMs: 15
        transactionLatencyMs: 35
      capacity:
        maxQueriesPerSecond: 3000

  db-transactions:
    type: database
    zone: data
    config:
      label: "DB Transactions"
      databaseType: postgresql
      connectionPool:
        maxConnections: 20
        minConnections: 3
      performance:
        readLatencyMs: 4
        writeLatencyMs: 18
        transactionLatencyMs: 40
      capacity:
        maxQueriesPerSecond: 2000

  cache-redis:
    type: cache
    zone: data
    config:
      label: "Cache Redis"
      cacheType: redis
      configuration:
        maxMemoryMB: 1024
        defaultTTLSeconds: 600
        evictionPolicy: lfu
      initialHitRatio: 80

  mq-events:
    type: message-queue
    zone: data
    config:
      label: "Kafka Events"
      queueType: kafka
      mode: pubsub
      configuration:
        maxQueueSize: 30000
        visibilityTimeoutMs: 30000
      performance:
        publishLatencyMs: 2
        consumeLatencyMs: 3
        messagesPerSecond: 5000
      consumerCount: 3
      ackMode: manual
      retryEnabled: true
      maxRetries: 5
      deadLetterEnabled: true
      topics:
        - name: transactions
          partitions: 6
          retentionMs: 604800000

connections:
  - from: clients-mobile
    to: waf
  - from: waf
    to: cdn
  - from: cdn
    to: api-gateway
  - from: api-gateway
    to: idp
  - from: api-gateway
    to: svc-comptes
  - from: api-gateway
    to: svc-virements
  - from: svc-comptes
    to: cache-redis
  - from: cache-redis
    to: db-comptes
  - from: svc-comptes
    to: db-comptes
  - from: svc-virements
    to: db-comptes
  - from: svc-virements
    to: db-transactions
  - from: svc-virements
    to: cb-paiement-ext
  - from: cb-paiement-ext
    to: external-paiement
  - from: svc-virements
    to: mq-events
    topic: transactions
  - from: mq-events
    to: worker-notifications
    topic: transactions
`;

// ============================================
// Template : Groupe Bancaire Multi-Pôles (C4 multi-niveaux + refinement)
// ============================================
// Variante C4 du multi-pôles avec containment ET refinement explicites :
//
//   L1 (Context)
//     - 4 acteurs émetteurs (`generatesTraffic: true`, RPS 1-2) :
//         client-particulier, client-entreprise, conseiller-banque, conseiller-assurance
//     - 3 c4-software-system distincts (un par pôle) :
//         systeme-banque, systeme-assurance, systeme-comptabilite
//     - 4 systèmes externes : ext-reseau-paiement, ext-bureau-credit, ext-regulateur, ext-notification
//     - Edges inter-pôles (banque→compta, assurance→compta) pour les écritures
//
//   L2 (Containers) — `parentSystemId` rattache chaque container à son pôle
//     - Pôle Banque : ct-banque, ct-transactions, svc-comptes-part, svc-virements,
//         cb-paiement-ext, db-clients, db-comptes, cache-clients,
//         + réplicas ON/BC (cache + DB + svc-comptes-on/bc)
//     - Pôle Assurance : ct-assurance, svc-assur-part, db-contrats
//     - Pôle Comptabilité : svc-grand-livre, db-compta
//     - Infra mutualisée (sans parentSystemId) : waf-principal, cdn-portail, gw-central,
//         gw-interne, lb-geo, idp-sso, sd-central, mq-interpoles, clients-web, clients-mobile
//     - Edges raffinés depuis les c4-person : `parentEdgeId` pointe sur l'edge L1
//         correspondant. Permet la cascade simulation : l'émission L1 (1-2 RPS par person)
//         passe sur l'edge L2 raffiné, atteint le WAF/Gateway, descend la chaîne.
//
//   L3 (Components) — drill-down dans 4 services applicatifs
//     - svc-comptes-part / svc-virements / svc-assur-part / svc-grand-livre activent
//         `simulateAtComponentLevel: true` + `entryComponentId` → cascade L2→L3 via
//         L2DelegationWrapper. Chaque edge L3 porte `parentEdgeId: edge-lb-geo-svc-*`
//         pour le drill par double-clic d'edge L2.
//     - Architecture hexagonale : controller → service → (cache adapter, repository, domain).
//
//   Deployment — projection multi-AZ ca-central-1a/b + ON + BC (inchangé).
//
// Démo recommandée :
//   1. Charger le template, vue L1 par défaut.
//   2. Lancer la simulation : observer les particules émises par les 4 c4-person.
//   3. Double-clic sur c4-software-system "Pôle Banque" → drill L2 filtré par parentSystemId.
//   4. Double-clic sur l'edge L1 client-particulier→Pôle Banque → sous-canvas refinement
//      (montre l'edge L2 raffiné jusqu'au WAF).
//   5. Double-clic sur container "API Comptes Particuliers" → drill L3 (composants).
//   6. Double-clic sur edge L2 lb-geo→svc-comptes-part → sous-canvas refinement L3.
// ============================================
const bankingC4Yaml = `
version: 1
name: "Banque Multi-Pôles (C4)"

metadata:
  kind: c4
  c4:
    activeLevel: context

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
    size: { width: 620, height: 360 }
  bc:
    type: backend
    interZoneLatency: 8
    position: { x: 720, y: 1210 }
    size: { width: 620, height: 360 }
  data-centrale:
    type: data
    interZoneLatency: 1
    position: { x: 50, y: 1620 }
    size: { width: 1300, height: 460 }

hosts:
  host-banque-qc:
    zone: qc
    ipAddress: "10.1.1.10"
    hostname: "banque-qc-01"
    position: { x: 30, y: 60 }
    size: { width: 600, height: 380 }
    config:
      label: "Pôle Banque QC"
      parentSystemId: systeme-banque
  host-assurance-qc:
    zone: qc
    ipAddress: "10.1.2.10"
    hostname: "assurance-qc-01"
    position: { x: 670, y: 60 }
    size: { width: 560, height: 270 }
    config:
      label: "Pôle Assurance QC"
      parentSystemId: systeme-assurance
  host-compta-qc:
    zone: qc
    ipAddress: "10.1.3.10"
    hostname: "compta-qc-01"
    position: { x: 670, y: 370 }
    size: { width: 560, height: 230 }
    config:
      label: "Pôle Comptabilité QC"
      parentSystemId: systeme-comptabilite
  host-on:
    zone: ontario
    ipAddress: "10.2.1.10"
    hostname: "services-on-01"
    position: { x: 30, y: 60 }
    size: { width: 560, height: 250 }
    config:
      label: "Services Ontario"
      parentSystemId: systeme-banque
  host-bc:
    zone: bc
    ipAddress: "10.3.1.10"
    hostname: "services-bc-01"
    position: { x: 30, y: 60 }
    size: { width: 560, height: 250 }
    config:
      label: "Services C.-B."
      parentSystemId: systeme-banque
  host-data:
    zone: data-centrale
    ipAddress: "10.10.1.10"
    hostname: "data-master-01"
    position: { x: 30, y: 60 }
    size: { width: 1240, height: 360 }
    config:
      label: "Data Primaire"

components:
  # ============================================
  # L1 — Context (acteurs et écosystème externe)
  # ============================================
  client-particulier:
    type: c4-person
    level: context
    positionsByLevel:
      context: { x: 80, y: 80 }
    config:
      label: "Client Particulier"
      description: "Détenteur d'un compte courant ou d'un produit d'épargne / d'assurance."
      generatesTraffic: true
      requestsPerSecond: 2
  client-entreprise:
    type: c4-person
    level: context
    positionsByLevel:
      context: { x: 80, y: 240 }
    config:
      label: "Client Entreprise"
      description: "PME ou grande entreprise utilisant les comptes pro et services de virement."
      generatesTraffic: true
      requestsPerSecond: 1
  conseiller-banque:
    type: c4-person
    level: context
    positionsByLevel:
      context: { x: 80, y: 400 }
    config:
      label: "Conseiller Banque"
      description: "Utilisateur interne du CRM Banque (ouverture compte, prêt, virement assisté)."
      generatesTraffic: true
      requestsPerSecond: 1
  conseiller-assurance:
    type: c4-person
    level: context
    positionsByLevel:
      context: { x: 80, y: 560 }
    config:
      label: "Conseiller Assurance"
      description: "Utilisateur interne du CRM Assurance (souscription, sinistre, patrimoine)."
      generatesTraffic: true
      requestsPerSecond: 1

  # 3 systèmes distincts — un par pôle métier. Chacun regroupe ses propres containers
  # via parentSystemId, ce qui permet le drill L1→L2 filtré par pôle.
  systeme-banque:
    type: c4-software-system
    level: context
    positionsByLevel:
      context: { x: 600, y: 120 }
    config:
      label: "Pôle Banque"
      description: "Comptes courants, virements interbancaires, prêts particuliers/entreprises. Cœur du SI bancaire."
  systeme-assurance:
    type: c4-software-system
    level: context
    positionsByLevel:
      context: { x: 600, y: 320 }
    config:
      label: "Pôle Assurance"
      description: "Polices auto/habitation/vie, gestion des sinistres, patrimoine et placements."
  systeme-comptabilite:
    type: c4-software-system
    level: context
    positionsByLevel:
      context: { x: 600, y: 520 }
    config:
      label: "Pôle Comptabilité"
      description: "Grand livre, balances, reporting réglementaire BSIF/AMF. Consolidation inter-pôles."
  ext-reseau-paiement:
    type: c4-external-system
    level: context
    positionsByLevel:
      context: { x: 1100, y: 80 }
    config:
      label: "Réseau de Paiement"
      description: "Interbancaire (SWIFT / Interac / RTGS) pour les virements externes."
  ext-bureau-credit:
    type: c4-external-system
    level: context
    positionsByLevel:
      context: { x: 1100, y: 240 }
    config:
      label: "Bureau de Crédit"
      description: "Equifax / TransUnion : score de crédit pour la validation des prêts."
  ext-regulateur:
    type: c4-external-system
    level: context
    positionsByLevel:
      context: { x: 1100, y: 400 }
    config:
      label: "Régulateur Financier"
      description: "BSIF / AMF : reporting compliance et envoi des rapports comptables."
  ext-notification:
    type: c4-external-system
    level: context
    positionsByLevel:
      context: { x: 1100, y: 560 }
    config:
      label: "Service Email / SMS"
      description: "SendGrid / Twilio : notifications transactionnelles et marketing."

  # ============================================
  # L2 — Containers (architecture applicative)
  # ============================================
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
          weight: 40
        - method: POST
          path: "/api/virements"
          weight: 25
        - method: GET
          path: "/api/assurance/polices"
          weight: 20
        - method: POST
          path: "/api/auth/login"
          weight: 15

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
          weight: 55
        - method: POST
          path: "/api/virements"
          weight: 25
        - method: GET
          path: "/api/notifications"
          weight: 20

  app-crm-banque:
    type: client-group
    config:
      label: "CRM Banque (interne)"
      virtualClients: 80
      requestMode: parallel
      concurrentRequests: 8
      baseInterval: 1000
      intervalVariance: 25
      distribution: uniform
      rampUpEnabled: false
      method: GET
      requestDistribution:
        - method: GET
          path: "/internal/clients/recherche"
          weight: 40
        - method: GET
          path: "/internal/comptes/detail"
          weight: 30
        - method: POST
          path: "/internal/prets/demande"
          weight: 30

  app-crm-assurance:
    type: client-group
    config:
      label: "CRM Assurance (interne)"
      virtualClients: 60
      requestMode: parallel
      concurrentRequests: 6
      baseInterval: 1500
      distribution: uniform
      method: GET
      requestDistribution:
        - method: GET
          path: "/internal/clients/recherche"
          weight: 35
        - method: POST
          path: "/internal/assurance/souscription"
          weight: 35
        - method: GET
          path: "/internal/patrimoine/portefeuille"
          weight: 30

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
        - id: route-assurance
          pathPattern: "/assurance/*"
          targetServiceName: "assurance-particulier"
          priority: 3
        - id: route-comptabilite
          pathPattern: "/comptabilite/*"
          targetServiceName: "grand-livre-api"
          priority: 4
      baseLatencyMs: 5

  gw-interne:
    type: api-gateway
    zone: edge
    config:
      label: "GW Interne (CRM)"
      authType: oauth2
      authFailureRate: 1
      rateLimiting:
        enabled: true
        requestsPerSecond: 2000
        burstSize: 500
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
    parentSystemId: systeme-banque
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
    parentSystemId: systeme-banque
    config:
      label: "Container Transactions"
      image: "transactions:latest"
      replicas: 2
      cpuLimitCores: 2
      memoryLimitMB: 1024

  ct-assurance:
    type: container
    host: host-assurance-qc
    parentSystemId: systeme-assurance
    config:
      label: "Container Assurance"
      image: "assurance:latest"
      replicas: 2
      cpuLimitCores: 3
      memoryLimitMB: 1536

  svc-comptes-part:
    type: api-service
    container: ct-banque
    parentSystemId: systeme-banque
    config:
      label: "API Comptes Particuliers"
      serviceName: "comptes-particuliers"
      authType: jwt
      responseTime: 40
      errorRate: 1
      maxConcurrentRequests: 300
      simulateAtComponentLevel: true
      entryComponentId: comp-cp-controller

  svc-virements:
    type: api-service
    container: ct-transactions
    parentSystemId: systeme-banque
    config:
      label: "API Virements"
      serviceName: "virements-api"
      authType: jwt
      responseTime: 120
      errorRate: 2
      simulateAtComponentLevel: true
      entryComponentId: comp-vir-controller
      maxConcurrentRequests: 100

  svc-assur-part:
    type: api-service
    container: ct-assurance
    parentSystemId: systeme-assurance
    config:
      label: "API Assurance Particulier"
      serviceName: "assurance-particulier"
      authType: jwt
      responseTime: 80
      errorRate: 1
      maxConcurrentRequests: 120
      simulateAtComponentLevel: true
      entryComponentId: comp-as-controller

  svc-grand-livre:
    type: api-service
    host: host-compta-qc
    parentSystemId: systeme-comptabilite
    config:
      label: "API Grand Livre"
      serviceName: "grand-livre-api"
      authType: oauth2
      responseTime: 100
      errorRate: 1
      maxConcurrentRequests: 60
      simulateAtComponentLevel: true
      entryComponentId: comp-gl-controller

  cb-paiement-ext:
    type: circuit-breaker
    container: ct-transactions
    parentSystemId: systeme-banque
    config:
      label: "CB Paiement Ext."
      failureThreshold: 5
      successThreshold: 3
      timeout: 30000

  ct-replica-on:
    type: container
    host: host-on
    parentSystemId: systeme-banque
    config:
      label: "Réplica ON"
      image: "services-replica:latest"
      replicas: 2

  svc-comptes-on:
    type: api-service
    container: ct-replica-on
    parentSystemId: systeme-banque
    config:
      label: "API Comptes (ON)"
      serviceName: "comptes-on"
      responseTime: 45
      maxConcurrentRequests: 150

  cache-on:
    type: cache
    host: host-on
    parentSystemId: systeme-banque
    config:
      label: "Cache ON"
      cacheType: redis

  db-replica-on:
    type: database
    host: host-on
    parentSystemId: systeme-banque
    config:
      label: "DB Replica ON"
      databaseType: postgresql
      performance:
        readLatencyMs: 4
        writeLatencyMs: 50

  ct-replica-bc:
    type: container
    host: host-bc
    parentSystemId: systeme-banque
    config:
      label: "Réplica BC"
      image: "services-replica:latest"
      replicas: 2

  svc-comptes-bc:
    type: api-service
    container: ct-replica-bc
    parentSystemId: systeme-banque
    config:
      label: "API Comptes (BC)"
      serviceName: "comptes-bc"
      responseTime: 50
      maxConcurrentRequests: 120

  cache-bc:
    type: cache
    host: host-bc
    parentSystemId: systeme-banque
    config:
      label: "Cache BC"
      cacheType: redis

  db-replica-bc:
    type: database
    host: host-bc
    parentSystemId: systeme-banque
    config:
      label: "DB Replica BC"
      databaseType: postgresql
      performance:
        readLatencyMs: 5
        writeLatencyMs: 60

  db-clients:
    type: database
    host: host-data
    parentSystemId: systeme-banque
    config:
      label: "DB Clients Centrale"
      databaseType: postgresql
      performance:
        readLatencyMs: 3
        writeLatencyMs: 12

  db-comptes:
    type: database
    host: host-data
    parentSystemId: systeme-banque
    config:
      label: "DB Comptes/Transactions"
      databaseType: postgresql
      performance:
        readLatencyMs: 4
        writeLatencyMs: 15

  db-contrats:
    type: database
    host: host-data
    parentSystemId: systeme-assurance
    config:
      label: "DB Contrats Assurance"
      databaseType: postgresql
      performance:
        readLatencyMs: 4
        writeLatencyMs: 18

  db-compta:
    type: database
    host: host-data
    parentSystemId: systeme-comptabilite
    config:
      label: "DB Comptabilité"
      databaseType: postgresql

  cache-clients:
    type: cache
    host: host-data
    parentSystemId: systeme-banque
    config:
      label: "Cache Clients"
      cacheType: redis
      initialHitRatio: 80

  mq-interpoles:
    type: message-queue
    zone: data-centrale
    config:
      label: "MQ Inter-Pôles"
      queueType: kafka
      mode: pubsub
      topics:
        - name: inter-pole-events
          partitions: 6

  idp-sso:
    type: identity-provider
    zone: data-centrale
    config:
      label: "SSO Groupe"
      providerType: keycloak
      protocol: oidc
      tokenFormat: jwt

  sd-central:
    type: service-discovery
    zone: data-centrale
    config:
      label: "Service Discovery"
      provider: consul

  # ============================================
  # L3 — Components (drill-down svc-comptes-part)
  # Architecture hexagonale : controller → service → (cache adapter, repository)
  # ============================================
  comp-cp-controller:
    type: c4-component
    level: components
    parentContainerId: svc-comptes-part
    componentKind: controller
    positionsByLevel:
      components: { x: 100, y: 80 }
    config:
      label: "CompteController"
      technology: "Spring REST"
      description: "Endpoints HTTP /comptes/*. Validation requête, mapping JWT → user."
  comp-cp-service:
    type: c4-component
    level: components
    parentContainerId: svc-comptes-part
    componentKind: service
    positionsByLevel:
      components: { x: 360, y: 80 }
    config:
      label: "CompteService"
      technology: "Spring Service"
      description: "Logique métier : agrégation soldes, autorisations, calcul historique."
      processingDelayMs: 8
  comp-cp-cache-adapter:
    type: c4-component
    level: components
    parentContainerId: svc-comptes-part
    componentKind: adapter
    positionsByLevel:
      components: { x: 620, y: 30 }
    config:
      label: "CacheAdapter"
      technology: "Lettuce / Redis"
      description: "Lecture/écriture cache aside. TTL 30s sur les soldes."
      processingDelayMs: 3
  comp-cp-repository:
    type: c4-component
    level: components
    parentContainerId: svc-comptes-part
    componentKind: repository
    positionsByLevel:
      components: { x: 620, y: 160 }
    config:
      label: "CompteRepository"
      technology: "JPA + Hibernate"
      description: "Persistence comptes / soldes / mouvements."
      processingDelayMs: 5
  comp-cp-solde-calc:
    type: c4-component
    level: components
    parentContainerId: svc-comptes-part
    componentKind: domain
    positionsByLevel:
      components: { x: 360, y: 240 }
    config:
      label: "SoldeCalculator"
      technology: "Domain Pure"
      description: "Calcul disponible / réservé / hors-bilan. Logique financière isolée."
      processingDelayMs: 4

  # ============================================
  # L3 — Components (drill-down svc-virements)
  # Pattern fan-out + circuit breaker pour le réseau externe
  # ============================================
  comp-vir-controller:
    type: c4-component
    level: components
    parentContainerId: svc-virements
    componentKind: controller
    positionsByLevel:
      components: { x: 900, y: 80 }
    config:
      label: "VirementController"
      technology: "Spring REST"
      description: "POST /virements. Idempotence par requestId."
  comp-vir-service:
    type: c4-component
    level: components
    parentContainerId: svc-virements
    componentKind: service
    positionsByLevel:
      components: { x: 1160, y: 80 }
    config:
      label: "VirementService"
      technology: "Spring Service"
      description: "Orchestration : validation → fraud check → débit → crédit → notification."
      processingDelayMs: 15
  comp-vir-fraud:
    type: c4-component
    level: components
    parentContainerId: svc-virements
    componentKind: domain
    positionsByLevel:
      components: { x: 1420, y: 30 }
    config:
      label: "FraudDetector"
      technology: "ML Inference"
      description: "Score de risque : vélocité, géoloc, montant. Reject si score > 80."
      processingDelayMs: 25
  comp-vir-payment-gw:
    type: c4-component
    level: components
    parentContainerId: svc-virements
    componentKind: gateway
    positionsByLevel:
      components: { x: 1420, y: 160 }
    config:
      label: "PaiementGateway"
      technology: "OkHttp + Resilience4j"
      description: "Adaptateur réseau interbancaire. Retry exponentiel + CB."
      processingDelayMs: 20
      errorRate: 0.05
  comp-vir-repo:
    type: c4-component
    level: components
    parentContainerId: svc-virements
    componentKind: repository
    positionsByLevel:
      components: { x: 1160, y: 240 }
    config:
      label: "VirementRepository"
      technology: "JPA + Hibernate"
      description: "Persistence virements + journal d'audit append-only."
      processingDelayMs: 6

  # ============================================
  # L3 — Components (drill-down svc-assur-part)
  # ============================================
  comp-as-controller:
    type: c4-component
    level: components
    parentContainerId: svc-assur-part
    componentKind: controller
    positionsByLevel:
      components: { x: 100, y: 460 }
    config:
      label: "AssuranceController"
      technology: "Spring REST"
      description: "Endpoints /assurance/polices, /sinistres, /devis."
  comp-as-police-svc:
    type: c4-component
    level: components
    parentContainerId: svc-assur-part
    componentKind: service
    positionsByLevel:
      components: { x: 360, y: 420 }
    config:
      label: "PoliceService"
      technology: "Spring Service"
      description: "Gestion des polices auto/habitation/vie : souscription, modification, résiliation."
      processingDelayMs: 12
  comp-as-sinistre-svc:
    type: c4-component
    level: components
    parentContainerId: svc-assur-part
    componentKind: service
    positionsByLevel:
      components: { x: 360, y: 540 }
    config:
      label: "SinistreService"
      technology: "Spring Service"
      description: "Workflow déclaration sinistre, expertise, indemnisation."
      processingDelayMs: 18
  comp-as-repo:
    type: c4-component
    level: components
    parentContainerId: svc-assur-part
    componentKind: repository
    positionsByLevel:
      components: { x: 620, y: 480 }
    config:
      label: "AssuranceRepository"
      technology: "JPA + Hibernate"
      description: "Persistence contrats + sinistres + bénéficiaires."
      processingDelayMs: 6

  # ============================================
  # L3 — Components (drill-down svc-grand-livre)
  # Architecture event-sourcing : posting → journal append-only → projection
  # ============================================
  comp-gl-controller:
    type: c4-component
    level: components
    parentContainerId: svc-grand-livre
    componentKind: controller
    positionsByLevel:
      components: { x: 900, y: 460 }
    config:
      label: "GrandLivreController"
      technology: "Spring REST"
      description: "Endpoints /ecritures, /comptes, /balances. Auth OAuth2."
  comp-gl-posting-svc:
    type: c4-component
    level: components
    parentContainerId: svc-grand-livre
    componentKind: service
    positionsByLevel:
      components: { x: 1160, y: 420 }
    config:
      label: "PostingService"
      technology: "Spring Service"
      description: "Orchestre la passation d'écritures comptables (debit/credit balance)."
      processingDelayMs: 14
  comp-gl-projector:
    type: c4-component
    level: components
    parentContainerId: svc-grand-livre
    componentKind: domain
    positionsByLevel:
      components: { x: 1160, y: 540 }
    config:
      label: "LedgerProjector"
      technology: "Domain Pure"
      description: "Projette le journal append-only en soldes par compte."
      processingDelayMs: 9
  comp-gl-journal-repo:
    type: c4-component
    level: components
    parentContainerId: svc-grand-livre
    componentKind: repository
    positionsByLevel:
      components: { x: 1420, y: 420 }
    config:
      label: "JournalRepository"
      technology: "JPA + PostgreSQL"
      description: "Journal append-only des écritures (immutable, indexé par date+compte)."
      processingDelayMs: 7
  comp-gl-audit-adapter:
    type: c4-component
    level: components
    parentContainerId: svc-grand-livre
    componentKind: adapter
    positionsByLevel:
      components: { x: 1420, y: 540 }
    config:
      label: "AuditAdapter"
      technology: "Kafka Producer"
      description: "Publie les écritures sur le topic compliance-audit (rétention 7 ans)."
      processingDelayMs: 4

  # ============================================
  # Deployment — Container Instances nichées dans les hosts L2
  # Au Deployment, les zones et hosts L2 servent de cadre physique :
  #   zone qc (DMZ/backend) ⊃ host-banque-qc (machine physique) ⊃ inst-cp-1a (pod K8s)
  # Les positions sont relatives à l'hôte parent et auto-calculées par le YAML parser.
  # ============================================

  # 3 instances de l'API Comptes Particuliers déployées sur le pôle Banque QC.
  inst-cp-1a:
    type: c4-container-instance
    level: deployment
    containerRef: svc-comptes-part
    host: host-banque-qc
    config:
      label: "comptes-part-#1"
      description: "Pod K8s · AZ ca-central-1a · CPU 33% · MEM 45%"
  inst-cp-1b:
    type: c4-container-instance
    level: deployment
    containerRef: svc-comptes-part
    host: host-banque-qc
    config:
      label: "comptes-part-#2"
      description: "Pod K8s · AZ ca-central-1b · CPU 31% · MEM 44%"
  inst-cp-1c:
    type: c4-container-instance
    level: deployment
    containerRef: svc-comptes-part
    host: host-banque-qc
    config:
      label: "comptes-part-#3"
      description: "Pod K8s · AZ ca-central-1c · CPU 30% · MEM 43%"

  # 2 instances de l'API Virements (charge plus lourde, moins d'instances).
  inst-vir-1a:
    type: c4-container-instance
    level: deployment
    containerRef: svc-virements
    host: host-banque-qc
    config:
      label: "virements-#1"
      description: "Pod K8s · AZ ca-central-1a · CPU 50% · MEM 60%"
  inst-vir-1b:
    type: c4-container-instance
    level: deployment
    containerRef: svc-virements
    host: host-banque-qc
    config:
      label: "virements-#2"
      description: "Pod K8s · AZ ca-central-1b · CPU 48% · MEM 58%"

  # 2 instances de l'API Assurance déployées sur le pôle Assurance QC.
  inst-as-1a:
    type: c4-container-instance
    level: deployment
    containerRef: svc-assur-part
    host: host-assurance-qc
    config:
      label: "assur-part-#1"
      description: "Pod K8s · AZ ca-central-1a · CPU 40% · MEM 55%"
  inst-as-1b:
    type: c4-container-instance
    level: deployment
    containerRef: svc-assur-part
    host: host-assurance-qc
    config:
      label: "assur-part-#2"
      description: "Pod K8s · AZ ca-central-1b · CPU 41% · MEM 56%"

  # 1 instance Grand Livre sur le pôle Compta QC.
  inst-gl-1a:
    type: c4-container-instance
    level: deployment
    containerRef: svc-grand-livre
    host: host-compta-qc
    config:
      label: "grand-livre-#1"
      description: "Pod K8s · AZ ca-central-1a · CPU 25% · MEM 35%"

  # Réplicas Ontario (lecture seule, sync Kafka).
  inst-cp-on:
    type: c4-container-instance
    level: deployment
    containerRef: svc-comptes-on
    host: host-on
    config:
      label: "comptes-on-#1"
      description: "Pod K8s · réplica lecture-seule · sync via Kafka."

  # Réplicas Colombie-Britannique.
  inst-cp-bc:
    type: c4-container-instance
    level: deployment
    containerRef: svc-comptes-bc
    host: host-bc
    config:
      label: "comptes-bc-#1"
      description: "Pod K8s · réplica lecture-seule · sync via Kafka."

connections:
  # ============================================
  # L1 — relationships (langue naturelle, multi-pôles)
  # Chaque acteur peut consommer un ou plusieurs pôles. Les flux inter-pôles
  # capturent les dépendances internes (ex: Banque → Compta pour les écritures).
  # ============================================
  # Client particulier : utilise Banque (compte courant, virements) et Assurance (polices)
  - from: client-particulier
    to: systeme-banque
    level: context
    edgeKind: relationship
  - from: client-particulier
    to: systeme-assurance
    level: context
    edgeKind: relationship
  # Client entreprise : Banque (comptes pro) et Comptabilité (consolidation)
  - from: client-entreprise
    to: systeme-banque
    level: context
    edgeKind: relationship
  - from: client-entreprise
    to: systeme-comptabilite
    level: context
    edgeKind: relationship
  # Conseillers : chacun son pôle métier
  - from: conseiller-banque
    to: systeme-banque
    level: context
    edgeKind: relationship
  - from: conseiller-assurance
    to: systeme-assurance
    level: context
    edgeKind: relationship
  # Inter-pôles : Banque envoie ses écritures à la Compta, Assurance idem
  - from: systeme-banque
    to: systeme-comptabilite
    level: context
    edgeKind: relationship
  - from: systeme-assurance
    to: systeme-comptabilite
    level: context
    edgeKind: relationship
  # Systèmes externes : chaque pôle a ses propres dépendances
  - from: systeme-banque
    to: ext-reseau-paiement
    level: context
    edgeKind: relationship
  - from: systeme-banque
    to: ext-bureau-credit
    level: context
    edgeKind: relationship
  - from: systeme-banque
    to: ext-notification
    level: context
    edgeKind: relationship
  - from: systeme-assurance
    to: ext-notification
    level: context
    edgeKind: relationship
  - from: systeme-comptabilite
    to: ext-regulateur
    level: context
    edgeKind: relationship

  # ============================================
  # L2 — refinements des edges L1 (cascade simulation)
  # Chaque c4-person avec generatesTraffic émet sur l'un de ces edges raffinés au tick.
  # Les IDs auto-générés des edges L1 (edge-{from}-{to}) servent de parentEdgeId.
  # ============================================
  - from: client-particulier
    to: waf-principal
    level: containers
    edgeKind: request
    parentEdgeId: edge-client-particulier-systeme-banque
    refinementWeight: 2
  - from: client-entreprise
    to: waf-principal
    level: containers
    edgeKind: request
    parentEdgeId: edge-client-entreprise-systeme-banque
    refinementWeight: 1
  - from: conseiller-banque
    to: gw-interne
    level: containers
    edgeKind: request
    parentEdgeId: edge-conseiller-banque-systeme-banque
  - from: conseiller-assurance
    to: gw-interne
    level: containers
    edgeKind: request
    parentEdgeId: edge-conseiller-assurance-systeme-assurance

  # ============================================
  # L2 — flux de requête (existant + simulé)
  # ============================================
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
  - from: lb-geo
    to: svc-comptes-part
  - from: lb-geo
    to: svc-virements
  - from: lb-geo
    to: svc-assur-part
  - from: lb-geo
    to: svc-grand-livre
  - from: lb-geo
    to: svc-comptes-on
  - from: lb-geo
    to: svc-comptes-bc
  - from: svc-comptes-part
    to: cache-clients
  - from: cache-clients
    to: db-clients
  - from: svc-comptes-part
    to: db-comptes
  - from: svc-comptes-part
    to: mq-interpoles
    topic: inter-pole-events
  - from: svc-virements
    to: db-comptes
  - from: svc-virements
    to: cb-paiement-ext
  - from: svc-virements
    to: mq-interpoles
    topic: inter-pole-events
  - from: svc-assur-part
    to: db-contrats
  - from: svc-assur-part
    to: db-clients
  - from: svc-grand-livre
    to: db-compta
  - from: svc-grand-livre
    to: db-comptes
  - from: svc-comptes-on
    to: cache-on
  - from: svc-comptes-on
    to: db-replica-on
  - from: svc-comptes-bc
    to: cache-bc
  - from: svc-comptes-bc
    to: db-replica-bc
  - from: mq-interpoles
    to: svc-grand-livre
    topic: inter-pole-events
  - from: svc-comptes-part
    to: sd-central

  # ============================================
  # L3 — function-call (intra-process, pas de protocol/rate)
  # parentEdgeId pointe sur l'edge L2 lb-geo → svc-* qui délivre la requête
  # au container — permet le drill L2→L3 via double-clic sur cet edge L2.
  # ============================================
  # svc-comptes-part components — raffinent edge-lb-geo-svc-comptes-part
  - from: comp-cp-controller
    to: comp-cp-service
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-comptes-part
  - from: comp-cp-service
    to: comp-cp-cache-adapter
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-comptes-part
  - from: comp-cp-service
    to: comp-cp-solde-calc
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-comptes-part
  - from: comp-cp-cache-adapter
    to: comp-cp-repository
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-comptes-part
  - from: comp-cp-service
    to: comp-cp-repository
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-comptes-part

  # svc-virements components — raffinent edge-lb-geo-svc-virements
  - from: comp-vir-controller
    to: comp-vir-service
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-virements
  - from: comp-vir-service
    to: comp-vir-fraud
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-virements
  - from: comp-vir-service
    to: comp-vir-payment-gw
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-virements
  - from: comp-vir-service
    to: comp-vir-repo
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-virements

  # svc-assur-part components — raffinent edge-lb-geo-svc-assur-part
  - from: comp-as-controller
    to: comp-as-police-svc
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-assur-part
  - from: comp-as-controller
    to: comp-as-sinistre-svc
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-assur-part
  - from: comp-as-police-svc
    to: comp-as-repo
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-assur-part
  - from: comp-as-sinistre-svc
    to: comp-as-repo
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-assur-part

  # svc-grand-livre components — raffinent edge-lb-geo-svc-grand-livre
  - from: comp-gl-controller
    to: comp-gl-posting-svc
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-grand-livre
  - from: comp-gl-posting-svc
    to: comp-gl-journal-repo
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-grand-livre
  - from: comp-gl-posting-svc
    to: comp-gl-projector
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-grand-livre
  - from: comp-gl-projector
    to: comp-gl-journal-repo
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-grand-livre
  - from: comp-gl-posting-svc
    to: comp-gl-audit-adapter
    level: components
    edgeKind: function-call
    parentEdgeId: edge-lb-geo-svc-grand-livre

  # ============================================
  # Deployment — network-link (réplication multi-région + peering)
  # ============================================
  # Réplication async via Kafka : QC primary → ON et BC en lecture seule.
  - from: inst-cp-1a
    to: inst-cp-on
    level: deployment
    edgeKind: network-link
  - from: inst-cp-1a
    to: inst-cp-bc
    level: deployment
    edgeKind: network-link
  # Failover des virements entre AZ a/b sur QC.
  - from: inst-vir-1a
    to: inst-vir-1b
    level: deployment
    edgeKind: network-link
  # Sync assurance entre les 2 instances QC.
  - from: inst-as-1a
    to: inst-as-1b
    level: deployment
    edgeKind: network-link
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
  createTemplateFromYaml(
    'banking-multipole-c4',
    'templates.bankingMultipoleC4.name',
    'templates.bankingMultipoleC4.description',
    bankingC4Yaml
  ),
  createTemplateFromYaml(
    'banking-online',
    'templates.bankingOnline.name',
    'templates.bankingOnline.description',
    bankingOnlineYaml
  ),
].filter((t): t is ArchitectureTemplate => t !== null);
