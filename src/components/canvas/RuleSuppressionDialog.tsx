'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ruleIdToI18nKey } from '@/lib/rules-engine';

export interface RuleSuppressionDialogProps {
  open: boolean;
  ruleId: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function RuleSuppressionDialog({ open, ruleId, onConfirm, onCancel }: RuleSuppressionDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  if (!ruleId) return null;

  const ruleMessage = t(ruleIdToI18nKey(ruleId, 'message'));
  const titleTpl = t('rules.suppression.dialog.title');
  const title = titleTpl.replace('{ruleId}', ruleId);

  const submit = () => {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError(t('rules.suppression.dialog.errorEmptyReason'));
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-xs">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {ruleMessage}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="suppression-reason" className="text-xs font-mono text-muted-foreground">
            {t('rules.suppression.dialog.reason')}
          </label>
          <textarea
            id="suppression-reason"
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder={t('rules.suppression.dialog.reasonPlaceholder')}
            rows={3}
            autoFocus
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {error && (
            <p className="text-[10px] font-mono text-signal-critical">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t('rules.suppression.dialog.cancel')}
          </Button>
          <Button variant="default" size="sm" onClick={submit}>
            {t('rules.suppression.dialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
