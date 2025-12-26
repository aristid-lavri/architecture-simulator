import type { ServerResources, ResourceUtilization, DegradationSettings } from '@/types';

export class ResourceManager {
  /**
   * Calcule l'utilisation actuelle des ressources
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

    return {
      cpu: Math.min(100, cpuUtil),
      memory: Math.min(100, memUtil),
      network: Math.min(100, netUtil),
      disk: diskUtil !== undefined ? Math.min(100, diskUtil) : undefined,
      activeConnections: activeRequests,
      queuedRequests,
    };
  }

  /**
   * Calcule la latence dégradée basée sur l'utilisation
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
   * Vérifie si le serveur peut accepter une nouvelle requête
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
}
