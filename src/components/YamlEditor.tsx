'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useArchitectureStore } from '@/store/architecture-store';
import { parseYamlArchitecture } from '@/lib/yaml-parser';
import { exportToYaml } from '@/lib/yaml-exporter';
import { Upload, Download, Play, AlertTriangle, Check, FileDown, Copy, X } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface YamlEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContent?: string;
}

// ── Line Numbers Gutter ──
function LineNumbers({ count, activeLines }: { count: number; activeLines?: Set<number> }) {
  return (
    <div className="yaml-gutter select-none pr-2 text-right font-mono text-[9px] text-muted-foreground/30 leading-relaxed pt-2.75 pb-3">
      {Array.from({ length: Math.max(count, 1) }, (_, i) => (
        <div
          key={i + 1}
          className={activeLines?.has(i + 1) ? 'text-signal-critical' : ''}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}

// ── Toolbar Button ──
function ToolbarAction({ icon: Icon, label, shortLabel, onClick, variant = 'default', disabled = false }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortLabel: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  const variantClasses = {
    default: 'hover:text-foreground hover:bg-muted/50',
    primary: 'text-signal-active hover:bg-signal-active/10',
    danger: 'text-signal-critical hover:bg-signal-critical/10',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`yaml-toolbar-btn flex items-center gap-1.5 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-all duration-200 disabled:opacity-20 disabled:pointer-events-none ${variantClasses[variant]}`}
          style={{ borderRadius: '2px' }}
        >
          <Icon className="w-3 h-3" />
          <span className="hidden sm:inline">{shortLabel}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="font-mono text-[10px]">{label}</TooltipContent>
    </Tooltip>
  );
}

export function YamlEditor({ open, onOpenChange, initialContent }: YamlEditorProps) {
  const { nodes, edges, setNodes, setEdges } = useArchitectureStore();
  const [yamlContent, setYamlContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);

  // Load initial content only on open transition (e.g. from template preview)
  useEffect(() => {
    if (open && !prevOpenRef.current && initialContent) {
      setYamlContent(initialContent);
      setError(null);
      setSuccess(false);
    }
    prevOpenRef.current = open;
  }, [initialContent, open]);

  // Sync gutter scroll with textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    const gutter = gutterRef.current;
    if (!textarea || !gutter) return;

    const syncScroll = () => {
      gutter.scrollTop = textarea.scrollTop;
    };
    textarea.addEventListener('scroll', syncScroll);
    return () => textarea.removeEventListener('scroll', syncScroll);
  }, []);

  const lineCount = useMemo(() => {
    if (!yamlContent) return 1;
    return yamlContent.split('\n').length;
  }, [yamlContent]);

  // Parse error line from error message
  const errorLines = useMemo(() => {
    if (!error) return undefined;
    const match = error.match(/line (\d+)/i);
    if (match) return new Set([parseInt(match[1])]);
    return undefined;
  }, [error]);

  // YAML stats
  const stats = useMemo(() => {
    const lines = yamlContent ? yamlContent.split('\n').length : 0;
    const chars = yamlContent.length;
    const componentMatches = yamlContent.match(/^\s{2}\w+:/gm);
    return { lines, chars, components: componentMatches?.length ?? 0 };
  }, [yamlContent]);

  const handleExport = useCallback(() => {
    const yaml = exportToYaml(nodes, edges);
    setYamlContent(yaml);
    setError(null);
    setSuccess(false);
  }, [nodes, edges]);

  const handleImport = useCallback(() => {
    if (!yamlContent.trim()) {
      setError('Le contenu YAML est vide.');
      return;
    }

    const result = parseYamlArchitecture(yamlContent);
    if ('error' in result) {
      setError(result.error);
      setSuccess(false);
      return;
    }

    setNodes(result.nodes);
    setEdges(result.edges);
    setError(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  }, [yamlContent, setNodes, setEdges]);

  const handleDownload = useCallback(() => {
    const content = yamlContent || exportToYaml(nodes, edges);
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture-${new Date().toISOString().split('T')[0]}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [yamlContent, nodes, edges]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setYamlContent(content);
      setError(null);
      setSuccess(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleCopy = useCallback(() => {
    const content = yamlContent || exportToYaml(nodes, edges);
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [yamlContent, nodes, edges]);

  const handleClear = useCallback(() => {
    setYamlContent('');
    setError(null);
    setSuccess(false);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="yaml-editor-panel w-140 sm:max-w-140 flex flex-col gap-0 p-0 border-l border-border bg-background"
      >
        <VisuallyHidden><SheetTitle>Éditeur YAML</SheetTitle></VisuallyHidden>

        {/* ── Signal Bar ── */}
        <div className="yaml-signal-bar h-0.75 w-full bg-signal-infra" />

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-instrument text-[10px] text-signal-infra">YAML</span>
            <span className="text-border">|</span>
            <span className="font-mono text-[9px] text-muted-foreground">DÉFINITION D&apos;ARCHITECTURE</span>
          </div>
          <div className="flex items-center gap-2">
            {success && (
              <div className="flex items-center gap-1 text-signal-healthy font-mono text-[9px] animate-fade-in-up">
                <Check className="w-3 h-3" />
                <span>APPLIQUÉ</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-1 text-signal-critical font-mono text-[9px]">
                <AlertTriangle className="w-3 h-3" />
                <span>ERREUR</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-card/50">
          <div className="flex items-center gap-0.5">
            <ToolbarAction
              icon={Download}
              label="Charger l'architecture actuelle dans l'editeur"
              shortLabel="EXPORTER"
              onClick={handleExport}
            />
            <div className="w-px h-4 bg-border mx-0.5" />
            <ToolbarAction
              icon={Play}
              label="Remplacer l'architecture par le YAML saisi"
              shortLabel="APPLIQUER"
              onClick={handleImport}
              variant="primary"
              disabled={!yamlContent.trim()}
            />
            <div className="w-px h-4 bg-border mx-0.5" />
            <ToolbarAction
              icon={FileDown}
              label="Telecharger en fichier .yaml"
              shortLabel=".YAML"
              onClick={handleDownload}
            />
            <ToolbarAction
              icon={Copy}
              label={copied ? 'Copie !' : 'Copier dans le presse-papier'}
              shortLabel={copied ? 'OK' : 'COPIER'}
              onClick={handleCopy}
            />
            <ToolbarAction
              icon={Upload}
              label="Charger un fichier .yaml depuis le disque"
              shortLabel="CHARGER"
              onClick={() => fileInputRef.current?.click()}
            />
            <input ref={fileInputRef} type="file" accept=".yaml,.yml" onChange={handleFileUpload} className="hidden" />
          </div>
          <div className="flex items-center gap-0.5">
            {yamlContent && (
              <ToolbarAction
                icon={X}
                label="Vider l'editeur"
                shortLabel="VIDER"
                onClick={handleClear}
                variant="danger"
              />
            )}
          </div>
        </div>

        {/* ── Error Detail ── */}
        {error && (
          <div className="px-3 py-2 border-b border-signal-critical/20 bg-signal-critical/5 font-mono text-[10px] text-signal-critical leading-relaxed">
            {error}
          </div>
        )}

        {/* ── Editor Area ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden bg-muted/20">
          {/* Gutter */}
          <div
            ref={gutterRef}
            className="yaml-gutter-scroll w-10 shrink-0 overflow-hidden border-r border-border/50 bg-muted/30"
          >
            <LineNumbers count={lineCount} activeLines={errorLines} />
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={yamlContent}
            onChange={(e) => { setYamlContent(e.target.value); setError(null); }}
            placeholder={`version: 1
name: "Mon Architecture"

zones:
  backend:
    type: backend
    domain: "api.example.com"

components:
  clients:
    type: client-group
    config:
      virtualClients: 50

  server:
    type: http-server
    zone: backend
    config:
      port: 8080

connections:
  - from: clients
    to: server`}
            className="yaml-textarea flex-1 p-3 pl-2 font-mono text-[11px] leading-relaxed bg-transparent text-foreground resize-none focus:outline-none placeholder:text-muted-foreground/20 caret-signal-active"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        {/* ── Status Bar ── */}
        <div className="flex items-center justify-between px-3 h-6 border-t border-border bg-card/80 font-mono text-[8px] text-muted-foreground select-none shrink-0">
          <div className="flex items-center gap-3">
            <span>LN:{stats.lines}</span>
            <span>CH:{stats.chars}</span>
            {yamlContent && <span>KEYS:{stats.components}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground/40">UTF-8</span>
            <span className="text-border">|</span>
            <span className="text-muted-foreground/40">YAML</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
