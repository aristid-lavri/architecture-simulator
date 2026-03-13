'use client';

import { useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { XCircle, AlertTriangle, Info, CheckCircle2, Crosshair } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { useTranslation } from '@/i18n';
import type { ValidationIssue, ValidationSeverity } from '@/lib/simulation-validator';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const severityConfig: Record<ValidationSeverity, { icon: typeof XCircle; colorClass: string; label: string }> = {
  error: { icon: XCircle, colorClass: 'text-signal-critical', label: 'ERROR' },
  warning: { icon: AlertTriangle, colorClass: 'text-signal-warning', label: 'WARN' },
  info: { icon: Info, colorClass: 'text-blue-400', label: 'INFO' },
};

function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const { t } = useTranslation();
  const reactFlow = useReactFlow();
  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  const message = formatMessage(t(issue.messageKey), issue.messageParams);

  const handleLocate = useCallback(() => {
    if (!issue.nodeIds?.length) return;
    const nodes = reactFlow.getNodes().filter((n) => issue.nodeIds!.includes(n.id));
    if (nodes.length === 0) return;
    reactFlow.fitView({
      nodes,
      duration: 400,
      padding: 0.5,
    });
  }, [issue.nodeIds, reactFlow]);

  return (
    <div className="flex items-start gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors group">
      <Icon className={cn('w-3 h-3 mt-0.5 shrink-0', config.colorClass)} />
      <span className="text-foreground/80 flex-1 min-w-0 break-words">{message}</span>
      {issue.nodeIds && issue.nodeIds.length > 0 && (
        <button
          onClick={handleLocate}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          title={t('validation.locate')}
        >
          <Crosshair className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function ValidationPanel({ panelHeight }: { panelHeight: number }) {
  const { t } = useTranslation();
  const validationResult = useAppStore((s) => s.validationResult);

  const grouped = useMemo(() => {
    if (!validationResult) return { errors: [], warnings: [], infos: [] };
    return {
      errors: validationResult.issues.filter((i) => i.severity === 'error'),
      warnings: validationResult.issues.filter((i) => i.severity === 'warning'),
      infos: validationResult.issues.filter((i) => i.severity === 'info'),
    };
  }, [validationResult]);

  if (!validationResult) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-[11px] px-4">
        {t('validation.clickToValidate')}
      </div>
    );
  }

  if (validationResult.issues.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 h-full font-mono text-[11px]">
        <CheckCircle2 className="w-4 h-4 text-signal-healthy" />
        <span className="text-signal-healthy">{t('validation.noIssues')}</span>
      </div>
    );
  }

  return (
    <ScrollArea style={{ height: panelHeight }} className="font-mono text-[11px]">
      <div className="py-2 space-y-1">
        {/* Summary bar */}
        <div className="flex items-center gap-4 px-3 pb-2 border-b border-border mb-1">
          {validationResult.errorCount > 0 && (
            <span className="flex items-center gap-1 text-signal-critical">
              <XCircle className="w-3 h-3" />
              {validationResult.errorCount} {t('validation.errors')}
            </span>
          )}
          {validationResult.warningCount > 0 && (
            <span className="flex items-center gap-1 text-signal-warning">
              <AlertTriangle className="w-3 h-3" />
              {validationResult.warningCount} {t('validation.warnings')}
            </span>
          )}
          {validationResult.infoCount > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <Info className="w-3 h-3" />
              {validationResult.infoCount} {t('validation.infos')}
            </span>
          )}
        </div>

        {/* Errors */}
        {grouped.errors.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}

        {/* Warnings */}
        {grouped.warnings.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}

        {/* Infos */}
        {grouped.infos.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </div>
    </ScrollArea>
  );
}
