'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useSimulationStore } from '@/store/simulation-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { useTranslation } from '@/i18n';
import { Skull, AlertTriangle, RotateCcw, Unplug } from 'lucide-react';
import { nodeContextMenuRegistry, type NodeContextMenuItem } from '@/plugins/extensions';

interface ContextMenuPosition {
  x: number;
  y: number;
  nodeId: string;
}

interface NodeContextMenuProps {
  position: ContextMenuPosition | null;
  onClose: () => void;
}

/**
 * Menu contextuel (clic droit) pour l'injection de pannes en mode simulation.
 * Affiche les options chaos : simuler panne, degrader, isoler reseau, restaurer.
 */
export function NodeContextMenu({ position, onClose }: NodeContextMenuProps) {
  const { t } = useTranslation();
  const injectFault = useSimulationStore((s) => s.injectFault);
  const clearFault = useSimulationStore((s) => s.clearFault);
  const isolateNode = useSimulationStore((s) => s.isolateNode);
  const faultInjections = useSimulationStore((s) => s.faultInjections);
  const isolatedNodes = useSimulationStore((s) => s.isolatedNodes);
  const allNodes = useArchitectureStore((s) => s.nodes);
  const projectMeta = useArchitectureStore((s) => s.projectMeta);
  const menuRef = useRef<HTMLDivElement>(null);

  // Phase 1E — Items contextuels injectés par les plugins (ex : "Simulate subtree only" en C4).
  const pluginItems = useMemo<NodeContextMenuItem[]>(() => {
    if (!position) return [];
    const node = allNodes.find((n) => n.id === position.nodeId);
    if (!node) return [];
    return nodeContextMenuRegistry.resolveItems(node, projectMeta).map((item) => ({
      ...item,
      onClick: () => { item.onClick(); onClose(); },
    }));
  }, [position, allNodes, projectMeta, onClose]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!position) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [position, onClose]);

  if (!position) return null;

  const nodeId = position.nodeId;
  const currentFault = faultInjections.get(nodeId);
  const isIsolated = isolatedNodes.has(nodeId);
  const hasFault = !!currentFault || isIsolated;

  const menuItems = hasFault
    ? [
        {
          label: t('chaos.restore'),
          icon: <RotateCcw size={14} />,
          onClick: () => { clearFault(nodeId); onClose(); },
          className: 'text-green-400 hover:bg-green-500/10',
        },
      ]
    : [
        {
          label: t('chaos.simulateFault'),
          icon: <Skull size={14} />,
          onClick: () => { injectFault(nodeId, 'down'); onClose(); },
          className: 'text-red-400 hover:bg-red-500/10',
        },
        {
          label: t('chaos.degradeNode'),
          icon: <AlertTriangle size={14} />,
          onClick: () => { injectFault(nodeId, 'degraded'); onClose(); },
          className: 'text-orange-400 hover:bg-orange-500/10',
        },
        {
          label: t('chaos.isolateNetwork'),
          icon: <Unplug size={14} />,
          onClick: () => { isolateNode(nodeId); onClose(); },
          className: 'text-red-400 hover:bg-red-500/10',
        },
      ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-md border border-border bg-popover/95 backdrop-blur-sm p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Chaos Mode
      </div>
      {menuItems.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-sm cursor-pointer transition-colors ${item.className}`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
      {pluginItems.length > 0 && (
        <>
          <div className="my-1 border-t border-border" />
          {pluginItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-sm cursor-pointer transition-colors ${item.className ?? 'text-foreground hover:bg-secondary'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
