// ============================================
// Documentation Data — Component Catalog, Edges, Metrics, Design Errors
// ============================================

// ── Types ──

export interface DocProperty {
  name: string;
  type: 'enum' | 'number' | 'string' | 'boolean' | 'object';
  defaultValue: string;
  description: string;
}

export interface DocMetric {
  name: string;
  description: string;
  interpretation: string;
}

export interface DocSection {
  name: string;
  description: string;
  properties: DocProperty[];
}

export interface DocComponent {
  name: string;
  type: string;
  description: string;
  category: 'simulation' | 'infrastructure' | 'data' | 'resilience' | 'compute' | 'cloud' | 'zone';
  sections: DocSection[];
  metrics: DocMetric[];
  behavior: string;
  connections: string;
  protocols: string[];
}

export interface DocEdgeProperty {
  name: string;
  type: string;
  defaultValue: string;
  description: string;
}

export interface DocDesignError {
  error: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  description: string;
  solution: string;
  category: string;
}

// ── Protocol Compatibility Matrix ──

export const protocolMatrix: { type: string; name: string; protocols: string[] }[] = [
  { type: 'http-client', name: 'Client HTTP', protocols: ['rest', 'graphql', 'websocket'] },
  { type: 'http-server', name: 'Serveur HTTP', protocols: ['rest', 'graphql', 'websocket'] },
  { type: 'client-group', name: 'Groupe de clients', protocols: ['rest', 'graphql', 'websocket'] },
  { type: 'api-gateway', name: 'API Gateway', protocols: ['rest', 'grpc', 'graphql', 'websocket'] },
  { type: 'load-balancer', name: 'Load Balancer', protocols: ['rest', 'grpc', 'websocket'] },
  { type: 'circuit-breaker', name: 'Circuit Breaker', protocols: ['rest', 'grpc', 'graphql', 'websocket'] },
  { type: 'cdn', name: 'CDN', protocols: ['rest'] },
  { type: 'waf', name: 'WAF', protocols: ['rest', 'graphql', 'websocket'] },
  { type: 'firewall', name: 'Firewall', protocols: ['rest', 'grpc', 'graphql', 'websocket'] },
  { type: 'dns', name: 'DNS', protocols: ['rest'] },
  { type: 'service-discovery', name: 'Service Discovery', protocols: ['rest', 'grpc'] },
  { type: 'serverless', name: 'Serverless', protocols: ['rest', 'grpc'] },
  { type: 'cloud-function', name: 'Cloud Function', protocols: ['rest', 'grpc'] },
  { type: 'cloud-storage', name: 'Cloud Storage', protocols: ['rest'] },
  { type: 'host-server', name: 'Serveur Hôte', protocols: ['rest', 'grpc', 'graphql', 'websocket'] },
  { type: 'container', name: 'Container', protocols: ['rest', 'grpc', 'graphql', 'websocket'] },
  { type: 'api-service', name: 'API Service', protocols: ['rest', 'grpc', 'graphql'] },
  { type: 'database', name: 'Base de données', protocols: [] },
  { type: 'cache', name: 'Cache', protocols: [] },
  { type: 'message-queue', name: 'File de messages', protocols: [] },
  { type: 'background-job', name: 'Background Job', protocols: [] },
  { type: 'network-zone', name: 'Zone Réseau', protocols: [] },
];

// ── Component Documentation ──

