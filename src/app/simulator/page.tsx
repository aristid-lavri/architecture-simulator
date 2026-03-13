'use client';

import { Header, ComponentsPanel, PropertiesPanel } from '@/components/layout';
import { FlowCanvas } from '@/components/flow/FlowCanvas';
import { SimulationReportDrawer } from '@/components/simulation/SimulationReportDrawer';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import { InstallPrompt } from '@/components/layout/InstallPrompt';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SimulationErrorBoundary } from '@/components/SimulationErrorBoundary';
import { ReactFlowProvider } from '@xyflow/react';

export default function SimulatorPage() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Status Bar */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Components Rack (Left Sidebar) */}
        <ErrorBoundary>
          <ComponentsPanel />
        </ErrorBoundary>

        {/* Flow Canvas (Center) */}
        <SimulationErrorBoundary>
          <ReactFlowProvider>
            <FlowCanvas />
          </ReactFlowProvider>
        </SimulationErrorBoundary>

        {/* Properties Panel (Right Sidebar) */}
        <ErrorBoundary>
          <PropertiesPanel />
        </ErrorBoundary>
      </div>

      {/* Simulation Report Drawer */}
      <SimulationReportDrawer />

      {/* Onboarding Tour */}
      <OnboardingOverlay />

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
