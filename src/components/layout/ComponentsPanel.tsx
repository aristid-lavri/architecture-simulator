'use client';

import { useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAppStore } from '@/store/app-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Server,
  Database,
  Monitor,
  Users,
  Share2,
  Zap,
  MessageSquare,
  Shield,
  Globe,
  ShieldCheck,
  ShieldOff,
  Cloud,
  Compass,
  HardDrive,
  Box,
  Layers,
  KeyRound,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { ComponentType } from '@/types';
import { pluginRegistry } from '@/plugins';

interface ComponentItem {
  type: ComponentType;
  nameKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  signalColor: string;
  category: 'simulation' | 'infrastructure' | 'data' | 'resilience' | 'compute' | 'cloud' | 'zone' | 'security';
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
  // Zone
  {
    type: 'network-zone',
    nameKey: 'components.networkZone.name',
    descriptionKey: 'components.networkZone.description',
    icon: <Layers className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.65 0.10 0)',
    category: 'zone',
  },
  {
    type: 'host-server',
    nameKey: 'components.hostServer.name',
    descriptionKey: 'components.hostServer.description',
    icon: <Monitor className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.62 0.14 240)',
    category: 'compute',
  },
  // Resilience
  {
    type: 'circuit-breaker',
    nameKey: 'components.circuitBreaker.name',
    descriptionKey: 'components.circuitBreaker.description',
    icon: <ShieldOff className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.70 0.18 330)',
    category: 'resilience',
  },
  // Edge / Security
  {
    type: 'cdn',
    nameKey: 'components.cdn.name',
    descriptionKey: 'components.cdn.description',
    icon: <Globe className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.70 0.15 200)',
    category: 'infrastructure',
  },
  {
    type: 'waf',
    nameKey: 'components.waf.name',
    descriptionKey: 'components.waf.description',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.65 0.20 25)',
    category: 'infrastructure',
  },
  {
    type: 'firewall',
    nameKey: 'components.firewall.name',
    descriptionKey: 'components.firewall.description',
    icon: <Shield className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.65 0.20 25)',
    category: 'infrastructure',
  },
  // Compute
  {
    type: 'serverless',
    nameKey: 'components.serverless.name',
    descriptionKey: 'components.serverless.description',
    icon: <Cloud className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.68 0.18 50)',
    category: 'compute',
  },
  {
    type: 'container',
    nameKey: 'components.container.name',
    descriptionKey: 'components.container.description',
    icon: <Box className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.68 0.18 50)',
    category: 'compute',
  },
  {
    type: 'api-service',
    nameKey: 'components.apiService.name',
    descriptionKey: 'components.apiService.description',
    icon: <Server className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.68 0.18 50)',
    category: 'compute',
  },
  {
    type: 'background-job',
    nameKey: 'components.backgroundJob.name',
    descriptionKey: 'components.backgroundJob.description',
    icon: <Zap className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.68 0.18 50)',
    category: 'compute',
  },
  // Discovery
  {
    type: 'service-discovery',
    nameKey: 'components.serviceDiscovery.name',
    descriptionKey: 'components.serviceDiscovery.description',
    icon: <Compass className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.68 0.15 180)',
    category: 'infrastructure',
  },
  // Cloud
  {
    type: 'cloud-storage',
    nameKey: 'components.cloudStorage.name',
    descriptionKey: 'components.cloudStorage.description',
    icon: <HardDrive className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.70 0.18 260)',
    category: 'cloud',
  },
  {
    type: 'cloud-function',
    nameKey: 'components.cloudFunction.name',
    descriptionKey: 'components.cloudFunction.description',
    icon: <Cloud className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.70 0.18 260)',
    category: 'cloud',
  },
  // Security
  {
    type: 'identity-provider',
    nameKey: 'components.identityProvider.name',
    descriptionKey: 'components.identityProvider.description',
    icon: <KeyRound className="h-3.5 w-3.5" />,
    signalColor: 'oklch(0.72 0.18 280)',
    category: 'security',
  },
];

interface CategoryConfig {
  key: string;
  label: string;
  signalColor: string;
  items: ComponentItem[];
}

