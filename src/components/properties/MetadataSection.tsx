'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n';
import type { GraphNode, NodeMetadata } from '@/types/graph';
import { cn } from '@/lib/utils';

/**
 * Bloc transverse de métadonnées documentaires (A7.1 + A7.4).
 *
 * Why : les utilisateurs veulent annoter leur architecture (notes de design, propriétaires,
 * dernière revue) sans contaminer le `data` qui pilote la simulation. Composant standalone
 * pour qu'on puisse l'insérer dans n'importe quelle branche du PropertiesPanel sans dupliquer
 * la logique de gestion d'état / nettoyage des champs vides.
 *
 * Convention de stockage : tout champ vide est stocké en `undefined` (pas en string vide).
 * Quand tous les champs sont undefined, `metadata` lui-même est mis à `undefined` —
 * sérialisation YAML/JSON propre, pas de pollution de diffs avec des `metadata: {}` partout.
 *
 * Le composant n'édite **jamais** `data` — uniquement `metadata`. L'orchestrateur passe un
 * `onChange` qui reçoit un patch `Partial<GraphNode>` (typiquement `{ metadata: NewMeta }`).
 */
export interface MetadataSectionProps {
  node: GraphNode;
  onChange: (patch: Partial<GraphNode>) => void;
  /** Section repliée par défaut ? Default `true` — la majorité des nœuds n'auront pas de méta. */
  defaultCollapsed?: boolean;
  className?: string;
}

/**
 * Normalise une valeur string : trim + retourne `undefined` si vide.
 * Garde la sérialisation propre (pas de `"notes": ""` dans le localStorage / YAML).
 */
function normalizeString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Parse une string CSV → string[] dédupliquée et trim. Empty input → `undefined`.
 * Pas de validation au-delà du non-empty trim (cf. brief).
 */
function parseTagsInput(value: string): string[] | undefined {
  const tags = value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tags.length === 0) return undefined;
  // Déduplication conservant l'ordre (au cas où l'utilisateur tape « foo, foo »)
  return Array.from(new Set(tags));
}

/**
 * Applique un patch `Partial<NodeMetadata>` à la metadata existante en supprimant
 * les clés `undefined`. Si le résultat est vide → renvoie `undefined` (et donc
 * `metadata` lui-même sera `undefined` côté GraphNode).
 */
function applyMetadataPatch(
  current: NodeMetadata | undefined,
  patch: Partial<NodeMetadata>,
): NodeMetadata | undefined {
  const merged: NodeMetadata = { ...(current ?? {}), ...patch };

  // Drop top-level undefined keys
  (Object.keys(merged) as (keyof NodeMetadata)[]).forEach((k) => {
    if (merged[k] === undefined) delete merged[k];
  });

  // Nested cleanup for `owner`
  if (merged.owner) {
    const owner = { ...merged.owner };
    if (!owner.team) delete owner.team;
    if (!owner.individual) delete owner.individual;
    if (Object.keys(owner).length === 0) {
      delete merged.owner;
    } else {
      merged.owner = owner;
    }
  }

  return Object.keys(merged).length === 0 ? undefined : merged;
}

export function MetadataSection({ node, onChange, defaultCollapsed = true, className }: MetadataSectionProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const metadata = node.metadata;

  // Local state for the tags Input so the user can type commas freely (we only
  // persist the parsed array). Initialized from current tags joined.
  const initialTagsValue = useMemo(() => (metadata?.tags ?? []).join(', '), [metadata?.tags]);
  const [tagsDraft, setTagsDraft] = useState(initialTagsValue);

  function update(patch: Partial<NodeMetadata>) {
    const next = applyMetadataPatch(metadata, patch);
    onChange({ metadata: next });
  }

  const headingId = `metadata-heading-${node.id}`;

  return (
    <div data-section="metadata" className={cn('space-y-3', className)}>
      <button
        type="button"
        id={headingId}
        aria-expanded={!collapsed}
        aria-controls={`metadata-body-${node.id}`}
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {t('metadata.section')}
      </button>
      <Separator />

      {!collapsed && (
        <div
          id={`metadata-body-${node.id}`}
          role="region"
          aria-labelledby={headingId}
          className="space-y-4"
        >
          <p className="text-[11px] text-muted-foreground/80 leading-snug">
            {t('metadata.sectionDescription')}
          </p>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor={`meta-notes-${node.id}`}>{t('metadata.notes')}</Label>
            <textarea
              id={`meta-notes-${node.id}`}
              value={metadata?.notes ?? ''}
              onChange={(e) => update({ notes: normalizeString(e.target.value) })}
              placeholder={t('metadata.notesPlaceholder')}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Tags (CSV input → string[]) */}
          <div className="space-y-2">
            <Label htmlFor={`meta-tags-${node.id}`}>{t('metadata.tags')}</Label>
            <Input
              id={`meta-tags-${node.id}`}
              value={tagsDraft}
              onChange={(e) => {
                setTagsDraft(e.target.value);
                update({ tags: parseTagsInput(e.target.value) });
              }}
              placeholder={t('metadata.tagsPlaceholder')}
              aria-describedby={`meta-tags-help-${node.id}`}
            />
            <p
              id={`meta-tags-help-${node.id}`}
              className="text-[11px] text-muted-foreground/70 leading-snug"
            >
              {t('metadata.tagsHelp')}
            </p>
            {metadata?.tags && metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1" role="list">
                {metadata.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    <span>{tag}</span>
                    <button
                      type="button"
                      aria-label={`${tag} — remove`}
                      onClick={() => {
                        const next = metadata.tags!.filter((tt) => tt !== tag);
                        const nextValue = next.length > 0 ? next : undefined;
                        setTagsDraft(next.join(', '));
                        update({ tags: nextValue });
                      }}
                      className="rounded-sm hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Last reviewed */}
          <div className="space-y-2">
            <Label htmlFor={`meta-last-reviewed-${node.id}`}>{t('metadata.lastReviewed')}</Label>
            <Input
              id={`meta-last-reviewed-${node.id}`}
              type="date"
              value={metadata?.lastReviewed ?? ''}
              onChange={(e) => update({ lastReviewed: normalizeString(e.target.value) })}
            />
          </div>

          {/* Owner — team */}
          <div className="space-y-2">
            <Label htmlFor={`meta-owner-team-${node.id}`}>{t('metadata.owner.team')}</Label>
            <Input
              id={`meta-owner-team-${node.id}`}
              value={metadata?.owner?.team ?? ''}
              onChange={(e) => {
                const team = normalizeString(e.target.value);
                const owner = { ...(metadata?.owner ?? {}), team };
                update({ owner });
              }}
              placeholder={t('metadata.owner.teamPlaceholder')}
            />
          </div>

          {/* Owner — individual */}
          <div className="space-y-2">
            <Label htmlFor={`meta-owner-individual-${node.id}`}>
              {t('metadata.owner.individual')}
            </Label>
            <Input
              id={`meta-owner-individual-${node.id}`}
              value={metadata?.owner?.individual ?? ''}
              onChange={(e) => {
                const individual = normalizeString(e.target.value);
                const owner = { ...(metadata?.owner ?? {}), individual };
                update({ owner });
              }}
              placeholder={t('metadata.owner.individualPlaceholder')}
            />
          </div>
        </div>
      )}
    </div>
  );
}