export const componentDocs: DocComponent[] = [
  // ═══════════════════════════════════════
  // SIMULATION (3)
  // ═══════════════════════════════════════
  {
    name: 'Client HTTP',
    type: 'http-client',
    description: 'Point de départ du flux de simulation. Envoie des requêtes HTTP vers le composant connecté en aval. En mode « single », une requête est envoyée à chaque démarrage. En mode « loop », les requêtes sont envoyées en continu à l\'intervalle configuré.',
    category: 'simulation',
    sections: [
      {
        name: 'Configuration HTTP',
        description: 'Paramètres de la requête HTTP envoyée par le client.',
        properties: [
          { name: 'method', type: 'enum', defaultValue: 'GET', description: 'Méthode HTTP de la requête. GET pour la lecture de données, POST pour la création, PUT pour la mise à jour, DELETE pour la suppression. Influence le type de charge simulée sur le serveur cible et le type de requête enregistré en base (read/write).' },
          { name: 'path', type: 'string', defaultValue: '/api/data', description: 'Chemin URL de la requête (endpoint cible). Utilisez des chemins réalistes correspondant à votre API pour simuler fidèlement les scénarios d\'usage.' },
          { name: 'requestBody', type: 'string', defaultValue: '—', description: 'Corps de la requête HTTP (optionnel). Utilisé avec POST et PUT pour simuler l\'envoi de données. La taille du body influence la consommation réseau.' },
          { name: 'requestMode', type: 'enum', defaultValue: 'single', description: 'Mode d\'envoi. « single » : envoie une seule requête par démarrage de simulation. « loop » : envoie en continu à l\'intervalle configuré. Utilisez « loop » pour générer du trafic continu et observer le comportement du système sous charge.' },
          { name: 'requestInterval', type: 'number', defaultValue: '1000', description: 'Intervalle entre les requêtes en ms (mode loop uniquement). 1000ms = 1 requête/seconde. Diminuez pour augmenter la charge. Un intervalle de 100ms génère 10 req/s par client.' },
        ],
      },
    ],
    metrics: [
      { name: 'requestsSent', description: 'Compteur cumulé de requêtes envoyées', interpretation: 'Indique le volume total de trafic généré. En mode loop, augmente linéairement.' },
    ],
    behavior: 'Point de départ du flux. Envoie des requêtes HTTP vers le composant connecté. En mode « single », envoie une requête au démarrage. En mode « loop », envoie en continu à l\'intervalle configuré jusqu\'à l\'arrêt de la simulation.',
    connections: 'Doit avoir au moins un edge sortant vers un serveur, gateway ou load balancer. Ne peut pas être enfant d\'un autre composant.',
    protocols: ['rest', 'graphql', 'websocket'],
  },
  {
    name: 'Serveur HTTP',
    type: 'http-server',
    description: 'Point terminal de traitement des requêtes. Simule un serveur complet avec ressources physiques (CPU, RAM, réseau, disque), gestion de la capacité (connexions et file d\'attente), et dégradation de performance sous charge. Le serveur calcule en temps réel l\'utilisation de chaque ressource et ajuste la latence selon la formule de dégradation.',
    category: 'simulation',
    sections: [
      {
        name: 'Configuration de base',
        description: 'Paramètres fondamentaux du serveur HTTP : port, réponse et taux d\'erreur.',
        properties: [
          { name: 'port', type: 'number', defaultValue: '8080', description: 'Port d\'écoute du serveur. Utilisé pour l\'identification dans les logs et les mappings de port du Host Server. Ports courants : 80 (HTTP), 443 (HTTPS), 8080 (dev), 3000 (Node.js).' },
          { name: 'responseStatus', type: 'number', defaultValue: '200', description: 'Code de statut HTTP retourné par défaut. 200=succès, 201=créé, 404=non trouvé, 500=erreur serveur. Permet de simuler différents comportements du serveur.' },
          { name: 'responseBody', type: 'string', defaultValue: '—', description: 'Corps de la réponse HTTP (optionnel). Simule la taille des réponses. La taille du body influence la consommation réseau (responseSizeKB).' },
          { name: 'responseDelay', type: 'number', defaultValue: '100', description: 'Latence de base en ms avant d\'envoyer la réponse. Simule le temps de traitement applicatif. Cette valeur est multipliée par la dégradation sous charge : à 80% d\'utilisation avec formule quadratique, la latence effective est ~164ms.' },
          { name: 'errorRate', type: 'number', defaultValue: '0', description: 'Taux d\'erreur simulé (0-100%). Pourcentage de requêtes qui échouent aléatoirement avec une erreur 500. Utile pour tester la résilience des circuit breakers et la gestion d\'erreurs des clients.' },
        ],
      },
      {
        name: 'Configuration microservice',
        description: 'Identification du service pour le routage par l\'API Gateway. Nécessaire uniquement si le serveur est la cible de règles de routage.',
        properties: [
          { name: 'serviceName', type: 'string', defaultValue: '—', description: 'Nom unique du microservice (ex: « users », « orders »). L\'API Gateway utilise ce nom dans ses règles de routage (targetServiceName). Chaque serveur routé doit avoir un serviceName unique.' },
          { name: 'basePath', type: 'string', defaultValue: '—', description: 'Route de base du service (ex: « /api/users »). Définit le préfixe URL pour l\'aiguillage des requêtes par l\'API Gateway.' },
        ],
      },
      {
        name: 'Ressources CPU',
        description: 'Capacité de calcul du serveur. Le CPU est la ressource la plus souvent limitante. La formule : capacité max ≈ cores / (processingTime/1000).',
        properties: [
          { name: 'resources.cpu.cores', type: 'number', defaultValue: '4', description: 'Nombre de cœurs CPU (1-64). Détermine la capacité de traitement parallèle. Plus de cœurs = plus de requêtes traitées simultanément sans saturation CPU. 4 cœurs avec 50ms/req = ~80 req/s max théorique.' },
          { name: 'resources.cpu.maxUtilization', type: 'number', defaultValue: '100', description: 'Utilisation maximale autorisée par cœur (0-100%). Permet de limiter la charge CPU effective. À 80%, le serveur commence à dégrader avant d\'atteindre 100% réel.' },
          { name: 'resources.cpu.processingTimePerRequest', type: 'number', defaultValue: '50', description: 'Temps CPU par requête en ms. Combiné avec les cœurs pour le calcul d\'utilisation CPU. Multiplié par le coefficient de processingComplexity (light=×0.5, medium=×1.0, heavy=×2.5, very-heavy=×5.0).' },
        ],
      },
      {
        name: 'Ressources mémoire',
        description: 'Configuration de la RAM. La mémoire est consommée par le système de base et par chaque requête active. Saturation = OOM.',
        properties: [
          { name: 'resources.memory.totalMB', type: 'number', defaultValue: '4096', description: 'Mémoire vive totale en Mo. Partagée entre l\'utilisation de base et les requêtes actives. Utilisation = (baseUsage + activeRequests × memPerRequest) / totalMB. Saturation mémoire → rejets.' },
          { name: 'resources.memory.memoryPerRequestMB', type: 'number', defaultValue: '10', description: 'Mémoire allouée par requête active en Mo. Requêtes actives × memPerRequest + baseUsage = mémoire utilisée. Vérifiez que maxConcurrent × memPerRequest + baseUsage < totalMB pour éviter les OOM.' },
          { name: 'resources.memory.baseUsageMB', type: 'number', defaultValue: '512', description: 'Mémoire de base du système en Mo (OS, runtime, cache). Consommée même sans trafic. Réduit la mémoire disponible pour les requêtes actives.' },
        ],
      },
      {
        name: 'Ressources réseau',
        description: 'Bande passante et latence réseau. Rarement limitant sauf pour les API avec de gros payloads.',
        properties: [
          { name: 'resources.network.bandwidthMbps', type: 'number', defaultValue: '1000', description: 'Bande passante en Mbps (1000 = 1 Gbps). Limite le débit total (requêtes + réponses). Utilisation = RPS × (requestSize + responseSize) × 8 / bandwidth.' },
          { name: 'resources.network.baseLatencyMs', type: 'number', defaultValue: '5', description: 'Latence réseau de base en ms ajoutée à chaque requête. Simule la latence physique (LAN ~1ms, même datacenter ~2-5ms, inter-région ~50-100ms).' },
          { name: 'resources.network.requestSizeKB', type: 'number', defaultValue: '2', description: 'Taille moyenne d\'une requête entrante en Ko. Utilisée pour le calcul de bande passante. Un body JSON simple fait 1-5 Ko.' },
          { name: 'resources.network.responseSizeKB', type: 'number', defaultValue: '10', description: 'Taille moyenne d\'une réponse en Ko. Les API JSON typiques : 1-50 Ko. API avec images ou fichiers : 100 Ko-1+ Mo.' },
        ],
      },
      {
        name: 'Ressources disque (optionnel)',
        description: 'Configuration du stockage. Activez uniquement si le service fait des opérations I/O disque.',
        properties: [
          { name: 'resources.disk.totalGB', type: 'number', defaultValue: '—', description: 'Espace disque total en Go. Optionnel. Activez pour les services avec I/O disque (logs, fichiers temporaires, base locale).' },
          { name: 'resources.disk.ioSpeedMBps', type: 'number', defaultValue: '—', description: 'Vitesse I/O disque en Mo/s. SSD NVMe ~3000 Mo/s, SSD SATA ~500 Mo/s, HDD ~100 Mo/s.' },
          { name: 'resources.disk.diskTimePerRequest', type: 'number', defaultValue: '—', description: 'Temps I/O disque par requête en ms. Ajouté au temps de traitement si activé. Simule les lectures/écritures fichier.' },
        ],
      },
      {
        name: 'Limites de connexions',
        description: 'Gestion de la capacité et file d\'attente. C\'est souvent le facteur limitant principal.',
        properties: [
          { name: 'resources.connections.maxConcurrent', type: 'number', defaultValue: '100', description: 'Connexions simultanées max. Au-delà, les requêtes sont mises en file d\'attente. C\'est le goulot principal de la capacité du serveur. Nginx : 1024 par défaut, Node.js : limité par la RAM.' },
          { name: 'resources.connections.queueSize', type: 'number', defaultValue: '50', description: 'Taille de la file d\'attente. Quand maxConcurrent est atteint, les requêtes patientent ici. File pleine = rejet immédiat (raison : capacity). 0 = pas de file, rejet direct.' },
          { name: 'resources.connections.connectionTimeoutMs', type: 'number', defaultValue: '30000', description: 'Timeout de connexion en ms. Une requête en file au-delà de ce délai est rejetée (raison : timeout). 30s est standard. Réduisez pour un fail-fast plus agressif.' },
        ],
      },
      {
        name: 'Dégradation sous charge',
        description: 'Comportement de la latence sous forte utilisation. Formule : baseLatency × (1 + utilization^power).',
        properties: [
          { name: 'degradation.enabled', type: 'boolean', defaultValue: 'true', description: 'Active la dégradation de latence sous charge. La latence augmente avec l\'utilisation des ressources. Désactivez pour un serveur à latence fixe (proxy, CDN).' },
          { name: 'degradation.formula', type: 'enum', defaultValue: 'quadratic', description: 'Formule de dégradation. « linear » : latence proportionnelle à la charge. « quadratic » (défaut, réaliste) : lent au début, rapide à haute charge. « exponential » : dégradation très agressive en fin de capacité.' },
          { name: 'degradation.latencyPower', type: 'number', defaultValue: '2', description: 'Exposant de la formule. Avec power=2 : à 50% util → +25% latence, à 80% → +64%, à 100% → +100%. Plus l\'exposant est élevé, plus la dégradation est brutale à haute charge.' },
        ],
      },
      {
        name: 'Complexité applicative',
        description: 'Multiplicateur du temps de traitement CPU selon la complexité du code.',
        properties: [
          { name: 'processingComplexity', type: 'enum', defaultValue: 'medium', description: 'Complexité du code applicatif. Multiplie processingTimePerRequest : light (×0.5 — proxy, API simple), medium (×1.0 — CRUD classique), heavy (×2.5 — calculs, jointures), very-heavy (×5.0 — ML, rapports complexes).' },
        ],
      },
    ],
    metrics: [
      { name: 'CPU %', description: 'Utilisation CPU actuelle', interpretation: '< 70% sain, 70-90% attention, > 90% saturation. Corrélation directe avec activeRequests × processingTime / cores.' },
      { name: 'RAM %', description: 'Utilisation mémoire', interpretation: 'Surveillez la courbe : croissance linéaire = normal, exponentielle = fuite mémoire potentielle.' },
      { name: 'Réseau %', description: 'Bande passante consommée', interpretation: 'Rarement limitant sauf pour les API de fichiers ou les gros payloads JSON.' },
      { name: 'Connexions actives', description: 'Requêtes en cours de traitement', interpretation: 'Comparez avec maxConcurrent. Proche du max = file d\'attente imminente.' },
      { name: 'File d\'attente', description: 'Requêtes en attente d\'un slot', interpretation: '> 0 indique saturation partielle. Croissance continue = serveur sous-dimensionné.' },
      { name: 'Saturation %', description: 'Max de CPU/mémoire/réseau', interpretation: 'Identifie la ressource limitante. La première à saturer est le goulot d\'étranglement.' },
      { name: 'Débit (RPS)', description: 'Requêtes traitées par seconde', interpretation: 'Comparez avec le débit théorique max pour évaluer l\'efficacité.' },
      { name: 'Taux d\'erreur %', description: 'Erreurs par serveur', interpretation: 'Augmente avec la charge si capacité insuffisante.' },
    ],
    behavior: 'Terminal de traitement. Reçoit les requêtes, calcule l\'utilisation des ressources (CPU, RAM, réseau), applique la dégradation de latence, et retourne une réponse. Les requêtes au-delà de maxConcurrent sont mises en file. File pleine = rejet (raison : capacity).',
    connections: 'Reçoit du trafic de clients, gateways, ou load balancers. Peut transmettre à des bases de données, caches, ou queues en aval. Ne peut pas être enfant d\'un autre composant.',
    protocols: ['rest', 'graphql', 'websocket'],
  },
  {
    name: 'Groupe de clients',
    type: 'client-group',
    description: 'Générateur de charge multi-clients pour le stress testing. Simule 1 à 1000 clients virtuels envoyant des requêtes HTTP en parallèle ou séquentiel, avec distribution configurable (uniforme, aléatoire, burst) et montée en charge progressive (ramp-up). Chaque client virtuel opère indépendamment.',
    category: 'simulation',
    sections: [
      {
        name: 'Clients virtuels',
        description: 'Nombre et mode de fonctionnement des clients. Détermine le volume de charge total.',
        properties: [
          { name: 'virtualClients', type: 'number', defaultValue: '10', description: 'Nombre de clients virtuels simultanés (1-1000). Chaque client envoie des requêtes indépendamment. 10 pour du dev, 100+ pour du stress test, 1000 pour une charge extrême.' },
          { name: 'requestMode', type: 'enum', defaultValue: 'parallel', description: 'Mode d\'envoi. « sequential » : chaque client attend la réponse avant d\'envoyer la suivante (simule un utilisateur réel). « parallel » : les clients envoient sans attendre (charge maximale).' },
          { name: 'concurrentRequests', type: 'number', defaultValue: '5', description: 'Requêtes parallèles par client (1-100). En mode parallel, chaque client maintient ce nombre de requêtes simultanées. Charge max totale = virtualClients × concurrentRequests.' },
        ],
      },
      {
        name: 'Timing et distribution',
        description: 'Contrôle du rythme d\'envoi des requêtes. Détermine le pattern de charge.',
        properties: [
          { name: 'baseInterval', type: 'number', defaultValue: '1000', description: 'Intervalle de base entre requêtes en ms. 1000ms = 1 req/s par client, 100ms = 10 req/s. L\'intervalle réel varie selon la distribution et la variance.' },
          { name: 'intervalVariance', type: 'number', defaultValue: '20', description: 'Variance appliquée à l\'intervalle (0-100%). Avec 20% de variance, un intervalle de 1000ms varie entre 800ms et 1200ms aléatoirement. Ajoute du réalisme.' },
          { name: 'distribution', type: 'enum', defaultValue: 'uniform', description: 'Distribution temporelle. « uniform » : intervalle régulier (charge constante). « random » : intervalle aléatoire (charge variable). « burst » : envoi par rafales avec pauses.' },
        ],
      },
      {
        name: 'Mode Burst',
        description: 'Configuration des rafales (actif quand distribution = burst). Simule des pics de trafic.',
        properties: [
          { name: 'burstSize', type: 'number', defaultValue: '5', description: 'Requêtes par rafale. Une grande rafale teste la capacité de pointe. Ex: burstSize=100 envoie 100 requêtes d\'un coup.' },
          { name: 'burstInterval', type: 'number', defaultValue: '5000', description: 'Délai entre les rafales en ms. Ex: 10000ms = une rafale toutes les 10 secondes. Simule les pics d\'usage périodiques.' },
        ],
      },
      {
        name: 'Montée en charge (Ramp-up)',
        description: 'Augmentation progressive du nombre de clients actifs. Essentiel pour observer le comportement sous charge croissante.',
        properties: [
          { name: 'rampUpEnabled', type: 'boolean', defaultValue: 'false', description: 'Active la montée en charge progressive. Les clients sont activés graduellement au lieu de démarrer tous en même temps. Permet d\'observer les seuils de saturation.' },
          { name: 'rampUpDuration', type: 'number', defaultValue: '30000', description: 'Durée de la montée en charge en ms. Temps pour passer de 0 à 100% des clients. 30s = rapide, 120s = lent et progressif.' },
          { name: 'rampUpCurve', type: 'enum', defaultValue: 'linear', description: 'Courbe de montée. « linear » : activation régulière. « exponential » : lent au début puis accéléré. « step » : par paliers (0%→25%→50%→75%→100%).' },
        ],
      },
      {
        name: 'Configuration HTTP',
        description: 'Paramètres des requêtes envoyées par les clients.',
        properties: [
          { name: 'method', type: 'enum', defaultValue: 'GET', description: 'Méthode HTTP des requêtes. Détermine le type d\'opération simulée (lecture/écriture). Le type influence la charge sur la base de données en aval (GET=read, POST/PUT=write).' },
          { name: 'path', type: 'string', defaultValue: '/api/data', description: 'Chemin URL principal des requêtes. Utilisez un chemin correspondant à votre API cible.' },
          { name: 'paths', type: 'object', defaultValue: '—', description: 'Liste de chemins alternatifs pour sélection aléatoire. Si défini, chaque requête choisit un chemin au hasard. Simule un usage plus réaliste avec plusieurs endpoints.' },
          { name: 'requestDistribution', type: 'object', defaultValue: '—', description: 'Distribution pondérée de types de requêtes. Chaque entrée : method + path + weight. Ex: 60% GET /users, 30% POST /orders, 10% DELETE /sessions. Les poids sont relatifs.' },
        ],
      },
      {
        name: 'Statistiques runtime',
        description: 'Compteurs mis à jour en temps réel pendant la simulation (lecture seule).',
        properties: [
          { name: 'activeClients', type: 'number', defaultValue: '0', description: 'Clients actuellement actifs. Pendant le ramp-up, ce nombre augmente progressivement. Permet de corréler la charge avec les métriques système.' },
          { name: 'requestsSent', type: 'number', defaultValue: '0', description: 'Total de requêtes envoyées par ce groupe depuis le début de la simulation.' },
        ],
      },
    ],
    metrics: [
      { name: 'requestsSent', description: 'Requêtes envoyées', interpretation: 'Compteur cumulé. Comparez avec responsesReceived pour détecter les requêtes perdues.' },
      { name: 'responsesReceived', description: 'Réponses reçues', interpretation: 'L\'écart avec requestsSent indique les requêtes encore en transit ou perdues.' },
      { name: 'successCount', description: 'Succès', interpretation: 'Ratio succès/total = fiabilité du système sous cette charge.' },
      { name: 'errorCount', description: 'Erreurs', interpretation: 'Augmentation soudaine = seuil de capacité atteint.' },
      { name: 'avgLatency', description: 'Latence moyenne (ms)', interpretation: 'Augmente avec la charge et la dégradation. Comparez entre groupes pour identifier les bottlenecks.' },
      { name: 'p95Latency', description: 'P95 Latence (ms)', interpretation: '95% des requêtes sous ce seuil. Plus révélateur que la moyenne.' },
      { name: 'activeClients', description: 'Clients actifs', interpretation: 'Pendant le ramp-up, permet de corréler charge et performance.' },
    ],
    behavior: 'Générateur de charge. Lance virtualClients instances indépendantes qui envoient des requêtes HTTP. Le ramp-up active les clients progressivement. La distribution contrôle le pattern temporel (constant, aléatoire ou par rafales).',
    connections: 'Doit avoir au moins un edge sortant vers un serveur, gateway ou load balancer. Ne peut pas être enfant d\'un autre composant.',
    protocols: ['rest', 'graphql', 'websocket'],
  },

  // ═══════════════════════════════════════
  // INFRASTRUCTURE (6)
  // ═══════════════════════════════════════
  {
    name: 'API Gateway',
    type: 'api-gateway',
    description: 'Point d\'entrée centralisé pour les API. Gère l\'authentification (API Key, JWT, OAuth2), le rate limiting avec fenêtre glissante, et le routage intelligent vers les microservices via des règles de pattern matching. Les requêtes non-autorisées ou excédentaires sont rejetées avant d\'atteindre les backends.',
    category: 'infrastructure',
    sections: [
      {
        name: 'Authentification',
        description: 'Contrôle d\'accès aux API. Chaque type ajoute de la latence et peut générer des rejets.',
        properties: [
          { name: 'authType', type: 'enum', defaultValue: 'none', description: 'Type d\'authentification. « none » : pas de vérification. « api-key » : clé API dans le header. « jwt » : token JWT vérifié (signature + expiration). « oauth2 » : protocole OAuth2 complet. Chaque type ajoute de la latence au traitement.' },
          { name: 'authFailureRate', type: 'number', defaultValue: '0', description: 'Taux d\'échec d\'authentification simulé (0-100%). Simule des tokens expirés ou clés invalides. Les requêtes rejetées comptent comme « auth-failure » dans les métriques de rejet.' },
        ],
      },
      {
        name: 'Rate Limiting',
        description: 'Limitation du débit pour protéger les backends contre les surcharges.',
        properties: [
          { name: 'rateLimiting.enabled', type: 'boolean', defaultValue: 'true', description: 'Active la limitation de débit. Les requêtes au-delà du seuil sont rejetées (raison : rate-limit). Protège les services en aval contre les pics de trafic.' },
          { name: 'rateLimiting.requestsPerSecond', type: 'number', defaultValue: '100', description: 'Requêtes par seconde autorisées. Au-delà, les requêtes excédentaires sont bloquées. Ajustez selon la capacité de vos backends.' },
          { name: 'rateLimiting.burstSize', type: 'number', defaultValue: '20', description: 'Taille du burst autorisé au-dessus du RPS. Permet des pics courts. Ex: avec 100 RPS et burst 20, jusqu\'à 120 req/s passent brièvement.' },
          { name: 'rateLimiting.windowMs', type: 'number', defaultValue: '1000', description: 'Fenêtre de temps pour le comptage en ms. 1000ms = fenêtre d\'1 seconde. Une fenêtre plus courte est plus réactive mais moins tolérante aux micro-bursts.' },
        ],
      },
      {
        name: 'Routage',
        description: 'Aiguillage des requêtes vers les microservices. Le préfixe peut être supprimé avant transmission.',
        properties: [
          { name: 'routing.pathPrefix', type: 'string', defaultValue: '/api', description: 'Préfixe URL global. Toutes les requêtes doivent commencer par ce préfixe pour être traitées par cette gateway.' },
          { name: 'routing.stripPrefix', type: 'boolean', defaultValue: 'true', description: 'Supprime le préfixe avant transmission. Si true, « /api/users/123 » arrive au service comme « /users/123 ». Standard pour les gateways en mode proxy inverse.' },
          { name: 'routing.timeout', type: 'number', defaultValue: '30000', description: 'Timeout de routage en ms. Les requêtes vers le backend au-delà de ce délai sont rejetées (raison : timeout). 30s est standard.' },
        ],
      },
      {
        name: 'Règles de routage',
        description: 'Règles de dispatch par chemin vers les microservices. Pattern : « * » matche un segment, « ** » matche tous les segments.',
        properties: [
          { name: 'routeRules', type: 'object', defaultValue: '[]', description: 'Liste de règles de routage. Chaque règle définit : pathPattern (ex: « /users/* »), targetServiceName (doit correspondre au serviceName d\'un HTTP Server), priority (plus petit = plus prioritaire). Les règles sont évaluées par priorité croissante.' },
        ],
      },
      {
        name: 'Performance',
        description: 'Latence et fiabilité intrinsèques de la gateway.',
        properties: [
          { name: 'baseLatencyMs', type: 'number', defaultValue: '5', description: 'Latence ajoutée par la gateway en ms. Représente le traitement interne (routing, auth check, logging). Typiquement 1-10ms pour une gateway performante.' },
          { name: 'errorRate', type: 'number', defaultValue: '0', description: 'Taux d\'erreur interne (0-100%). Erreurs de la gateway elle-même, indépendamment des erreurs d\'auth ou rate-limit.' },
        ],
      },
      {
        name: 'Fonctionnalités',
        description: 'Options activables pour les fonctionnalités additionnelles de la gateway.',
        properties: [
          { name: 'corsEnabled', type: 'boolean', defaultValue: 'true', description: 'Active le CORS (Cross-Origin Resource Sharing). Nécessaire pour les API appelées depuis un navigateur web avec un domaine différent.' },
          { name: 'loggingEnabled', type: 'boolean', defaultValue: 'true', description: 'Active la journalisation des requêtes. Permet l\'observabilité et le debug en production.' },
          { name: 'compressionEnabled', type: 'boolean', defaultValue: 'true', description: 'Active la compression gzip/brotli des réponses. Réduit la taille mais ajoute du temps CPU.' },
        ],
      },
    ],
    metrics: [
      { name: 'totalRequests', description: 'Total requêtes reçues', interpretation: 'Volume de trafic global passant par la gateway.' },
      { name: 'blockedRequests', description: 'Requêtes bloquées', interpretation: 'Auth + rate-limit combinés. Ratio blocked/total = taux de rejet de la gateway.' },
      { name: 'authFailures', description: 'Échecs auth', interpretation: 'Taux élevé = clients mal configurés ou attaque potentielle.' },
      { name: 'rateLimitHits', description: 'Rate limit atteint', interpretation: 'Trafic qui dépasse la capacité configurée. Augmentez requestsPerSecond si légitime.' },
      { name: 'avgLatency', description: 'Latence moyenne (ms)', interpretation: 'Temps de traitement incluant auth, routing et transmission.' },
    ],
    behavior: 'Vérifie l\'authentification (rejette si échec), applique le rate limiting (rejette si dépassé), route vers le bon microservice selon les règles, retourne la réponse du service au client.',
    connections: 'Reçoit du trafic entrant (clients, CDN, WAF). Route vers des HTTP Servers identifiés par serviceName.',
    protocols: ['rest', 'grpc', 'graphql', 'websocket'],
  },
  {
    name: 'Load Balancer',
    type: 'load-balancer',
    description: 'Répartit la charge entre plusieurs serveurs backend selon un algorithme configurable. Surveille la santé des backends via des health checks périodiques et retire les serveurs défaillants de la rotation. Supporte les sessions persistantes (sticky) pour les applications stateful.',
    category: 'infrastructure',
    sections: [
      {
        name: 'Algorithme de répartition',
        description: 'Détermine comment les requêtes sont distribuées entre les backends.',
        properties: [
          { name: 'algorithm', type: 'enum', defaultValue: 'round-robin', description: 'Algorithme de répartition. « round-robin » : tour par tour cyclique, distribution équitable. « least-connections » : envoie au serveur avec le moins de requêtes actives (optimal pour charges inégales). « ip-hash » : affinité par IP source (même client → même serveur). « weighted » : poids configurable par backend pour favoriser les serveurs puissants.' },
        ],
      },
      {
        name: 'Health Check',
        description: 'Vérification périodique de la santé des backends. Les backends défaillants sont exclus.',
        properties: [
          { name: 'healthCheck.enabled', type: 'boolean', defaultValue: 'true', description: 'Active la vérification de santé. Les backends défaillants sont exclus de la rotation. Désactiver augmente le risque d\'envoyer du trafic vers un serveur en panne.' },
          { name: 'healthCheck.intervalMs', type: 'number', defaultValue: '5000', description: 'Intervalle entre les vérifications en ms. Court = détection rapide mais plus de trafic monitoring. 5-10s est typique.' },
          { name: 'healthCheck.timeoutMs', type: 'number', defaultValue: '2000', description: 'Délai max de réponse au health check en ms. Pas de réponse = check échoué.' },
          { name: 'healthCheck.unhealthyThreshold', type: 'number', defaultValue: '3', description: 'Échecs consécutifs avant marquage « unhealthy ». Un seuil de 3 évite les faux positifs liés à un pic temporaire.' },
        ],
      },
      {
        name: 'Sessions persistantes',
        description: 'Affinité client-serveur pour les applications stateful.',
        properties: [
          { name: 'stickySessions', type: 'boolean', defaultValue: 'false', description: 'Active les sessions persistantes. Les requêtes d\'un même client sont envoyées au même backend. Nécessaire pour les applications stateful. Attention : peut déséquilibrer la charge.' },
          { name: 'sessionTTLSeconds', type: 'number', defaultValue: '3600', description: 'Durée de vie d\'une session sticky en secondes (3600s = 1 heure). Après expiration, le client peut être redirigé vers un autre backend.' },
        ],
      },
    ],
    metrics: [
      { name: 'totalRequests', description: 'Total requêtes distribuées', interpretation: 'Volume de trafic passant par le load balancer.' },
      { name: 'activeConnections', description: 'Connexions actives', interpretation: 'Requêtes en cours de routage vers les backends.' },
      { name: 'backends', description: 'État des backends', interpretation: 'Par backend : poids, santé (healthy/unhealthy), connexions actives. Distribution inégale avec round-robin = backend lent.' },
    ],
    behavior: 'Distribue les requêtes entre les backends connectés selon l\'algorithme. Les backends en panne sont retirés par le health check. Ajoute ~1-2ms de latence pour le routage.',
    connections: 'Reçoit du trafic de clients, gateways ou WAF. Envoie vers des HTTP Servers (backends). Doit avoir au moins 1 backend.',
    protocols: ['rest', 'grpc', 'websocket'],
  },
  {
    name: 'CDN',
    type: 'cdn',
    description: 'Content Delivery Network — cache en edge avec latence réduite. Sert le contenu depuis le point de présence (POP) le plus proche du client. En cas de cache hit, la réponse est quasi instantanée. En cas de miss, la requête est transmise au serveur d\'origine.',
    category: 'infrastructure',
    sections: [
      {
        name: 'Configuration',
        description: 'Paramètres du CDN : provider, cache ratio et latences.',
        properties: [
          { name: 'provider', type: 'enum', defaultValue: 'generic', description: 'Fournisseur CDN. « cloudflare » : réseau mondial avec WAF intégré. « cloudfront » : CDN AWS, intégration S3. « akamai » : haute performance pour le streaming. « generic » : paramètres personnalisables.' },
          { name: 'cacheHitRatio', type: 'number', defaultValue: '85', description: 'Ratio de cache hit (0-100%). 85% = 85% des requêtes servies depuis le cache edge. Plus ce ratio est élevé, moins l\'origin est sollicité. Ajusté par le type de contenu : +30% statique, ÷3 user-spécifique.' },
          { name: 'edgeLatencyMs', type: 'number', defaultValue: '5', description: 'Latence du cache edge en ms (cache hit). Très rapide car servi depuis le POP le plus proche (2-10ms typique).' },
          { name: 'originLatencyMs', type: 'number', defaultValue: '50', description: 'Latence de l\'origine en ms (cache miss). Inclut le trajet retour vers le serveur d\'origine (30-100ms typique).' },
          { name: 'bandwidthMbps', type: 'number', defaultValue: '1000', description: 'Bande passante du CDN en Mbps.' },
          { name: 'cacheTTLSeconds', type: 'number', defaultValue: '3600', description: 'Durée de vie du cache en secondes. Court TTL = contenu frais, long TTL = meilleur hit ratio.' },
        ],
      },
    ],
    metrics: [
      { name: 'cacheHit', description: 'Cache hits', interpretation: 'Requêtes servies depuis le cache edge. Plus c\'est élevé, mieux c\'est.' },
      { name: 'cacheMiss', description: 'Cache miss', interpretation: 'Requêtes transmises à l\'origin. Élevé = TTL trop court ou contenu non cacheable.' },
    ],
    behavior: 'Tire un nombre aléatoire ; si < cacheHitRatio → cache hit (edgeLatencyMs), sinon → cache miss, transmet à l\'origin (originLatencyMs). Le hit ratio est ajusté selon le type de contenu.',
    connections: 'Reçoit du trafic de clients. Transmet les cache miss au serveur d\'origine (edge sortant).',
    protocols: ['rest'],
  },
  {
    name: 'WAF',
    type: 'waf',
    description: 'Web Application Firewall — filtre les requêtes malveillantes avant qu\'elles n\'atteignent les services. Inspecte chaque requête contre un ensemble de règles de sécurité (SQL injection, XSS, rate limiting) et bloque un pourcentage configurable du trafic.',
    category: 'infrastructure',
    sections: [
      {
        name: 'Configuration',
        description: 'Paramètres du WAF : provider, latence d\'inspection et taux de blocage.',
        properties: [
          { name: 'provider', type: 'enum', defaultValue: 'generic', description: 'Fournisseur WAF. « aws-waf », « cloudflare », « azure-waf », ou « generic ». Indicatif.' },
          { name: 'inspectionLatencyMs', type: 'number', defaultValue: '2', description: 'Latence d\'inspection par requête en ms. Temps pour analyser la requête. 1-5ms typique.' },
          { name: 'blockRate', type: 'number', defaultValue: '5', description: 'Taux de blocage simulé (0-100%). Les requêtes bloquées sont rejetées (raison : waf-blocked).' },
          { name: 'requestsPerSecond', type: 'number', defaultValue: '10000', description: 'Débit maximum en req/s. Capacité de traitement du WAF.' },
        ],
      },
      {
        name: 'Règles de sécurité',
        description: 'Types de protection activables. Indicatif dans la simulation.',
        properties: [
          { name: 'rules.sqlInjection', type: 'boolean', defaultValue: 'true', description: 'Protection SQL Injection. Analyse les paramètres pour détecter les tentatives d\'injection.' },
          { name: 'rules.xss', type: 'boolean', defaultValue: 'true', description: 'Protection XSS. Détecte les scripts malveillants dans les données utilisateur.' },
          { name: 'rules.rateLimiting', type: 'boolean', defaultValue: 'true', description: 'Rate limiting au niveau WAF. Complémentaire du rate limiting de l\'API Gateway.' },
          { name: 'rules.ipBlocking', type: 'boolean', defaultValue: 'false', description: 'Blocage par IP. Bloque des plages d\'adresses spécifiques.' },
          { name: 'rules.geoBlocking', type: 'boolean', defaultValue: 'false', description: 'Blocage géographique. Restreint l\'accès selon le pays d\'origine.' },
        ],
      },
    ],
    metrics: [
      { name: 'blockedRequests', description: 'Requêtes bloquées', interpretation: 'Nombre de requêtes rejetées par le WAF (raison : waf-blocked).' },
    ],
    behavior: 'Inspecte chaque requête (inspectionLatencyMs). Un pourcentage aléatoire est bloqué (blockRate). Les requêtes autorisées sont transmises en aval.',
    connections: 'Reçoit du trafic entrant. Transmet les requêtes autorisées.',
    protocols: ['rest', 'graphql', 'websocket'],
  },
  {
    name: 'Firewall',
    type: 'firewall',
    description: 'Firewall réseau — filtre le trafic par action par défaut (allow/deny) et ports autorisés. Plus simple qu\'un WAF, opère au niveau réseau plutôt qu\'applicatif. Note : présent dans le code mais absent du panneau de composants par défaut.',
    category: 'infrastructure',
    sections: [
      {
        name: 'Configuration',
        description: 'Règles d\'accès réseau.',
        properties: [
          { name: 'inspectionLatencyMs', type: 'number', defaultValue: '1', description: 'Latence d\'inspection en ms. Plus rapide qu\'un WAF car les règles sont plus simples (pas d\'inspection applicative).' },
          { name: 'defaultAction', type: 'enum', defaultValue: 'allow', description: 'Action par défaut. « allow » : tout passe sauf les IPs bloquées. « deny » : tout est bloqué sauf les ports autorisés. En mode « deny », definissez obligatoirement allowedPorts.' },
          { name: 'allowedPorts', type: 'object', defaultValue: '[80, 443, 8080]', description: 'Ports autorisés. En mode « deny », seul le trafic vers ces ports passe. Ports courants : 80 (HTTP), 443 (HTTPS), 8080 (dev), 5432 (PostgreSQL), 6379 (Redis).' },
          { name: 'blockedIPs', type: 'object', defaultValue: '[]', description: 'IPs bloquées. Les requêtes de ces IPs sont rejetées (raison : firewall-blocked).' },
        ],
      },
    ],
    metrics: [
      { name: 'blockedRequests', description: 'Requêtes bloquées', interpretation: 'Raison de rejet : firewall-blocked.' },
    ],
    behavior: 'Vérifie les règles d\'accès (ports, IPs). En mode « deny » sans allowedPorts, tout est bloqué. Les requêtes autorisées sont transmises avec la latence d\'inspection.',
    connections: 'Reçoit et transmet le trafic.',
    protocols: ['rest', 'grpc', 'graphql', 'websocket'],
  },
  {
    name: 'Service Discovery',
    type: 'service-discovery',
    description: 'Registre de services — résout dynamiquement les noms de services vers les instances disponibles. Surveille la santé des services enregistrés et met en cache les résolutions récentes pour réduire la latence.',
    category: 'infrastructure',
    sections: [
      {
        name: 'Configuration',
        description: 'Paramètres du registre de services.',
        properties: [
          { name: 'provider', type: 'enum', defaultValue: 'consul', description: 'Fournisseur. « consul » : service mesh avec health checking. « eureka » : registre Netflix OSS. « kubernetes » : service natif K8s via CoreDNS. « generic » : personnalisable.' },
          { name: 'registrationLatencyMs', type: 'number', defaultValue: '10', description: 'Latence d\'enregistrement d\'un service en ms. 5-50ms typique.' },
          { name: 'lookupLatencyMs', type: 'number', defaultValue: '2', description: 'Latence de recherche de service en ms. Avec le cache, la plupart des lookups sont sub-milliseconde.' },
          { name: 'healthCheckIntervalMs', type: 'number', defaultValue: '10000', description: 'Intervalle du health check en ms. 5-30s typique.' },
          { name: 'cacheTTLMs', type: 'number', defaultValue: '5000', description: 'TTL du cache de résolution en ms. Court = plus réactif aux changements, long = plus rapide.' },
        ],
      },
    ],
    metrics: [],
    behavior: 'Résout les noms de service vers les instances. Ajoute la latence de lookup à chaque requête transitant par ce composant.',
    connections: 'Reçoit les requêtes de résolution. Transmet aux services cibles.',
    protocols: ['rest', 'grpc'],
  },

  // ═══════════════════════════════════════
  // DATA (3)
  // ═══════════════════════════════════════
  {
    name: 'Base de données',
    type: 'database',
    description: 'Stockage persistant avec pool de connexions et latences par type d\'opération (lecture, écriture, transaction). Le pool de connexions limite le nombre de requêtes simultanées. Les types de requêtes sont déterminés par la méthode HTTP (GET=read, POST/PUT=write). Les compteurs par type alimentent les métriques globales (databaseQueryCounts).',
    category: 'data',
    sections: [
      {
        name: 'Type de base de données',
        description: 'Choix de la technologie. Indicatif pour la visualisation.',
        properties: [
          { name: 'databaseType', type: 'enum', defaultValue: 'postgresql', description: 'Type de base. « postgresql » : SQL relationnel, fort en transactions et jointures. « mysql » : SQL rapide en lecture. « mongodb » : NoSQL document, flexible en schéma.' },
        ],
      },
      {
        name: 'Pool de connexions',
        description: 'Gestion des connexions client-serveur. Un pool saturé bloque les nouvelles requêtes.',
        properties: [
          { name: 'connectionPool.maxConnections', type: 'number', defaultValue: '20', description: 'Connexions max dans le pool (1-100). Chaque requête DB utilise une connexion. Pool saturé = requêtes en attente ou rejetées. PostgreSQL : défaut 100, MySQL : défaut 151.' },
          { name: 'connectionPool.minConnections', type: 'number', defaultValue: '2', description: 'Connexions minimum maintenues (pré-ouvertes). Évite la latence de création à la demande.' },
          { name: 'connectionPool.connectionTimeoutMs', type: 'number', defaultValue: '5000', description: 'Timeout pour obtenir une connexion en ms. Si le pool est plein et aucune connexion libérée dans ce délai, la requête échoue.' },
          { name: 'connectionPool.idleTimeoutMs', type: 'number', defaultValue: '30000', description: 'Durée avant fermeture d\'une connexion inactive en ms. Libère les ressources des connexions inutilisées.' },
        ],
      },
      {
        name: 'Performance',
        description: 'Latences par type d\'opération. Les latences réelles dépendent de la complexité des requêtes.',
        properties: [
          { name: 'performance.readLatencyMs', type: 'number', defaultValue: '5', description: 'Latence de lecture en ms. SELECT simples : 1-5ms, avec jointures : 10-50ms, full scan : 100ms+.' },
          { name: 'performance.writeLatencyMs', type: 'number', defaultValue: '15', description: 'Latence d\'écriture en ms. INSERT/UPDATE : 5-20ms. Plus lent que la lecture (persistance disque, mise à jour des index).' },
          { name: 'performance.transactionLatencyMs', type: 'number', defaultValue: '30', description: 'Latence d\'une transaction complète en ms. Inclut BEGIN + opérations + COMMIT. Garantit l\'atomicité (ACID).' },
        ],
      },
      {
        name: 'Capacité',
        description: 'Limites de débit de la base.',
        properties: [
          { name: 'capacity.maxQueriesPerSecond', type: 'number', defaultValue: '1000', description: 'Requêtes max par seconde. Au-delà, les requêtes sont ralenties ou rejetées.' },
        ],
      },
      {
        name: 'Fiabilité',
        description: 'Simulation d\'erreurs de la base de données.',
        properties: [
          { name: 'errorRate', type: 'number', defaultValue: '0', description: 'Taux d\'erreur simulé (0-100%). Simule deadlocks, violations de contraintes, timeouts.' },
        ],
      },
    ],
    metrics: [
      { name: 'connectionPoolUsage', description: 'Utilisation pool (%)', interpretation: '> 80% = risque de saturation. > 95% = requêtes en attente fréquentes.' },
      { name: 'queriesPerSecond', description: 'QPS', interpretation: 'Comparez avec maxQueriesPerSecond pour évaluer la marge.' },
      { name: 'avgQueryTime', description: 'Temps moyen (ms)', interpretation: 'Augmente sous charge élevée. Surveillez les pics.' },
      { name: 'queriesByType', description: 'Par type (read/write/tx)', interpretation: 'Ratio élevé de writes = latence plus élevée. Utilisez le cache pour réduire les reads.' },
    ],
    behavior: 'Point de stockage terminal. Vérifie la disponibilité d\'une connexion dans le pool, simule la latence selon le type d\'opération (GET=read, POST/PUT=write), enregistre le type de query dans les métriques globales.',
    connections: 'Reçoit du trafic de services en amont. Ne transmet pas en aval (terminal). Connexion directe (pas de protocole app-level).',
    protocols: [],
  },
  {
    name: 'Cache',
    type: 'cache',
    description: 'Stockage temporaire en mémoire pour accès ultra-rapide. Implémente le pattern cache-aside : en cas de hit, retourne la donnée instantanément ; en cas de miss, transmet la requête à la base de données en aval, stocke le résultat, puis retourne la réponse. Supporte le warm-up progressif simulant un cache qui se remplit après redémarrage.',
    category: 'data',
    sections: [
      {
        name: 'Type de cache',
        description: 'Choix de la technologie de cache.',
        properties: [
          { name: 'cacheType', type: 'enum', defaultValue: 'redis', description: 'Type de cache. « redis » : in-memory, supporte les structures complexes (listes, sets, hashes). « memcached » : in-memory simplifié, très rapide pour le key-value. Redis est plus versatile, Memcached plus performant en lecture pure.' },
        ],
      },
      {
        name: 'Configuration',
        description: 'Capacité, éviction et TTL du cache.',
        properties: [
          { name: 'configuration.maxMemoryMB', type: 'number', defaultValue: '512', description: 'Mémoire max en Mo. À 100%, l\'éviction commence selon la politique configurée.' },
          { name: 'configuration.maxKeys', type: 'number', defaultValue: '100000', description: 'Nombre max de clés stockées. Limite logique indépendante de la mémoire.' },
          { name: 'configuration.defaultTTLSeconds', type: 'number', defaultValue: '3600', description: 'Durée de vie des clés en secondes. Court TTL = données fraîches mais plus de miss. Long TTL = meilleur hit ratio mais données potentiellement périmées.' },
          { name: 'configuration.evictionPolicy', type: 'enum', defaultValue: 'lru', description: 'Politique d\'éviction. « lru » (Least Recently Used) : supprime la clé la moins récemment accédée (meilleur choix général). « lfu » (Least Frequently Used) : supprime la moins souvent accédée. « fifo » : supprime la plus ancienne.' },
        ],
      },
      {
        name: 'Performance',
        description: 'Latences des opérations de cache.',
        properties: [
          { name: 'performance.getLatencyMs', type: 'number', defaultValue: '1', description: 'Latence GET en ms (cache hit). Redis typique : 0.1-1ms. C\'est la latence pour les requêtes trouvées en cache.' },
          { name: 'performance.setLatencyMs', type: 'number', defaultValue: '2', description: 'Latence SET en ms. Légèrement plus lent que GET (écriture mémoire + mise à jour de la politique d\'éviction).' },
        ],
      },
      {
        name: 'Simulation du comportement',
        description: 'Contrôle du hit/miss ratio et du warm-up.',
        properties: [
          { name: 'initialHitRatio', type: 'number', defaultValue: '80', description: 'Ratio de cache hit initial (0-100%). 80% = 80% des requêtes trouvent la donnée en cache. Les 20% restants sont des cache miss transmis à la DB.' },
          { name: 'hitRatioVariance', type: 'number', defaultValue: '10', description: 'Variance du hit ratio (0-30%). Avec 80% initial et 10% variance, le ratio effectif varie entre 70% et 90%.' },
          { name: 'warmUpEnabled', type: 'boolean', defaultValue: 'true', description: 'Active le warm-up progressif. Le cache démarre vide : le hit ratio monte de 0% vers initialHitRatio sur la durée configurée.' },
          { name: 'warmUpDurationMs', type: 'number', defaultValue: '30000', description: 'Durée du warm-up en ms. Pendant cette période, le hit ratio augmente linéairement de 0 à initialHitRatio.' },
        ],
      },
    ],
    metrics: [
      { name: 'hitRatio', description: 'Hit ratio (%)', interpretation: '< 50% = cache peu efficace. 70-80% = bon. > 90% = excellent. Surveillez pendant le warm-up.' },
      { name: 'hitCount / missCount', description: 'Hits vs Miss', interpretation: 'Le ratio hit/miss détermine l\'efficacité du cache et la charge sur la DB.' },
      { name: 'evictionCount', description: 'Évictions', interpretation: 'Nombre élevé = maxMemoryMB insuffisant ou TTL trop long. Augmentez la mémoire.' },
      { name: 'memoryUsage', description: 'Mémoire (%)', interpretation: 'À 100%, l\'éviction commence. Surveillez pour anticiper la saturation.' },
    ],
    behavior: 'Pattern cache-aside. 1) Vérifie si la donnée est en cache (selon hitRatio). 2) Si hit → retourne avec getLatencyMs. 3) Si miss → transmet à la DB (action: cache-miss). 4) Stocke le résultat (setLatencyMs, action: store-and-respond). 5) Retourne la réponse.',
    connections: 'Reçoit du trafic en amont. Doit avoir un edge sortant vers une DB (fallback en cache-miss). Connexion directe.',
    protocols: [],
  },
  {
    name: 'File de messages',
    type: 'message-queue',
    description: 'Communication asynchrone entre services. Le producteur publie un message et reçoit une réponse immédiate (fire-and-forget). La queue stocke les messages et les distribue aux consumers connectés. Supporte les modes FIFO, priorité et pub/sub. Les messages en échec sont retentés puis envoyés en dead letter queue.',
    category: 'data',
    sections: [
      {
        name: 'Type et mode',
        description: 'Choix de la technologie et du pattern de distribution.',
        properties: [
          { name: 'queueType', type: 'enum', defaultValue: 'rabbitmq', description: 'Type de file. « rabbitmq » : broker classique AMQP, fiable. « kafka » : event streaming haute performance, rétention longue. « sqs » : service AWS managé, simple et scalable.' },
          { name: 'mode', type: 'enum', defaultValue: 'fifo', description: 'Mode de distribution. « fifo » : premier entré premier sorti, garantit l\'ordre. « priority » : messages prioritaires traités en premier. « pubsub » : publication vers tous les abonnés (fan-out).' },
        ],
      },
      {
        name: 'Configuration',
        description: 'Paramètres de la file : taille, rétention, délai.',
        properties: [
          { name: 'configuration.maxQueueSize', type: 'number', defaultValue: '10000', description: 'Taille max de la file. File pleine = rejet des nouveaux messages (raison : queue-full).' },
          { name: 'configuration.messageRetentionMs', type: 'number', defaultValue: '86400000', description: 'Rétention des messages en ms (86400000 = 24h). Messages non consommés au-delà → supprimés.' },
          { name: 'configuration.deliveryDelayMs', type: 'number', defaultValue: '0', description: 'Délai de livraison en ms. Messages retenus avant d\'être visibles aux consumers.' },
          { name: 'configuration.visibilityTimeoutMs', type: 'number', defaultValue: '30000', description: 'Timeout de visibilité en ms. Après livraison, le message est invisible pendant ce délai. Sans acquittement, il réapparaît. Trop court = doublons, trop long = retard de retraitement.' },
        ],
      },
      {
        name: 'Performance',
        description: 'Latences et débit de la file.',
        properties: [
          { name: 'performance.publishLatencyMs', type: 'number', defaultValue: '2', description: 'Latence de publication en ms. RabbitMQ: 1-5ms, Kafka: 1-2ms, SQS: 5-10ms.' },
          { name: 'performance.consumeLatencyMs', type: 'number', defaultValue: '5', description: 'Latence de consommation en ms. Temps pour récupérer un message.' },
          { name: 'performance.messagesPerSecond', type: 'number', defaultValue: '1000', description: 'Débit max en messages/seconde.' },
        ],
      },
      {
        name: 'Consumers',
        description: 'Configuration des consommateurs de messages.',
        properties: [
          { name: 'consumerCount', type: 'number', defaultValue: '1', description: 'Nombre de consumers actifs (1-100). Plus de consumers = plus de messages traités en parallèle.' },
          { name: 'prefetchCount', type: 'number', defaultValue: '10', description: 'Messages pré-chargés par consumer. Améliore le débit mais peut déséquilibrer la charge.' },
          { name: 'ackMode', type: 'enum', defaultValue: 'auto', description: 'Mode d\'acquittement. « auto » : acquittement à la réception. « manual » : acquittement explicite après traitement. Manual est plus fiable mais plus lent.' },
        ],
      },
      {
        name: 'Fiabilité',
        description: 'Retry et dead letter queue pour les messages en échec.',
        properties: [
          { name: 'retryEnabled', type: 'boolean', defaultValue: 'true', description: 'Active les retentatives automatiques. Messages en échec re-livrés jusqu\'à maxRetries.' },
          { name: 'maxRetries', type: 'number', defaultValue: '3', description: 'Retentatives max. Après ce nombre d\'échecs → dead letter queue (si activée) ou perte.' },
          { name: 'deadLetterEnabled', type: 'boolean', defaultValue: 'true', description: 'Active la dead letter queue (DLQ). Messages ayant échoué maxRetries fois → DLQ pour analyse. Indispensable en production.' },
        ],
      },
    ],
    metrics: [
      { name: 'queueDepth', description: 'Profondeur file', interpretation: 'Croissance continue = consumers trop lents ou insuffisants.' },
      { name: 'messagesPublished', description: 'Messages publiés', interpretation: 'Volume de production. Comparez avec messagesConsumed pour le retard.' },
      { name: 'messagesConsumed', description: 'Messages consommés', interpretation: 'L\'écart avec messagesPublished révèle le retard de traitement.' },
      { name: 'messagesDeadLettered', description: 'Dead letters', interpretation: '> 0 = erreurs récurrentes nécessitant investigation.' },
      { name: 'messagesRetried', description: 'Retentatives', interpretation: 'Nombre élevé = consumers instables ou traitement trop lent.' },
      { name: 'avgProcessingTime', description: 'Temps traitement (ms)', interpretation: 'Augmente si les consumers sont surchargés.' },
      { name: 'throughput', description: 'Débit (msgs/s)', interpretation: 'Comparez avec messagesPerSecond pour la marge restante.' },
    ],
    behavior: 'Le producteur publie un message (action: notify), la queue le stocke, puis le transmet aux consumers en aval. Le producteur reçoit une réponse immédiate (fire-and-forget). Les messages sont retentés en cas d\'échec.',
    connections: 'Reçoit des messages en amont. Transmet aux consumers en aval. Doit avoir au moins un consumer (edge sortant). Connexion directe.',
    protocols: [],
  },

  // ═══════════════════════════════════════
  // RESILIENCE (1)
  // ═══════════════════════════════════════
  {
    name: 'Circuit Breaker',
    type: 'circuit-breaker',
    description: 'Pattern Circuit Breaker — protège les services contre les cascades d\'erreurs via une machine à 3 états. En état « closed » : transmet normalement. Quand le nombre d\'erreurs atteint le seuil → « open » : rejette toutes les requêtes. Après un délai → « half-open » : laisse passer quelques requêtes test. Si elles réussissent → retour « closed ».',
    category: 'resilience',
    sections: [
      {
        name: 'Seuils et timing',
        description: 'Configuration de la machine à états. Détermine la sensibilité et la réactivité du circuit breaker.',
        properties: [
          { name: 'failureThreshold', type: 'number', defaultValue: '5', description: 'Échecs consécutifs avant ouverture du circuit. Sous ce seuil, le circuit reste fermé. Valeur basse = sensible, élevée = tolérant. 5 est un bon compromis.' },
          { name: 'successThreshold', type: 'number', defaultValue: '3', description: 'Succès consécutifs en half-open pour refermer le circuit. Confirme que le service est rétabli. 2-5 est typique.' },
          { name: 'timeout', type: 'number', defaultValue: '30000', description: 'Délai en ms avant de passer de open à half-open. Pendant l\'état open, tout est rejeté. 30s est un bon compromis entre récupération rapide et stabilité.' },
          { name: 'halfOpenMaxRequests', type: 'number', defaultValue: '3', description: 'Requêtes test autorisées en half-open. Si elles réussissent → closed. Si échec → retour open. Trop élevé = trop de charge sur un service fragile.' },
          { name: 'monitoringWindow', type: 'number', defaultValue: '60000', description: 'Fenêtre de monitoring en ms. Les compteurs sont réinitialisés après cette fenêtre. Évite qu\'une erreur ancienne influence le circuit.' },
        ],
      },
      {
        name: 'État du circuit',
        description: 'Valeurs runtime mises à jour par le moteur de simulation (lecture seule).',
        properties: [
          { name: 'circuitState', type: 'enum', defaultValue: 'closed', description: 'État actuel. « closed » (vert) = normal. « open » (rouge) = toutes les requêtes rejetées (raison : circuit-open). « half-open » (orange) = test en cours.' },
          { name: 'failureCount', type: 'number', defaultValue: '0', description: 'Compteur d\'échecs dans la fenêtre actuelle. Approche failureThreshold = ouverture imminente.' },
          { name: 'successCount', type: 'number', defaultValue: '0', description: 'Compteur de succès en half-open. Approche successThreshold = fermeture imminente.' },
        ],
      },
    ],
    metrics: [
      { name: 'circuitState', description: 'État du circuit', interpretation: 'closed=normal, open=protection active, half-open=test. Oscillation rapide open/half-open = service instable.' },
      { name: 'failureCount', description: 'Compteur erreurs', interpretation: 'Approchant failureThreshold = alerte précoce.' },
      { name: 'successCount', description: 'Compteur succès', interpretation: 'Progresse vers successThreshold pour la fermeture.' },
    ],
    behavior: 'Proxy protecteur avec machine à 3 états. Closed → transmet normalement. failureThreshold atteint → Open (rejette tout, raison: circuit-open). Après timeout → Half-open (laisse passer quelques requêtes test). successThreshold atteints → Closed. Une erreur en half-open → retour Open.',
    connections: 'Doit avoir un edge entrant ET un edge sortant. Placé entre un client/gateway et un service fragile.',
    protocols: ['rest', 'grpc', 'graphql', 'websocket'],
  },

  // ═══════════════════════════════════════
  // COMPUTE (5)
  // ═══════════════════════════════════════
  {
    name: 'Serveur Hôte',
    type: 'host-server',
    description: 'Serveur physique ou VM hébergeant des conteneurs Docker. Partage ses ressources CPU/RAM/réseau entre tous ses enfants via le HierarchicalResourceManager. Le trafic entrant est routé vers les conteneurs enfants via les port mappings (équivalent Docker -p).',
    category: 'compute',
    sections: [
      {
        name: 'Identification',
        description: 'Identification réseau du serveur.',
        properties: [
          { name: 'ipAddress', type: 'string', defaultValue: '192.168.1.10', description: 'Adresse IP du serveur (IPv4). Utilisée pour les logs et l\'identification.' },
          { name: 'hostname', type: 'string', defaultValue: '—', description: 'Nom d\'hôte optionnel (ex: web-server-01). Affiché dans les métriques.' },
          { name: 'os', type: 'enum', defaultValue: 'linux', description: 'Système d\'exploitation. « linux », « windows », « macos ». Indicatif pour la visualisation (icône).' },
        ],
      },
      {
        name: 'Port Mappings',
        description: 'Routage du trafic vers les conteneurs enfants. Équivalent Docker -p hostPort:containerPort.',
        properties: [
          { name: 'portMappings', type: 'object', defaultValue: '[]', description: 'Liste des mappings de port host → conteneur. Chaque mapping : hostPort (port d\'entrée), containerNodeId (ID du conteneur cible), containerPort (port interne), protocol (tcp/udp). Les edges entrants doivent spécifier targetPort pour être routés.' },
        ],
      },
      {
        name: 'Ressources',
        description: 'Identique au HTTP Server (ServerResources). Ces ressources sont partagées entre tous les enfants (conteneurs + services).',
        properties: [
          { name: 'resources.cpu.cores', type: 'number', defaultValue: '4', description: 'Cœurs CPU partagés entre les enfants. La somme des cpuLimitCores des conteneurs ne devrait pas dépasser ce nombre.' },
          { name: 'resources.memory.totalMB', type: 'number', defaultValue: '4096', description: 'RAM totale partagée. La somme des memoryLimitMB des conteneurs ne devrait pas dépasser ce total.' },
          { name: 'resources.connections.maxConcurrent', type: 'number', defaultValue: '100', description: 'Connexions simultanées max au niveau serveur.' },
        ],
      },
      {
        name: 'Dégradation',
        description: 'Comportement sous charge (identique au HTTP Server).',
        properties: [
          { name: 'degradation.enabled', type: 'boolean', defaultValue: 'true', description: 'Active la dégradation de latence sous charge.' },
          { name: 'degradation.formula', type: 'enum', defaultValue: 'quadratic', description: 'Formule de dégradation (linear, quadratic, exponential).' },
        ],
      },
    ],
    metrics: [
      { name: 'CPU/RAM/Réseau', description: 'Utilisation agrégée', interpretation: 'Inclut la consommation de tous les enfants (isAggregated=true). Identifie la ressource limitante du serveur physique.' },
    ],
    behavior: 'Serveur physique hébergeant des conteneurs. Ressources partagées via HierarchicalResourceManager. Requêtes routées via port mappings vers les conteneurs enfants.',
    connections: 'Les edges entrants DOIVENT spécifier targetPort. Peut être placé dans une Network Zone. Ne peut pas être enfant d\'un autre composant.',
    protocols: ['rest', 'grpc', 'graphql', 'websocket'],
  },
  {
    name: 'Container',
    type: 'container',
    description: 'Container Docker/Kubernetes avec limites de ressources CPU/mémoire, replicas et auto-scaling HPA. Doit être enfant d\'un Host Server et partage les ressources du parent. Peut héberger des services (API Service, Background Job, etc.) en tant qu\'enfants.',
    category: 'compute',
    sections: [
      {
        name: 'Image et replicas',
        description: 'Configuration de base du conteneur.',
        properties: [
          { name: 'image', type: 'string', defaultValue: 'app:latest', description: 'Image Docker (indicatif). Ex: nginx:latest, node:20-alpine.' },
          { name: 'replicas', type: 'number', defaultValue: '2', description: 'Nombre de replicas. Plus de replicas = plus de capacité. L\'auto-scaler ajuste dynamiquement.' },
        ],
      },
      {
        name: 'Limites de ressources',
        description: 'Contraintes CPU et mémoire. Dépassement mémoire = OOM killed.',
        properties: [
          { name: 'cpuLimit', type: 'string', defaultValue: '500m', description: 'Limite CPU (millicores K8s). 500m = 0.5 cœur, 1000m = 1 cœur. Dépassement = throttling.' },
          { name: 'memoryLimit', type: 'string', defaultValue: '512Mi', description: 'Limite mémoire (format K8s). 512Mi = 512 Mo. Dépassement = OOM killed (raison: oom-killed).' },
          { name: 'cpuLimitCores', type: 'number', defaultValue: '2', description: 'Limite CPU en cœurs (Docker --cpus). Utilisé pour les calculs de simulation.' },
          { name: 'memoryLimitMB', type: 'number', defaultValue: '512', description: 'Limite mémoire en Mo (Docker --memory). Dépassement = OOM killed.' },
        ],
      },
      {
        name: 'Auto-scaling (HPA)',
        description: 'Horizontal Pod Autoscaler. Ajuste automatiquement le nombre de replicas.',
        properties: [
          { name: 'autoScaling.enabled', type: 'boolean', defaultValue: 'true', description: 'Active le HPA. Le nombre de replicas s\'ajuste selon l\'utilisation CPU.' },
          { name: 'autoScaling.minReplicas', type: 'number', defaultValue: '1', description: 'Minimum de replicas. Ne descend jamais en dessous.' },
          { name: 'autoScaling.maxReplicas', type: 'number', defaultValue: '10', description: 'Maximum de replicas. Limite le scaling pour contrôler les coûts et la charge en aval.' },
          { name: 'autoScaling.targetCPU', type: 'number', defaultValue: '70', description: 'Seuil CPU cible (%). Scale up au-dessus, scale down en dessous. 70% = standard K8s.' },
        ],
      },
      {
        name: 'Health Check',
        description: 'Vérification de la santé du conteneur.',
        properties: [
          { name: 'healthCheck.path', type: 'string', defaultValue: '/health', description: 'Endpoint du health check. Retour 200 = sain.' },
          { name: 'healthCheck.intervalMs', type: 'number', defaultValue: '10000', description: 'Intervalle du health check en ms.' },
          { name: 'healthCheck.timeoutMs', type: 'number', defaultValue: '3000', description: 'Timeout en ms. 3 échecs consécutifs = redémarrage.' },
        ],
      },
      {
        name: 'Performance',
        description: 'Overhead du conteneur.',
        properties: [
          { name: 'responseDelayMs', type: 'number', defaultValue: '20', description: 'Délai ajouté par le conteneur en ms. Simule l\'overhead de virtualisation.' },
        ],
      },
    ],
    metrics: [
      { name: 'oom-killed', description: 'OOM Killed', interpretation: 'Le conteneur a dépassé sa limite mémoire et a été tué. Augmentez memoryLimitMB.' },
    ],
    behavior: 'Environnement isolé avec limites de ressources. L\'auto-scaler ajuste les replicas en temps réel. Les ressources sont partagées avec le Host Server parent.',
    connections: 'DOIT être enfant d\'un Host Server. Peut contenir des services. Trafic via les port mappings du parent.',
    protocols: ['rest', 'grpc', 'graphql', 'websocket'],
  },
  {
    name: 'API Service',
    type: 'api-service',
    description: 'Microservice hébergé dans un Host Server ou Container. Expose une API REST, gRPC ou GraphQL avec dégradation de latence quadratique sous charge et taux d\'erreur dynamique augmentant à haute saturation.',
    category: 'compute',
    sections: [
      {
        name: 'Configuration',
        description: 'Paramètres du service : identification, protocole et performance.',
        properties: [
          { name: 'serviceName', type: 'string', defaultValue: 'my-service', description: 'Nom unique du service (ex: users-service). Doit correspondre au targetServiceName des règles de routage de l\'API Gateway.' },
          { name: 'basePath', type: 'string', defaultValue: '/api', description: 'Route de base du service.' },
          { name: 'protocol', type: 'enum', defaultValue: 'rest', description: 'Protocole. « rest » : API RESTful. « grpc » : RPC binaire haute performance. « graphql » : requêtes flexibles avec schéma typé.' },
          { name: 'responseTime', type: 'number', defaultValue: '50', description: 'Temps de réponse en ms. Latence de base augmentée sous charge (dégradation quadratique : responseTime × (1 + load²)).' },
          { name: 'errorRate', type: 'number', defaultValue: '0', description: 'Taux d\'erreur (0-100%). Augmente dynamiquement au-delà de 80% de saturation.' },
          { name: 'maxConcurrentRequests', type: 'number', defaultValue: '100', description: 'Requêtes concurrentes max. Facteur principal de capacité.' },
        ],
      },
    ],
    metrics: [
      { name: 'activeRequests', description: 'Requêtes actives', interpretation: 'Comparez avec maxConcurrentRequests. > 80% = dégradation visible.' },
      { name: 'totalRequests', description: 'Total requêtes', interpretation: 'Compteur cumulé depuis le début de la simulation.' },
    ],
    behavior: 'Microservice avec dégradation sous charge. Calcule la charge (active/maxConcurrent), applique la dégradation quadratique à la latence. À > 80% saturation, le taux d\'erreur augmente dynamiquement.',
    connections: 'Hébergé dans un Host Server ou Container. Peut transmettre à des DBs, caches, queues.',
    protocols: ['rest', 'grpc', 'graphql'],
  },
  {
    name: 'Serverless',
    type: 'serverless',
    description: 'Fonction serverless avec cold start, auto-scaling et concurrence limitée. Les instances sont créées à la demande et deviennent « froides » après 5 minutes d\'inactivité. Le cold start ajoute une latence significative à la première invocation.',
    category: 'compute',
    sections: [
      {
        name: 'Configuration',
        description: 'Paramètres de la fonction serverless.',
        properties: [
          { name: 'provider', type: 'enum', defaultValue: 'aws', description: 'Fournisseur cloud (AWS Lambda, Azure Functions, GCP Cloud Functions, generic).' },
          { name: 'runtime', type: 'string', defaultValue: 'nodejs20.x', description: 'Runtime d\'exécution (indicatif). Le runtime influence le cold start en production.' },
          { name: 'memoryMB', type: 'number', defaultValue: '256', description: 'Mémoire allouée en Mo. Plus de mémoire = plus de CPU alloué proportionnellement (Lambda).' },
          { name: 'timeoutMs', type: 'number', defaultValue: '30000', description: 'Timeout d\'exécution en ms. ATTENTION : doit être > coldStartMs sinon timeout systématique au cold start.' },
          { name: 'coldStartMs', type: 'number', defaultValue: '500', description: 'Latence de cold start en ms. Temps de démarrage quand aucune instance n\'est disponible (après 5 min d\'inactivité).' },
          { name: 'warmStartMs', type: 'number', defaultValue: '5', description: 'Latence de warm start en ms. Instance déjà chaude = réponse très rapide.' },
          { name: 'concurrencyLimit', type: 'number', defaultValue: '100', description: 'Concurrence max. Au-delà = rejet (raison: capacity). Lambda: 1000 par défaut par compte.' },
          { name: 'minInstances', type: 'number', defaultValue: '0', description: 'Instances minimum (provisioned). Restent chaudes en permanence, éliminant les cold starts. Coûteux.' },
          { name: 'maxInstances', type: 'number', defaultValue: '100', description: 'Instances maximum. Limite le scaling pour contrôler les coûts.' },
        ],
      },
    ],
    metrics: [
      { name: 'coldStarts', description: 'Cold starts', interpretation: 'Fréquents = minInstances trop bas. Impacte la latence P99.' },
      { name: 'activeInstances', description: 'Instances actives', interpretation: 'Évolue avec la charge. Approche maxInstances = scaling limité.' },
    ],
    behavior: 'Fonction à la demande. Pas d\'instance chaude → cold start (coldStartMs), sinon → warm start (warmStartMs). Instances froides après 5 min d\'inactivité. Au-delà de concurrencyLimit → rejet.',
    connections: 'Reçoit du trafic de gateways, services ou clients. Peut transmettre en aval.',
    protocols: ['rest', 'grpc'],
  },
  {
    name: 'Background Job',
    type: 'background-job',
    description: 'Job en arrière-plan asynchrone. Trois types : « cron » (planifié par expression cron), « worker » (consomme en continu depuis une Message Queue), « batch » (traite des lots de données par taille configurable).',
    category: 'compute',
    sections: [
      {
        name: 'Configuration',
        description: 'Paramètres du job : type, planning et performance.',
        properties: [
          { name: 'jobType', type: 'enum', defaultValue: 'worker', description: 'Type de job. « cron » : exécution planifiée (nécessite schedule). « worker » : consommation continue depuis une queue. « batch » : traitement par lots (nécessite batchSize).' },
          { name: 'schedule', type: 'string', defaultValue: '—', description: 'Expression cron (type cron). Format: « minute heure jour mois jour_semaine ». Ex: « 0/5 * * * * » = toutes les 5 min. Obligatoire pour cron.' },
          { name: 'concurrency', type: 'number', defaultValue: '1', description: 'Exécutions concurrentes max. Worker : messages traités en parallèle. Batch : lots simultanés.' },
          { name: 'processingTimeMs', type: 'number', defaultValue: '500', description: 'Durée moyenne d\'exécution en ms. Un cron de rapport : 10s. Un worker de message : 100ms.' },
          { name: 'errorRate', type: 'number', defaultValue: '0', description: 'Taux d\'erreur simulé (0-100%).' },
          { name: 'batchSize', type: 'number', defaultValue: '—', description: 'Taille du lot (type batch). Éléments traités par exécution. Obligatoire pour batch.' },
        ],
      },
    ],
    metrics: [],
    behavior: 'Cron : exécute périodiquement selon le schedule. Worker : consomme les messages de la queue connectée. Batch : traite des lots de données. Le traitement prend processingTimeMs et échoue selon errorRate.',
    connections: 'Worker : connecté à une Message Queue en amont. Peut transmettre à des DBs ou services en aval. Connexion directe.',
    protocols: [],
  },

  // ═══════════════════════════════════════
  // CLOUD (2)
  // ═══════════════════════════════════════
  {
    name: 'Cloud Storage',
    type: 'cloud-storage',
    description: 'Stockage objet cloud (S3, Azure Blob, GCS). Point de stockage terminal avec latences de lecture/écriture configurables et limitation de débit. La classe de stockage affecte les latences.',
    category: 'cloud',
    sections: [
      {
        name: 'Configuration',
        description: 'Paramètres du stockage objet.',
        properties: [
          { name: 'provider', type: 'enum', defaultValue: 'aws', description: 'Fournisseur. « aws » (S3), « azure » (Blob Storage), « gcp » (Cloud Storage), « generic ».' },
          { name: 'storageClass', type: 'enum', defaultValue: 'standard', description: 'Classe de stockage. « standard » : accès fréquent, latence faible. « infrequent » : accès rare, coût réduit. « archive » : archivage froid, latence très élevée.' },
          { name: 'readLatencyMs', type: 'number', defaultValue: '20', description: 'Latence de lecture en ms. Standard: 10-50ms. Archive: potentiellement des heures.' },
          { name: 'writeLatencyMs', type: 'number', defaultValue: '50', description: 'Latence d\'écriture en ms. Plus lent que la lecture (réplication, confirmation).' },
          { name: 'bandwidthMbps', type: 'number', defaultValue: '500', description: 'Bande passante en Mbps.' },
          { name: 'maxRequestsPerSecond', type: 'number', defaultValue: '5500', description: 'Max req/s. S3: 5500 GET/s par préfixe. Au-delà = throttling.' },
        ],
      },
    ],
    metrics: [],
    behavior: 'Point de stockage terminal. Simule les latences de lecture/écriture selon la classe de stockage. Pas de dégradation sous charge.',
    connections: 'Reçoit du trafic en amont. Ne transmet pas en aval (terminal).',
    protocols: ['rest'],
  },
  {
    name: 'Cloud Function',
    type: 'cloud-function',
    description: 'Fonction cloud managée — extension de Serverless avec presets spécifiques au fournisseur. Hérite de toutes les propriétés serverless (cold start, concurrence, scaling). Le serviceType détermine les presets par défaut.',
    category: 'cloud',
    sections: [
      {
        name: 'Configuration spécifique',
        description: 'Paramètre additionnel par rapport à Serverless.',
        properties: [
          { name: 'serviceType', type: 'enum', defaultValue: 'aws-lambda', description: 'Service cloud spécifique. « aws-lambda » : fonctions AWS. « azure-function » : fonctions Azure. « gcp-cloud-function » : fonctions Google Cloud.' },
        ],
      },
    ],
    metrics: [
      { name: 'coldStarts', description: 'Cold starts', interpretation: 'Identique à Serverless. Fréquents = minInstances trop bas.' },
    ],
    behavior: 'Identique à Serverless avec des presets spécifiques au fournisseur cloud.',
    connections: 'Identiques à Serverless.',
    protocols: ['rest', 'grpc'],
  },

  // ═══════════════════════════════════════
  // ZONES (1)
  // ═══════════════════════════════════════
  {
    name: 'Zone Réseau',
    type: 'network-zone',
    description: 'Zone de regroupement réseau isolée (VPC, DMZ, backend, data). Conteneur visuel et logique qui regroupe les composants. La latence inter-zone est ajoutée à chaque requête traversant les frontières de cette zone.',
    category: 'zone',
    sections: [
      {
        name: 'Configuration',
        description: 'Paramètres de la zone réseau.',
        properties: [
          { name: 'zoneType', type: 'enum', defaultValue: 'backend', description: 'Type de zone. « public » : accessible depuis Internet (bleu). « dmz » : zone démilitarisée (jaune). « backend » : zone privée interne (vert). « data » : zone base de données isolée (violet). « custom » : personnalisée (gris).' },
          { name: 'domain', type: 'string', defaultValue: '—', description: 'Domaine de la zone (ex: api.example.com). Indicatif pour la documentation.' },
          { name: 'subdomains', type: 'object', defaultValue: '[]', description: 'Sous-domaines associés. Indicatif.' },
          { name: 'interZoneLatency', type: 'number', defaultValue: '2', description: 'Latence inter-zone en ms. Ajoutée à chaque requête traversant les frontières. Même datacenter ~1-2ms, inter-région ~50-100ms.' },
          { name: 'color', type: 'string', defaultValue: 'auto', description: 'Couleur de la zone. Déterminée automatiquement par le zoneType. Personnalisable.' },
        ],
      },
    ],
    metrics: [],
    behavior: 'Conteneur passif. Regroupe visuellement les composants. La latence inter-zone est ajoutée aux requêtes traversant les frontières.',
    connections: 'Pas de connexions directes. Les composants enfants maintiennent leurs propres connexions.',
    protocols: [],
  },
];

