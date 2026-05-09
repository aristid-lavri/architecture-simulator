// Plugin system public API
export type {
  Plugin,
  PluginNodeDefinition,
  PluginPanel,
  PluginEngineHooks,
  SimulationEngineAPI,
} from './types';

export { pluginRegistry, registerPlugin } from './plugin-registry';
export { canBeChildOfExtended, getAllContainerTypes } from './hierarchy-helpers';

// Extension API : points d'extension génériques pour les plugins.
export * from './extensions';
