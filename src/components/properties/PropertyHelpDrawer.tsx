'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useTranslation } from '@/i18n';
import { resolveDocText } from '@/lib/doc-text';
import { componentDocs } from '@/data/docs-data';
import { getDocEntry } from '@/_ds';
import type { DocEntry, DocSection } from '@/data/docs-types';
import { DocScreenshotGallery } from '@/components/docs/DocScreenshot';
import { cn } from '@/lib/utils';

export interface PropertyHelpDrawerProps {
  /** Ouvre/ferme le drawer. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Identifiant du composant CE ou de la feature EE (matche `DocEntry.type` ou `DocEntry.id`). */
  entryId: string;
  /** Nom de la section à afficher en priorité (matche `DocSection.name`). Si absent → vue d'ensemble. */
  sectionName?: string;
}

/**
 * Drawer d'aide riche pour le Properties Panel.
 *
 * Lookup d'entrée :
 *   1. EE registry (`getDocEntry(entryId)`) — peuplé en build enterprise + licence active.
 *   2. CE built-in (`componentDocs`) — fallback toujours disponible.
 *
 * Affichage :
 *   - Titre + description courte de l'entrée.
 *   - Si `sectionName` → focus sur cette section (description + table de propriétés + screenshots).
 *   - Sinon : aperçu général (premier screenshot top-level + lien vers /docs#<id>).
 *   - Footer : « Voir tout dans /docs » + lien optionnel vers la référence dev.
 */
export function PropertyHelpDrawer({
  open,
  onOpenChange,
  entryId,
  sectionName,
}: PropertyHelpDrawerProps) {
  const { t } = useTranslation();

  const entry: DocEntry | undefined = useMemo(() => {
    return getDocEntry(entryId) ?? componentDocs.find((c) => c.type === entryId || c.id === entryId);
  }, [entryId]);

  const section: DocSection | undefined = useMemo(() => {
    if (!entry || !sectionName) return undefined;
    return entry.sections.find((s) => s.name === sectionName || s.nameKey === sectionName);
  }, [entry, sectionName]);

  if (!entry) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[420px] sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>Documentation indisponible</SheetTitle>
            <SheetDescription>
              Aucune entrée de doc trouvée pour <code>{entryId}</code>.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const title = entry.titleKey ? resolveDocText(entry.titleKey, t) : entry.name;
  const description = entry.descriptionKey ? resolveDocText(entry.descriptionKey, t) : entry.description;
  const docsHref = `/docs#component-${entry.name.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-xs text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Section ciblée */}
          {section && (
            <div>
              <h3 className="text-[10px] font-mono uppercase font-semibold text-muted-foreground mb-2">
                {section.nameKey ? resolveDocText(section.nameKey, t) : section.name}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {section.descriptionKey ? resolveDocText(section.descriptionKey, t) : section.description}
              </p>

              {section.properties.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground/70 text-left">
                        <th className="pb-2 pr-3 text-[8px] uppercase">Champ</th>
                        <th className="pb-2 pr-3 text-[8px] uppercase">Défaut</th>
                        <th className="pb-2 text-[8px] uppercase">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {section.properties.map((prop) => (
                        <tr key={prop.name}>
                          <td className="py-1.5 pr-3 text-foreground font-medium whitespace-nowrap">{prop.name}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{prop.defaultValue}</td>
                          <td className="py-1.5 text-muted-foreground">
                            {prop.descriptionKey ? resolveDocText(prop.descriptionKey, t) : prop.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {section.screenshots && section.screenshots.length > 0 && (
                <div className="mt-3">
                  <DocScreenshotGallery screenshots={section.screenshots} />
                </div>
              )}
            </div>
          )}

          {/* Vue d'ensemble (sans section ciblée) */}
          {!section && entry.screenshots && entry.screenshots.length > 0 && (
            <DocScreenshotGallery screenshots={entry.screenshots} />
          )}

          {/* Footer : liens */}
          <div className="pt-3 border-t border-border/30 flex flex-col gap-1.5 text-[11px] font-mono">
            <Link
              href={docsHref}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors',
              )}
            >
              Voir tout dans /docs
              <ExternalLink className="w-3 h-3" />
            </Link>
            {entry.referenceDoc && (
              <a
                href={entry.referenceDoc}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Référence technique
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