// ── Edge Properties ──

export const edgeProperties: DocEdgeProperty[] = [
  { name: 'protocol', type: 'enum', defaultValue: 'auto', description: 'Protocole de communication. « rest » : API RESTful HTTP/JSON. « grpc » : RPC binaire haute performance (HTTP/2, protobuf). « websocket » : connexion bidirectionnelle persistante. « graphql » : requêtes flexibles avec schéma. Auto-suggéré selon les composants connectés. Certains composants (database, cache, message-queue, background-job) utilisent une connexion directe sans protocole.' },
  { name: 'targetPort', type: 'number', defaultValue: '—', description: 'Port cible sur le nœud de destination. OBLIGATOIRE pour les edges vers un Host Server — détermine quel conteneur enfant reçoit le trafic via les portMappings. Recommandé pour les edges vers un Firewall. Plage : 1-65535.' },
  { name: 'label', type: 'string', defaultValue: '—', description: 'Texte affiché sur l\'edge. Par défaut, affiche le protocole et le nombre de particules en transit. Utile pour documenter la connexion (ex: « auth », « data sync »).' },
  { name: 'color', type: 'string', defaultValue: 'auto', description: 'Couleur personnalisée en hexadécimal. 6 couleurs prédéfinies : gris (#888888), bleu (#3b82f6), vert (#22c55e), orange (#f97316), rouge (#ef4444), violet (#8b5cf6). Utile pour distinguer les flux (rouge=erreurs, vert=succès).' },
  { name: 'strokeWidth', type: 'number', defaultValue: '1.5', description: 'Épaisseur en pixels (1-8). Augmentez pour mettre en évidence les flux critiques. Les edges sélectionnés passent à 2px avec un effet de brillance.' },
  { name: 'strokeStyle', type: 'enum', defaultValue: 'solid', description: 'Style du trait. « solid » : continu (standard). « dashed » : pointillés (connexions optionnelles). « dotted » : points (connexions logiques ou futures).' },
  { name: 'pathType', type: 'enum', defaultValue: 'bezier', description: 'Type de courbe. « bezier » : courbe élégante automatique (défaut). « smoothstep » : angle arrondi en escalier. « straight » : ligne droite.' },
];

