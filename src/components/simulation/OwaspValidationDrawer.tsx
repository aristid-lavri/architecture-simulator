'use client';

import { useAppStore } from '@/store/app-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { useTranslation } from '@/i18n';
import { runOwaspValidation } from '@/lib/owasp-validation/engine';
import { ALL_RULES } from '@/lib/owasp-validation/rules';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { OwaspSeverity } from '@/lib/owasp-validation/types';
import { useEffect, useMemo } from 'react';

const SEVERITY_COLORS: Record<OwaspSeverity, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-yellow-500 text-black',
  LOW: 'bg-blue-500 text-white',
  INFO: 'bg-gray-400 text-white',
};

export function OwaspValidationDrawer() {
  const open = useAppStore((s) => s.owaspDrawerOpen);
  const setOpen = useAppStore((s) => s.setOwaspDrawerOpen);
  const result = useAppStore((s) => s.owaspValidationResult);
  const setResult = useAppStore((s) => s.setOwaspValidationResult);
  const setSelected = useAppStore((s) => s.setSelectedNodeId);
  const { nodes, edges } = useArchitectureStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      const r = runOwaspValidation({ nodes, edges });
      setResult(r);
    }
  }, [open, nodes, edges, setResult]);

  const ruleById = useMemo(() => new Map(ALL_RULES.map((r) => [r.id, r])), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="sm:max-w-lg w-full">
        <SheetHeader>
          <SheetTitle>{t('owasp.drawer.title')}</SheetTitle>
        </SheetHeader>

        {result && (
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold">{result.passedRules} / {result.totalRules}</span>
              <span className="text-sm text-muted-foreground">{t('owasp.drawer.scoreLabel')}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as OwaspSeverity[]).map((sev) => (
                result.bySeverity[sev] > 0 && (
                  <Badge key={sev} className={SEVERITY_COLORS[sev]}>
                    {result.bySeverity[sev]} {t(`owasp.severity.${sev}`)}
                  </Badge>
                )
              ))}
            </div>

            {result.violations.length === 0 ? (
              <p className="text-green-600 font-medium">{t('owasp.drawer.noViolations')}</p>
            ) : (
              <ul className="space-y-3">
                {result.violations.map((v, idx) => {
                  const rule = ruleById.get(v.ruleId);
                  if (!rule) return null;
                  return (
                    <li key={idx} className="border rounded p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={SEVERITY_COLORS[rule.severity]}>{t(`owasp.severity.${rule.severity}`)}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{rule.id}</span>
                      </div>
                      <h4 className="font-medium">{t(rule.titleKey)}</h4>
                      <p className="text-sm text-muted-foreground">{t(rule.descriptionKey)}</p>
                      {v.details && <p className="text-xs italic">{v.details}</p>}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {v.affectedNodeIds.map((nid) => (
                          <Button key={nid} size="sm" variant="outline"
                            onClick={() => { setSelected(nid); setOpen(false); }}
                          >
                            {nid}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs mt-2"><strong>{t('owasp.drawer.remediationLabel')}:</strong> {t(rule.remediationKey)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