function DraggableComponent({ component, t, disabled, categoryColor }: { component: ComponentItem; t: (key: string) => string; disabled?: boolean; categoryColor: string }) {
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
      data-tour={`component-${component.type}`}
    >
      {/* Signal accent */}
      <div
        className="w-0.5 h-6 rounded-full shrink-0"
        style={{ backgroundColor: categoryColor }}
      />
      <div style={{ color: categoryColor }} className="shrink-0">
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

function CategoryAccordion({
  category,
  isOpen,
  onToggle,
  isSimMode,
  t,
}: {
  category: CategoryConfig;
  isOpen: boolean;
  onToggle: () => void;
  isSimMode: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="border-t border-border first:border-t-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors"
        aria-expanded={isOpen}
      >
        <div
          className="w-0.5 h-3 rounded-full shrink-0"
          style={{ backgroundColor: category.signalColor }}
        />
        <ChevronDown
          className={cn(
            "h-2.5 w-2.5 text-muted-foreground shrink-0 transition-transform duration-200",
            !isOpen && "-rotate-90"
          )}
        />
        <span className="text-instrument text-[9px] text-muted-foreground flex-1 text-left">
          {category.label}
        </span>
        <span className="text-instrument text-[9px] text-muted-foreground/50">
          {category.items.length}
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 px-1 pb-1">
            {category.items.map((component) => (
              <DraggableComponent key={component.type} component={component} t={t} disabled={isSimMode} categoryColor={category.signalColor} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const CATEGORY_SIGNAL_COLORS: Record<string, string> = {
  simulation: 'oklch(0.70 0.15 220)',
  infrastructure: 'oklch(0.75 0.18 75)',
  data: 'oklch(0.72 0.19 155)',
  resilience: 'oklch(0.70 0.18 330)',
  compute: 'oklch(0.68 0.18 50)',
  cloud: 'oklch(0.70 0.18 260)',
  zone: 'oklch(0.65 0.10 0)',
  security: 'oklch(0.72 0.18 280)',
};

const CATEGORY_ORDER: { key: ComponentItem['category']; label: string }[] = [
  { key: 'simulation', label: 'SIMULATION' },
  { key: 'infrastructure', label: 'INFRASTRUCTURE' },
  { key: 'data', label: 'DATA' },
  { key: 'resilience', label: 'RESILIENCE' },
  { key: 'compute', label: 'COMPUTE' },
  { key: 'cloud', label: 'CLOUD' },
  { key: 'security', label: 'SECURITY' },
  { key: 'zone', label: 'ZONES' },
];

export function ComponentsPanel() {
  const { isComponentsPanelOpen, toggleComponentsPanel, mode } = useAppStore();
  const { t } = useTranslation();
  const isSimMode = mode === 'simulation';

  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(CATEGORY_ORDER.map((c) => c.key))
  );

  const toggleCategory = useCallback((key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Réagir aux changements de plugins
  const pluginSnapshot = useSyncExternalStore(
    (cb) => pluginRegistry.subscribe(cb),
    () => pluginRegistry.getRegisteredPlugins().length,
    () => 0,
  );

  const categories: CategoryConfig[] = useMemo(() => {
    // Convertir les nœuds de plugins en ComponentItem
    const pluginItems: ComponentItem[] = pluginRegistry.getNodeDefinitions()
      .filter(def => def.panel)
      .map(def => ({
        type: def.type as ComponentType,
        nameKey: def.panel!.name,
        descriptionKey: def.panel!.description,
        icon: def.panel!.icon,
        signalColor: def.panel!.signalColor,
        category: def.panel!.category as ComponentItem['category'],
      }));

    const allComponents = [...COMPONENTS, ...pluginItems];

    // Collecter les catégories dynamiques des plugins
    const pluginCategories = new Set(
      pluginItems.map(p => p.category).filter(c => !CATEGORY_ORDER.some(co => co.key === c))
    );

    const allCategoryOrder = [
      ...CATEGORY_ORDER,
      ...Array.from(pluginCategories).map(key => ({
        key: key as ComponentItem['category'],
        label: key.toUpperCase(),
      })),
    ];

    return allCategoryOrder.map(({ key, label }) => ({
      key,
      label,
      signalColor: CATEGORY_SIGNAL_COLORS[key] || 'oklch(0.65 0.15 180)',
      items: allComponents.filter((c) => c.category === key),
    })).filter(c => c.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginSnapshot]);

  return (
    <div
      className={`border-r border-border bg-card transition-all duration-300 flex flex-col h-full ${
        isComponentsPanelOpen ? 'w-56' : 'w-8'
      }`}
      data-tour="components-panel"
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
        <ScrollArea className="flex-1 overflow-hidden">
          <div className="py-1">
            {categories.map((category) => (
              <CategoryAccordion
                key={category.key}
                category={category}
                isOpen={openCategories.has(category.key)}
                onToggle={() => toggleCategory(category.key)}
                isSimMode={isSimMode}
                t={t}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
