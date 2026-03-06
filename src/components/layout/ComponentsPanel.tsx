'use client';

import { useAppStore } from '@/store/app-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronRight,
  ChevronLeft,
  Server,
  Database,
  Monitor,
  Users,
  Share2,
  Zap,
  MessageSquare,
  Shield,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { ComponentType } from '@/types';

interface ComponentItem {
  type: ComponentType;
  nameKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  signalColor: string;
  category: 'simulation' | 'infrastructure' | 'data';
}

const COMPONENTS: ComponentItem[] = [
  {
    type: 'http-client',
    nameKey: 'components.httpClient.name',
    descriptionKey: 'components.httpClient.description',
    icon: <Monitor className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.70 0.15 220)',
    category: 'simulation',
  },
  {
    type: 'http-server',
    nameKey: 'components.httpServer.name',
    descriptionKey: 'components.httpServer.description',
    icon: <Server className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.68 0.18 290)',
    category: 'simulation',
  },
  {
    type: 'client-group',
    nameKey: 'components.clientGroup.name',
    descriptionKey: 'components.clientGroup.description',
    icon: <Users className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.70 0.15 220)',
    category: 'simulation',
  },
  {
    type: 'api-gateway',
    nameKey: 'components.apiGateway.name',
    descriptionKey: 'components.apiGateway.description',
    icon: <Shield className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.75 0.18 75)',
    category: 'infrastructure',
  },
  {
    type: 'load-balancer',
    nameKey: 'components.loadBalancer.name',
    descriptionKey: 'components.loadBalancer.description',
    icon: <Share2 className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.75 0.18 75)',
    category: 'infrastructure',
  },
  {
    type: 'database',
    nameKey: 'components.database.name',
    descriptionKey: 'components.database.description',
    icon: <Database className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.72 0.19 155)',
    category: 'data',
  },
  {
    type: 'cache',
    nameKey: 'components.cache.name',
    descriptionKey: 'components.cache.description',
    icon: <Zap className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.72 0.19 155)',
    category: 'data',
  },
  {
    type: 'message-queue',
    nameKey: 'components.messageQueue.name',
    descriptionKey: 'components.messageQueue.description',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.75 0.18 75)',
    category: 'data',
  },
];

function DraggableComponent({ component, t, disabled }: { component: ComponentItem; t: (key: string) => string; disabled?: boolean }) {
  const onDragStart = (event: React.DragEvent) => {
    if (disabled) { event.preventDefault(); return; }
    event.dataTransfer.setData('application/reactflow', component.type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      className={cn(
        "group flex items-center gap-2.5 px-2.5 py-2 border border-transparent transition-colors",
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-grab active:cursor-grabbing hover:border-border'
      )}
      style={{ borderRadius: '3px' }}
      role="option"
      aria-label={`${t(component.nameKey)} — ${t(component.descriptionKey)}`}
      aria-disabled={disabled}
    >
      {/* Signal accent */}
      <div
        className="w-0.5 h-6 rounded-full shrink-0"
        style={{ backgroundColor: component.signalColor }}
      />
      <div style={{ color: component.signalColor }} className="shrink-0">
        {component.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-instrument text-[10px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
          {t(component.nameKey)}
        </p>
      </div>
    </div>
  );
}

export function ComponentsPanel() {
  const { isComponentsPanelOpen, toggleComponentsPanel, mode } = useAppStore();
  const { t } = useTranslation();
  const isSimMode = mode === 'simulation';

  const simulationComponents = COMPONENTS.filter((c) => c.category === 'simulation');
  const infrastructureComponents = COMPONENTS.filter((c) => c.category === 'infrastructure');
  const dataComponents = COMPONENTS.filter((c) => c.category === 'data');

  return (
    <div
      className={`border-r border-border bg-card transition-all duration-300 flex flex-col ${
        isComponentsPanelOpen ? 'w-56' : 'w-8'
      }`}
    >
      {/* Toggle */}
      <div className="h-8 border-b border-border flex items-center justify-between px-1.5">
        {isComponentsPanelOpen && (
          <span className="text-instrument text-[10px] text-muted-foreground px-1.5">RACK</span>
        )}
        <button
          onClick={toggleComponentsPanel}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label={isComponentsPanelOpen ? 'Fermer le panneau de composants' : 'Ouvrir le panneau de composants'}
        >
          {isComponentsPanelOpen ? (
            <ChevronLeft className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Components List */}
      {isComponentsPanelOpen && (
        <ScrollArea className="flex-1 overflow-auto">
          <div className="py-2 space-y-3">
            {/* Simulation */}
            <div>
              <div className="px-3 mb-1">
                <span className="text-instrument text-[9px] text-muted-foreground">
                  SIMULATION
                </span>
              </div>
              <div className="space-y-0.5 px-1">
                {simulationComponents.map((component) => (
                  <DraggableComponent key={component.type} component={component} t={t} disabled={isSimMode} />
                ))}
              </div>
            </div>

            {/* Infrastructure */}
            <div>
              <div className="px-3 mb-1 pt-1 border-t border-border">
                <span className="text-instrument text-[9px] text-muted-foreground">
                  INFRASTRUCTURE
                </span>
              </div>
              <div className="space-y-0.5 px-1">
                {infrastructureComponents.map((component) => (
                  <DraggableComponent key={component.type} component={component} t={t} disabled={isSimMode} />
                ))}
              </div>
            </div>

            {/* Data */}
            <div>
              <div className="px-3 mb-1 pt-1 border-t border-border">
                <span className="text-instrument text-[9px] text-muted-foreground">
                  DATA
                </span>
              </div>
              <div className="space-y-0.5 px-1">
                {dataComponents.map((component) => (
                  <DraggableComponent key={component.type} component={component} t={t} disabled={isSimMode} />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
