'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { useAppStore } from '@/store/app-store';
import { useSimulationStore } from '@/store/simulation-store';
import { TOUR_STEPS } from './steps';
import { TourSpotlight } from './TourSpotlight';
import { TourStep } from './TourStep';

/**
 * Run beforeStep side-effects for certain steps.
 * This ensures the UI is in the right state for the current step.
 */
function runBeforeStep(stepIndex: number) {
  const step = TOUR_STEPS[stepIndex];
  if (!step) return;

  switch (step.id) {
    case 'welcome': {
      // Ensure clean state: edit mode, components panel open, clear canvas
      const appStore = useAppStore.getState();
      if (appStore.mode !== 'edit') appStore.setMode('edit');
      if (!appStore.isComponentsPanelOpen) appStore.setComponentsPanelOpen(true);
      // Clear architecture for a fresh start
      const archStore = useArchitectureStore.getState();
      if (archStore.nodes.length > 0 || archStore.edges.length > 0) {
        archStore.clear();
      }
      break;
    }

    case 'components-panel': {
      // Ensure simulation category is expanded (it's open by default)
      useAppStore.getState().setComponentsPanelOpen(true);
      break;
    }

    case 'drag-http-client':
    case 'drag-http-server': {
      // Make sure panel is open
      useAppStore.getState().setComponentsPanelOpen(true);
      break;
    }

    case 'switch-sim-mode': {
      // Close properties panel by deselecting node
      const appState = useAppStore.getState();
      if (appState.selectedNodeId) {
        appState.setSelectedNodeId(null);
      }
      break;
    }

    case 'metrics-tab': {
      // Click the metrics tab to show it
      const el = document.querySelector('[data-tour="metrics-panel-tab-metrics"]') as HTMLButtonElement | null;
      el?.click();
      break;
    }

    case 'output-tab': {
      const el = document.querySelector('[data-tour="metrics-panel-tab-output"]') as HTMLButtonElement | null;
      el?.click();
      break;
    }

    case 'validation-tab': {
      const el = document.querySelector('[data-tour="metrics-panel-tab-valid"]') as HTMLButtonElement | null;
      el?.click();
      break;
    }

    case 'traces-tab': {
      const el = document.querySelector('[data-tour="metrics-panel-tab-traces"]') as HTMLButtonElement | null;
      el?.click();
      break;
    }
  }
}

