'use client';

import { useState } from 'react';
import { applyCustomRulesPack, type CustomRulesError, type ApplyResult } from '@/lib/rules-engine/custom';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';

/**
 * Custom Rules editor panel (A6.2).
 *
 * Displays a textarea for the project's custom-rules YAML DSL and an "Apply" button.
 * On apply, the YAML is parsed + compiled + registered into the global rules registry
 * (replacing the previous `project-custom` pack). Errors are rendered inline.
 *
 * The optional `initialYaml` prop seeds the textarea (typically with the current
 * `projectMeta.customRulesYaml`). The optional `onApply` callback is invoked after
 * a successful apply with the YAML that was applied; integrators wire this to the
 * architecture store action that persists `customRulesYaml`. If no `onApply` is
 * provided, the registry is still updated but the YAML is not persisted anywhere —
 * useful for ephemeral previews and for tests that don't require store wiring.
 */
export interface CustomRulesPanelProps {
  /** Seed the textarea — typically the persisted YAML. */
  initialYaml?: string;
  /** Called with the applied YAML when compilation succeeds. */
  onApply?: (yaml: string, result: ApplyResult) => void;
}

export function CustomRulesPanel({ initialYaml = '', onApply }: CustomRulesPanelProps) {
  const { t } = useTranslation();

  const [draft, setDraft] = useState(initialYaml);
  const [errors, setErrors] = useState<CustomRulesError[]>([]);
  const [count, setCount] = useState<number | null>(null);

  function handleApply() {
    const out = applyCustomRulesPack(draft);
    setErrors(out.errors);
    if (out.ok) {
      setCount(out.rulesCount);
      onApply?.(draft, out);
    } else {
      setCount(null);
    }
  }

  const appliedSuccessRaw = t('rules.custom.appliedSuccess');
  // t() returns the key name if missing — fall back to a sensible English template.
  const appliedSuccessTemplate =
    appliedSuccessRaw === 'rules.custom.appliedSuccess'
      ? '{count} rule(s) compiled and applied'
      : appliedSuccessRaw;
  const appliedSuccess = appliedSuccessTemplate.replace('{count}', String(count ?? 0));

  const titleText = t('rules.custom.title');
  const title = titleText === 'rules.custom.title' ? 'Custom rules' : titleText;

  const descriptionText = t('rules.custom.description');
  const description =
    descriptionText === 'rules.custom.description'
      ? 'YAML DSL for project-specific architecture rules.'
      : descriptionText;

  const yamlLabelText = t('rules.custom.yamlLabel');
  const yamlLabel =
    yamlLabelText === 'rules.custom.yamlLabel' ? 'Custom rules YAML' : yamlLabelText;

  const applyText = t('rules.custom.apply');
  const applyLabel = applyText === 'rules.custom.apply' ? 'Apply' : applyText;

  return (
    <div className="flex flex-col gap-3 p-4 h-full">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <p className="text-xs text-muted-foreground leading-snug">
        {description}
      </p>
      <textarea
        aria-label={yamlLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="flex-1 font-mono text-xs rounded-md border bg-background p-2 min-h-[300px]"
        spellCheck={false}
      />
      <div className="flex items-center gap-2">
        <Button onClick={handleApply} size="sm">
          {applyLabel}
        </Button>
        {count !== null && errors.length === 0 && (
          <span className="text-xs text-green-600">{appliedSuccess}</span>
        )}
      </div>
      {errors.length > 0 && (
        <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-auto">
          {errors.map((e, i) => (
            <li key={i}>
              {e.ruleId ? `[${e.ruleId}] ` : ''}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
