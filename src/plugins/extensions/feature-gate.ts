/**
 * Registre des feature gates apportés par les plugins.
 * Permet à un plugin d'enregistrer un identifiant de feature qui sera consulté par
 * `<EnterpriseGate feature="...">` au lieu d'élargir une liste hard-codée dans le CE.
 *
 * Le contrat : si une feature est enregistrée ici, le gate la considère comme
 * "premium" (= nécessite tier enterprise pour être déverrouillée). Les features
 * non enregistrées passent en mode permissif (compatibilité avec les call sites
 * historiques du CE qui utilisent leur propre liste).
 */

type FeatureGateListener = () => void;

class FeatureGateRegistryImpl {
  private features: Set<string> = new Set();
  private listeners: Set<FeatureGateListener> = new Set();

  /** Enregistre un identifiant de feature comme gated par licence. */
  register(featureId: string): void {
    if (!this.features.has(featureId)) {
      this.features.add(featureId);
      this.notify();
    }
  }

  /** Désenregistre une feature. */
  unregister(featureId: string): void {
    if (this.features.delete(featureId)) {
      this.notify();
    }
  }

  /** Vérifie si une feature est enregistrée par un plugin. */
  has(featureId: string): boolean {
    return this.features.has(featureId);
  }

  list(): string[] {
    return Array.from(this.features);
  }

  subscribe(listener: FeatureGateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const featureGateRegistry = new FeatureGateRegistryImpl();
