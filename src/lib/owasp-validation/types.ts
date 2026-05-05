import type { GraphNode, GraphEdge } from '@/types/graph';

/** Sévérité d'une règle OWASP */
export type OwaspSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

/** Framework dont une règle est issue. Extensible pour PCI-DSS, OSFI-CYBER, etc. */
export type OwaspFramework =
  | 'OWASP-API-Top10-2023'
  | 'OWASP-ASVS-Subset'
  // Réservé pour évolutions futures :
  | 'OWASP-Web-Top10-2021'
  | 'PCI-DSS-4.0'
  | 'OSFI-CYBER-2024';

/** Snapshot du graphe sur lequel les règles opèrent */
export interface OwaspGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Une violation détectée par une règle */
export interface OwaspViolation {
  ruleId: string;
  affectedNodeIds: string[];
  /** Détails contextuels optionnels (ex: chemin manquant, valeur attendue vs actuelle) */
  details?: string;
}

/** Une règle de validation */
export interface OwaspRule {
  /** Identifiant unique stable (ex: "OWASP-AUTH-001") */
  readonly id: string;
  readonly framework: OwaspFramework;
  readonly category: string; // ex: "Authentication", "Network Segmentation"
  readonly severity: OwaspSeverity;
  /** Clé i18n pour le titre */
  readonly titleKey: string;
  /** Clé i18n pour la description du problème */
  readonly descriptionKey: string;
  /** Clé i18n pour la remédiation suggérée */
  readonly remediationKey: string;
  /**
   * Évalue le graphe et retourne les violations détectées.
   * Une règle peut retourner 0..N violations.
   */
  validate(graph: OwaspGraph): OwaspViolation[];
}

/** Résultat de l'évaluation complète */
export interface OwaspValidationResult {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  violations: OwaspViolation[];
  /** Comptes par sévérité (pour le score visuel) */
  bySeverity: Record<OwaspSeverity, number>;
  /** Date d'exécution (timestamp ms) */
  evaluatedAt: number;
}