// ── Particle Types ──

export const particleTypes = [
  { type: 'request', color: 'oklch(0.70 0.15 220)', label: 'Requête', description: 'Particule bleue — requête en transit du client vers le serveur.' },
  { type: 'response-success', color: 'oklch(0.72 0.19 155)', label: 'Réponse succès', description: 'Particule verte — réponse réussie du serveur vers le client.' },
  { type: 'response-error', color: 'oklch(0.65 0.22 25)', label: 'Réponse erreur', description: 'Particule rouge — réponse en erreur retournée au client.' },
];

// ── Global Metrics ──

export const globalMetrics: DocMetric[] = [
  { name: 'REQ', description: 'Requêtes envoyées', interpretation: 'Volume total de trafic généré par les clients. Augmente linéairement en charge constante.' },
  { name: 'RES', description: 'Réponses reçues', interpretation: 'Total des réponses (succès + erreurs). L\'écart avec REQ = requêtes encore en transit.' },
  { name: 'ERR (%)', description: 'Taux d\'erreur', interpretation: '< 1% acceptable | 1-5% à surveiller | > 5% problème systémique. Inclut les rejets et erreurs serveur.' },
  { name: 'P50', description: 'Latence médiane', interpretation: 'La moitié des requêtes sont plus rapides que ce seuil. Bon indicateur de la latence « typique ».' },
  { name: 'P95', description: 'Latence 95e percentile', interpretation: '95% des requêtes sont sous ce seuil. Indicateur clé pour les SLA. L\'écart P50/P95 révèle la variabilité.' },
  { name: 'P99', description: 'Latence 99e percentile', interpretation: 'Cas limite — révèle les pics de latence sous charge. Un P99 élevé indique des congestions intermittentes.' },
  { name: 'RPS', description: 'Requêtes par seconde', interpretation: 'Débit réel du système. Comparez avec le débit attendu (virtualClients / baseInterval).' },
  { name: 'CPU %', description: 'Utilisation CPU', interpretation: '< 70% sain | 70-90% attention | > 90% saturation. Surveillez par serveur pour identifier les goulots.' },
  { name: 'RAM %', description: 'Utilisation mémoire', interpretation: 'Mêmes seuils que CPU. Croissance continue = risque de fuite mémoire ou dimensionnement insuffisant.' },
  { name: 'Réseau %', description: 'Utilisation réseau', interpretation: 'Bande passante relative au max configuré. Rarement limitant sauf pour les gros payloads.' },
  { name: 'Rejections', description: 'Requêtes rejetées', interpretation: 'Capacité dépassée. Consultez rejectionsByReason pour identifier la cause (rate-limit, capacity, circuit-open, etc.).' },
  { name: 'Queue', description: 'Requêtes en file', interpretation: 'Indique du backpressure. Croissance continue = serveurs sous-dimensionnés.' },
];

