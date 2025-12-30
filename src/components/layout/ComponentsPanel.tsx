'use client';

import { useAppStore } from '@/store/app-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ChevronRight,
  ChevronLeft,
  Shield,
  Server,
  Database,
  HardDrive,
  Network,
  MessageSquare,
  Monitor,
  Users,
  Share2,
  Zap,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { ComponentType } from '@/types';

interface ComponentItem {
  type: ComponentType;
  nameKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  color: string;
  category: 'simulation' | 'infrastructure' | 'data';
}

const COMPONENTS: ComponentItem[] = [
  // Simulation components (MVP)
  {
    type: 'http-client',
    nameKey: 'components.httpClient.name',
    descriptionKey: 'components.httpClient.description',
    icon: <Monitor className="h-5 w-5" />,
    color: 'bg-blue-500',
    category: 'simulation',
  },
  {
    type: 'http-server',
    nameKey: 'components.httpServer.name',
    descriptionKey: 'components.httpServer.description',
    icon: <Server className="h-5 w-5" />,
    color: 'bg-purple-500',
    category: 'simulation',
  },
  {
    type: 'client-group',
    nameKey: 'components.clientGroup.name',
    descriptionKey: 'components.clientGroup.description',
    icon: <Users className="h-5 w-5" />,
    color: 'bg-blue-600',
    category: 'simulation',
  },
  // Infrastructure components
  {
    type: 'api-gateway',
    nameKey: 'components.apiGateway.name',
    descriptionKey: 'components.apiGateway.description',
    icon: <Shield className="h-5 w-5" />,
    color: 'bg-blue-500',
    category: 'infrastructure',
  },
  {
    type: 'load-balancer',
    nameKey: 'components.loadBalancer.name',
    descriptionKey: 'components.loadBalancer.description',
    icon: <Share2 className="h-5 w-5" />,
    color: 'bg-green-500',
    category: 'infrastructure',
  },
  // Data components
  {
    type: 'database',
    nameKey: 'components.database.name',
    descriptionKey: 'components.database.description',
    icon: <Database className="h-5 w-5" />,
    color: 'bg-purple-600',
    category: 'data',
  },
  {
    type: 'cache',
    nameKey: 'components.cache.name',
    descriptionKey: 'components.cache.description',
    icon: <Zap className="h-5 w-5" />,
    color: 'bg-orange-500',
    category: 'data',
  },
  {
    type: 'message-queue',
    nameKey: 'components.messageQueue.name',
    descriptionKey: 'components.messageQueue.description',
    icon: <MessageSquare className="h-5 w-5" />,
    color: 'bg-yellow-500',
    category: 'data',
  },
];

function DraggableComponent({ component, t }: { component: ComponentItem; t: (key: string) => string }) {
  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', component.type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="p-3 border rounded-lg cursor-grab active:cursor-grabbing hover:border-primary hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div
          className={`${component.color} p-2 rounded-md text-white flex-shrink-0`}
        >
          {component.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{t(component.nameKey)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(component.descriptionKey)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ComponentsPanel() {
  const { isComponentsPanelOpen, toggleComponentsPanel } = useAppStore();
  const { t } = useTranslation();

  // Group components by category
  const simulationComponents = COMPONENTS.filter((c) => c.category === 'simulation');
  const infrastructureComponents = COMPONENTS.filter((c) => c.category === 'infrastructure');
  const dataComponents = COMPONENTS.filter((c) => c.category === 'data');

  return (
    <div
      className={`border-l bg-background transition-all duration-300 flex flex-col ${
        isComponentsPanelOpen ? 'w-72' : 'w-12'
      }`}
    >
      {/* Toggle Button */}
      <div className="h-12 border-b flex items-center justify-between px-2">
        {isComponentsPanelOpen && (
          <span className="font-medium text-sm px-2">{t('components.title')}</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleComponentsPanel}
          className="ml-auto"
        >
          {isComponentsPanelOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Components List */}
      {isComponentsPanelOpen && (
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-3 space-y-4">
            {/* Simulation Category */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {t('components.categories.simulation')}
                </span>
                <Badge variant="default" className="text-xs bg-blue-500">
                  MVP
                </Badge>
              </div>
              <div className="space-y-2">
                {simulationComponents.map((component) => (
                  <DraggableComponent key={component.type} component={component} t={t} />
                ))}
              </div>
            </div>

            <Separator />

            {/* Infrastructure Category */}
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                {t('components.categories.infrastructure')}
              </span>
              <div className="space-y-2">
                {infrastructureComponents.map((component) => (
                  <DraggableComponent key={component.type} component={component} t={t} />
                ))}
              </div>
            </div>

            <Separator />

            {/* Data Category */}
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                {t('components.categories.data')}
              </span>
              <div className="space-y-2">
                {dataComponents.map((component) => (
                  <DraggableComponent key={component.type} component={component} t={t} />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
