'use client';

import { useSyncExternalStore } from 'react';
import { canvasHtmlOverlayRegistry } from '@/plugins/extensions';
import { useArchitectureStore } from '@/store/architecture-store';

const subscribe = (listener: () => void) => canvasHtmlOverlayRegistry.subscribe(listener);
const getSnapshot = () => canvasHtmlOverlayRegistry.list();

/**
 * Slot HTML overlay au-dessus du canvas PixiJS (pas dans le viewport pan/zoom — DOM normal).
 * Les composants enregistrés via `canvasHtmlOverlayRegistry` reçoivent `projectMeta` et sont
 * responsables de leur positionnement absolute.
 *
 * Conteneur racine en `pointer-events: none` pour ne pas intercepter les events du canvas ;
 * les overlays individuels peuvent ré-activer `pointer-events: auto` sur leurs éléments
 * interactifs.
 */
export function CanvasOverlaySlot() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const projectMeta = useArchitectureStore((s) => s.projectMeta);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {entries.map((e) => {
        if (e.shouldRender && !e.shouldRender({ projectMeta })) return null;
        const Comp = e.component;
        return <Comp key={e.id} projectMeta={projectMeta} />;
      })}
    </div>
  );
}