// ── Rejection Reasons ──

export const rejectionReasons: { reason: string; description: string; components: string; solution: string }[] = [
  { reason: 'rate-limit', description: 'Requête bloquée par le rate limiter de l\'API Gateway', components: 'API Gateway', solution: 'Augmentez rateLimiting.requestsPerSecond ou burstSize.' },
  { reason: 'capacity', description: 'Capacité du serveur dépassée (connexions max + file pleine)', components: 'HTTP Server, Database, Serverless', solution: 'Augmentez maxConcurrent/queueSize ou ajoutez des serveurs.' },
  { reason: 'circuit-open', description: 'Circuit Breaker en état ouvert — protège le service en aval', components: 'Circuit Breaker', solution: 'Corrigez le service défaillant en aval. Ajustez failureThreshold/timeout.' },
  { reason: 'auth-failure', description: 'Authentification échouée (token expiré, clé invalide)', components: 'API Gateway', solution: 'Vérifiez authType et authFailureRate. Réduisez le taux si trop élevé.' },
  { reason: 'waf-blocked', description: 'Requête bloquée par le Web Application Firewall', components: 'WAF', solution: 'Ajustez blockRate. Vérifiez les règles de sécurité activées.' },
  { reason: 'firewall-blocked', description: 'Requête bloquée par le firewall réseau', components: 'Firewall', solution: 'Vérifiez defaultAction et allowedPorts. Retirez l\'IP des blockedIPs.' },
  { reason: 'timeout', description: 'Requête expirée (délai de connexion dépassé)', components: 'HTTP Server, API Gateway', solution: 'Augmentez connectionTimeoutMs ou réduisez la charge.' },
  { reason: 'oom-killed', description: 'Container tué pour dépassement de la limite mémoire', components: 'Container', solution: 'Augmentez memoryLimitMB ou optimisez la consommation mémoire.' },
  { reason: 'dns-failure', description: 'Résolution DNS échouée', components: 'DNS', solution: 'Vérifiez les enregistrements DNS et le failover.' },
  { reason: 'queue-full', description: 'File de messages pleine, message rejeté', components: 'Message Queue', solution: 'Augmentez maxQueueSize ou ajoutez des consumers.' },
];

