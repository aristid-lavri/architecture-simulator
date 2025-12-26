import type { ClientGroupNodeData, RampUpCurve } from '@/types';

export interface VirtualClient {
  id: number;
  groupId: string;
  isActive: boolean;
  activatedAt: number;
  lastRequestAt: number;
  requestsSent: number;
  activeRequests: number; // Number of currently in-flight requests for this client
}

interface BurstState {
  requestsInCurrentBurst: number;
  lastBurstTime: number;
}

export class VirtualClientManager {
  private clients: Map<string, VirtualClient[]> = new Map();
  private rampUpTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private burstStates: Map<string, BurstState> = new Map();

  /**
   * Initialise un groupe de clients virtuels
   */
  initializeGroup(groupId: string, data: ClientGroupNodeData): void {
    const clients: VirtualClient[] = [];

    for (let i = 0; i < data.virtualClients; i++) {
      clients.push({
        id: i,
        groupId,
        isActive: !data.rampUpEnabled,
        activatedAt: data.rampUpEnabled ? -1 : Date.now(),
        lastRequestAt: 0,
        requestsSent: 0,
        activeRequests: 0,
      });
    }

    this.clients.set(groupId, clients);

    // Initialiser l'état burst si nécessaire
    if (data.distribution === 'burst') {
      this.burstStates.set(groupId, {
        requestsInCurrentBurst: 0,
        lastBurstTime: Date.now(),
      });
    }

    if (data.rampUpEnabled) {
      this.startRampUp(groupId, data);
    }
  }

  /**
   * Démarre le ramp-up progressif des clients
   */
  private startRampUp(groupId: string, data: ClientGroupNodeData): void {
    const clients = this.clients.get(groupId);
    if (!clients) return;

    const startTime = Date.now();
    const totalClients = clients.length;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const targetActive = this.calculateActiveClients(
        elapsed,
        data.rampUpDuration,
        totalClients,
        data.rampUpCurve
      );

      // Activer les clients nécessaires
      let activated = 0;
      for (const client of clients) {
        if (client.isActive) {
          activated++;
        } else if (activated < targetActive) {
          client.isActive = true;
          client.activatedAt = Date.now();
          activated++;
        }
      }

      // Arrêter quand tous sont actifs
      if (activated >= totalClients) {
        clearInterval(timer);
        this.rampUpTimers.delete(groupId);
      }
    }, 100);

    this.rampUpTimers.set(groupId, timer);
  }

  /**
   * Calcule le nombre de clients à activer selon la courbe
   */
  private calculateActiveClients(
    elapsed: number,
    duration: number,
    total: number,
    curve: RampUpCurve
  ): number {
    const progress = Math.min(1, elapsed / duration);

    switch (curve) {
      case 'linear':
        return Math.floor(total * progress);
      case 'exponential':
        return Math.floor(total * (1 - Math.exp(-3 * progress)));
      case 'step':
        const step = Math.floor(progress * 5);
        return Math.floor(total * (step / 5));
      default:
        return Math.floor(total * progress);
    }
  }

  /**
   * Détermine si un client doit envoyer une requête maintenant
   */
  shouldSendRequest(groupId: string, clientId: number, data: ClientGroupNodeData): boolean {
    const clients = this.clients.get(groupId);
    if (!clients) return false;

    const client = clients.find(c => c.id === clientId);
    if (!client || !client.isActive) return false;

    const now = Date.now();

    // En mode séquentiel, on attend que la requête précédente soit terminée
    if (data.requestMode === 'sequential') {
      if (client.activeRequests > 0) return false;
    } else {
      // En mode parallèle, on limite le nombre de requêtes simultanées
      const maxConcurrent = data.concurrentRequests || 5;
      if (client.activeRequests >= maxConcurrent) return false;
    }

    if (data.distribution === 'burst') {
      return this.shouldSendBurstRequest(groupId, data, now);
    }

    const delay = this.getNextRequestDelay(data);
    return now - client.lastRequestAt >= delay;
  }

  /**
   * Gère la logique burst
   */
  private shouldSendBurstRequest(
    groupId: string,
    data: ClientGroupNodeData,
    now: number
  ): boolean {
    const burstState = this.burstStates.get(groupId);
    if (!burstState) return false;

    const burstSize = data.burstSize || 5;
    const burstInterval = data.burstInterval || 5000;

    if (burstState.requestsInCurrentBurst < burstSize) {
      burstState.requestsInCurrentBurst++;
      return true;
    }

    if (now - burstState.lastBurstTime >= burstInterval) {
      burstState.requestsInCurrentBurst = 1;
      burstState.lastBurstTime = now;
      return true;
    }

    return false;
  }

  /**
   * Obtient le prochain délai de requête selon la distribution
   */
  getNextRequestDelay(data: ClientGroupNodeData): number {
    switch (data.distribution) {
      case 'uniform':
        return data.baseInterval;

      case 'random':
        const variance = data.baseInterval * (data.intervalVariance / 100);
        return data.baseInterval + (Math.random() * 2 - 1) * variance;

      case 'burst':
        return 0;

      default:
        return data.baseInterval;
    }
  }

  /**
   * Enregistre qu'une requête a été envoyée par un client
   */
  recordRequestSent(groupId: string, clientId: number): void {
    const clients = this.clients.get(groupId);
    if (!clients) return;

    const client = clients.find(c => c.id === clientId);
    if (client) {
      client.lastRequestAt = Date.now();
      client.requestsSent++;
      client.activeRequests++;
    }
  }

  /**
   * Enregistre qu'une requête est terminée (réponse reçue)
   */
  recordRequestCompleted(groupId: string, clientId: number): void {
    const clients = this.clients.get(groupId);
    if (!clients) return;

    const client = clients.find(c => c.id === clientId);
    if (client && client.activeRequests > 0) {
      client.activeRequests--;
    }
  }

  /**
   * Récupère les clients actifs d'un groupe
   */
  getActiveClients(groupId: string): VirtualClient[] {
    const clients = this.clients.get(groupId);
    return clients?.filter(c => c.isActive) || [];
  }

  /**
   * Récupère tous les clients d'un groupe
   */
  getAllClients(groupId: string): VirtualClient[] {
    return this.clients.get(groupId) || [];
  }

  /**
   * Récupère les statistiques d'un groupe
   */
  getGroupStats(groupId: string): { activeClients: number; totalRequests: number } {
    const clients = this.clients.get(groupId) || [];
    const activeClients = clients.filter(c => c.isActive).length;
    const totalRequests = clients.reduce((sum, c) => sum + c.requestsSent, 0);
    return { activeClients, totalRequests };
  }

  /**
   * Nettoie un groupe
   */
  cleanup(groupId: string): void {
    const timer = this.rampUpTimers.get(groupId);
    if (timer) {
      clearInterval(timer);
      this.rampUpTimers.delete(groupId);
    }
    this.clients.delete(groupId);
    this.burstStates.delete(groupId);
  }

  /**
   * Nettoie tous les groupes
   */
  cleanupAll(): void {
    this.rampUpTimers.forEach(timer => clearInterval(timer));
    this.rampUpTimers.clear();
    this.clients.clear();
    this.burstStates.clear();
  }

  /**
   * Vérifie si un groupe existe
   */
  hasGroup(groupId: string): boolean {
    return this.clients.has(groupId);
  }
}
