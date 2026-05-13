'use client';

/**
 * ADR editor pane — A7.2.
 *
 * Single-pane form bound to one ADR (by id) in `useAdrStore`. All field
 * changes are pushed back to the store immediately (no draft state) so
 * persistence + cross-component reactivity is automatic.
 */

import { useAdrStore } from '@/store/adr-store';
import { useTranslation } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { ADRStatus } from '@/types/adr';

const STATUSES: ADRStatus[] = ['proposed', 'accepted', 'superseded', 'deprecated'];

export interface ADREditorProps {
  adrId: string;
}

export function ADREditor({ adrId }: ADREditorProps) {
  const { t } = useTranslation();
  const adr = useAdrStore((s) => s.adrs.find((a) => a.id === adrId));
  const updateADR = useAdrStore((s) => s.updateADR);

  if (!adr) return <p className="text-sm text-muted-foreground">{t('adr.notFound')}</p>;

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">ADR-{String(adr.number).padStart(4, '0')}</Badge>
        <Badge variant={adr.status === 'accepted' ? 'default' : 'outline'}>{adr.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`adr-title-${adr.id}`}>{t('adr.fields.title')}</Label>
          <Input
            id={`adr-title-${adr.id}`}
            value={adr.title}
            onChange={(e) => updateADR(adr.id, { title: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`adr-date-${adr.id}`}>{t('adr.fields.date')}</Label>
          <Input
            id={`adr-date-${adr.id}`}
            type="date"
            value={adr.date}
            onChange={(e) => updateADR(adr.id, { date: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`adr-status-${adr.id}`}>{t('adr.fields.status')}</Label>
          <select
            id={`adr-status-${adr.id}`}
            value={adr.status}
            onChange={(e) => updateADR(adr.id, { status: e.target.value as ADRStatus })}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`adr-author-${adr.id}`}>{t('adr.fields.author')}</Label>
          <Input
            id={`adr-author-${adr.id}`}
            value={adr.author ?? ''}
            onChange={(e) => updateADR(adr.id, { author: e.target.value || undefined })}
          />
        </div>
      </div>

      {(['context', 'decision', 'consequences', 'alternatives'] as const).map((field) => (
        <div key={field} className="space-y-1">
          <Label htmlFor={`adr-${field}-${adr.id}`}>{t(`adr.fields.${field}`)}</Label>
          <textarea
            id={`adr-${field}-${adr.id}`}
            value={adr[field] ?? ''}
            onChange={(e) => updateADR(adr.id, { [field]: e.target.value })}
            rows={field === 'alternatives' ? 3 : 5}
            className="w-full rounded-md border border-input bg-background p-2 text-sm font-mono"
          />
        </div>
      ))}

      <div className="space-y-1">
        <Label htmlFor={`adr-tags-${adr.id}`}>{t('adr.fields.tags')}</Label>
        <Input
          id={`adr-tags-${adr.id}`}
          value={(adr.tags ?? []).join(', ')}
          onChange={(e) => {
            const tags = e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean);
            updateADR(adr.id, { tags: tags.length > 0 ? Array.from(new Set(tags)) : undefined });
          }}
          placeholder="payment, pci, critical"
        />
      </div>
    </div>
  );
}