// ── Distributed Tracing ──

export interface DocTraceField {
  name: string;
  type: 'string' | 'number' | 'enum' | 'object' | 'boolean';
  description: string;
}

export const traceSpanFields: DocTraceField[] = [
  { name: 'id', type: 'string', description: 'Identifiant unique du span, généré automatiquement.' },
  { name: 'chainId', type: 'string', description: 'Identifiant de la chaîne de requêtes à laquelle appartient ce span. Tous les spans d\'une même requête bout-en-bout partagent le même chainId.' },
  { name: 'nodeId', type: 'string', description: 'Identifiant du nœud (composant) qui a traité cette étape de la requête.' },
  { name: 'nodeName', type: 'string', description: 'Nom lisible du composant affiché dans le waterfall.' },
  { name: 'nodeType', type: 'string', description: 'Type du composant (http-server, database, cache…). Détermine la couleur de la barre dans le waterfall.' },
  { name: 'parentSpanId', type: 'string', description: 'Référence au span parent dans l\'arbre d\'appels. Permet de reconstruire la hiérarchie des appels.' },
  { name: 'startTime', type: 'number', description: 'Timestamp de début du traitement (en ms depuis le début de la simulation).' },
  { name: 'endTime', type: 'number', description: 'Timestamp de fin du traitement. Absent si le span est encore actif.' },
  { name: 'duration', type: 'number', description: 'Durée totale du span (endTime − startTime). Calculée automatiquement à la fin du traitement.' },
  { name: 'status', type: 'enum', description: 'État du span : « active » (en cours), « completed » (succès), « error » (échec). Les spans en erreur apparaissent en rouge dans le waterfall.' },
];

