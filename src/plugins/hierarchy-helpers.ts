import { canBeChildOf as builtinCanBeChildOf, CONTAINER_TYPES, type ComponentType } from '@/types';
import { pluginRegistry } from './plugin-registry';

/**
 * Version étendue de canBeChildOf qui prend en compte les plugins.
 * Vérifie d'abord les règles built-in, puis les règles des plugins.
 */
export function canBeChildOfExtended(childType: string, parentType: string): boolean {
  // Vérifier d'abord côté plugin (enfant)
  const pluginChildResult = pluginRegistry.canPluginBeChildOf(childType, parentType);
  if (pluginChildResult !== undefined) return pluginChildResult;

  // Vérifier côté plugin (parent)
  const pluginParentResult = pluginRegistry.canPluginAcceptChild(parentType, childType);
  if (pluginParentResult !== undefined) return pluginParentResult;

  // Fallback sur les règles built-in
  return builtinCanBeChildOf(childType as ComponentType, parentType as ComponentType);
}

/**
 * Retourne tous les types de conteneurs (built-in + plugins).
 */
export function getAllContainerTypes(): string[] {
  return [...CONTAINER_TYPES, ...pluginRegistry.getContainerTypes()];
}
