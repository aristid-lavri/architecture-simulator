/**
 * Configuration d'une simulation "scopée" — restreinte à un sous-arbre du graph.
 *
 * Consommée par `SimulationEngine.setSimulationScope(config | null)`. Quand un scope est
 * actif :
 *   1. `sendRequest()` filtre toute requête dont la source n'est pas dans `subtreeNodeIds`.
 *   2. Les `syntheticEmitters` démarrent leurs propres timers à `engine.start()` (en plus
 *      des emitters CE existants — les emitters CE/EE classiques continuent de tourner mais
 *      leurs requêtes sont filtrées par le check du point 1).
 *   3. Les `sinks` terminent la chain à l'arrivée (pas de forward) et enregistrent les
 *      métriques de fin de chemin.
 */

export interface SyntheticEmitter {
  /** ID de l'edge sur laquelle injecter (typiquement un edge boundary entrant). */
  edgeId: string;
  /** Requêtes par seconde injectées sur cet edge. */
  requestsPerSecond: number;
}

export interface SimulationScope {
  /** ID du node racine du sous-arbre (info, pas utilisé directement par l'engine). */
  subtreeRoot: string;
  /** IDs de tous les nodes appartenant au sous-arbre (incluant la racine). */
  subtreeNodeIds: Set<string>;
  /** Emitters synthétiques injectant du trafic au boundary (edges entering). */
  syntheticEmitters: SyntheticEmitter[];
  /** IDs des nodes qui agissent comme sinks (terminent la chain à l'arrivée). */
  sinks: Set<string>;
}
