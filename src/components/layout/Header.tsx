'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useSimulationStore } from '@/store/simulation-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Save,
  FolderOpen,
  PanelRight,
  Settings2,
  Clock,
  Timer,
  LayoutTemplate,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { architectureTemplates, type ArchitectureTemplate } from '@/data/architecture-templates';
import type { AppMode } from '@/types';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function Header() {
  const { t } = useTranslation();
  const { mode, setMode, toggleComponentsPanel, isComponentsPanelOpen } =
    useAppStore();
  const {
    state: simulationState,
    start,
    pause,
    stop,
    reset,
    duration,
    setDuration,
    updateElapsedTime,
    metrics,
  } = useSimulationStore();
  const { nodes, setNodes, setEdges, clear } = useArchitectureStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<ArchitectureTemplate | null>(null);

  const handleTemplateSelect = (template: ArchitectureTemplate) => {
    if (nodes.length > 0) {
      setPendingTemplate(template);
      setConfirmDialogOpen(true);
    } else {
      applyTemplate(template);
    }
  };

  const applyTemplate = (template: ArchitectureTemplate) => {
    setNodes(template.nodes);
    setEdges(template.edges);
    setPendingTemplate(null);
  };

  const confirmTemplateApply = () => {
    if (pendingTemplate) {
      applyTemplate(pendingTemplate);
    }
    setConfirmDialogOpen(false);
  };

  const handleClearCanvas = () => {
    if (nodes.length > 0) {
      setClearDialogOpen(true);
    }
  };

  const confirmClear = () => {
    clear();
    setClearDialogOpen(false);
  };

  // Timer effect
  useEffect(() => {
    if (simulationState === 'running') {
      timerRef.current = setInterval(() => {
        if (metrics.startTime) {
          const elapsed = Math.floor((Date.now() - metrics.startTime) / 1000);
          setElapsedSeconds(elapsed);
          updateElapsedTime(elapsed * 1000);

          // Check if duration limit reached
          if (duration && elapsed >= duration) {
            stop('timeout');
          }
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (simulationState === 'idle') {
        setElapsedSeconds(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [simulationState, duration, metrics.startTime, stop, updateElapsedTime]);

  const handleDurationChange = (value: string) => {
    if (value === 'unlimited') {
      setDuration(null);
    } else {
      setDuration(parseInt(value, 10));
    }
  };

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4">
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Architecture Simulator</span>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-4">
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as AppMode)}
        >
          <TabsList>
            <TabsTrigger value="edit" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Édition
            </TabsTrigger>
            <TabsTrigger value="simulation" className="gap-2">
              <Play className="h-4 w-4" />
              Simulation
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'simulation' && (
          <>
            <Separator orientation="vertical" className="h-6" />

            {/* Duration Selector */}
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <Select
                value={duration?.toString() ?? 'unlimited'}
                onValueChange={handleDurationChange}
                disabled={simulationState !== 'idle'}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue placeholder="Durée" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlimited">Illimitée</SelectItem>
                  <SelectItem value="30">30 sec</SelectItem>
                  <SelectItem value="60">1 min</SelectItem>
                  <SelectItem value="120">2 min</SelectItem>
                  <SelectItem value="300">5 min</SelectItem>
                  <SelectItem value="600">10 min</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Timer Display */}
            {simulationState !== 'idle' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md font-mono text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatTime(elapsedSeconds)}</span>
                {duration && (
                  <span className="text-muted-foreground">/ {formatTime(duration)}</span>
                )}
              </div>
            )}

            <Separator orientation="vertical" className="h-6" />

            {/* Simulation Controls */}
            <div className="flex items-center gap-2">
              {simulationState === 'running' ? (
                <Button size="sm" variant="default" className="gap-2" onClick={pause}>
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              ) : (
                <Button size="sm" variant="default" className="gap-2" onClick={start}>
                  <Play className="h-4 w-4" />
                  Démarrer
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => stop('manual')}
                disabled={simulationState === 'idle'}
              >
                <Square className="h-4 w-4" />
                Arrêter
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={reset}
                disabled={simulationState === 'idle'}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Templates Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <LayoutTemplate className="h-4 w-4" />
              {t('templates.title')}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {architectureTemplates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className="flex flex-col items-start gap-1"
              >
                <span className="font-medium">{t(template.nameKey)}</span>
                <span className="text-xs text-muted-foreground">
                  {t(template.descriptionKey)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" title="Ouvrir">
          <FolderOpen className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" title="Sauvegarder">
          <Save className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Vider le canvas"
          onClick={handleClearCanvas}
          disabled={nodes.length === 0 || mode === 'simulation'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant={isComponentsPanelOpen ? 'secondary' : 'ghost'}
          size="icon"
          title="Panneau des composants"
          onClick={toggleComponentsPanel}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Template Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('templates.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('templates.confirmReplace')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTemplateApply}>
              {t('common.open')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Canvas Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider le canvas</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera tous les composants et connexions de l'éditeur. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Vider
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