export const requestTraceFields: DocTraceField[] = [
  { name: 'chainId', type: 'string', description: 'Identifiant unique de la trace complète, partagé par tous les spans de la chaîne.' },
  { name: 'spans', type: 'object', description: 'Liste ordonnée de tous les TraceSpan de cette chaîne. Chaque span représente le passage de la requête dans un composant.' },
  { name: 'totalDuration', type: 'number', description: 'Durée totale de la trace (du premier startTime au dernier endTime). C\'est le temps bout-en-bout perçu par le client.' },
  { name: 'startTime', type: 'number', description: 'Timestamp du début de la trace (= startTime du premier span).' },
  { name: 'endTime', type: 'number', description: 'Timestamp de fin de la trace (= endTime du dernier span complété).' },
  { name: 'status', type: 'enum', description: 'État global : « completed » si tous les spans ont réussi, « error » si au moins un span a échoué, « active » si des spans sont encore en cours.' },
];

export const criticalPathFields: DocTraceField[] = [
  { name: 'bottleneckSpan', type: 'object', description: 'Le span ayant la plus grande durée dans la trace. Représente le goulot d\'étranglement principal. Affiché avec une icône d\'alerte et un contour orange dans le waterfall.' },
  { name: 'timePerComponent', type: 'object', description: 'Répartition du temps par composant : nodeId, nodeName, nodeType, totalTime (ms) et percentage (%). Permet d\'identifier quels composants consomment le plus de temps.' },
  { name: 'nPlusOnePatterns', type: 'object', description: 'Détection des patterns N+1 : lorsqu\'un même composant (ex: database) est appelé plus de 2 fois dans une même trace, il est signalé comme un pattern N+1 potentiel. Inclut nodeId, nodeName et count.' },
  { name: 'totalDuration', type: 'number', description: 'Durée totale du chemin critique (peut différer de la durée totale de la trace si des appels sont parallèles).' },
];

