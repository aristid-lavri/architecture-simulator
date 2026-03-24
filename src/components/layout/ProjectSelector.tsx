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
import { ChevronDown, Plus, Copy, Pencil, Trash2, FolderOpen, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProjectSelector() {
  const {
    projectsMeta,
    activeProjectId,
    switchProject,
    createProject,
    renameProject,
    deleteProject,
    duplicateProject,
    getActiveProjectName,
    initialized,
  } = useProjectStore();

  const simulationState = useSimulationStore((s) => s.state);
  const stop = useSimulationStore((s) => s.stop);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState('');
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [listOpen, setListOpen] = useState(false);

  const newInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const projectName = getActiveProjectName();

  useEffect(() => {
    if (newProjectDialogOpen) {
      const t = setTimeout(() => newInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [newProjectDialogOpen]);

  useEffect(() => {
    if (renameDialogOpen) {
      const t = setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [renameDialogOpen]);

  if (!initialized) return null;

  const stopSimIfRunning = () => {
    if (simulationState !== 'idle') {
      stop('manual');
    }
  };

  const handleSwitch = (id: string) => {
    if (id === activeProjectId) return;
    stopSimIfRunning();
    switchProject(id);
    setListOpen(false);
  };

  const handleCreate = () => {
    setNewProjectName('');
    setNewProjectDialogOpen(true);
    setListOpen(false);
  };

  const confirmCreate = () => {
    const name = newProjectName.trim() || 'Nouveau Projet';
    stopSimIfRunning();
    createProject(name);
    setNewProjectDialogOpen(false);
  };

  const openRename = (id: string, name: string) => {
    setRenameTargetId(id);
    setRenameValue(name);
    setRenameDialogOpen(true);
  };

  const confirmRename = () => {
    if (renameTargetId && renameValue.trim()) {
      renameProject(renameTargetId, renameValue.trim());
    }
    setRenameDialogOpen(false);
  };

  const openDelete = (id: string, name: string) => {
    if (projectsMeta.length <= 1) return;
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      stopSimIfRunning();
      deleteProject(deleteTargetId);
    }
    setDeleteDialogOpen(false);
  };

  const handleDuplicate = (id: string) => {
    duplicateProject(id);
  };

  return (
    <>
      {/* Main project dropdown: left-click to list & switch */}
      <DropdownMenu open={listOpen} onOpenChange={setListOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 px-1.5 py-0.5 hover:text-foreground transition-colors cursor-pointer max-w-[160px]">
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span className="truncate">{projectName}</span>
            <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-50">
          {/* Project list — left-click switches */}
          {projectsMeta.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-1 pr-1',
                p.id === activeProjectId && 'bg-muted rounded-sm'
              )}
            >
              <button
                onClick={() => handleSwitch(p.id)}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left min-w-0"
              >
                <FolderOpen className="w-3 h-3 shrink-0" />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto text-muted-foreground text-[10px] shrink-0">{p.diagramCount}d</span>
              </button>

              {/* Per-project actions menu (right "..." button) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded-sm hover:bg-accent hover:text-accent-foreground opacity-50 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right" className="min-w-35">
                  <DropdownMenuItem onClick={() => openRename(p.id, p.name)}>
                    <Pencil className="w-3 h-3 mr-2" />
                    Renommer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDuplicate(p.id)}>
                    <Copy className="w-3 h-3 mr-2" />
                    Dupliquer
                  </DropdownMenuItem>
                  {projectsMeta.length > 1 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openDelete(p.id, p.name)}
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

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleCreate}>
            <Plus className="w-3 h-3 mr-2" />
            Nouveau projet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renommer le projet</AlertDialogTitle>
            <AlertDialogDescription>
              Entrez le nouveau nom du projet.
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
            <AlertDialogTitle>Supprimer le projet</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer &quot;{deleteTargetName}&quot; et tous ses diagrammes ? Cette action est irr&eacute;versible.
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

      {/* New project dialog */}
      <AlertDialog open={newProjectDialogOpen} onOpenChange={setNewProjectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nouveau projet</AlertDialogTitle>
            <AlertDialogDescription>
              Entrez un nom pour le nouveau projet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            ref={newInputRef}
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmCreate();
            }}
            placeholder="Nouveau Projet"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCreate}>
              Cr&eacute;er
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
