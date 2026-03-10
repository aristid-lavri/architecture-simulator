import type { ServerResources, ResourceUtilization, DegradationSettings } from '@/types';

/**
 * Utilitaire statique pour calculer l'utilisation des ressources serveur
 * et la degradation de latence sous charge.
 *
 * Formules : CPU = (activeReq x procTime) / (cores x 1000) x 100,
 * Memoire = (baseUsage + activeReq x memPerReq) / totalMB x 100,
 * Reseau = (RPS x (reqSize + resSize) x 8) / (bandwidth x 1000) x 100.
 */
export class ResourceManager {
  /**
   * Calcule l'utilisation actuelle des ressources (CPU, memoire, reseau, disque).
   * Toutes les valeurs retournees sont clampees a 100%.
   */
  static calculateUtilization(
    resources: ServerResources,
    activeRequests: number,
    queuedRequests: number,
    requestsPerSecond: number = 0
  ): ResourceUtilization {
    const cpuUtil = this.calculateCpuUtilization(resources.cpu, activeRequests);
    const memUtil = this.calculateMemoryUtilization(resources.memory, activeRequests);
    const netUtil = this.calculateNetworkUtilization(resources.network, requestsPerSecond);
    const diskUtil = resources.disk
      ? this.calculateDiskUtilization(resources.disk, activeRequests)
      : undefined;

    const cpuClamped = Math.min(100, cpuUtil);
    const memClamped = Math.min(100, memUtil);
    const netClamped = Math.min(100, netUtil);
    const diskClamped = diskUtil !== undefined ? Math.min(100, diskUtil) : undefined;

    return {
      cpu: cpuClamped,
      memory: memClamped,
      network: netClamped,
      disk: diskClamped,
      activeConnections: activeRequests,
      queuedRequests,
      saturation: Math.max(cpuClamped, memClamped, netClamped, diskClamped ?? 0),
    };
  }

  /**
   * Calcule la latence degradee selon la formule configuree.
   * Utilise le max de (CPU, memoire, reseau) comme facteur de degradation.
   * @returns baseLatency si la degradation est desactivee.
   */
  static calculateDegradedLatency(
    baseLatency: number,
    utilization: ResourceUtilization,
    settings: DegradationSettings
  ): number {
    if (!settings.enabled) return baseLatency;

    // Utiliser le max des utilisations
    const maxUtil = Math.max(utilization.cpu, utilization.memory, utilization.network) / 100;

    switch (settings.formula) {
      case 'linear':
        return baseLatency * (1 + maxUtil);
      case 'exponential':
        return baseLatency * (1 + Math.pow(maxUtil, 3));
      case 'quadratic':
      default:
        return baseLatency * (1 + Math.pow(maxUtil, settings.latencyPower));
    }
  }

  /**
   * Verifie si le serveur peut accepter une nouvelle requete.
   * @returns 'accept' si sous la limite, 'queue' si la file a de la place, 'reject' sinon.
   */
  static canAcceptRequest(
    resources: ServerResources,
    utilization: ResourceUtilization
  ): 'accept' | 'queue' | 'reject' {
    if (utilization.activeConnections < resources.connections.maxConcurrent) {
      return 'accept';
    }
    if (utilization.queuedRequests < resources.connections.queueSize) {
      return 'queue';
    }
    return 'reject';
  }

  /**
   * Calcule le temps d'attente estimé dans la file
   */
  static calculateEstimatedWaitTime(
    queuePosition: number,
    avgProcessingTime: number
  ): number {
    return queuePosition * avgProcessingTime;
  }

  /**
   * Détermine la couleur de la jauge basée sur l'utilisation
   */
  static getUtilizationColor(utilization: number): 'green' | 'orange' | 'red' {
    if (utilization < 70) return 'green';
    if (utilization < 90) return 'orange';
    return 'red';
  }

  /**
   * Calcule l'utilisation CPU
   * Formula: (activeRequests × processingTimePerRequest) / (cores × 1000) × 100
   */
  private static calculateCpuUtilization(
    cpu: ServerResources['cpu'],
    activeRequests: number
  ): number {
    return (activeRequests * cpu.processingTimePerRequest) / (cpu.cores * 1000) * 100;
  }

