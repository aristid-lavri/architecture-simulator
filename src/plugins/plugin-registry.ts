import type { ComponentType as ReactComponentType } from 'react';
import type { Plugin, PluginNodeDefinition, PluginPanel, PluginEngineHooks } from './types';

type PluginRegistryListener = () => void;

/**
 * Registre global des plugins.
 * Singleton qui centralise tous les plugins enregistrés et expose
 * des accesseurs pour les consommateurs (FlowCanvas, ComponentsPanel, Engine).
 */
class PluginRegistryImpl {
  private plugins: Map<string, Plugin> = new Map();
  private nodeDefinitions: Map<string, PluginNodeDefinition> = new Map();
  private panelDefinitions: Map<string, PluginPanel> = new Map();
  private engineHooksList: PluginEngineHooks[] = [];
  private listeners: Set<PluginRegistryListener> = new Set();

  /**
   * Enregistre un plugin et tous ses composants.
   * @throws Error si un plugin avec le même id est déjà enregistré
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin "${plugin.id}" is already registered, skipping.`);
      return;
    }

    this.plugins.set(plugin.id, plugin);

    // Enregistrer les nœuds
    if (plugin.nodes) {
      for (const node of plugin.nodes) {
        if (this.nodeDefinitions.has(node.type)) {
          console.warn(`Node type "${node.type}" already registered, overwriting with plugin "${plugin.id}".`);
        }
        this.nodeDefinitions.set(node.type, node);
      }
    }

    // Enregistrer les panneaux
    if (plugin.panels) {
      for (const panel of plugin.panels) {
        this.panelDefinitions.set(panel.id, panel);
      }
    }

    // Enregistrer les hooks moteur
    if (plugin.engineHooks) {
      this.engineHooksList.push(plugin.engineHooks);
    }

    this.notifyListeners();
  }

  /**
   * Désenregistre un plugin et tous ses composants.
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    if (plugin.nodes) {
      for (const node of plugin.nodes) {
        this.nodeDefinitions.delete(node.type);
      }
    }

    if (plugin.panels) {
      for (const panel of plugin.panels) {
        this.panelDefinitions.delete(panel.id);
      }
    }

    if (plugin.engineHooks) {
      this.engineHooksList = this.engineHooksList.filter(h => h !== plugin.engineHooks);
    }

    this.plugins.delete(pluginId);
    this.notifyListeners();
  }

  // ── Accesseurs pour les nœuds ──

  /**
   * Retourne les composants React Flow des plugins, à merger avec les nodeTypes built-in.
   */
  getNodeTypes(): Record<string, ReactComponentType<any>> {
    const types: Record<string, ReactComponentType<any>> = {};
    for (const [type, def] of this.nodeDefinitions) {
      types[type] = def.component;
    }
    return types;
  }

  /**
   * Retourne les données par défaut d'un type de nœud plugin.
   */
  getDefaultNodeData(type: string): Record<string, unknown> | null {
    return this.nodeDefinitions.get(type)?.defaultData ?? null;
  }

  /**
   * Retourne les définitions de nœuds pour le panneau de composants.
   */
  getNodeDefinitions(): PluginNodeDefinition[] {
    return Array.from(this.nodeDefinitions.values());
  }

  /**
   * Retourne les handlers de simulation des plugins.
   */
  getNodeHandlers(): { type: string; handler: PluginNodeDefinition['handler'] }[] {
    return Array.from(this.nodeDefinitions.values()).map(def => ({
      type: def.type,
      handler: def.handler,
    }));
  }

  // ── Accesseurs pour les panneaux ──

  getPanels(position?: PluginPanel['position']): PluginPanel[] {
    const panels = Array.from(this.panelDefinitions.values());
    return position ? panels.filter(p => p.position === position) : panels;
  }

  // ── Accesseurs pour les hooks moteur ──

  getEngineHooks(): PluginEngineHooks[] {
    return [...this.engineHooksList];
  }

  // ── Souscription aux changements ──

  /**
   * Souscrit aux changements du registre (ajout/suppression de plugins).
   * Retourne une fonction de désinscription.
   */
  subscribe(listener: PluginRegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // ── Utilitaires ──

  getRegisteredPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  isRegistered(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  hasNodeType(type: string): boolean {
    return this.nodeDefinitions.has(type);
  }

  clear(): void {
    this.plugins.clear();
    this.nodeDefinitions.clear();
    this.panelDefinitions.clear();
    this.engineHooksList = [];
    this.notifyListeners();
  }
}

/** Instance singleton du registre de plugins */
export const pluginRegistry = new PluginRegistryImpl();

/** Raccourci pour enregistrer un plugin */
export function registerPlugin(plugin: Plugin): void {
  pluginRegistry.register(plugin);
}
