'use client';

/**
 * "Related ADRs" subsection inside the PropertiesPanel — A7.2.
 *
 * Given a selected graph element (`node` or `edge`) it lists the ADRs that
 * already link to it and offers a picker to add a new link. Removing a link
 * is one click on the small "x" trailing each entry.
 */

import { useAdrStore } from '@/store/adr-store';
import { useTranslation } from '@/i18n';
import { Badge } from '@/components/ui/badge';

export interface RelatedADRsSectionProps {
  elementKind: 'node' | 'edge';
  elementId: string;
}

export function RelatedADRsSection({ elementKind, elementId }: RelatedADRsSectionProps) {
  const { t } = useTranslation();
  const adrs = useAdrStore((s) => s.adrs);
  const addLink = useAdrStore((s) => s.addLink);
  const removeLink = useAdrStore((s) => s.removeLink);

  const linked = adrs.filter((a) =>
    (a.links ?? []).some((l) => l.kind === elementKind && l.targetId === elementId),
  );
  const unlinked = adrs.filter((a) => !linked.includes(a));

  return (
    <div data-section="related-adrs" className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        {t('adr.related.title')}
      </h3>
      {linked.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{t('adr.related.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {linked.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-mono text-xs">ADR-{String(a.number).padStart(4, '0')}</span>
              <span className="flex-1 truncate">{a.title || '(untitled)'}</span>
              <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
              <button
                type="button"
                onClick={() => removeLink(a.id, { kind: elementKind, targetId: elementId })}
                aria-label="unlink"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {unlinked.length > 0 && (
        <div className="space-y-1">
          <label htmlFor={`adr-picker-${elementId}`} className="text-[11px] text-muted-foreground">
            {t('adr.related.link')}
          </label>
          <select
            id={`adr-picker-${elementId}`}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              addLink(e.target.value, { kind: elementKind, targetId: elementId });
              e.target.value = '';
            }}
          >
            <option value="">—</option>
            {unlinked.map((a) => (
              <option key={a.id} value={a.id}>
                ADR-{String(a.number).padStart(4, '0')} — {a.title || '(untitled)'}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
