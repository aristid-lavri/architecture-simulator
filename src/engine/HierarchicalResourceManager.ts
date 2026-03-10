import type { Node } from '@xyflow/react';
import type { ResourceUtilization } from '@/types';
import { ResourceManager } from './ResourceManager';

/**
 * Gestionnaire hierarchique des ressources.
 * Construit et maintient les relations parent-enfant entre les noeuds
 * pour permettre le calcul de latence hierarchique et l'agregation des ressources.
 */
export class HierarchicalResourceManager {
  private childToParent: Map<string, string> = new Map();
  private parentToChildren: Map<string, string[]> = new Map();
  private nodeTypes: Map<string, string> = new Map();

  /**
   * Construit les maps de relations a partir des parentId des noeuds.
   */
  initialize(nodes: Node[]): void {
    this.childToParent.clear();
    this.parentToChildren.clear();
    this.nodeTypes.clear();

    for (const node of nodes) {
      this.nodeTypes.set(node.id, node.type ?? 'default');

      if (node.parentId) {
        this.childToParent.set(node.id, node.parentId);

        const children = this.parentToChildren.get(node.parentId) || [];
        children.push(node.id);
        this.parentToChildren.set(node.parentId, children);
      }
    }
  }

  /**
   * Retourne le parentId direct d'un noeud.
   */
  getParentId(nodeId: string): string | undefined {
    return this.childToParent.get(nodeId);
  }

  /**
   * Retourne les IDs des enfants directs d'un noeud.
   */
  getChildrenIds(parentId: string): string[] {
    return this.parentToChildren.get(parentId) || [];
  }

  /**
   * Remonte la chaine parentId pour trouver le host-server ancetre.
   */
  findContainingServer(nodeId: string): string | undefined {
    let currentId: string | undefined = this.childToParent.get(nodeId);
    while (currentId) {
      const nodeType = this.nodeTypes.get(currentId);
      if (nodeType === 'host-server') return currentId;
      currentId = this.childToParent.get(currentId);
    }
    return undefined;
  }

  /**
   * Remonte la chaine parentId pour trouver le container ancetre.
   */
  findContainingContainer(nodeId: string): string | undefined {
    let currentId: string | undefined = this.childToParent.get(nodeId);
    while (currentId) {
      const nodeType = this.nodeTypes.get(currentId);
      if (nodeType === 'container') return currentId;
      currentId = this.childToParent.get(currentId);
    }
    return undefined;
  }

  /**
   * Remonte la chaine parentId pour trouver la network-zone ancetre.
   */
  findContainingZone(nodeId: string): string | undefined {
    let currentId: string | undefined = this.childToParent.get(nodeId);
    while (currentId) {
      const nodeType = this.nodeTypes.get(currentId);
      if (nodeType === 'network-zone') return currentId;
      currentId = this.childToParent.get(currentId);
    }
    return undefined;
  }

  /**
   * Retourne la chaine d'ancetres [parentId, grandparentId, ...].
   */
  getAncestorChain(nodeId: string): string[] {
    const chain: string[] = [];
    let currentId: string | undefined = this.childToParent.get(nodeId);
    while (currentId) {
      chain.push(currentId);
      currentId = this.childToParent.get(currentId);
    }
    return chain;
  }

  /**
   * Calcule l'utilisation agregee d'un parent a partir de ses enfants.
   * Somme CPU/RAM/Network des etats enfants, rapportee aux limites du parent.
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

    // L'utilisation agregee est le max entre le parent et la moyenne ponderee des enfants
    const avgCpu = totalCpu / childStates.length;
    const avgMemory = totalMemory / childStates.length;
    const avgNetwork = totalNetwork / childStates.length;

    const aggregated: ResourceUtilization = {
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

    return aggregated;
  }

  /**
   * Calcule la latence degradee en prenant en compte la charge du parent.
   * Si le parent est sous charge, ses enfants subissent aussi une degradation.
   */
  static calculateDegradedLatencyWithParent(
    baseLatency: number,
    nodeUtilization: ResourceUtilization,
    parentUtilization: ResourceUtilization | null,
    settings: import('@/types').DegradationSettings
  ): number {
    // D'abord appliquer la degradation du noeud lui-meme
    let degradedLatency = ResourceManager.calculateDegradedLatency(
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
