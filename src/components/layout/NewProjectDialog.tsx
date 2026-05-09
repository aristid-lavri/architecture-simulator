'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/store/project-store';
import { useLicenseStore } from '@/lib/license';
import {
  projectKindRegistry,
  DEFAULT_PROJECT_KIND,
  type ProjectKindDefinition,
} from '@/plugins/extensions';
import { useTranslation } from '@/i18n';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si vrai, le dialog ne peut pas être fermé sans créer un projet (cas démarrage initial). */
  required?: boolean;
}

function resolveLabel(s: string | undefined, t: (k: string) => string, fallback: string): string {
  if (!s) return fallback;
  if (s.includes('.')) {
    const translated = t(s);
    return translated === s ? fallback : translated;
  }
  return s;
}

export function NewProjectDialog({ open, onOpenChange, required }: NewProjectDialogProps) {
  const { t } = useTranslation();
  const tier = useLicenseStore((s) => s.tier);
  const isEnterprise = tier === 'enterprise';
  const createProject = useProjectStore((s) => s.createProject);

  // Re-rend automatiquement quand un plugin (re)enregistre des kinds.
  const kinds = useSyncExternalStore(
    (cb) => projectKindRegistry.subscribe(cb),
    () => projectKindRegistry.list(),
    () => projectKindRegistry.list(),
  );

  const defaultSelection = useMemo(() => {
    const free = kinds.find((k) => k.id === DEFAULT_PROJECT_KIND);
    return free?.id ?? kinds[0]?.id ?? DEFAULT_PROJECT_KIND;
  }, [kinds]);

  const [selection, setSelection] = useState<string>(defaultSelection);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelection(defaultSelection);
      setName('');
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open, defaultSelection]);

  const selected = kinds.find((k) => k.id === selection);
  const selectionGated = !!(selected?.requiresLicense && !isEnterprise);
  const canCreate = !selectionGated;

  function handleCreate() {
    if (!canCreate) return;
    const projectName = name.trim() || resolveLabel(undefined, t, 'Nouveau projet');
    createProject(projectName, selection);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next && required) return;
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl"
        // Empêche la fermeture par clic extérieur ou Escape quand requis.
        onPointerDownOutside={(e) => required && e.preventDefault()}
        onEscapeKeyDown={(e) => required && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Nouveau projet</DialogTitle>
        </DialogHeader>

        <div
          className={`grid gap-4 py-4 ${
            kinds.length <= 1 ? 'grid-cols-1' : kinds.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
          }`}
        >
          {kinds.map((kind) => {
            const gated = !!(kind.requiresLicense && !isEnterprise);
            const label = resolveLabel(kind.label, t, kind.id);
            const description = resolveLabel(kind.description, t, '');
            const isSelected = selection === kind.id;
            return (
              <button
                key={kind.id}
                type="button"
                onClick={() => setSelection(kind.id)}
                className={[
                  'relative flex flex-col items-center gap-2 p-6 border rounded-md transition-colors text-left cursor-pointer',
                  isSelected
                    ? 'border-signal-active bg-signal-active/5'
                    : 'border-border hover:border-foreground/30',
                  gated ? 'opacity-80' : '',
                ].join(' ')}
              >
                {kind.requiresLicense && (
                  <Badge
                    variant="secondary"
                    className="absolute top-2 right-2 text-[9px] uppercase tracking-wider"
                  >
                    {isEnterprise ? 'Enterprise' : 'Enterprise · upgrade requis'}
                  </Badge>
                )}
                <div className="w-8 h-8 flex items-center justify-center text-foreground">
                  {kind.icon ?? <Pencil className="w-8 h-8" />}
                </div>
                <span className="font-display font-semibold text-sm">{label}</span>
                {description && (
                  <span className="text-[11px] text-muted-foreground text-center">
                    {description}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-project-name">Nom du projet</Label>
          <Input
            id="new-project-name"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) handleCreate();
            }}
            placeholder="Mon architecture"
          />
        </div>

        {selectionGated && (
          <p className="text-[11px] text-signal-warning">
            La création d&apos;un projet {resolveLabel(selected?.label, t, selection)} nécessite une
            licence Enterprise.
          </p>
        )}

        <DialogFooter>
          {!required && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
          )}
          <Button onClick={handleCreate} disabled={!canCreate}>
            Créer le projet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
