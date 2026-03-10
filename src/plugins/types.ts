import type { ComponentType as ReactComponentType } from 'react';
import type { NodeRequestHandler } from '@/engine/handlers/types';
import type { HierarchyLevel, ConnectionProtocol } from '@/types';

/**
 * Définition d'un composant de nœud apporté par un plugin.
 * Chaque PluginNode enregistre :
 *  - un type unique (affiché dans le graphe)
 *  - le composant React pour le rendu
 *  - le handler pour le moteur de simulation
 *  - les données par défaut à la création
 *  - les métadonnées pour le panneau de composants (sidebar)
 *  - les règles de hiérarchie (nesting parent-enfant)
 */
export interface PluginNodeDefinition {
  /** Identifiant unique du type de nœud (ex: 'custom-auth-server') */
  type: string;
  /** Composant React Flow pour le rendu du nœud */
  component: ReactComponentType<Record<string, unknown>>;
  /** Handler du moteur de simulation */
  handler: NodeRequestHandler;
  /** Données par défaut lors de la création du nœud */
  defaultData: Record<string, unknown>;
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
 * Hooks sur le cycle de vie du moteur de simulation.
 */
export interface PluginEngineHooks {
  /** Appelé au démarrage de la simulation */
  onSimulationStart?: () => void;
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
