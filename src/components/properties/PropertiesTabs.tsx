'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/**
 * Tabs persistés par-type pour le PropertiesPanel (A4.1b).
 *
 * Why : sur les types de composants à grande surface de configuration
 * (http-server, database, message-queue), un scroll-spy nav (A4.1a) soulage
 * la perte d'orientation mais le contenu reste long. Les tabs masquent
 * effectivement les sections non actives → scroll réduit drastiquement.
 *
 * On persiste l'onglet actif par type de nœud dans localStorage : si l'utilisateur
 * passe du temps dans l'onglet "Resources" pour un http-server, il y restera
 * quand il sélectionnera un autre http-server.
 *
 * Pas de prop `value` contrôlée : le composant est uncontrolled-with-default
 * pour rester simple côté caller.
 */
export interface PropertiesTabsProps {
  /** Identifiant stable utilisé pour persister l'onglet actif (typiquement le node type). */
  storageKey: string;
  /** Onglets à afficher. */
  tabs: ReadonlyArray<{ id: string; label: string; content: ReactNode }>;
  /** Onglet par défaut si aucune valeur persistée. Sinon, premier de la liste. */
  defaultTab?: string;
}

const STORAGE_PREFIX = 'arch-sim-props-tab:';

function readPersistedTab(storageKey: string, fallback: string, validIds: readonly string[]): string {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
  if (raw && validIds.includes(raw)) return raw;
  return fallback;
}

export function PropertiesTabs({ storageKey, tabs, defaultTab }: PropertiesTabsProps) {
  const ids = tabs.map((t) => t.id);
  const fallback = defaultTab && ids.includes(defaultTab) ? defaultTab : ids[0];
  // Lazy init pour ne lire localStorage qu'une fois.
  const [active, setActive] = useState<string>(() => readPersistedTab(storageKey, fallback, ids));

  // Si l'ensemble d'ids change (rare — on swap de type), réajuste à un id valide.
  useEffect(() => {
    if (!ids.includes(active)) setActive(fallback);
  }, [ids, active, fallback]);

  const handleChange = (value: string) => {
    setActive(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_PREFIX + storageKey, value);
    }
  };

  return (
    <Tabs value={active} onValueChange={handleChange} className="gap-3">
      <TabsList className="w-full h-8 grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="text-xs">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="space-y-6 mt-0">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