  /**
   * Calcule l'utilisation mémoire
   * Formula: (baseUsageMB + (activeRequests × memoryPerRequestMB)) / totalMB × 100
   */
  private static calculateMemoryUtilization(
    memory: ServerResources['memory'],
    activeRequests: number
  ): number {
    const usedMB = memory.baseUsageMB + (activeRequests * memory.memoryPerRequestMB);
    return (usedMB / memory.totalMB) * 100;
  }

  /**
   * Calcule l'utilisation réseau
   * Formula: ((requestsPerSecond × (requestSizeKB + responseSizeKB)) × 8) / (bandwidthMbps × 1000) × 100
   */
  private static calculateNetworkUtilization(
    network: ServerResources['network'],
    requestsPerSecond: number
  ): number {
    const dataPerSecond = requestsPerSecond * (network.requestSizeKB + network.responseSizeKB);
    const mbps = (dataPerSecond * 8) / 1000;
    return (mbps / network.bandwidthMbps) * 100;
  }

  /**
   * Calcule l'utilisation disque (optionnel)
   */
  private static calculateDiskUtilization(
    disk: NonNullable<ServerResources['disk']>,
    activeRequests: number
  ): number {
    // Temps I/O total par seconde par rapport à la capacité
    const ioTimeNeeded = activeRequests * disk.diskTimePerRequest;
    return (ioTimeNeeded / 1000) * 100;
  }

  /**
   * Crée un état d'utilisation initial (vide)
   */
  static createInitialUtilization(): ResourceUtilization {
    return {
      cpu: 0,
      memory: 0,
      network: 0,
      activeConnections: 0,
      queuedRequests: 0,
    };
  }

  /**
   * Calcule l'utilisation agregee d'un parent a partir des etats de ses enfants.
   * Somme CPU/RAM/Network des enfants, rapportee aux capacites du parent.
   */
  static calculateAggregatedUtilization(
    parentUtilization: ResourceUtilization,
    childStates: ResourceUtilization[]
  ): ResourceUtilization {
    if (childStates.length === 0) return parentUtilization;

    const totalCpu = childStates.reduce((sum, c) => sum + c.cpu, 0);
    const totalMemory = childStates.reduce((sum, c) => sum + c.memory, 0);
    const totalNetwork = childStates.reduce((sum, c) => sum + c.network, 0);
    const totalConnections = childStates.reduce((sum, c) => sum + c.activeConnections, 0);
    const totalQueued = childStates.reduce((sum, c) => sum + c.queuedRequests, 0);

    // L'utilisation agregee prend le max entre le parent et la moyenne des enfants
    const avgCpu = totalCpu / childStates.length;
    const avgMemory = totalMemory / childStates.length;
    const avgNetwork = totalNetwork / childStates.length;

    return {
      cpu: Math.min(100, Math.max(parentUtilization.cpu, avgCpu)),
      memory: Math.min(100, Math.max(parentUtilization.memory, avgMemory)),
      network: Math.min(100, Math.max(parentUtilization.network, avgNetwork)),
      disk: parentUtilization.disk,
      activeConnections: totalConnections,
      queuedRequests: totalQueued,
      saturation: Math.max(
        parentUtilization.saturation ?? 0,
        Math.max(avgCpu, avgMemory, avgNetwork)
      ),
      parentId: parentUtilization.parentId,
      isAggregated: true,
      childrenCount: childStates.length,
    };
  }

  /**
   * Calcule la latence degradee en tenant compte de la charge du parent.
   * Si le parent est sous forte charge (>70%), ses enfants subissent une degradation supplementaire.
   */
  static calculateDegradedLatencyWithParent(
    baseLatency: number,
    nodeUtilization: ResourceUtilization,
    parentUtilization: ResourceUtilization | null,
    settings: DegradationSettings
  ): number {
    // D'abord appliquer la degradation du noeud lui-meme
    let degradedLatency = this.calculateDegradedLatency(
      baseLatency,
      nodeUtilization,
      settings
    );

    // Si le parent est sous charge, ajouter un facteur supplementaire
    if (parentUtilization) {
      const parentMaxUtil = Math.max(
        parentUtilization.cpu,
        parentUtilization.memory,
        parentUtilization.network
      ) / 100;

      // Facteur multiplicatif base sur la charge du parent (1.0 a 1.5x)
      if (parentMaxUtil > 0.7) {
        const parentFactor = 1 + (parentMaxUtil - 0.7) * 1.67; // 0.7->1.0, 1.0->1.5
        degradedLatency *= parentFactor;
      }
    }

    return degradedLatency;
  }
}
