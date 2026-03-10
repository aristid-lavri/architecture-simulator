# Architecture Simulator

**Testez votre architecture avant de la construire.**

Architecture Simulator est un outil interactif open source permettant de concevoir visuellement des architectures de systemes distribues, de les simuler en temps reel et d'analyser leurs performances sous charge. Glissez-deposez des composants, connectez-les, lancez une simulation et observez le comportement de votre systeme.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-BSL_1.1-blue)

---

## Fonctionnalites

### Conception visuelle
- **20+ types de composants** : HTTP Client/Server, Load Balancer, API Gateway, Database, Cache, Message Queue, CDN, WAF, Firewall, Circuit Breaker, Serverless, Container, DNS, Service Discovery, Cloud Storage...
- **Drag & drop** sur un canvas interactif (React Flow)
- **Zones reseau** pour grouper et organiser les composants
- **Edges animes** avec particules representant le flux des requetes

### Simulation en temps reel
- **Moteur de simulation** orchestrant requetes, reponses et erreurs
- **Clients virtuels** (1 a 1000 simultanes) pour les tests de charge
- **Degradation des ressources** : les serveurs ralentissent sous la charge (CPU, memoire, connexions)
- **Vitesse ajustable** : x0.5 a x4

### Patterns avances
- **Load Balancing** : Round Robin, Least Connections, IP Hash, Random
- **Cache** : pattern cache-aside avec TTL et eviction LRU
- **Connection Pooling** : pool de connexions avec idle timeout
- **Rate Limiting** : token bucket par API Gateway
- **Circuit Breaker** : etats Closed/Open/Half-Open avec seuils configurables
- **Message Queue** : modes FIFO et priorite

### Metriques et analyse
- Requetes/seconde, taux de succes, latences P50/P95/P99
- Utilisation des ressources par composant
- Statistiques des groupes de clients
- Rapport de simulation final avec graphiques (Recharts)

### Import / Export
- Export et import d'architectures au format **YAML**
- **Templates predefinies** : Monolithe, Load Balanced, Microservices

### Internationalisation
- Interface disponible en **francais** (par defaut) et **anglais**

---

## Capture d'ecran

> *A venir — contributions bienvenues pour ajouter des captures d'ecran et des GIFs de demonstration.*

---

## Demarrage rapide

### Prerequis

- **Node.js** >= 20
- **npm** >= 10

### Installation

```bash
# Cloner le depot
git clone https://github.com/<votre-org>/architecture-simulator.git
cd architecture-simulator/architecture-simulator

# Installer les dependances
npm install

# Lancer le serveur de developpement
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
| `npm run dev` | Serveur de developpement (port 3000) |
| `npm run build` | Build de production |
| `npm start` | Serveur de production |
| `npm run lint` | Linter ESLint |
| `npm run test` | Tests unitaires (Vitest, mode watch) |
| `npm run test:run` | Tests unitaires (execution unique) |
| `npm run test:coverage` | Couverture de tests |

> Tous les scripts s'executent depuis le repertoire `architecture-simulator/`.

---

## Architecture du projet

### Design en 3 couches

```
┌─────────────────────────────────────────────┐
│  Vue (React)                                │
│  FlowCanvas · Nodes · Edges · Panels       │
├─────────────────────────────────────────────┤
│  Etat (Zustand)                             │
│  app-store · architecture-store · sim-store │
├─────────────────────────────────────────────┤
│  Moteur (Engine)                            │
│  SimulationEngine · Handlers · Managers     │
└─────────────────────────────────────────────┘
```

1. **Couche Vue** — Composants React + React Flow pour la visualisation du graphe
2. **Couche Etat** — 3 stores Zustand decouplees :
   - `app-store` : etat UI (mode, theme, selection)
   - `architecture-store` : graphe persiste dans localStorage
   - `simulation-store` : etat runtime ephemere
3. **Couche Moteur** — `SimulationEngine` orchestre la logique via le **Strategy Pattern** (20+ handlers specifiques par type de composant)

### Structure des fichiers

```
architecture-simulator/src/
├── app/                    # Pages Next.js (App Router)
│   ├── page.tsx            # Page d'accueil
│   ├── simulator/page.tsx  # Simulateur principal
│   └── docs/page.tsx       # Documentation
├── components/
│   ├── nodes/              # 20+ composants React Flow (HttpServerNode, DatabaseNode...)
│   ├── edges/              # AnimatedEdge avec particules
│   ├── flow/               # FlowCanvas — canvas principal
│   ├── layout/             # Header, ComponentsPanel, PropertiesPanel
│   ├── simulation/         # MetricsPanel, OutputPanel, SimulationReportDrawer
│   └── ui/                 # Composants Shadcn/ui
├── engine/
│   ├── SimulationEngine.ts # Orchestrateur principal
│   ├── handlers/           # Strategy pattern — 1 handler par type de noeud
│   ├── ResourceManager.ts  # Gestion CPU/memoire/connexions
│   ├── VirtualClientManager.ts
│   ├── LoadBalancerManager.ts
│   ├── CacheManager.ts
│   ├── DatabaseManager.ts
│   ├── ParticleManager.ts
│   └── metrics.ts          # MetricsCollector
├── store/                  # 3 stores Zustand
├── types/index.ts          # Toutes les definitions TypeScript
├── i18n/                   # Traductions FR/EN
├── lib/                    # Utilitaires (YAML export/import)
├── data/                   # Templates d'architectures
└── hooks/                  # Hooks React customs
```

---

## Stack technique

| Categorie | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TypeScript 5 |
| Graphe | @xyflow/react (React Flow) |
| Etat | Zustand 5 |
| Styles | Tailwind CSS 4, Shadcn/ui |
| Animations | Framer Motion |
| Graphiques | Recharts |
| Icones | Lucide React |
| Tests | Vitest, Testing Library |
| Conteneur | Docker (multi-stage, Node 20 Alpine) |

---

## Contribuer

Les contributions sont les bienvenues ! Consultez le guide [CONTRIBUTING.md](CONTRIBUTING.md) pour savoir comment participer.

---

## Licence

Ce projet est distribue sous licence **Business Source License 1.1 (BSL 1.1)**.

**Usage gratuit** pour :
- Usage personnel et non-commercial
- Usage educatif et academique
- Evaluation, developpement et tests (hors production)
- Production par des organisations de moins de 5 employes

**Usage commercial** (entreprises de 5+ employes en production) : une licence commerciale est requise. Contactez-nous pour les tarifs.

Chaque version du code devient automatiquement **Apache 2.0** quatre ans apres sa publication.

Voir le fichier [LICENSE](LICENSE) pour le texte complet.

---

## Remerciements

- [React Flow](https://reactflow.dev/) pour la visualisation de graphes
- [Shadcn/ui](https://ui.shadcn.com/) pour les composants UI
- [Zustand](https://zustand-demo.pmnd.rs/) pour la gestion d'etat
- [Recharts](https://recharts.org/) pour les graphiques
