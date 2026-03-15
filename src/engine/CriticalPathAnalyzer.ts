import type { SimulationEvent, TraceSpan, RequestTrace, CriticalPathAnalysis, HandlerDecisionAction } from '@/types';
import { simulationEvents } from './events';

const MAX_TRACES = 100;
const MAX_SPANS_PER_TRACE = 50;

/**
 * Collecte les spans emis pendant la simulation et reconstruit les traces distribuees.
 * Ecoute les evenements SPAN_START/SPAN_END/HANDLER_DECISION/RESOURCE_SNAPSHOT
 * via le simulationEvents emitter.
 * Fournit l'analyse du chemin critique (bottleneck, % temps, patterns N+1).
 */
export class CriticalPathAnalyzer {
  private traces: Map<string, RequestTrace> = new Map();
  private spanMap: Map<string, TraceSpan> = new Map();
  private unsubscribers: (() => void)[] = [];
  private nodeLabels: Map<string, string> = new Map();
  private listeners: Set<() => void> = new Set();
  /** Map spanKey (chainId:nodeId) → pending decision info to attach to spans. */
  private pendingDecisions: Map<string, { decision: HandlerDecisionAction; reason?: string; targets?: string[] }> = new Map();
  /** Map spanKey (chainId:nodeId) → resource snapshot to attach to spans. */
  private pendingSnapshots: Map<string, { cpu: number; memory: number; activeConnections: number; queuedRequests: number }> = new Map();

  /** Demarre l'ecoute des evenements de span. */
  start(nodeLabels: Map<string, string>): void {
    this.nodeLabels = nodeLabels;
    this.clear();

    const unsubStart = simulationEvents.on('SPAN_START', (event) => this.handleSpanStart(event));
    const unsubEnd = simulationEvents.on('SPAN_END', (event) => this.handleSpanEnd(event));
    const unsubDecision = simulationEvents.on('HANDLER_DECISION', (event) => this.handleDecision(event));
    const unsubResource = simulationEvents.on('RESOURCE_SNAPSHOT', (event) => this.handleResourceSnapshot(event));

    this.unsubscribers.push(unsubStart, unsubEnd, unsubDecision, unsubResource);
  }

