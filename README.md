# Architecture Simulator

**Testez votre architecture avant de la construire.**

Architecture Simulator est un outil interactif open source permettant de concevoir visuellement des architectures de systèmes distribués, de les simuler en temps réel et d'analyser leurs performances sous charge. Glissez-déposez des composants, connectez-les, lancez une simulation et observez le comportement de votre système.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![PixiJS](https://img.shields.io/badge/PixiJS-8-E72264?logo=pixi.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-BSL_1.1-blue)

---

## Fonctionnalités

### Conception visuelle
- **20+ types de composants** : HTTP Client/Server, Load Balancer, API Gateway, Database, Cache, Message Queue, CDN, WAF, Circuit Breaker, Serverless, Container, DNS, Service Discovery, Cloud Storage, Identity Provider...
- **Canvas WebGL haute performance** (PixiJS) avec pan/zoom fluide
- **Drag & drop** depuis le panneau de composants
- **Zones réseau** pour grouper et organiser les composants (VPC, DMZ, Backend)
- **Hiérarchie à 4 niveaux** : Zone → Host Server → Container → Service
- **Particules GPU** représentant le flux des requêtes (jusqu'à 2000 simultanées)

### Simulation en temps réel
- **Moteur de simulation** orchestrant requêtes, réponses et erreurs
- **Clients virtuels** (1 à 1000 simultanés) pour les tests de charge
- **Dégradation des ressources** : les serveurs ralentissent sous la charge (CPU, mémoire, connexions)
- **Vitesse ajustable** : x0.5 à x4

### Patterns avancés
- **Load Balancing** : Round Robin, Least Connections, IP Hash, Random
- **Cache** : pattern cache-aside avec TTL et éviction LRU
- **Connection Pooling** : pool de connexions avec idle timeout
- **Rate Limiting** : token bucket par API Gateway
- **Circuit Breaker** : états Closed/Open/Half-Open avec seuils configurables
- **Message Queue** : modes FIFO et priorité
- **Ressources hiérarchiques** : partage CPU/mémoire entre conteneurs parents et enfants

### Métriques et analyse
- Requêtes/seconde, taux de succès, latences P50/P95/P99
- Utilisation des ressources par composant
- Statistiques des groupes de clients
- **Traces bout-en-bout** (waterfall view) de chaque requête
- **Détection des goulots d'étranglement**
- **Analyse de latence** par chemin de requête
- Rapport de simulation final avec graphiques (Recharts)

### Import / Export
- Export et import d'architectures au format **YAML**
- **Templates prédéfinis** : Monolithe, Load Balanced, Microservices, Event-Driven, API Gateway...

### PWA & Offline
- Installable en tant qu'application (Progressive Web App)
- Fonctionne hors ligne après le premier chargement

### Internationalisation
- Interface disponible en **français** (par défaut) et **anglais**

---

## Capture d'écran

> *À venir — contributions bienvenues pour ajouter des captures d'écran et des GIFs de démonstration.*

---

## Démarrage rapide

### Prérequis

- **Node.js** >= 20
- **npm** >= 10

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/<votre-org>/architecture-simulator.git
cd architecture-simulator/architecture-simulator

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### Avec Docker

```bash
cd architecture-simulator
docker compose up --build
```

L'application sera accessible sur [http://localhost:5004](http://localhost:5004).

---

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement avec Turbopack (port 3000) |
| `npm run build` | Build de production |
| `npm start` | Serveur de production |
| `npm run lint` | Linter ESLint |
| `npm run test` | Tests unitaires (Vitest, mode watch) |
| `npm run test:run` | Tests unitaires (exécution unique) |
| `npm run test:coverage` | Couverture de tests |
| `npm run test:e2e` | Tests end-to-end (Playwright) |

> Tous les scripts s'exécutent depuis le répertoire `architecture-simulator/`.

---

## Architecture du projet

### Design en 3 couches

```
┌─────────────────────────────────────────────┐
│  Vue (PixiJS + React)                       │
│  PixiCanvas · Renderers · Panels · UI       │
├─────────────────────────────────────────────┤
│  État (Zustand)                             │
│  app-store · architecture-store · sim-store │
├─────────────────────────────────────────────┤
│  Moteur (Engine)                            │
│  SimulationEngine · Handlers · Managers     │
└─────────────────────────────────────────────┘
```

1. **Couche Vue** — Canvas WebGL PixiJS (`PixiCanvas.tsx`) avec renderers spécialisés (nodes, edges, particules, handles, grille, minimap)
2. **Couche État** — 3 stores Zustand découplés :
   - `app-store` : état UI (mode, thème, sélection)
   - `architecture-store` : graphe persisté dans localStorage
   - `simulation-store` : état runtime éphémère
3. **Couche Moteur** — `SimulationEngine` orchestre la logique via le **Strategy Pattern** (24 handlers spécifiques par type de composant)

### Structure des fichiers

```
architecture-simulator/src/
├── app/                    # Pages Next.js (App Router)
│   ├── page.tsx            # Page d'accueil
│   ├── simulator/page.tsx  # Simulateur principal
│   └── docs/page.tsx       # Documentation intégrée
├── components/
│   ├── canvas/             # Moteur de rendu PixiJS
│   │   ├── PixiCanvas.tsx  # Canvas principal (WebGL + pixi-viewport)
│   │   ├── NodeRenderer.ts # Rendu des 21 types de nœuds
│   │   ├── EdgeRenderer.ts # Edges bézier/orthogonaux + badges protocole
│   │   ├── ParticleRenderer.ts # Système de particules GPU (2000 sprites)
│   │   ├── HandleRenderer.ts   # Points de connexion (4 côtés par nœud)
│   │   ├── GridRenderer.ts     # Grille infinie suivant le viewport
│   │   ├── EdgePathCache.ts    # Pré-calcul des chemins pour particules
│   │   └── MiniMap.tsx         # Navigation miniature
│   ├── layout/             # Header, ComponentsPanel, PropertiesPanel, ProjectSelector, DiagramTabs
│   ├── simulation/         # MetricsPanel, OutputPanel, ValidationPanel, BottleneckPanel, WaterfallView, LatencyPathPanel, SimulationReportDrawer
│   └── ui/                 # Composants Shadcn/ui
├── engine/
│   ├── SimulationEngine.ts # Orchestrateur principal
│   ├── handlers/           # Strategy pattern — 24 handlers par type de nœud
│   ├── HierarchicalResourceManager.ts # Ressources partagées parent-enfant
│   ├── ResourceManager.ts  # Gestion CPU/mémoire/connexions
│   ├── VirtualClientManager.ts
│   ├── LoadBalancerManager.ts
│   ├── CacheManager.ts
│   ├── DatabaseManager.ts
│   ├── ParticleManager.ts
│   └── metrics.ts          # MetricsCollector
├── store/                  # 3 stores Zustand
├── types/                  # Définitions TypeScript (index.ts + graph.ts)
├── i18n/                   # Traductions FR/EN
├── lib/                    # Utilitaires (YAML export/import, latency calculator)
├── data/                   # Templates d'architectures + matrice de latence
└── hooks/                  # Hooks React customs
```

---

## Stack technique

| Catégorie | Technologie |
|---|---|
| Framework | Next.js 16 (App Router + Turbopack) |
| UI | React 19, TypeScript 5 |
| Rendu graphe | **PixiJS 8** + pixi-viewport (WebGL) |
| État | Zustand 5 |
| Styles | Tailwind CSS 4, Shadcn/ui |
| Graphiques | Recharts |
| Icônes | Lucide React |
| Layout | ELK.js (auto-layout de graphes) |
| PWA | Serwist (Service Worker) |
| Tests | Vitest, Testing Library, Playwright |
| Conteneur | Docker (multi-stage, Node 20 Alpine) |

---

## Contribuer

Les contributions sont les bienvenues ! Consultez le guide [CONTRIBUTING.md](CONTRIBUTING.md) pour savoir comment participer.

---

## Licence

Ce projet est distribué sous licence **Business Source License 1.1 (BSL 1.1)**.

**Usage gratuit** pour :
- Usage personnel et non-commercial
- Usage éducatif et académique
- Évaluation, développement et tests (hors production)
- Production par des organisations de moins de 5 employés

**Usage commercial** (entreprises de 5+ employés en production) : une licence commerciale est requise. Contactez-nous pour les tarifs.

Chaque version du code devient automatiquement **Apache 2.0** quatre ans après sa publication.

Voir le fichier [LICENSE](LICENSE) pour le texte complet.

---

## Remerciements

- [PixiJS](https://pixijs.com/) pour le rendu WebGL haute performance
- [pixi-viewport](https://github.com/davidfig/pixi-viewport) pour le pan/zoom du canvas
- [Shadcn/ui](https://ui.shadcn.com/) pour les composants UI
- [Zustand](https://zustand-demo.pmnd.rs/) pour la gestion d'état
- [Recharts](https://recharts.org/) pour les graphiques
- [ELK.js](https://github.com/kieler/elkjs) pour le layout automatique de graphes
