'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useSimulationStore } from '@/store/simulation-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { useTranslation } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
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
  ChevronDown,
  Trash2,
  Sun,
  Moon,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { architectureTemplates, type ArchitectureTemplate } from '@/data/architecture-templates';
import type { AppMode } from '@/types';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function Header() {
  const { t } = useTranslation();
  const { mode, setMode, toggleComponentsPanel, theme, toggleTheme } =
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
    clearReport,
  } = useSimulationStore();
  const { nodes, edges, setNodes, setEdges, clear } = useArchitectureStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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

  const durationOptions = [
    { value: 'unlimited', label: 'INF' },
    { value: '30', label: '30s' },
    { value: '60', label: '1m' },
    { value: '120', label: '2m' },
    { value: '300', label: '5m' },
  ];

  return (
    <header className="h-8 border-b border-border bg-background flex items-center justify-between px-3 font-mono text-[11px] text-muted-foreground select-none">
      {/* Left: Identity + Mode */}
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <img src="/logo.svg" alt="" className="h-5 w-5" />
              <span className="text-foreground font-display font-semibold tracking-wider text-xs">
                ARCH.SIM
              </span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">Accueil</TooltipContent>
        </Tooltip>
        <span className="text-border">|</span>

        {/* Mode toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                if (mode === 'simulation') {
                  if (simulationState !== 'idle') {
                    stop('manual');
                  }
                  reset();
                  clearReport();
                }
                setMode('edit' as AppMode);
              }}
              className={cn(
                'px-1.5 py-0.5 transition-colors',
                mode === 'edit' ? 'text-foreground' : 'hover:text-foreground/70'
              )}
            >
              EDIT
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Mode édition</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setMode('simulation' as AppMode)}
              className={cn(
                'px-1.5 py-0.5 transition-colors',
                mode === 'simulation' ? 'text-signal-active' : 'hover:text-foreground/70'
              )}
            >
              SIM
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Mode simulation</TooltipContent>
        </Tooltip>
        <span className="text-border">|</span>

        {/* Stats */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>N:{nodes.length}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Nombre de nœuds</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>E:{edges.length}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Nombre de connexions</TooltipContent>
        </Tooltip>
      </div>

      {/* Center: Simulation controls */}
      <div className="flex items-center gap-3" role="toolbar" aria-label="Controles de simulation">
        {mode === 'simulation' && (
          <>
            {/* Duration selector */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 hover:text-foreground transition-colors">
                <span>DUR:{durationOptions.find(d => d.value === (duration?.toString() ?? 'unlimited'))?.label || 'INF'}</span>
                <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-20">
                {durationOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => handleDurationChange(opt.value)}
                    disabled={simulationState !== 'idle'}
                    className="font-mono text-xs"
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-border">|</span>

            {/* Timer */}
            {simulationState !== 'idle' && (
              <>
                <span
                  className={cn(
                    'tabular-nums',
                    simulationState === 'running' && 'text-signal-active signal-pulse'
                  )}
                  aria-live="polite"
                  aria-label={`Temps ecoule: ${formatTime(elapsedSeconds)}`}
                >
                  {formatTime(elapsedSeconds)}
                  {duration && <span className="text-muted-foreground">/{formatTime(duration)}</span>}
                </span>
                <span className="text-border">|</span>
              </>
            )}

            {/* Control buttons */}
            {simulationState === 'running' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={pause}
                    className="flex items-center gap-1 text-signal-active hover:text-signal-active/80 transition-colors"
                    aria-label="Mettre en pause la simulation"
                  >
                    <Pause className="w-3 h-3" />
                    PAUSE
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Mettre en pause</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={start}
                    disabled={simulationState === 'idle' && edges.length === 0}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 transition-opacity",
                      simulationState === 'idle' && edges.length === 0
                        ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                        : 'bg-signal-active text-background hover:opacity-80'
                    )}
                    style={{ borderRadius: '2px' }}
                    aria-label={simulationState === 'paused' ? 'Reprendre la simulation' : 'Demarrer la simulation'}
                  >
                    <Play className="w-3 h-3" />
                    {simulationState === 'paused' ? 'RESUME' : 'START'}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {simulationState === 'idle' && edges.length === 0
                    ? 'Connectez au moins 2 composants'
                    : simulationState === 'paused' ? 'Reprendre la simulation' : 'Démarrer la simulation'}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => stop('manual')}
                  disabled={simulationState === 'idle'}
                  className="flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-30"
                  aria-label="Arreter la simulation"
                >
                  <Square className="w-3 h-3" />
                  STOP
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Arrêter la simulation</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={reset}
                  disabled={simulationState === 'idle'}
                  className="flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-30"
                  aria-label="Reinitialiser la simulation"
                >
                  <RotateCcw className="w-3 h-3" />
                  RST
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Réinitialiser</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Templates */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger className="flex items-center gap-1 hover:text-foreground transition-colors">
                TPL
                <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Templates d&apos;architecture</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="min-w-48">
            {architectureTemplates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className="flex flex-col items-start gap-0.5"
              >
                <span className="font-medium text-xs">{t(template.nameKey)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {t(template.descriptionKey)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-border">|</span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClearCanvas}
              disabled={nodes.length === 0 || mode === 'simulation'}
              className="text-red-500 hover:text-red-400 drop-shadow-[0_0_6px_rgba(255,0,0,0.8)] transition-colors disabled:opacity-30"
              aria-label="Vider le canvas"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Vider le canvas</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/docs"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              aria-label="Documentation"
              target="_blank"
            >
              <BookOpen className="w-3 h-3" />
              DOCS
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">Documentation</TooltipContent>
        </Tooltip>

        {mounted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className="hover:text-foreground transition-colors"
                aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
              >
                {theme === 'dark' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleComponentsPanel}
              className="hover:text-foreground transition-colors"
              aria-label="Afficher/masquer le panneau de composants"
            >
              RACK
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Panneau de composants</TooltipContent>
        </Tooltip>
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
              Cette action supprimera tous les composants et connexions. Cette action est irréversible.
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