  /** Arrete l'ecoute. */
  stop(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  /** Remet a zero toutes les traces collectees. */
  clear(): void {
    this.traces.clear();
    this.spanMap.clear();
    this.pendingDecisions.clear();
    this.pendingSnapshots.clear();
  }

  /** Retourne toutes les traces collectees, triees par startTime descendant. */
  getTraces(): RequestTrace[] {
    return Array.from(this.traces.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, MAX_TRACES);
  }

  /** Retourne une trace specifique par chainId. */
  getTrace(chainId: string): RequestTrace | undefined {
    return this.traces.get(chainId);
  }

  /** Analyse le chemin critique d'une trace. */
  analyze(chainId: string): CriticalPathAnalysis | null {
    const trace = this.traces.get(chainId);
    if (!trace || trace.spans.length === 0) return null;

    const completedSpans = trace.spans.filter((s) => s.status === 'completed' || s.status === 'error');
    if (completedSpans.length === 0) return null;

    // Trouver le bottleneck (span le plus long)
    let bottleneckSpan: TraceSpan | null = null;
    let maxDuration = 0;
    for (const span of completedSpans) {
      const duration = span.duration ?? 0;
      if (duration > maxDuration) {
        maxDuration = duration;
        bottleneckSpan = span;
      }
    }

    // Calculer le % de temps par composant
    const timePerComponent = new Map<string, { nodeId: string; nodeName: string; nodeType: string; totalTime: number; percentage: number }>();
    const totalDuration = trace.totalDuration || 1;

    for (const span of completedSpans) {
      const duration = span.duration ?? 0;
      const existing = timePerComponent.get(span.nodeId);
      if (existing) {
        existing.totalTime += duration;
        existing.percentage = (existing.totalTime / totalDuration) * 100;
      } else {
        timePerComponent.set(span.nodeId, {
          nodeId: span.nodeId,
          nodeName: span.nodeName,
          nodeType: span.nodeType,
          totalTime: duration,
          percentage: (duration / totalDuration) * 100,
        });
      }
    }

    // Detecter les patterns N+1 (meme noeud appele N fois dans une chaine)
    const callCounts = new Map<string, number>();
    for (const span of completedSpans) {
      callCounts.set(span.nodeId, (callCounts.get(span.nodeId) ?? 0) + 1);
    }

    const nPlusOnePatterns: { nodeId: string; nodeName: string; count: number }[] = [];
    for (const [nodeId, count] of callCounts) {
      if (count >= 3) {
        const span = completedSpans.find((s) => s.nodeId === nodeId);
        nPlusOnePatterns.push({
          nodeId,
          nodeName: span?.nodeName ?? nodeId,
          count,
        });
      }
    }

    return {
      bottleneckSpan,
      timePerComponent,
      nPlusOnePatterns,
      totalDuration,
    };
  }

  /** Enregistre un listener appele a chaque mise a jour de trace. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private handleSpanStart(event: SimulationEvent): void {
    const { chainId, sourceNodeId } = event;
    if (!chainId) return;

    const spanId = event.data.spanId;
    if (!spanId) return;

    const nodeName = this.nodeLabels.get(sourceNodeId) ?? sourceNodeId.split('-')[0];
    const nodeType = event.data.nodeType ?? 'unknown';

    const span: TraceSpan = {
      id: spanId,
      chainId,
      nodeId: sourceNodeId,
      nodeName,
      nodeType,
      parentSpanId: event.data.parentSpanId,
      startTime: event.timestamp,
      status: 'active',
    };

    this.spanMap.set(spanId, span);

    // Ajouter a la trace
    let trace = this.traces.get(chainId);
    if (!trace) {
      trace = {
        chainId,
        spans: [],
        totalDuration: 0,
        startTime: event.timestamp,
        endTime: event.timestamp,
        status: 'active',
      };
      this.traces.set(chainId, trace);
    }

    if (trace.spans.length < MAX_SPANS_PER_TRACE) {
      trace.spans.push(span);
    }

    this.notify();
  }

  private handleSpanEnd(event: SimulationEvent): void {
    const spanId = event.data.spanId;
    if (!spanId) return;

    const span = this.spanMap.get(spanId);
    if (!span) return;

    span.endTime = event.timestamp;
    span.duration = event.timestamp - span.startTime;
    span.status = event.data.isError ? 'error' : 'completed';

    // Attach pending decision and resource snapshot to the span
    const spanKey = `${span.chainId}:${span.nodeId}`;
    const pendingDecision = this.pendingDecisions.get(spanKey);
    if (pendingDecision) {
      span.decision = pendingDecision.decision;
      span.decisionReason = pendingDecision.reason;
      span.forwardTargets = pendingDecision.targets;
      this.pendingDecisions.delete(spanKey);
    }
    const pendingSnapshot = this.pendingSnapshots.get(spanKey);
    if (pendingSnapshot) {
      span.resourceSnapshot = pendingSnapshot;
      this.pendingSnapshots.delete(spanKey);
    }

    // Mettre a jour la trace
    const trace = this.traces.get(span.chainId);
    if (trace) {
      trace.endTime = Math.max(trace.endTime, event.timestamp);
      trace.totalDuration = trace.endTime - trace.startTime;

      // Verifier si tous les spans sont termines
      const allDone = trace.spans.every((s) => s.status === 'completed' || s.status === 'error');
      if (allDone) {
        trace.status = trace.spans.some((s) => s.status === 'error') ? 'error' : 'completed';
      }
    }

    this.notify();
  }

  /** Stocke la decision du handler pour l'attacher au span correspondant. */
  private handleDecision(event: SimulationEvent): void {
    const { chainId, sourceNodeId } = event;
    if (!chainId) return;

    const spanKey = `${chainId}:${sourceNodeId}`;
    this.pendingDecisions.set(spanKey, {
      decision: event.data.decision as HandlerDecisionAction,
      reason: event.data.reason,
      targets: event.data.targets,
    });
  }

  /** Stocke le snapshot de ressources pour l'attacher au span correspondant. */
  private handleResourceSnapshot(event: SimulationEvent): void {
    const { chainId, sourceNodeId } = event;
    if (!chainId) return;

    const spanKey = `${chainId}:${sourceNodeId}`;
    this.pendingSnapshots.set(spanKey, {
      cpu: event.data.cpu ?? 0,
      memory: event.data.memory ?? 0,
      activeConnections: event.data.activeConnections ?? 0,
      queuedRequests: event.data.queuedRequests ?? 0,
    });
  }
}

/** Singleton global du CriticalPathAnalyzer. */
export const criticalPathAnalyzer = new CriticalPathAnalyzer();
