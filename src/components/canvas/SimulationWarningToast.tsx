'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { useSimulationStore } from '@/store/simulation-store';

/**
 * A6.4 — Non-blocking toast surfaced when a simulation starts despite the presence of
 * warning-severity rule violations. Auto-dismisses after 5s; clicking dismisses immediately.
 */
export function SimulationWarningToast() {
  const { t } = useTranslation();
  const warningToast = useSimulationStore((s) => s.warningToast);
  const shownAt = useSimulationStore((s) => s.warningToastShownAt);
  const dismiss = useSimulationStore((s) => s.dismissWarningToast);

  useEffect(() => {
    if (!warningToast || warningToast.length === 0) return;
    const timer = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(timer);
  }, [warningToast, shownAt, dismiss]);

  if (!warningToast || warningToast.length === 0) return null;

  const label = t('rules.toast.simulationWarnings').replace(
    '{count}',
    String(warningToast.length),
  );

  return (
    <div
      key={shownAt ?? 0}
      role="status"
      onClick={dismiss}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-md px-4 py-2 rounded-md border border-amber-500/40 bg-amber-500/10 backdrop-blur text-amber-400 text-xs font-mono shadow-lg cursor-pointer animate-in fade-in slide-in-from-top-2 duration-200"
    >
      ⚠ {label}
      <span className="ml-2 text-amber-500/70">
        {t('rules.toast.simulationWarningsHint')}
      </span>
    </div>
  );
}
