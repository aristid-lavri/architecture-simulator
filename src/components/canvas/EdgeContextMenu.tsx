'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { ruleIdToI18nKey } from '@/lib/rules-engine';
import type { GraphEdge } from '@/types/graph';

export interface EdgeContextMenuProps {
  /** Position in viewport (clientX/clientY). */
  x: number;
  y: number;
  edge: GraphEdge;
  /** Active (non-suppressed) rule violation IDs reported on this edge by the latest validation pass. */
  activeRuleIds: string[];
  onSuppressRule: (ruleId: string) => void;
  onClose: () => void;
}

/**
 * Floating context menu shown when the user right-clicks an edge that has at least one
 * active rule warning. Lists each unsuppressed rule and lets the user open the suppression
 * dialog. Phase 1 — no submenu, no shortcuts.
 */
export function EdgeContextMenu({ x, y, activeRuleIds, onSuppressRule, onClose }: EdgeContextMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (activeRuleIds.length === 0) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[240px] rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1 font-mono text-xs"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
        {t('rules.panel.category')}
      </div>
      {activeRuleIds.map((ruleId) => {
        const shortKey = ruleIdToI18nKey(ruleId, 'short');
        const messageKey = ruleIdToI18nKey(ruleId, 'message');
        const shortLabel = t(shortKey);
        const fullMessage = t(messageKey);
        return (
          <button
            key={ruleId}
            type="button"
            role="menuitem"
            onClick={() => {
              onSuppressRule(ruleId);
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors flex flex-col gap-0.5 cursor-pointer"
          >
            <span className="font-semibold">{t('rules.suppression.menuLabel')} : {shortLabel}</span>
            <span className="text-muted-foreground text-[10px] truncate">{fullMessage}</span>
          </button>
        );
      })}
    </div>
  );
}
