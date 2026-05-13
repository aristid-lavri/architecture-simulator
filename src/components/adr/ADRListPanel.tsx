'use client';

/**
 * Left-rail list view of all ADRs in the current project — A7.2.
 *
 * Pure consumer of `useAdrStore`. Sorted by ascending ADR number so the
 * sequence reads chronologically. Clicking an entry hands control back to
 * the parent (`ADRDialog`) via the `onOpen` callback.
 */

import { useAdrStore } from '@/store/adr-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n';

export interface ADRListPanelProps {
  onOpen: (adrId: string) => void;
}

export function ADRListPanel({ onOpen }: ADRListPanelProps) {
  const { t } = useTranslation();
  const adrs = useAdrStore((s) => s.adrs);
  const createADR = useAdrStore((s) => s.createADR);

  const sorted = [...adrs].sort((a, b) => a.number - b.number);

  return (
    <div className="flex flex-col gap-3 p-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Decisions
        </h2>
        <Button
          size="sm"
          onClick={() => {
            const id = createADR();
            onOpen(id);
          }}
        >
          {t('adr.list.new')}
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('adr.list.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-auto">
          {sorted.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onOpen(a.id)}
                className="w-full text-left rounded-md px-3 py-2 hover:bg-accent flex items-center justify-between gap-2"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  ADR-{String(a.number).padStart(4, '0')}
                </span>
                <span className="flex-1 truncate text-sm">{a.title || <em>(untitled)</em>}</span>
                <Badge variant={a.status === 'accepted' ? 'default' : 'outline'} className="text-[10px]">
                  {a.status}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
