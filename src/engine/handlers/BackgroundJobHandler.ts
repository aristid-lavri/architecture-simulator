import type { GraphNode, GraphEdge } from '@/types/graph';
import type { NodeRequestHandler, RequestContext, RequestDecision } from './types';
import type { BackgroundJobNodeData } from '@/types';

/**
 * Etat runtime d'un background job
 */
interface JobState {
  activeExecutions: number;
  totalExecutions: number;
  lastCronTrigger: number;
  batchBuffer: string[];  // chainIds en attente pour mode batch
}

/**
 * Handler pour les noeuds Background Job.
 * Supporte les types : cron (declenchement periodique), worker (consomme depuis input),
 * et batch (traite par lots).
 * Respecte la limite de concurrency et peut emettre des requetes vers les services connectes.
 */
export class BackgroundJobHandler implements NodeRequestHandler {
  readonly nodeType = 'background-job';

  private jobStates: Map<string, JobState> = new Map();

  getProcessingDelay(node: GraphNode, speed: number): number {
    const data = node.data as BackgroundJobNodeData;
    return data.processingTimeMs / speed;
  }

  initialize(node: GraphNode): void {
    this.jobStates.set(node.id, {
      activeExecutions: 0,
      totalExecutions: 0,
      lastCronTrigger: Date.now(),
      batchBuffer: [],
    });
  }

  cleanup(nodeId: string): void {
    this.jobStates.delete(nodeId);
  }

  handleRequestArrival(
    node: GraphNode,
    context: RequestContext,
    outgoingEdges: GraphEdge[],
    _allNodes: GraphNode[]
  ): RequestDecision {
    const data = node.data as BackgroundJobNodeData;
    const state = this.getOrCreateState(node.id);

    // Verifier la limite de concurrency
    if (state.activeExecutions >= data.concurrency) {
      return { action: 'queue' };
    }

    switch (data.jobType) {
      case 'cron':
        return this.handleCronJob(state, data, outgoingEdges, context);

      case 'worker':
        return this.handleWorkerJob(state, data, outgoingEdges);

      case 'batch':
        return this.handleBatchJob(state, data, outgoingEdges, context);

      default:
        return this.handleWorkerJob(state, data, outgoingEdges);
    }
  }

  /**
   * Verifie si un job cron doit se declencher base sur le schedule.
   * Utilise un intervalle simplifie base sur l'expression cron.
   */
  shouldCronTrigger(nodeId: string, data: BackgroundJobNodeData): boolean {
    const state = this.jobStates.get(nodeId);
    if (!state || data.jobType !== 'cron') return false;

    const intervalMs = this.parseCronIntervalMs(data.schedule);
    const now = Date.now();

    if (now - state.lastCronTrigger >= intervalMs) {
      state.lastCronTrigger = now;
      return true;
    }

    return false;
  }

  /**
   * Appele quand une execution termine
   */
  recordExecutionCompleted(nodeId: string): void {
    const state = this.jobStates.get(nodeId);
    if (state && state.activeExecutions > 0) {
      state.activeExecutions--;
    }
  }

  /**
   * Handler pour les jobs cron.
   * Le cron traite et peut emettre vers les services connectes.
   */
  private handleCronJob(
    state: JobState,
    data: BackgroundJobNodeData,
    outgoingEdges: GraphEdge[],
    _context: RequestContext
  ): RequestDecision {
    state.activeExecutions++;
    state.totalExecutions++;

    // Simuler le taux d'erreur
    const isError = Math.random() * 100 < data.errorRate;

    if (isError || outgoingEdges.length === 0) {
      return { action: 'respond', isError };
    }

    // Emettre vers les services connectes
    const targets = outgoingEdges.map((edge) => ({
      nodeId: edge.target,
      edgeId: edge.id,
    }));

    return { action: 'forward', targets };
  }

  /**
   * Handler pour les jobs worker.
   * Consomme un message depuis l'input (message-queue) et peut emettre vers les services.
   */
  private handleWorkerJob(
    state: JobState,
    data: BackgroundJobNodeData,
    outgoingEdges: GraphEdge[]
  ): RequestDecision {
    state.activeExecutions++;
    state.totalExecutions++;

    // Simuler le taux d'erreur
    const isError = Math.random() * 100 < data.errorRate;

    if (isError || outgoingEdges.length === 0) {
      return { action: 'respond', isError };
    }

    // Emettre vers les services connectes (ex: ecrire en DB, appeler une API)
    const targets = outgoingEdges.map((edge) => ({
      nodeId: edge.target,
      edgeId: edge.id,
    }));

    return { action: 'forward', targets };
  }

  /**
   * Handler pour les jobs batch.
   * Accumule des messages et les traite par lots (batchSize).
   */
  private handleBatchJob(
    state: JobState,
    data: BackgroundJobNodeData,
    outgoingEdges: GraphEdge[],
    context: RequestContext
  ): RequestDecision {
    const batchSize = data.batchSize ?? 10;

    // Accumuler dans le buffer
    state.batchBuffer.push(context.chainId);

    // Si le buffer n'a pas atteint la taille du batch, mettre en file
    if (state.batchBuffer.length < batchSize) {
      return { action: 'respond', isError: false };
    }

    // Traiter le lot
    state.batchBuffer = [];
    state.activeExecutions++;
    state.totalExecutions++;

    // Simuler le taux d'erreur
    const isError = Math.random() * 100 < data.errorRate;

    if (isError || outgoingEdges.length === 0) {
      return { action: 'respond', isError };
    }

    // Emettre vers les services connectes
    const targets = outgoingEdges.map((edge) => ({
      nodeId: edge.target,
      edgeId: edge.id,
    }));

    return { action: 'forward', targets };
  }

  /**
   * Parse une expression cron simplifiee pour obtenir un intervalle en ms.
   * Supporte : "* /N * * * *" (toutes les N minutes), sinon defaut 5 min.
   */
  private parseCronIntervalMs(schedule?: string): number {
    if (!schedule) return 5 * 60 * 1000; // Defaut 5 minutes

    // Pattern simple : */N au debut = toutes les N minutes
    const match = schedule.match(/^\*\/(\d+)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      return minutes * 60 * 1000;
    }

    // Pour la simulation, on accelere les crons a 5 secondes minimum
    return 5000;
  }

  private getOrCreateState(nodeId: string): JobState {
    let state = this.jobStates.get(nodeId);
    if (!state) {
      state = {
        activeExecutions: 0,
        totalExecutions: 0,
        lastCronTrigger: Date.now(),
        batchBuffer: [],
      };
      this.jobStates.set(nodeId, state);
    }
    return state;
  }
}
