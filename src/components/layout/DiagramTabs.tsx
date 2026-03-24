'use client';

import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useSimulationStore } from '@/store/simulation-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Copy, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DiagramTabs() {
  const {
    activeDiagramId,
    switchDiagram,
    createDiagram,
    renameDiagram,
    deleteDiagram,
    duplicateDiagram,
    getActiveDiagrams,
    initialized,
  } = useProjectStore();

  const simulationState = useSimulationStore((s) => s.state);
  const stop = useSimulationStore((s) => s.stop);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState('');

  const renameInputRef = useRef<HTMLInputElement>(null);

  const diagrams = getActiveDiagrams();

  useEffect(() => {
    if (renameDialogOpen) {
      const t = setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [renameDialogOpen]);

  if (!initialized || diagrams.length === 0) return null;

  const stopSimIfRunning = () => {
    if (simulationState !== 'idle') {
      stop('manual');
    }
  };

  const handleSwitch = (id: string) => {
    if (id === activeDiagramId) return;
    stopSimIfRunning();
    switchDiagram(id);
  };

  const handleCreate = () => {
    stopSimIfRunning();
    createDiagram(`Diagramme ${diagrams.length + 1}`);
  };

  const openRename = (id: string, name: string) => {
    setRenameTargetId(id);
    setRenameValue(name);
    setRenameDialogOpen(true);
  };

  const confirmRename = () => {
    if (renameTargetId && renameValue.trim()) {
      renameDiagram(renameTargetId, renameValue.trim());
    }
    setRenameDialogOpen(false);
  };

  const openDelete = (id: string, name: string) => {
    if (diagrams.length <= 1) return;
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      stopSimIfRunning();
      deleteDiagram(deleteTargetId);
    }
    setDeleteDialogOpen(false);
  };

  const handleDuplicate = (id: string) => {
    stopSimIfRunning();
    duplicateDiagram(id);
  };

  return (
    <>
      <div className="h-7 border-b border-border bg-background/80 flex items-center px-2 gap-0.5 font-mono text-[11px] text-muted-foreground select-none overflow-x-auto scrollbar-none" data-tour="diagram-tabs">
        {diagrams.map((d) => (
          <div
            key={d.id}
            className={cn(
              'flex items-center rounded-t-sm transition-colors',
              d.id === activeDiagramId
                ? 'bg-muted/60 border-b-2 border-signal-active'
                : 'hover:bg-muted/50'
            )}
          >
            {/* Left-click switches diagram */}
            <button
              onClick={() => handleSwitch(d.id)}
              className={cn(
                'px-2.5 py-1 whitespace-nowrap cursor-pointer transition-colors',
                d.id === activeDiagramId
                  ? 'text-foreground'
                  : 'hover:text-foreground/70'
              )}
            >
              {d.name}
            </button>

            {/* Actions menu via "..." button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-0.5 mr-0.5 rounded-sm hover:bg-accent hover:text-accent-foreground opacity-0 group-hover:opacity-100 hover:opacity-100! transition-opacity cursor-pointer shrink-0"
                  style={{ opacity: d.id === activeDiagramId ? 0.5 : 0 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = d.id === activeDiagramId ? '0.5' : '0'; }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-35">
                <DropdownMenuItem onClick={() => openRename(d.id, d.name)}>
                  <Pencil className="w-3 h-3 mr-2" />
                  Renommer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDuplicate(d.id)}>
                  <Copy className="w-3 h-3 mr-2" />
                  Dupliquer
                </DropdownMenuItem>
                {diagrams.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => openDelete(d.id, d.name)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        <button
          onClick={handleCreate}
          className="px-1.5 py-1 hover:bg-muted/50 rounded-sm transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          title="Nouveau diagramme"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Rename dialog */}
      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renommer le diagramme</AlertDialogTitle>
            <AlertDialogDescription>
              Entrez le nouveau nom du diagramme.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmRename();
            }}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRename}>
              Renommer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le diagramme</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer &quot;{deleteTargetName}&quot; ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
