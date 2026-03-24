/**
 * Limiteur de débit par fenêtre glissante (sliding window).
 * Utilisé par les handlers de type proxy (CDN, WAF, Firewall, DNS, ServiceDiscovery, CloudStorage)
 * pour limiter le nombre de requêtes par seconde.
 *
 * Le compteur se reset automatiquement quand 1 seconde s'est écoulée depuis le dernier reset.
 * Pas de setTimeout — le reset est vérifié à chaque appel (tick-based).
 */
export class ThroughputLimiter {
  private requestCounts: Map<string, number> = new Map();
  private lastResetTimestamps: Map<string, number> = new Map();

  /**
   * Tente de consommer un token pour le noeud donné.
   * @returns true si la requête est acceptée, false si le débit est dépassé.
   */
  tryAcquire(nodeId: string, maxRequestsPerSecond: number): boolean {
    const now = Date.now();
    const lastReset = this.lastResetTimestamps.get(nodeId) || 0;

    // Reset le compteur si plus d'1 seconde écoulée
    if (now - lastReset >= 1000) {
      this.requestCounts.set(nodeId, 0);
      this.lastResetTimestamps.set(nodeId, now);
    }

    const count = this.requestCounts.get(nodeId) || 0;
    if (count >= maxRequestsPerSecond) {
      return false;
    }

    this.requestCounts.set(nodeId, count + 1);
    return true;
  }

  /**
   * Nettoie l'état d'un noeud (appelé à l'arrêt de la simulation).
   */
  cleanup(nodeId: string): void {
    this.requestCounts.delete(nodeId);
    this.lastResetTimestamps.delete(nodeId);
  }

  /**
   * Nettoie tout l'état (appelé à l'arrêt global).
   */
  clear(): void {
    this.requestCounts.clear();
    this.lastResetTimestamps.clear();
  }
}
