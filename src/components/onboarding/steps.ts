import type { AppMode } from '@/types';

export type TourTrigger =
  | { type: 'click-next' }
  | { type: 'auto'; delayMs: number }
  | { type: 'node-added'; nodeType: string }
  | { type: 'edge-added' }
  | { type: 'mode-changed'; targetMode: AppMode }
  | { type: 'simulation-state-changed'; targetState: 'running' | 'idle' | 'paused' }
  | { type: 'node-selected'; nodeType: string }
  | { type: 'node-config-changed'; nodeType: string; field: string; value: string };

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TourStepConfig {
  id: string;
  titleKey: string;
  descriptionKey: string;
  targetSelector: string | null; // CSS selector for data-tour element, null = centered modal
  tooltipPosition: TooltipPosition;
  trigger: TourTrigger;
  /** If true, overlay allows all pointer events through (needed for drag-drop) */
  allowInteraction?: boolean;
}

export const TOUR_STEPS: TourStepConfig[] = [
  // Phase A — Welcome & Edit mode discovery (0-3)
  {
    id: 'welcome',
    titleKey: 'onboarding.welcome.title',
    descriptionKey: 'onboarding.welcome.description',
    targetSelector: null,
    tooltipPosition: 'bottom',
    trigger: { type: 'click-next' },
  },
  {
    id: 'components-panel',
    titleKey: 'onboarding.componentsPanel.title',
    descriptionKey: 'onboarding.componentsPanel.description',
    targetSelector: '[data-tour="components-panel"]',
    tooltipPosition: 'right',
    trigger: { type: 'click-next' },
  },
  {
    id: 'header-tools',
    titleKey: 'onboarding.headerTools.title',
    descriptionKey: 'onboarding.headerTools.description',
    targetSelector: '[data-tour="header-tools"]',
    tooltipPosition: 'bottom',
    trigger: { type: 'click-next' },
  },
  {
    id: 'undo-redo-snapshots',
    titleKey: 'onboarding.undoRedoSnapshots.title',
    descriptionKey: 'onboarding.undoRedoSnapshots.description',
    targetSelector: '[data-tour="header-tools"]',
    tooltipPosition: 'bottom',
    trigger: { type: 'click-next' },
  },
  {
    id: 'flow-canvas-intro',
    titleKey: 'onboarding.flowCanvasIntro.title',
    descriptionKey: 'onboarding.flowCanvasIntro.description',
    targetSelector: '[data-tour="flow-canvas"]',
    tooltipPosition: 'left',
    trigger: { type: 'click-next' },
  },

  // Phase B — Build architecture (4-7)
  {
    id: 'drag-http-client',
    titleKey: 'onboarding.dragHttpClient.title',
    descriptionKey: 'onboarding.dragHttpClient.description',
    targetSelector: '[data-tour="component-http-client"]',
    tooltipPosition: 'right',
    trigger: { type: 'node-added', nodeType: 'http-client' },
    allowInteraction: true,
  },
  {
    id: 'drag-http-server',
    titleKey: 'onboarding.dragHttpServer.title',
    descriptionKey: 'onboarding.dragHttpServer.description',
    targetSelector: '[data-tour="component-http-server"]',
    tooltipPosition: 'right',
    trigger: { type: 'node-added', nodeType: 'http-server' },
    allowInteraction: true,
  },
  {
    id: 'connect-nodes',
    titleKey: 'onboarding.connectNodes.title',
    descriptionKey: 'onboarding.connectNodes.description',
    targetSelector: '[data-tour="flow-canvas"]',
    tooltipPosition: 'top',
    trigger: { type: 'edge-added' },
    allowInteraction: true,
  },
  {
    id: 'architecture-ready',
    titleKey: 'onboarding.architectureReady.title',
    descriptionKey: 'onboarding.architectureReady.description',
    targetSelector: null,
    tooltipPosition: 'bottom',
    trigger: { type: 'click-next' },
  },

  // Phase B2 — Configure HTTP Client
  {
    id: 'select-http-client',
    titleKey: 'onboarding.selectHttpClient.title',
    descriptionKey: 'onboarding.selectHttpClient.description',
    targetSelector: '[data-tour="flow-canvas"]',
    tooltipPosition: 'top',
    trigger: { type: 'node-selected', nodeType: 'http-client' },
    allowInteraction: true,
  },
  {
    id: 'properties-panel-intro',
    titleKey: 'onboarding.propertiesPanelIntro.title',
    descriptionKey: 'onboarding.propertiesPanelIntro.description',
    targetSelector: '[data-tour="properties-panel"]',
    tooltipPosition: 'left',
    trigger: { type: 'click-next' },
  },
  {
    id: 'set-loop-mode',
    titleKey: 'onboarding.setLoopMode.title',
    descriptionKey: 'onboarding.setLoopMode.description',
    targetSelector: '[data-tour="request-mode-select"]',
    tooltipPosition: 'left',
    trigger: { type: 'node-config-changed', nodeType: 'http-client', field: 'requestMode', value: 'loop' },
    allowInteraction: true,
  },

  // Phase C — Simulation
  {
    id: 'switch-sim-mode',
    titleKey: 'onboarding.switchSimMode.title',
    descriptionKey: 'onboarding.switchSimMode.description',
    targetSelector: '[data-tour="mode-sim-button"]',
    tooltipPosition: 'bottom',
    trigger: { type: 'mode-changed', targetMode: 'simulation' },
  },
  {
    id: 'sim-controls-intro',
    titleKey: 'onboarding.simControlsIntro.title',
    descriptionKey: 'onboarding.simControlsIntro.description',
    targetSelector: '[data-tour="sim-controls"]',
    tooltipPosition: 'bottom',
    trigger: { type: 'click-next' },
  },
  {
    id: 'start-simulation',
    titleKey: 'onboarding.startSimulation.title',
    descriptionKey: 'onboarding.startSimulation.description',
    targetSelector: '[data-tour="sim-start-button"]',
    tooltipPosition: 'bottom',
    trigger: { type: 'simulation-state-changed', targetState: 'running' },
  },
  {
    id: 'observe-particles',
    titleKey: 'onboarding.observeParticles.title',
    descriptionKey: 'onboarding.observeParticles.description',
    targetSelector: '[data-tour="flow-canvas"]',
    tooltipPosition: 'top',
    trigger: { type: 'auto', delayMs: 4000 },
  },
  {
    id: 'pause-simulation',
    titleKey: 'onboarding.pauseSimulation.title',
    descriptionKey: 'onboarding.pauseSimulation.description',
    targetSelector: '[data-tour="sim-pause-button"]',
    tooltipPosition: 'bottom',
    trigger: { type: 'simulation-state-changed', targetState: 'paused' },
  },
  {
    id: 'metrics-tab',
    titleKey: 'onboarding.metricsTab.title',
    descriptionKey: 'onboarding.metricsTab.description',
    targetSelector: '[data-tour="metrics-panel"]',
    tooltipPosition: 'top',
    trigger: { type: 'click-next' },
  },
  {
    id: 'output-tab',
    titleKey: 'onboarding.outputTab.title',
    descriptionKey: 'onboarding.outputTab.description',
    targetSelector: '[data-tour="metrics-panel-tab-output"]',
    tooltipPosition: 'top',
    trigger: { type: 'click-next' },
  },
  {
    id: 'validation-tab',
    titleKey: 'onboarding.validationTab.title',
    descriptionKey: 'onboarding.validationTab.description',
    targetSelector: '[data-tour="metrics-panel-tab-valid"]',
    tooltipPosition: 'top',
    trigger: { type: 'click-next' },
  },
  {
    id: 'traces-tab',
    titleKey: 'onboarding.tracesTab.title',
    descriptionKey: 'onboarding.tracesTab.description',
    targetSelector: '[data-tour="metrics-panel-tab-traces"]',
    tooltipPosition: 'top',
    trigger: { type: 'click-next' },
  },

  // Phase D — Stop & Results
  {
    id: 'stop-simulation',
    titleKey: 'onboarding.stopSimulation.title',
    descriptionKey: 'onboarding.stopSimulation.description',
    targetSelector: '[data-tour="sim-stop-button"]',
    tooltipPosition: 'bottom',
    trigger: { type: 'simulation-state-changed', targetState: 'idle' },
  },
  {
    id: 'view-report',
    titleKey: 'onboarding.viewReport.title',
    descriptionKey: 'onboarding.viewReport.description',
    targetSelector: '[data-tour="report-drawer"]',
    tooltipPosition: 'bottom',
    trigger: { type: 'click-next' },
  },
];
