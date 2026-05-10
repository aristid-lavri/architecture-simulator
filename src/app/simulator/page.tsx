'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Header, ComponentsPanel, PropertiesPanel, DiagramTabs, NewProjectDialog } from '@/components/layout';
import { PixiCanvas } from '@/components/canvas/PixiCanvas';
import { UISlotHost, projectKindRegistry } from '@/plugins/extensions';
import { bootstrapEnterprisePlugins } from '@/plugins/__enterprise-bootstrap';
import { registerCoreRulesEngine } from '@/lib/rules-engine';
import { SimulationReportDrawer } from '@/components/simulation/SimulationReportDrawer';
import { OwaspValidationDrawer } from '@/components/simulation/OwaspValidationDrawer';
import { AnalysisView } from '@/components/analysis/AnalysisView';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import { InstallPrompt } from '@/components/layout/InstallPrompt';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SimulationErrorBoundary } from '@/components/SimulationErrorBoundary';
import { useSimulationStore } from '@/store/simulation-store';
import { useProjectStore } from '@/store/project-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { useAppStore } from '@/store/app-store';
import { useOnboardingStore } from '@/store/onboarding-store';

export default function SimulatorPage() {
  const analysisMode = useSimulationStore((s) => s.analysisMode);
  const initialize = useProjectStore((s) => s.initialize);
  const projectsCount = useProjectStore((s) => s.projectsMeta.length);
  const initialized = useProjectStore((s) => s.initialized);
  const projectMeta = useArchitectureStore((s) => s.projectMeta);

  useEffect(() => {
    initialize();
    registerCoreRulesEngine();
    void bootstrapEnterprisePlugins();
  }, [initialize]);

  // Re-rend le bandeau quand un plugin enregistre un nouveau kind (ex: C4 chargé async).
  const kinds = useSyncExternalStore(
    (cb) => projectKindRegistry.subscribe(cb),
    () => projectKindRegistry.list(),
    () => projectKindRegistry.list(),
  );
  const currentKindDef = useMemo(
    () => kinds.find((k) => k.id === projectMeta.kind),
    [kinds, projectMeta.kind],
  );
  const hideDiagramTabs = !!currentKindDef?.hideDiagramTabs;
  const needsInitialProject = initialized && projectsCount === 0;

  // Expose stores on window for Playwright e2e tests (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const w = window as unknown as Record<string, unknown>;
      w.__archStore = useArchitectureStore;
      w.__appStore = useAppStore;
      w.__simStore = useSimulationStore;
      w.__onboardingStore = useOnboardingStore;
      w.__projectKindRegistry = projectKindRegistry;
    }
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Status Bar */}
      <Header />
      {/* Plugin slot: bandeau sous le header (ex: barre d'onglets multi-niveaux) */}
      <UISlotHost slotId="under-header" projectMeta={projectMeta} hideWhenEmpty />
      {/* Plugin slot: breadcrumb apporté par un plugin */}
      <UISlotHost slotId="breadcrumb" projectMeta={projectMeta} hideWhenEmpty />
      {/* Diagram Tabs — masqué pour les kinds qui apportent leur propre navigation (ex: C4) */}
      {!hideDiagramTabs && <DiagramTabs />}

      {analysisMode ? (
        /* Full-screen Analysis View */
        <div className="flex-1 overflow-hidden">
          <ErrorBoundary>
            <AnalysisView />
          </ErrorBoundary>
        </div>
      ) : (
        <>
          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Components Rack (Left Sidebar) */}
            <ErrorBoundary>
              <ComponentsPanel />
            </ErrorBoundary>

            {/* Canvas (Center) */}
            <SimulationErrorBoundary>
              <div className="flex-1 relative flex flex-col min-w-0">
                <PixiCanvas />
                {/* Plugin slot: bannières/overlays DOM positionnés absolument
                    au-dessus du canvas (visual-diff EE-3, …). */}
                <UISlotHost slotId="canvas-overlay" projectMeta={projectMeta} hideWhenEmpty />
              </div>
            </SimulationErrorBoundary>

            {/* Properties Panel (overlay, right side) */}
            <ErrorBoundary>
              <PropertiesPanel />
            </ErrorBoundary>
          </div>

          {/* Simulation Report Drawer */}
          <SimulationReportDrawer />
        </>
      )}

      {/* OWASP Validation Drawer (mounted at root for global access) */}
      <OwaspValidationDrawer />

      {/* Onboarding Tour */}
      <OnboardingOverlay />

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Plugin slot: dialogs (ex: cascade delete) montés au niveau racine. */}
      <UISlotHost slotId="cascade-dialog-provider" projectMeta={projectMeta} hideWhenEmpty />

      {/* Dialog de choix de projet — affiché et requis quand l'utilisateur n'a aucun projet
          (premier lancement ou suppression du dernier projet). */}
      <NewProjectDialog
        open={needsInitialProject}
        onOpenChange={() => {
          /* contrôlé par needsInitialProject; le dialog est non-fermable tant qu'il est requis */
        }}
        required
      />
    </div>
  );
}
