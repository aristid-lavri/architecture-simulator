// Extension API publique des plugins.
// Aucune mention métier ici — ces registries sont génériques et peuvent être consommés
// par n'importe quel plugin (multi-niveaux d'abstraction, cost estimation, analytics...).

export {
  projectKindRegistry,
  createProjectMeta,
  DEFAULT_PROJECT_KIND,
  type ProjectKindDefinition,
  type ProjectKindMeta,
} from './project-kind';

export {
  uiSlotRegistry,
  type UISlotId,
  type UISlotEntry,
  type UISlotProps,
} from './ui-slots';

export { UISlotHost } from './UISlotHost';

export {
  canvasFilterRegistry,
  type NodeVisibilityFilter,
  type EdgeVisibilityFilter,
  type NodePositionSelector,
  type NodePositionWriter,
  type CanvasFilterContext,
} from './canvas-filter';

export {
  paletteVisibilityRegistry,
  type PaletteCategoryFilter,
  type PaletteItemFilter,
  type PaletteCategoryDescriptor,
  type PaletteItemDescriptor,
  type PaletteVisibilityContext,
} from './palette-visibility';

export {
  nodeInteractionRegistry,
  type NodeInteractionEvent,
  type NodeInteractionHandler,
  type NodeInteractionContext,
} from './node-interaction';

export {
  edgeInteractionRegistry,
  type EdgeInteractionEvent,
  type EdgeInteractionHandler,
  type EdgeInteractionContext,
} from './edge-interaction';

export {
  nodeCreationDecoratorRegistry,
  type DraftNode,
  type NodeCreationContext,
  type NodeCreationDecorator,
} from './node-creation';

export {
  edgeCreationDecoratorRegistry,
  type DraftEdge,
  type EdgeCreationContext,
  type EdgeCreationDecorator,
} from './edge-creation';

export {
  nodeRendererRegistry,
  type NodeRendererProvider,
  type NodeRenderHints,
  type NodeRenderVariant,
  type NodeRendererContext,
} from './node-renderer';

export {
  edgeStyleRegistry,
  type EdgeStyleProvider,
  type EdgeStyleHints,
  type EdgeStrokeStyle,
  type EdgeStyleContext,
} from './edge-style';

export {
  deleteHookRegistry,
  type DeleteHook,
  type EdgeDeleteHook,
  type DeleteHookDecision,
  type DeleteHookContext,
  type EdgeDeleteHookContext,
} from './delete-hook';

export {
  yamlSchemaRegistry,
  type YAMLSchemaExtension,
} from './yaml-schema';

export {
  simulationHandlerRegistry,
  type SimulationHandlerEntry,
} from './simulation-handler';

export {
  metricsProjectionRegistry,
  type MetricsProjectionProvider,
  type MetricsProjectionContext,
  type ProjectedFooterMetrics,
} from './metrics-projection';

export { featureGateRegistry } from './feature-gate';

export {
  canvasOverlayRegistry,
  type CanvasOverlayProvider,
  type CanvasOverlayContext,
  type OverlayHint,
} from './canvas-overlay';
