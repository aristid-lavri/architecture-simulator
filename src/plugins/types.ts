import type { ComponentType as ReactComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { NodeRequestHandler } from '@/engine/handlers/types';
import type { HierarchyLevel, ConnectionProtocol } from '@/types';
import type { GraphNode, GraphEdge } from '@/types/graph';

/**
 * Variante visuelle d'un nœud plugin.
 * - `instrument` (défaut) : style SIGNAL actuel — fond sombre, signal-bar gauche, header avec icône Lucide.
 *   Utilisé par les types simulateur natifs et tout type plugin qui veut s'intégrer visuellement avec eux.
 * - `strict` : notation C4 stricte — fond parchment, pas d'icône header, type-tag uppercase, description en italique.
 *   Utilisé pour les types documentaires (Person, SoftwareSystem, Component) qui ne sont pas simulés.
 * - `instance` : variante instrument avec un badge `↗ refLabel` (référence à un autre nœud).
 *   Utilisé pour les ContainerInstance Deployment qui pointent vers un Container L2.
 */
export type PluginNodeVisualVariant = 'instrument' | 'strict' | 'instance';

/**
 * Définition d'un composant de nœud apporté par un plugin.
 * Cette définition couvre à la fois le rendu (PixiJS), la simulation (handler) et la palette.
 * Tous les sous-systèmes CE qui ont une connaissance hardcodée des 21 types simulateur natifs
 * (NodeRenderer, IconRegistry, node-defaults, etc.) consultent en fallback `pluginRegistry`
 * pour les types inconnus.
 */
export interface PluginNodeDefinition {
  /** Identifiant unique du type de nœud (ex: 'c4-person'). Convention : préfixe namespacé pour éviter les collisions. */
  type: string;
  /**
   * Composant React Flow pour le rendu du nœud (legacy — conservé pour compatibilité avec l'ancien moteur React Flow).
   * Le canvas PixiJS actuel utilise plutôt `visual` ci-dessous. Passer un placeholder no-op si non utilisé.
   */
  component: ReactComponentType<Record<string, unknown>>;
  /**
   * Handler du moteur de simulation. `null` = type documentaire (jamais simulé) ; le moteur l'ignore.
   * Typique des types L1 C4 (Person, SoftwareSystem) et Deployment (ContainerInstance, DeploymentNode).
   */
  handler: NodeRequestHandler | null;
  /** Données par défaut lors de la création du nœud */
  defaultData: Record<string, unknown>;

  /**
   * Hints visuels consommés par le rendu PixiJS du CE pour les nœuds inconnus du switch hardcodé.
   * Si absent, le rendu retombe sur des valeurs par défaut (boîte blanche, glyph `●`).
   * C'est ici que tu déclares la variante visuelle, l'icône Lucide, les couleurs, etc.
   */
  visual?: {
    /** Variante visuelle à appliquer. Default: `instrument`. */
    variant?: PluginNodeVisualVariant;
    /** Couleurs de fond/bordure/texte (entiers hex, ex: 0xffffff). Override `theme.nodeColors[type]`. */
    colors?: { bg: number; border: number; text: number };
    /** Icône Lucide affichée dans le header (variant `instrument` / `instance`). Ignorée en variant `strict`. */
    icon?: LucideIcon;
    /** Hauteur par défaut du nœud (px). Override `getNodeHeight(type)`. */
    height?: number;
    /** Largeur par défaut du nœud (px). Override `NODE_WIDTH`. */
    width?: number;
    /**
     * Texte type-tag affiché en variant `strict` (ex: "Person", "Component: Repository").
     * Peut être une fonction qui lit `node.data` (ex: pour inclure `componentKind`).
     */
    typeTag?: string | ((data: Record<string, unknown>) => string);
    /** Tag affiché dans le coin top-right (ex: "EXT" pour external-system). Mappe sur `cornerTag` des hints renderer. */
    cornerTag?: string;
    /** Si `true`, le rendu affiche `data.description` en italique sous le nom (variant `strict` uniquement). */
    showDescription?: boolean;
    /** Pour variant `instance` : nom du champ `data.*` qui contient l'ID de la référence affichée en badge `↗ name`. */
    referenceField?: string;
  };

  /** Métadonnées pour l'affichage dans le panneau de composants */
  panel?: {
    /** Clé i18n ou label brut pour le nom */
    name: string;
    /** Clé i18n ou label brut pour la description */
    description: string;
    /** Icône React (ex: composant Lucide) */
    icon: React.ReactNode;
    /** Couleur du signal dans le panneau */
    signalColor: string;
    /** Catégorie dans le panneau */
    category: string;
  };

  /** Règles de hiérarchie pour le nesting parent-enfant */
  hierarchy?: {
    /** Niveau dans la hiérarchie (zone, server, container, service) */
    level: HierarchyLevel;
    /** Ce noeud est un conteneur qui peut avoir des enfants */
    isContainer?: boolean;
    /** Types de parents acceptés (ex: ['host-server', 'container']) */
    allowedParents?: string[];
    /** Types d'enfants acceptés (ex: ['api-service', 'database']) */
    allowedChildren?: string[];
    /** Ce noeud ne peut jamais être enfant d'un autre noeud */
    nonNestable?: boolean;
  };
  /** Protocoles de connexion supportés */
  protocols?: ConnectionProtocol[];
}

/**
 * Panneau UI additionnel apporté par un plugin.
 */
export interface PluginPanel {
  /** Identifiant unique du panneau */
  id: string;
  /** Label affiché */
  label: string;
  /** Position dans l'interface */
  position: 'sidebar' | 'toolbar' | 'bottom';
  /** Composant React du panneau */
  component: ReactComponentType<Record<string, unknown>>;
}

/**
 * API exposée aux plugins pendant la durée de vie d'une simulation.
 *
 * Les plugins reçoivent cette API dans `onSimulationStart` et peuvent l'utiliser pour
 * injecter du trafic depuis leurs propres nodes (ex: c4-person avec `generatesTraffic`)
 * sans avoir à dupliquer la logique d'émission de l'engine ni à modifier le CE.
 *
 * Disponible uniquement entre `onSimulationStart` et `onSimulationStop`. Toute référence
 * conservée hors de cette fenêtre devient inerte (sendRequest est un no-op après stop).
 */
export interface SimulationEngineAPI {
  /** Injecte une requête depuis un node source sur un edge sortant. */
  sendRequest: (sourceNode: GraphNode, edge: GraphEdge) => void;
  /** Lecture du graphe courant (référence stable durant la simulation). */
  getNodes: () => ReadonlyArray<GraphNode>;
  getEdges: () => ReadonlyArray<GraphEdge>;
  /** Multiplicateur de vitesse appliqué par l'utilisateur. */
  getSpeed: () => number;
  /** Vrai si la simulation tourne (pas en pause / pas arrêtée). */
  isRunning: () => boolean;
}

/**
 * Hooks sur le cycle de vie du moteur de simulation.
 */
export interface PluginEngineHooks {
  /** Appelé au démarrage de la simulation. Reçoit l'API moteur pour émettre des requêtes. */
  onSimulationStart?: (api: SimulationEngineAPI) => void;
  /** Appelé à l'arrêt de la simulation */
  onSimulationStop?: () => void;
  /** Appelé à chaque tick du moteur (attention: ~60fps) */
  onTick?: (deltaTime: number) => void;
}

/**
 * Définition complète d'un plugin.
 */
export interface Plugin {
  /** Identifiant unique du plugin */
  id: string;
  /** Nom affiché du plugin */
  name: string;
  /** Version du plugin */
  version: string;
  /** Nouveaux types de nœuds */
  nodes?: PluginNodeDefinition[];
  /** Panneaux UI additionnels */
  panels?: PluginPanel[];
  /** Hooks sur le moteur de simulation */
  engineHooks?: PluginEngineHooks;
}
