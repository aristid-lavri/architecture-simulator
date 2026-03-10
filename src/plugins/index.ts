// Plugin system public API
export type {
  Plugin,
  PluginNodeDefinition,
  PluginPanel,
  PluginEngineHooks,
} from './types';

export { pluginRegistry, registerPlugin } from './plugin-registry';
export { canBeChildOfExtended, getAllContainerTypes } from './hierarchy-helpers';
