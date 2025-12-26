'use client';

import { Header, ComponentsPanel, PropertiesPanel } from '@/components/layout';
import { FlowCanvas } from '@/components/flow/FlowCanvas';
import { SimulationReportDrawer } from '@/components/simulation/SimulationReportDrawer';
import { ReactFlowProvider } from '@xyflow/react';

export default function Home() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Components Panel (Left Sidebar) */}
        <ComponentsPanel />

        {/* Flow Canvas (Center) */}
        <ReactFlowProvider>
          <FlowCanvas />
        </ReactFlowProvider>

        {/* Properties Panel (Right Sidebar) */}
        <PropertiesPanel />
      </div>

      {/* Simulation Report Drawer */}
      <SimulationReportDrawer />
    </div>
  );
}