export const tracingConcepts: { title: string; description: string }[] = [
  {
    title: 'Span',
    description: 'Unité de travail atomique représentant le passage d\'une requête dans un composant. Chaque composant traversé génère un span avec son temps de traitement, son statut et sa relation parent.',
  },
  {
    title: 'Trace (chaîne)',
    description: 'Ensemble de spans liés par un chainId commun, représentant le parcours complet d\'une requête à travers l\'architecture. La trace commence au client et se termine quand la réponse revient.',
  },
  {
    title: 'Chemin critique',
    description: 'Séquence de spans qui détermine la durée totale de la trace. Optimiser le chemin critique réduit directement la latence bout-en-bout.',
  },
  {
    title: 'Goulot d\'étranglement (bottleneck)',
    description: 'Le span le plus long du chemin critique. Si un span database prend 80% du temps total, c\'est le goulot. Il est mis en évidence visuellement dans le waterfall avec une icône d\'alerte.',
  },
  {
    title: 'Pattern N+1',
    description: 'Anti-pattern où un composant est appelé N fois en série (ex: une requête DB par élément d\'une liste au lieu d\'un batch). Détecté automatiquement quand un même nœud apparaît 3+ fois dans une trace.',
  },
  {
    title: 'Waterfall',
    description: 'Visualisation horizontale de la trace où chaque span est représenté par une barre dont la position (gauche) indique le moment de début et la largeur indique la durée. Permet de voir le parallélisme et les dépendances.',
  },
];

export const waterfallGuide: { title: string; description: string }[] = [
  {
    title: 'Lecture du waterfall',
    description: 'L\'axe horizontal représente le temps. Chaque ligne est un span. La longueur de la barre = durée du traitement. Les barres décalées vers la droite ont commencé plus tard. Des barres superposées verticalement = traitements parallèles.',
  },
  {
    title: 'Couleurs des barres',
    description: 'Chaque type de composant a sa couleur (bleu = client/serveur, violet = gateway, ambre = database, vert = cache, orange = message queue, rouge = circuit breaker). Les spans en erreur sont toujours rouges.',
  },
  {
    title: 'Sélection et navigation',
    description: 'Cliquez sur une trace dans la liste de gauche pour voir son waterfall détaillé. Cliquez sur un span pour sélectionner le composant correspondant dans le canvas et voir ses propriétés.',
  },
  {
    title: 'Répartition du temps',
    description: 'Sous le waterfall, la section « Time breakdown » montre le pourcentage de temps passé dans chaque composant. Un composant à 60%+ du temps total est un candidat prioritaire à l\'optimisation.',
  },
  {
    title: 'Alertes N+1',
    description: 'Les patterns N+1 détectés sont affichés avec une icône d\'alerte orange. Par exemple : « database appelée 5x » indique qu\'il faudrait grouper ces appels en un seul (batch/join).',
  },
  {
    title: 'Filtrage',
    description: 'La barre de recherche filtre les traces par chainId ou par nom de nœud traversé. Utile pour retrouver les traces passant par un composant spécifique.',
  },
];

// ── Design Errors ──

export const designErrors: DocDesignError[] = [
  // Connexions
  { category: 'Connexions', error: 'Source sans edge sortant', severity: 'ERROR', description: 'Un HTTP Client ou Client Group n\'a pas de destination configurée. Aucune requête ne sera envoyée.', solution: 'Ajoutez une connexion (edge) vers un serveur, gateway ou load balancer.' },
  { category: 'Connexions', error: 'Load Balancer sans backend', severity: 'ERROR', description: 'Le load balancer n\'a aucun serveur backend connecté en aval.', solution: 'Connectez au moins un HTTP Server en sortie du load balancer.' },
  { category: 'Connexions', error: 'Circuit Breaker incomplet', severity: 'ERROR', description: 'Le circuit breaker doit avoir des connexions entrante ET sortante pour fonctionner.', solution: 'Placez-le entre un client/gateway (entrée) et un service fragile (sortie).' },
  { category: 'Connexions', error: 'Cache sans fallback DB', severity: 'WARNING', description: 'Le cache n\'a pas de base de données connectée en aval pour les cache miss.', solution: 'Connectez une base de données en sortie pour le pattern cache-aside.' },
  { category: 'Connexions', error: 'CDN sans origin', severity: 'WARNING', description: 'Le CDN avec un hit ratio < 100% n\'a pas de serveur d\'origine pour les cache miss.', solution: 'Connectez un HTTP Server en aval comme serveur d\'origine.' },
  { category: 'Connexions', error: 'Load Balancer à 1 backend', severity: 'INFO', description: 'Un load balancer avec un seul backend ne répartit pas la charge.', solution: 'Ajoutez d\'autres serveurs ou supprimez le load balancer.' },
  { category: 'Connexions', error: 'Message Queue sans consumer', severity: 'WARNING', description: 'La file n\'a aucun service consommateur connecté. Les messages s\'accumuleront.', solution: 'Connectez un service ou Background Job en aval.' },
  { category: 'Connexions', error: 'Nœud isolé', severity: 'WARNING', description: 'Le composant n\'a aucune connexion entrante ou sortante.', solution: 'Connectez-le au flux de requêtes ou supprimez-le s\'il est inutile.' },
  { category: 'Connexions', error: 'Edge invalide (dangling)', severity: 'ERROR', description: 'L\'edge référence un nœud source ou cible qui n\'existe plus.', solution: 'Supprimez l\'edge invalide.' },

  // Ports
  { category: 'Ports', error: 'Edge → Host Server sans targetPort', severity: 'ERROR', description: 'Les edges vers un Host Server doivent spécifier un targetPort pour router vers les conteneurs internes.', solution: 'Configurez targetPort dans les propriétés de l\'edge (clic sur l\'edge).' },
  { category: 'Ports', error: 'Edge → Firewall sans targetPort', severity: 'WARNING', description: 'Il est recommandé de spécifier un targetPort pour les edges vers un Firewall.', solution: 'Ajoutez le port dans les propriétés de l\'edge.' },
  { category: 'Ports', error: 'Port non résolu', severity: 'ERROR', description: 'Le targetPort de l\'edge ne correspond à aucun portMapping du Host Server.', solution: 'Vérifiez les port mappings du serveur hôte et corrigez le targetPort.' },
  { category: 'Ports', error: 'Port mapping orphelin', severity: 'ERROR', description: 'Un port mapping référence un conteneur qui n\'existe pas ou n\'est pas enfant du Host Server.', solution: 'Corrigez le containerNodeId dans les port mappings.' },

  // Routage
  { category: 'Routage', error: 'Gateway avec routes sans edges', severity: 'WARNING', description: 'L\'API Gateway a des règles de routage mais aucune connexion vers les services cibles.', solution: 'Connectez les services référencés dans les routeRules.' },
  { category: 'Routage', error: 'Route vers service non connecté', severity: 'WARNING', description: 'Une règle de routage référence un targetServiceName qui n\'est pas connecté à la gateway.', solution: 'Connectez le service correspondant ou supprimez la règle orpheline.' },
  { category: 'Routage', error: 'Priorités dupliquées', severity: 'WARNING', description: 'Plusieurs règles de routage ont la même priorité, causant un routage imprévisible.', solution: 'Assignez des priorités uniques à chaque règle.' },
  { category: 'Routage', error: 'API Service sans serviceName', severity: 'WARNING', description: 'Le service n\'a pas de nom unique configuré, rendant le routage par API Gateway impossible.', solution: 'Définissez un serviceName unique.' },

  // Ressources
  { category: 'Ressources', error: 'Surcharge client → serveur', severity: 'WARNING', description: 'Le groupe de clients génère plus de trafic que le serveur cible peut supporter (virtualClients > maxConcurrent).', solution: 'Augmentez la capacité du serveur ou réduisez le nombre de clients.' },
  { category: 'Ressources', error: 'processingTime = 0', severity: 'INFO', description: 'Le temps de traitement CPU est à 0ms (traitement instantané). La charge CPU ne sera pas simulée.', solution: 'Ajoutez un temps de traitement réaliste (10-100ms) si vous souhaitez simuler la charge.' },
  { category: 'Ressources', error: 'Mémoire insuffisante prévisible', severity: 'WARNING', description: 'memoryPerRequestMB × maxConcurrent + baseUsageMB > totalMB. Le serveur manquera de mémoire sous charge maximale.', solution: 'Augmentez totalMB ou réduisez memoryPerRequestMB.' },

  // Champs obligatoires
  { category: 'Champs obligatoires', error: 'HTTP Server sans resources', severity: 'ERROR', description: 'Le serveur HTTP n\'a pas de configuration de ressources.', solution: 'Configurez CPU, mémoire, réseau et connexions dans le panneau de propriétés.' },
  { category: 'Champs obligatoires', error: 'Database sans performance', severity: 'ERROR', description: 'La base de données n\'a pas de latences configurées.', solution: 'Configurez readLatencyMs, writeLatencyMs et transactionLatencyMs.' },
  { category: 'Champs obligatoires', error: 'Cache sans configuration', severity: 'ERROR', description: 'Le cache n\'a pas de configuration mémoire ni de politique d\'éviction.', solution: 'Configurez maxMemoryMB, defaultTTLSeconds et evictionPolicy.' },

  // Configuration
  { category: 'Configuration', error: 'Serverless timeout < coldStart', severity: 'ERROR', description: 'Le timeout est inférieur au temps de cold start. La fonction timeout systématiquement au démarrage à froid.', solution: 'Augmentez timeoutMs au-dessus de coldStartMs.' },
  { category: 'Configuration', error: 'Serverless min > max instances', severity: 'ERROR', description: 'Le minimum d\'instances est supérieur au maximum. Configuration invalide.', solution: 'Corrigez : minInstances doit être ≤ maxInstances.' },
  { category: 'Configuration', error: 'Serverless concurrency = 0', severity: 'ERROR', description: 'La concurrence est à 0, aucune requête ne sera traitée.', solution: 'Définissez concurrencyLimit > 0.' },
  { category: 'Configuration', error: 'Cron sans schedule', severity: 'ERROR', description: 'Un job de type « cron » n\'a pas d\'expression cron configurée.', solution: 'Définissez schedule (ex: « 0/5 * * * * » = toutes les 5 min).' },
  { category: 'Configuration', error: 'Batch sans batchSize', severity: 'ERROR', description: 'Un job de type « batch » n\'a pas de taille de lot configurée.', solution: 'Définissez batchSize.' },
  { category: 'Configuration', error: 'virtualClients ≤ 0', severity: 'ERROR', description: 'Le nombre de clients virtuels doit être positif (1-1000).', solution: 'Définissez un nombre entre 1 et 1000.' },
  { category: 'Configuration', error: 'errorRate > 80%', severity: 'WARNING', description: 'Un taux d\'erreur supérieur à 80% rend le service quasi inutilisable.', solution: 'Vérifiez si c\'est intentionnel (chaos testing) ou une erreur de configuration.' },
  { category: 'Configuration', error: 'CB timeout < 5000ms', severity: 'INFO', description: 'Un timeout très court peut causer des oscillations fréquentes open/half-open.', solution: 'Envisagez un timeout de 10s+ pour laisser le temps au service de se rétablir.' },

  // Hiérarchie
  { category: 'Hiérarchie', error: 'Container sans Host Server', severity: 'ERROR', description: 'Un conteneur doit être placé dans un Host Server.', solution: 'Faites glisser le conteneur dans un Host Server existant.' },
  { category: 'Hiérarchie', error: 'Port mapping vers non-enfant', severity: 'ERROR', description: 'Un port mapping du Host Server référence un conteneur qui n\'est pas son enfant direct.', solution: 'Vérifiez que le conteneur cible est placé dans le Host Server.' },
];
