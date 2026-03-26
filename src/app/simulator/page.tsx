'use client';

import { useEffect } from 'react';
import { Header, ComponentsPanel, PropertiesPanel, DiagramTabs } from '@/components/layout';
import { PixiCanvas } from '@/components/canvas/PixiCanvas';
import { SimulationReportDrawer } from '@/components/simulation/SimulationReportDrawer';
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

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Expose stores on window for Playwright e2e tests (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const w = window as Record<string, unknown>;
      w.__archStore = useArchitectureStore;
      w.__appStore = useAppStore;
      w.__simStore = useSimulationStore;
      w.__onboardingStore = useOnboardingStore;
    }
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Status Bar */}
      <Header />
      {/* Diagram Tabs */}
      <DiagramTabs />

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
              <PixiCanvas />
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

      {/* Onboarding Tour */}
      <OnboardingOverlay />

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
