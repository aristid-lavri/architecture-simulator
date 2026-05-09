'use client';

import { useSyncExternalStore, createElement, Fragment } from 'react';
import { uiSlotRegistry, type UISlotId, type UISlotProps } from './ui-slots';

interface UISlotHostProps extends UISlotProps {
  slotId: UISlotId;
  /** Si vrai, n'affiche rien si aucun composant n'est enregistré pour ce slot. */
  hideWhenEmpty?: boolean;
  /** Wrapper optionnel autour de l'ensemble des entrées (className sur un div). */
  className?: string;
}

/**
 * Composant hôte qui rend toutes les entrées enregistrées pour un slot UI.
 * S'abonne au registre via useSyncExternalStore : les changements sont propagés sans reload.
 */
export function UISlotHost({
  slotId,
  projectMeta,
  context,
  hideWhenEmpty,
  className,
}: UISlotHostProps) {
  const version = useSyncExternalStore(
    (cb) => uiSlotRegistry.subscribe(cb),
    () => uiSlotRegistry.getForSlot(slotId).length,
    () => 0,
  );

  // Force le useMemo à recalculer quand version change.
  void version;

  const entries = uiSlotRegistry
    .getForSlot(slotId)
    .filter((e) => !e.shouldRender || e.shouldRender({ projectMeta, context }));

  if (entries.length === 0 && hideWhenEmpty) return null;

  const children = entries.map((e) =>
    createElement(e.component, {
      key: e.id,
      projectMeta,
      context,
    }),
  );

  if (className) {
    return createElement('div', { className }, ...children);
  }
  return createElement(Fragment, null, ...children);
}
