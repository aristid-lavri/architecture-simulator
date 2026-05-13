'use client';

import { useTranslation } from '@/i18n';
import { useSimulationStore } from '@/store/simulation-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ruleIdToI18nKey } from '@/lib/rules-engine/core';

/**
 * A6.4 — Modal dialog shown when a `start()` attempt is blocked by error-severity
 * rule violations. Lists each violation with its rule ID, message, and suggestion.
 *
 * Dismissing the dialog clears `blockedReason` from the simulation store; the user
 * is expected to fix the graph and re-trigger the simulation manually.
 */
export function BlockingValidationDialog() {
  const { t } = useTranslation();
  const blockedReason = useSimulationStore((s) => s.blockedReason);
  const dismiss = useSimulationStore((s) => s.dismissBlocked);

  const open = !!blockedReason && blockedReason.length > 0;
  const count = blockedReason?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('rules.blockingDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('rules.blockingDialog.subtitle').replace('{count}', String(count))}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
          {(blockedReason ?? []).map((issue) => {
            const ruleId = issue.ruleId ?? '';
            const messageKey = issue.messageKey;
            const message = t(messageKey);
            // Translate suggestion if rule has one (sibling key 'suggestion').
            const suggestionKey = ruleId ? ruleIdToI18nKey(ruleId, 'suggestion') : '';
            const suggestion = suggestionKey ? t(suggestionKey) : '';
            // If t() returns the key itself (no translation), suppress fallback.
            const showSuggestion = suggestion && suggestion !== suggestionKey;
            return (
              <div
                key={issue.id}
                className="border border-signal-critical/40 bg-signal-critical/5 rounded p-3 text-sm"
              >
                {ruleId && (
                  <div className="text-xs font-mono text-muted-foreground mb-1">
                    {t('rules.blockingDialog.ruleIdLabel')} : {ruleId}
                  </div>
                )}
                <div className="text-foreground">{message}</div>
                {showSuggestion && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold">
                      {t('rules.blockingDialog.suggestionLabel')} :{' '}
                    </span>
                    {suggestion}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          {t('rules.blockingDialog.fixHint')}
        </p>

        <DialogFooter>
          <Button variant="default" onClick={dismiss}>
            {t('rules.blockingDialog.dismiss')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