export function OnboardingOverlay() {
  const isActive = useOnboardingStore((s) => s.isActive);
  const hasCompletedTour = useOnboardingStore((s) => s.hasCompletedTour);
  const currentStepIndex = useOnboardingStore((s) => s.currentStepIndex);
  const advanceStep = useOnboardingStore((s) => s.advanceStep);
  const startTour = useOnboardingStore((s) => s.startTour);
  const completeTour = useOnboardingStore((s) => s.completeTour);

  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevNodeCountRef = useRef<number>(0);
  const prevEdgeCountRef = useRef<number>(0);
  const hasStartedRef = useRef(false);

  // Auto-start tour on first visit
  useEffect(() => {
    if (!hasCompletedTour && !isActive && !hasStartedRef.current) {
      hasStartedRef.current = true;
      // Small delay to let the page render
      const timer = setTimeout(() => {
        startTour();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTour, isActive, startTour]);

  // Run beforeStep on step change
  useEffect(() => {
    if (!isActive) return;
    runBeforeStep(currentStepIndex);
  }, [isActive, currentStepIndex]);

  // Snapshot node/edge counts when entering action steps
  useEffect(() => {
    if (!isActive) return;
    prevNodeCountRef.current = useArchitectureStore.getState().nodes.length;
    prevEdgeCountRef.current = useArchitectureStore.getState().edges.length;
  }, [isActive, currentStepIndex]);

  // Subscribe to stores for auto-advance triggers
  useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;
    const trigger = step.trigger;

    // Auto-advance after delay
    if (trigger.type === 'auto') {
      autoTimerRef.current = setTimeout(() => {
        advanceStep();
      }, trigger.delayMs);
      return () => {
        if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      };
    }

    // Guard: ensure advanceStep is only called once per step
    // Zustand subscribe fires on EVERY store update, not just the watched field
    let advanced = false;
    const advanceOnce = (delay = 300) => {
      if (advanced) return;
      advanced = true;
      setTimeout(() => advanceStep(), delay);
    };

    // Watch architecture store for node-added and edge-added
    if (trigger.type === 'node-added') {
      const unsub = useArchitectureStore.subscribe((state) => {
        const hasNewNode = state.nodes.some(
          (n) => (n.data as { type?: string }).type === trigger.nodeType || n.type === trigger.nodeType
        );
        if (hasNewNode && state.nodes.length > prevNodeCountRef.current) {
          prevNodeCountRef.current = state.nodes.length;
          advanceOnce();
        }
      });
      return unsub;
    }

    if (trigger.type === 'edge-added') {
      const unsub = useArchitectureStore.subscribe((state) => {
        if (state.edges.length > prevEdgeCountRef.current) {
          prevEdgeCountRef.current = state.edges.length;
          advanceOnce();
        }
      });
      return unsub;
    }

    // Watch app store for mode change
    if (trigger.type === 'mode-changed') {
      const unsub = useAppStore.subscribe((state) => {
        if (state.mode === trigger.targetMode) {
          advanceOnce();
        }
      });
      return unsub;
    }

    // Watch simulation store for state changes
    if (trigger.type === 'simulation-state-changed') {
      const unsub = useSimulationStore.subscribe((state) => {
        if (state.state === trigger.targetState) {
          // Extra delay for 'idle' to let report drawer open
          advanceOnce(trigger.targetState === 'idle' ? 500 : 300);
        }
      });
      return unsub;
    }

    // Watch app store for node selection
    if (trigger.type === 'node-selected') {
      const unsub = useAppStore.subscribe((state) => {
        if (state.selectedNodeId) {
          const nodes = useArchitectureStore.getState().nodes;
          const selected = nodes.find((n) => n.id === state.selectedNodeId);
          if (selected && selected.type === trigger.nodeType) {
            advanceOnce();
          }
        }
      });
      return unsub;
    }

    // Watch simulation store for analysis mode activation
    if (trigger.type === 'analysis-activated') {
      const unsub = useSimulationStore.subscribe((state) => {
        if (state.analysisMode) {
          advanceOnce();
        }
      });
      return unsub;
    }

    // Watch architecture store for node config change
    if (trigger.type === 'node-config-changed') {
      const unsub = useArchitectureStore.subscribe((state) => {
        const node = state.nodes.find((n) => n.type === trigger.nodeType);
        if (node) {
          const data = node.data as Record<string, unknown>;
          if (data[trigger.field] === trigger.value) {
            advanceOnce();
          }
        }
      });
      return unsub;
    }
  }, [isActive, currentStepIndex, advanceStep]);

  // Handle "Next" button click
  const handleNext = useCallback(() => {
    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;

    // Last step → complete tour
    if (currentStepIndex === TOUR_STEPS.length - 1) {
      completeTour();
      return;
    }

    advanceStep();
  }, [currentStepIndex, advanceStep, completeTour]);

  if (!isActive) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  if (!currentStep) return null;

  // For steps that need click-through on target (mode switch, start, stop),
  // we need to allow pointer events on the spotlight hole
  const needsTargetClick =
    currentStep.trigger.type === 'mode-changed' ||
    currentStep.trigger.type === 'simulation-state-changed' ||
    currentStep.trigger.type === 'analysis-activated';

  return (
    <>
      <TourSpotlight
        targetSelector={currentStep.targetSelector}
        allowInteraction={currentStep.allowInteraction || needsTargetClick}
        visible={true}
      />
      <TourStep
        step={currentStep}
        stepIndex={currentStepIndex}
        onNext={handleNext}
      />
    </>
  );
}
