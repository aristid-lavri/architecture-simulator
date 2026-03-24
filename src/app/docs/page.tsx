'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Monitor,
  Server,
  Users,
  Shield,
  Share2,
  Database,
  Zap,
  MessageSquare,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Home,
  ShieldOff,
  Globe,
  ShieldCheck,
  Cloud,
  Box,
  Compass,
  HardDrive,
  Layers,
  AlertTriangle,
  Link as LinkIcon,
  Cable,
  Activity,
  KeyRound,
} from 'lucide-react';
import { ComponentCard } from '@/components/docs/ComponentCard';
import { TemplateCard } from '@/components/docs/TemplateCard';
import { cn } from '@/lib/utils';
import { componentDocs, edgeProperties, designErrors, globalMetrics, rejectionReasons, particleTypes, protocolMatrix, traceSpanFields, requestTraceFields, criticalPathFields, tracingConcepts, waterfallGuide } from '@/data/docs-data';
import type { DocComponent } from '@/data/docs-data';

// ── Icon mapping helper ──
function getComponentIcon(type: string) {
  const iconMap: Record<string, React.ReactNode> = {
    'http-client': <Monitor className="w-4 h-4" />,
    'http-server': <Server className="w-4 h-4" />,
    'client-group': <Users className="w-4 h-4" />,
    'api-gateway': <Shield className="w-4 h-4" />,
    'load-balancer': <Share2 className="w-4 h-4" />,
    'database': <Database className="w-4 h-4" />,
    'cache': <Zap className="w-4 h-4" />,
    'message-queue': <MessageSquare className="w-4 h-4" />,
    'circuit-breaker': <ShieldOff className="w-4 h-4" />,
    'cdn': <Globe className="w-4 h-4" />,
    'waf': <ShieldCheck className="w-4 h-4" />,
    'firewall': <ShieldOff className="w-4 h-4" />,
    'service-discovery': <Compass className="w-4 h-4" />,
    'dns': <Globe className="w-4 h-4" />,
    'serverless': <Cloud className="w-4 h-4" />,
    'container': <Box className="w-4 h-4" />,
    'host-server': <Monitor className="w-4 h-4" />,
    'api-service': <Server className="w-4 h-4" />,
    'background-job': <Zap className="w-4 h-4" />,
    'cloud-storage': <HardDrive className="w-4 h-4" />,
    'cloud-function': <Cloud className="w-4 h-4" />,
    'network-zone': <Layers className="w-4 h-4" />,
    'identity-provider': <KeyRound className="w-4 h-4" />,
  };
  return iconMap[type] || <Box className="w-4 h-4" />;
}

// ── Section definitions ──
const sections = [
  {
    id: 'guide',
    label: 'Guide de démarrage',
    icon: '01',
    color: 'oklch(0.75 0.18 75)',   // signal-active (amber)
    children: [
      { id: 'guide-composants', label: 'Ajouter des composants' },
      { id: 'guide-connexions', label: 'Connexions' },
      { id: 'guide-configuration', label: 'Configuration' },
      { id: 'guide-simulation', label: 'Simulation' },
      { id: 'guide-analyse', label: 'Analyse' },
    ],
  },
  {
    id: 'yaml',
    label: 'Éditeur YAML',
    icon: '02',
    color: 'oklch(0.75 0.18 75)',   // signal-infra (amber)
    children: [
      { id: 'yaml-structure', label: 'Structure du fichier' },
      { id: 'yaml-zones', label: 'Zones réseau' },
      { id: 'yaml-components', label: 'Composants' },
      { id: 'yaml-connections', label: 'Connexions' },
      { id: 'yaml-editeur', label: 'Utiliser l\'éditeur' },
    ],
  },
  {
    id: 'composants',
    label: 'Catalogue composants',
    icon: '03',
    color: 'oklch(0.70 0.15 220)',   // signal-client (blue)
    children: [
      { id: 'component-client-http', label: 'Client HTTP' },
      { id: 'component-serveur-http', label: 'Serveur HTTP' },
      { id: 'component-groupe-de-clients', label: 'Groupe de clients' },
      { id: 'component-api-gateway', label: 'API Gateway' },
      { id: 'component-load-balancer', label: 'Load Balancer' },
      { id: 'component-base-de-données', label: 'Base de données' },
      { id: 'component-cache', label: 'Cache' },
      { id: 'component-file-de-messages', label: 'File de messages' },
      { id: 'component-circuit-breaker', label: 'Circuit Breaker' },
      { id: 'component-cdn', label: 'CDN' },
      { id: 'component-waf', label: 'WAF' },
      { id: 'component-firewall', label: 'Firewall' },
      { id: 'component-serverless', label: 'Serverless' },
      { id: 'component-container', label: 'Container' },
      { id: 'component-service-discovery', label: 'Service Discovery' },
      { id: 'component-cloud-storage', label: 'Cloud Storage' },
      { id: 'component-cloud-function', label: 'Cloud Function' },
      { id: 'component-serveur-hôte', label: 'Serveur Hôte' },
      { id: 'component-api-service', label: 'API Service' },
      { id: 'component-background-job', label: 'Background Job' },
      { id: 'component-identity-provider', label: 'Identity Provider' },
      { id: 'component-zone-réseau', label: 'Zone Réseau' },
    ],
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: '04',
    color: 'oklch(0.68 0.18 290)',   // signal-server (purple)
    children: [],
  },
  {
    id: 'metriques',
    label: 'Métriques',
    icon: '05',
    color: 'oklch(0.72 0.19 155)',   // signal-data (green)
    children: [
      { id: 'metriques-globales', label: 'Métriques globales' },
      { id: 'metriques-rejets', label: 'Raisons de rejet' },
      { id: 'metriques-interpretation', label: 'Guide d\'interprétation' },
    ],
  },
  {
    id: 'edges',
    label: 'Connexions (Edges)',
    icon: '06',
    color: 'oklch(0.75 0.18 75)',
    children: [
      { id: 'edges-proprietes', label: 'Propriétés des edges' },
      { id: 'edges-protocoles', label: 'Matrice des protocoles' },
      { id: 'edges-particules', label: 'Particules animées' },
    ],
  },
  {
    id: 'traces',
    label: 'Tracing distribué',
    icon: '07',
    color: 'oklch(0.72 0.16 200)',
    children: [
      { id: 'traces-concepts', label: 'Concepts clés' },
      { id: 'traces-span', label: 'TraceSpan' },
      { id: 'traces-request', label: 'RequestTrace' },
      { id: 'traces-critical', label: 'Chemin critique' },
      { id: 'traces-waterfall', label: 'Guide du waterfall' },
    ],
  },
  {
    id: 'erreurs',
    label: 'Erreurs de conception',
    icon: '08',
    color: 'oklch(0.65 0.22 25)',
    children: [],
  },
];

// ── Scroll spy hook ──
function useScrollSpy(ids: string[], offset = 100) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry closest to the top
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: `-${offset}px 0px -60% 0px`, threshold: 0 }
    );

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [ids, offset]);

  return activeId;
}

// ── Sidebar ──
function SidebarContent({ activeId, onLinkClick }: { activeId: string; onLinkClick?: () => void }) {
  const scrollToSection = useCallback((id: string) => {
    // Dispatch event so collapsed accordions can auto-open if they contain this target
    window.dispatchEvent(new CustomEvent('docs-scroll-to', { detail: { targetId: id } }));
    // Wait for React to re-render the opened accordion, then scroll
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        onLinkClick?.();
      }
    }, 50);
  }, [onLinkClick]);

  return (
    <nav className="space-y-5">
      {sections.map((section) => {
        const isSectionActive = activeId === section.id || section.children.some(c => c.id === activeId);

        return (
          <div key={section.id}>
            <button
              onClick={() => scrollToSection(section.id)}
              className={cn(
                'flex items-center gap-2 text-[10px] font-mono uppercase transition-colors w-full text-left py-1',
                isSectionActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className="inline-flex items-center justify-center w-5 h-5 text-[8px] font-bold border"
                style={{
                  borderColor: isSectionActive ? section.color : 'var(--border)',
                  color: isSectionActive ? section.color : 'var(--muted-foreground)',
                  borderRadius: '2px',
                }}
              >
                {section.icon}
              </span>
              <span className={cn(isSectionActive && 'font-semibold')}>{section.label}</span>
            </button>

            {section.children.length > 0 && (
              <div className="ml-7 mt-1 space-y-0.5 border-l border-border pl-2.5">
                {section.children.map((child) => {
                  const isChildActive = activeId === child.id;
                  return (
                    <button
                      key={child.id}
                      onClick={() => scrollToSection(child.id)}
                      className={cn(
                        'block text-[11px] font-mono py-0.5 transition-all w-full text-left',
                        isChildActive
                          ? 'text-foreground translate-x-0.5'
                          : 'text-muted-foreground/60 hover:text-muted-foreground'
                      )}
                      style={isChildActive ? { borderLeftColor: section.color } : undefined}
                    >
                      {isChildActive && (
                        <span className="inline-block w-1 h-1 rounded-full mr-1.5 -ml-[13px]" style={{ backgroundColor: section.color }} />
                      )}
                      {child.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── Section Header ──
function SectionHeader({ id, label, icon, color, description }: {
  id: string; label: string; icon: string; color: string; description?: string;
}) {
  return (
    <div id={id} className="scroll-mt-16 mb-8">
      <div className="flex items-center gap-3 mb-2">
        <span
          className="inline-flex items-center justify-center w-7 h-7 text-[10px] font-mono font-bold border"
          style={{ borderColor: color, color, borderRadius: '3px' }}
        >
          {icon}
        </span>
        <h1 className="font-display font-bold text-xl text-foreground">{label}</h1>
      </div>
      {description && (
        <p className="text-[12px] text-muted-foreground ml-10">{description}</p>
      )}
      <div className="mt-3 h-px" style={{ background: `linear-gradient(to right, ${color}33, transparent)` }} />
    </div>
  );
}

// ── Guide Step ──
function GuideStep({ id, step, title, children }: {
  id: string; step: string; title: string; children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-16 group">
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          <span className="flex items-center justify-center w-8 h-8 text-[10px] font-mono font-bold border border-signal-active/40 text-signal-active bg-signal-active/5 group-hover:bg-signal-active/10 transition-colors" style={{ borderRadius: '3px' }}>
            {step}
          </span>
          <div className="flex-1 w-px bg-border mt-2" />
        </div>
        <div className="pb-8 flex-1">
          <h2 className="font-mono text-sm font-semibold text-foreground mb-2">{title}</h2>
          <div className="text-sm text-foreground/80 leading-relaxed space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Category Accordion ──
function CategoryAccordion({ label, color, count, defaultOpen = false, children }: {
  label: string; color: string; count: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-open when a child element is targeted by sidebar navigation
  useEffect(() => {
    const handler = (e: Event) => {
      const targetId = (e as CustomEvent).detail?.targetId;
      if (targetId && contentRef.current?.querySelector(`[id="${targetId}"]`)) {
        setIsOpen(true);
      }
    };
    window.addEventListener('docs-scroll-to', handler);
    return () => window.removeEventListener('docs-scroll-to', handler);
  }, []);

  return (
    <div className="mb-2 border border-border/50 overflow-hidden" style={{ borderRadius: '4px' }}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'group flex items-center gap-3 w-full py-3 px-4 transition-all duration-200 cursor-pointer select-none',
          isOpen ? 'bg-muted/40' : 'hover:bg-muted/20'
        )}
      >
        {/* Expand/collapse indicator */}
        <div
          className="flex items-center justify-center w-5 h-5 border shrink-0 transition-colors duration-200"
          style={{
            borderColor: isOpen ? color : 'var(--border)',
            backgroundColor: isOpen ? `${color}15` : 'transparent',
            borderRadius: '3px',
          }}
        >
          <ChevronDown
            className="w-3 h-3 transition-transform duration-300"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              color: isOpen ? color : 'var(--muted-foreground)',
            }}
          />
        </div>

        {/* Color bar */}
        <div className="w-1 h-4 shrink-0" style={{ backgroundColor: color, borderRadius: '1px' }} />

        {/* Label */}
        <span
          className="text-[11px] font-mono uppercase font-semibold tracking-wider transition-colors"
          style={{ color: isOpen ? color : 'var(--muted-foreground)' }}
        >
          {label}
        </span>

        {/* Count badge */}
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 border transition-colors"
          style={{
            borderColor: isOpen ? `${color}40` : 'var(--border)',
            color: isOpen ? color : 'var(--muted-foreground)',
            borderRadius: '2px',
          }}
        >
          {count}
        </span>

        {/* Gradient line */}
        <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${color}15, transparent)` }} />
      </button>

      {/* Content — always in DOM so scroll targets are reachable */}
      <div
        ref={contentRef}
        className={cn(
          'border-t border-border/30 px-4 pt-4 pb-3 bg-background',
          !isOpen && 'hidden'
        )}
      >
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Category definitions for the component catalog ──
const componentCategories: { label: string; color: string; filter: string }[] = [
  { label: 'Simulation', color: '#3b82f6', filter: 'simulation' },
  { label: 'Infrastructure', color: '#a855f7', filter: 'infrastructure' },
  { label: 'Données', color: '#10b981', filter: 'data' },
  { label: 'Résilience', color: '#f43f5e', filter: 'resilience' },
  { label: 'Compute', color: '#f59e0b', filter: 'compute' },
  { label: 'Cloud', color: '#0ea5e9', filter: 'cloud' },
  { label: 'Sécurité', color: '#ec4899', filter: 'security' },
  { label: 'Zones', color: '#64748b', filter: 'zone' },
];

export default function DocsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Collect all IDs for scroll spy
  const allIds = sections.flatMap(s => [s.id, ...s.children.map(c => c.id)]);
  const activeId = useScrollSpy(allIds);

  // Group design errors by category
  const errorCategories = Array.from(new Set(designErrors.map(e => e.category)));

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* ── Header ── */}
      <header className="h-10 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="" className="h-4 w-4" />
            <span className="font-display font-semibold tracking-wider text-[11px] text-foreground">ARCH.SIM</span>
          </Link>
          <span className="text-border">|</span>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <Home className="w-3 h-3" />
            </Link>
            <ChevronRight className="w-2.5 h-2.5 text-border" />
            <span className="text-foreground font-semibold uppercase">Documentation</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick nav links */}
          <Link
            href="/simulator"
            className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-signal-active transition-colors"
          >
            Simulateur
            <ArrowRight className="w-3 h-3" />
          </Link>

          {/* Mobile menu */}
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menu"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Sidebar — desktop ── */}
        <aside className="hidden md:flex flex-col w-56 border-r border-border shrink-0">
          <div className="flex-1 overflow-y-auto docs-scroller p-4">
            <SidebarContent activeId={activeId} />
          </div>

          {/* Sidebar footer */}
          <div className="p-4 border-t border-border shrink-0">
            <Link
              href="/simulator"
              className="flex items-center gap-2 font-mono text-[10px] text-signal-active hover:text-signal-active/80 transition-colors"
            >
              <ArrowRight className="w-3 h-3" />
              Ouvrir le simulateur
            </Link>
          </div>
        </aside>

        {/* ── Sidebar — mobile overlay ── */}
        {sidebarOpen && (
          <aside className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm p-4 overflow-y-auto md:hidden">
            <SidebarContent activeId={activeId} onLinkClick={() => setSidebarOpen(false)} />
          </aside>
        )}

        {/* ── Main content ── */}
        <main ref={mainRef} className="flex-1 overflow-y-auto docs-scroller px-6 py-8 md:px-12 max-w-4xl">

          {/* ═══ SECTION 1: GUIDE ═══ */}
          <SectionHeader
            id="guide"
            label="Guide de démarrage"
            icon="01"
            color="oklch(0.75 0.18 75)"
            description="5 étapes pour maîtriser le simulateur."
          />

          <div className="ml-0 space-y-0">
            <GuideStep id="guide-composants" step="01" title="Ajouter des composants">
              <p>
                Ouvrez le panneau de composants à gauche (bouton <strong className="text-foreground">RACK</strong> dans le header). Les composants sont organisés en 7 catégories :
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono border border-blue-500/30 text-blue-400" style={{ borderRadius: '2px' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Simulation
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono border border-purple-500/30 text-purple-400" style={{ borderRadius: '2px' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Infrastructure
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono border border-emerald-500/30 text-emerald-400" style={{ borderRadius: '2px' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Données
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono border border-rose-500/30 text-rose-400" style={{ borderRadius: '2px' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Résilience
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono border border-amber-500/30 text-amber-400" style={{ borderRadius: '2px' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Compute
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono border border-sky-500/30 text-sky-400" style={{ borderRadius: '2px' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  Cloud
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono border border-slate-500/30 text-slate-400" style={{ borderRadius: '2px' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  Zones
                </span>
              </div>
              <p className="text-muted-foreground mt-2">
                Glissez un composant depuis le panneau et déposez-le sur le canvas.
              </p>
            </GuideStep>

            <GuideStep id="guide-connexions" step="02" title="Connecter les composants">
              <p>
                Chaque composant possède des <strong className="text-foreground">handles</strong> (points de connexion) sur ses bords.
                Cliquez sur un handle de sortie et tirez vers un handle d&apos;entrée d&apos;un autre composant.
              </p>
              <p className="text-muted-foreground">
                Les connexions définissent le flux des requêtes pendant la simulation. Vous pouvez reconnecter une arête en tirant son extrémité vers un autre composant.
              </p>
            </GuideStep>

            <GuideStep id="guide-configuration" step="03" title="Configurer les propriétés">
              <p>
                Cliquez sur un composant pour ouvrir le <strong className="text-foreground">panneau de propriétés</strong> à droite.
                Chaque type a ses propres paramètres : latence, taux d&apos;erreur, algorithme de répartition,
                politique d&apos;éviction du cache, etc.
              </p>
              <p className="text-muted-foreground">
                Les modifications sont sauvegardées automatiquement dans localStorage.
              </p>
            </GuideStep>

            <GuideStep id="guide-simulation" step="04" title="Lancer la simulation">
              <p>
                Basculez en <strong className="text-foreground">mode SIM</strong> via le toggle dans le header.
                Les contrôles apparaissent : Play, Pause, Stop, Reset. Choisissez une durée ou laissez en mode infini.
              </p>
              <p className="text-muted-foreground">
                Le moteur PixiJS WebGL rend des particules GPU pour visualiser le flux des requêtes et réponses. Les composants changent de couleur selon leur état.
              </p>
            </GuideStep>

            <GuideStep id="guide-analyse" step="05" title="Analyser les résultats">
              <p>
                La <strong className="text-foreground">barre de télémétrie</strong> en bas affiche les métriques en temps réel.
                Cliquez dessus pour développer les détails :
              </p>
              <div className="mt-2 space-y-1 ml-2">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-active" />
                  <strong className="text-foreground/80">Metrics</strong>
                  <span className="text-muted-foreground">— Latences, groupes de clients, utilisation serveurs</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-active" />
                  <strong className="text-foreground/80">Output</strong>
                  <span className="text-muted-foreground">— Logs d&apos;événements en temps réel</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-active" />
                  <strong className="text-foreground/80">Bottlenecks</strong>
                  <span className="text-muted-foreground">— Détection automatique des goulots d&apos;étranglement</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-active" />
                  <strong className="text-foreground/80">Traces</strong>
                  <span className="text-muted-foreground">— Tracing distribué avec vue waterfall du chemin critique</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-active" />
                  <strong className="text-foreground/80">Analytics</strong>
                  <span className="text-muted-foreground">— Métriques détaillées par composant avec synthèse post-simulation</span>
                </div>
              </div>
            </GuideStep>
          </div>

          {/* ═══ SECTION 2: YAML ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="yaml"
            label="Éditeur YAML"
            icon="02"
            color="oklch(0.75 0.18 75)"
            description="Définissez votre architecture en YAML — importez, exportez, versionnez. Une alternative puissante au drag & drop."
          />

          <div className="space-y-6">
            {/* Structure du fichier */}
            <div id="yaml-structure" className="scroll-mt-16">
              <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Structure du fichier</h2>
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                Un fichier YAML d&apos;architecture contient 4 sections principales :
              </p>
              <div className="border border-border bg-card/30 overflow-hidden" style={{ borderRadius: '3px' }}>
                <div className="px-3 py-1.5 border-b border-border bg-card/50 flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded-full bg-signal-infra" />
                  <span className="font-mono text-[9px] uppercase text-muted-foreground font-semibold">Structure de base</span>
                </div>
                <pre className="p-4 font-mono text-[11px] leading-relaxed text-foreground overflow-x-auto"><code>{`version: 1
name: "Mon Architecture"

zones:        # Optionnel — zones réseau
  backend:
    type: backend
    domain: "api.example.com"

components:   # Requis — vos composants
  clients:
    type: client-group
    config:
      virtualClients: 50

  server:
    type: http-server
    zone: backend
    config:
      port: 8080

connections:  # Requis — liens entre composants
  - from: clients
    to: server`}</code></pre>
              </div>
              <div className="mt-3 space-y-1 ml-2">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-infra" />
                  <code className="text-foreground/80 font-mono text-[11px]">version</code>
                  <span className="text-muted-foreground">— Toujours <code className="font-mono">1</code></span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-infra" />
                  <code className="text-foreground/80 font-mono text-[11px]">name</code>
                  <span className="text-muted-foreground">— Nom libre de votre architecture</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-infra" />
                  <code className="text-foreground/80 font-mono text-[11px]">zones</code>
                  <span className="text-muted-foreground">— Optionnel. Groupes logiques de composants</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-infra" />
                  <code className="text-foreground/80 font-mono text-[11px]">components</code>
                  <span className="text-muted-foreground">— Requis. La clé = identifiant unique du composant</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-1 h-1 rounded-full bg-signal-infra" />
                  <code className="text-foreground/80 font-mono text-[11px]">connections</code>
                  <span className="text-muted-foreground">— Requis. Liste de liens <code className="font-mono">from → to</code></span>
                </div>
              </div>
            </div>

            {/* Zones réseau */}
            <div id="yaml-zones" className="scroll-mt-16">
              <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Zones réseau</h2>
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                Les zones regroupent visuellement les composants. Un composant peut appartenir à une zone via la propriété <code className="font-mono text-[11px] bg-muted px-1 py-0.5" style={{ borderRadius: '2px' }}>zone</code>.
              </p>
              <div className="border border-border bg-card/30 overflow-hidden" style={{ borderRadius: '3px' }}>
                <div className="px-3 py-1.5 border-b border-border bg-card/50 flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded-full bg-signal-infra" />
                  <span className="font-mono text-[9px] uppercase text-muted-foreground font-semibold">Exemple de zones</span>
                </div>
                <pre className="p-4 font-mono text-[11px] leading-relaxed text-foreground overflow-x-auto"><code>{`zones:
  frontend:
    type: frontend        # frontend | backend | dmz | database | external
    domain: "app.example.com"
    subdomains:
      - "cdn.example.com"
    interZoneLatency: 5   # Latence inter-zone en ms
    position: { x: 50, y: 50 }
    size: { width: 400, height: 300 }`}</code></pre>
              </div>
              <div className="mt-3 p-3 border border-border bg-muted/20 font-mono text-[10px] text-muted-foreground" style={{ borderRadius: '3px' }}>
                <strong className="text-foreground">Types disponibles :</strong> frontend, backend, dmz, database, external
              </div>
            </div>

            {/* Composants */}
            <div id="yaml-components" className="scroll-mt-16">
              <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Composants</h2>
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                Chaque composant a un <code className="font-mono text-[11px] bg-muted px-1 py-0.5" style={{ borderRadius: '2px' }}>type</code> et un bloc <code className="font-mono text-[11px] bg-muted px-1 py-0.5" style={{ borderRadius: '2px' }}>config</code> optionnel. Si <code className="font-mono text-[11px] bg-muted px-1 py-0.5" style={{ borderRadius: '2px' }}>config</code> est omis, les valeurs par défaut sont utilisées.
              </p>
              <div className="border border-border bg-card/30 overflow-hidden" style={{ borderRadius: '3px' }}>
                <div className="px-3 py-1.5 border-b border-border bg-card/50 flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded-full bg-signal-infra" />
                  <span className="font-mono text-[9px] uppercase text-muted-foreground font-semibold">Exemples de composants</span>
                </div>
                <pre className="p-4 font-mono text-[11px] leading-relaxed text-foreground overflow-x-auto"><code>{`components:
  # Groupe de clients virtuels
  load-test:
    type: client-group
    config:
      label: "Load Test"
      virtualClients: 200
      rampUpTime: 5000
      distribution: uniform   # uniform | normal | burst

  # Serveur HTTP avec ressources
  api:
    type: http-server
    zone: backend             # Rattaché à la zone "backend"
    config:
      label: "API Server"
      port: 8080
      responseDelay: 50
      errorRate: 0.01

  # Base de données
  db:
    type: database
    zone: backend
    config:
      label: "PostgreSQL"
      maxConnections: 100
      queryDelay: 10

  # Load balancer
  lb:
    type: load-balancer
    config:
      algorithm: round-robin  # round-robin | least-connections | random`}</code></pre>
              </div>

              {/* Types reference */}
              <div className="mt-3 overflow-x-auto border border-border bg-card/30" style={{ borderRadius: '3px' }}>
                <table className="w-full font-mono text-[11px]">
                  <thead>
                    <tr className="text-muted-foreground text-left border-b border-border bg-card/50">
                      <th className="py-2 px-3 text-[9px] uppercase font-semibold">Type YAML</th>
                      <th className="py-2 px-3 text-[9px] uppercase font-semibold">Composant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {[
                      ['http-client', 'Client HTTP'],
                      ['http-server', 'Serveur HTTP'],
                      ['client-group', 'Groupe de clients'],
                      ['api-gateway', 'API Gateway'],
                      ['load-balancer', 'Load Balancer'],
                      ['database', 'Base de données'],
                      ['cache', 'Cache'],
                      ['message-queue', 'File de messages'],
                      ['circuit-breaker', 'Circuit Breaker'],
                      ['cdn', 'CDN'],
                      ['waf', 'WAF'],
                      ['firewall', 'Firewall'],
                      ['serverless', 'Serverless'],
                      ['container', 'Container'],
                      ['service-discovery', 'Service Discovery'],
                      ['dns', 'DNS'],
                      ['cloud-storage', 'Cloud Storage'],
                      ['cloud-function', 'Cloud Function'],
                      ['host-server', 'Serveur Hôte'],
                      ['api-service', 'API Service'],
                      ['background-job', 'Background Job'],
                      ['identity-provider', 'Identity Provider'],
                      ['network-zone', 'Zone Réseau'],
                    ].map(([type, name], i) => (
                      <tr key={type} className={cn('text-foreground/80', i % 2 === 0 && 'bg-card/20')}>
                        <td className="py-1.5 px-3"><code>{type}</code></td>
                        <td className="py-1.5 px-3">{name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Connexions */}
            <div id="yaml-connections" className="scroll-mt-16">
              <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Connexions</h2>
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                Les connexions définissent le flux de données entre composants.
                Utilisez l&apos;identifiant du composant (la clé dans <code className="font-mono text-[11px] bg-muted px-1 py-0.5" style={{ borderRadius: '2px' }}>components</code>).
              </p>
              <div className="border border-border bg-card/30 overflow-hidden" style={{ borderRadius: '3px' }}>
                <div className="px-3 py-1.5 border-b border-border bg-card/50 flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded-full bg-signal-infra" />
                  <span className="font-mono text-[9px] uppercase text-muted-foreground font-semibold">Exemple de connexions</span>
                </div>
                <pre className="p-4 font-mono text-[11px] leading-relaxed text-foreground overflow-x-auto"><code>{`connections:
  - from: load-test    # ID du composant source
    to: lb             # ID du composant cible

  - from: lb
    to: api

  - from: api
    to: db`}</code></pre>
              </div>
            </div>

            {/* Utiliser l'éditeur */}
            <div id="yaml-editeur" className="scroll-mt-16">
              <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Utiliser l&apos;éditeur</h2>
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                L&apos;éditeur YAML est accessible depuis la barre d&apos;outils du simulateur (bouton <strong className="text-foreground">YAML</strong>).
              </p>
              <div className="space-y-3">
                <div className="p-3 border border-border bg-card/30" style={{ borderRadius: '3px' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-instrument text-[9px] text-signal-infra">EXPORTER</span>
                    <span className="text-border">|</span>
                    <span className="text-[12px] text-muted-foreground">Charge l&apos;architecture actuelle du canvas dans l&apos;éditeur en YAML</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-instrument text-[9px] text-signal-active">APPLIQUER</span>
                    <span className="text-border">|</span>
                    <span className="text-[12px] text-muted-foreground">Parse le YAML et remplace l&apos;architecture sur le canvas</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-instrument text-[9px] text-muted-foreground">.YAML</span>
                    <span className="text-border">|</span>
                    <span className="text-[12px] text-muted-foreground">Télécharge le contenu en fichier <code className="font-mono text-[11px]">.yaml</code></span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-instrument text-[9px] text-muted-foreground">COPIER</span>
                    <span className="text-border">|</span>
                    <span className="text-[12px] text-muted-foreground">Copie le contenu dans le presse-papier</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-instrument text-[9px] text-muted-foreground">CHARGER</span>
                    <span className="text-border">|</span>
                    <span className="text-[12px] text-muted-foreground">Importe un fichier <code className="font-mono text-[11px]">.yaml</code> depuis le disque</span>
                  </div>
                </div>
                <div className="p-3 border border-signal-infra/20 bg-signal-infra/5 font-mono text-[11px] text-foreground/80 leading-relaxed" style={{ borderRadius: '3px' }}>
                  <strong className="text-signal-infra">Astuce :</strong> Exportez votre architecture, modifiez le YAML, puis appliquez pour itérer rapidement. Les fichiers <code>.yaml</code> sont compatibles Git pour le versioning.
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 3: COMPOSANTS ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="composants"
            label="Catalogue des composants"
            icon="03"
            color="oklch(0.70 0.15 220)"
            description="22 types de composants répartis en 8 catégories. Chaque composant est configurable via le panneau de propriétés."
          />

          {componentCategories.map(({ label, color, filter }) => {
            const comps = componentDocs.filter(c => c.category === filter);
            if (comps.length === 0) return null;
            return (
              <CategoryAccordion key={filter} label={label} color={color} count={comps.length}>
                {comps.map(comp => (
                  <ComponentCard
                    key={comp.type}
                    icon={getComponentIcon(comp.type)}
                    name={comp.name}
                    description={comp.description}
                    category={comp.category}
                    sections={comp.sections}
                    metrics={comp.metrics}
                    behavior={comp.behavior}
                    connections={comp.connections}
                    protocols={comp.protocols}
                  />
                ))}
              </CategoryAccordion>
            );
          })}

          {/* ═══ SECTION 4: TEMPLATES ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="templates"
            label="Templates d'architecture"
            icon="04"
            color="oklch(0.68 0.18 290)"
            description="8 architectures pré-configurées accessibles depuis le menu TPL dans le header."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <TemplateCard
              name="Monolithe Simple"
              description="Architecture monolithique classique avec cache-aside pattern."
              topology="Client Group → Serveur → Cache → Database"
              components={['client-group', 'http-server', 'cache', 'database']}
              useCase="Application web classique avec un seul serveur et une base de données. Le cache Redis réduit la charge sur la DB."
            />
            <TemplateCard
              name="Load Balanced"
              description="Architecture avec répartition de charge entre plusieurs serveurs."
              topology="Client Group → Load Balancer → 2x Serveur → Database"
              components={['client-group', 'load-balancer', 'http-server', 'database']}
              useCase="Application à fort trafic nécessitant la répartition de charge. Testez l'impact des algorithmes (Round Robin, Least Connections)."
            />
            <TemplateCard
              name="Microservices"
              description="Architecture microservices avec API Gateway comme point d'entrée."
              topology="Client Group → API Gateway → 2x Service → Database"
              components={['client-group', 'api-gateway', 'http-server', 'database']}
              useCase="Architecture distribuée avec routage par chemin. Testez le rate limiting et l'authentification."
            />
            <TemplateCard
              name="Event-Driven"
              description="Architecture event-driven avec communication asynchrone via Message Queue."
              topology="Client Group → Serveur → Message Queue → 2x Consumer → Database"
              components={['client-group', 'http-server', 'message-queue', 'database']}
              useCase="Système découplé avec traitement asynchrone. Le producteur répond immédiatement, les consommateurs traitent en arrière-plan."
            />
            <TemplateCard
              name="E-Commerce Microservices"
              description="Plateforme e-commerce avec zones réseau, microservices et communication asynchrone."
              topology="Client Group → WAF → LB → 6x Microservices → DB + Cache + MQ"
              components={['client-group', 'waf', 'load-balancer', 'network-zone', 'api-gateway', 'service-discovery', 'message-queue', 'database', 'cache']}
              useCase="Architecture e-commerce complète avec séparation en zones (DMZ, Backend, Données). Testez la résilience, le scaling et la communication inter-services."
            />
          </div>

          {/* ═══ SECTION 5: MÉTRIQUES ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="metriques"
            label="Référence métriques"
            icon="05"
            color="oklch(0.72 0.19 155)"
            description="Les métriques collectées pendant la simulation et comment les interpréter."
          />

          {/* 5a. Global metrics */}
          <div id="metriques-globales" className="scroll-mt-16">
            <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Métriques globales</h2>
            <p className="text-sm text-foreground/80 leading-relaxed mb-3">
              Métriques affichées dans la barre de télémétrie pendant la simulation.
            </p>
            <div className="overflow-x-auto border border-border bg-card/30" style={{ borderRadius: '3px' }}>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-muted-foreground text-left border-b border-border bg-card/50">
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Métrique</th>
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Description</th>
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Interprétation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {globalMetrics.map((metric, i) => (
                    <tr key={metric.name} className={cn('text-foreground/80', i % 2 === 0 && 'bg-card/20')}>
                      <td className="py-2 px-4 text-foreground font-medium whitespace-nowrap">{metric.name}</td>
                      <td className="py-2 px-4">{metric.description}</td>
                      <td className="py-2 px-4 text-muted-foreground">{metric.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Color legend */}
            <div className="mt-4 p-3 border border-border bg-card/30 flex flex-wrap items-center gap-6" style={{ borderRadius: '3px' }}>
              <span className="text-[9px] font-mono uppercase text-muted-foreground font-semibold">Seuils</span>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <div className="w-2 h-2 rounded-full bg-signal-healthy" />
                <span className="text-signal-healthy">Sain</span>
                <span className="text-muted-foreground/50">&lt; 70%</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <div className="w-2 h-2 rounded-full bg-signal-warning" />
                <span className="text-signal-warning">Attention</span>
                <span className="text-muted-foreground/50">70-90%</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <div className="w-2 h-2 rounded-full bg-signal-critical" />
                <span className="text-signal-critical">Critique</span>
                <span className="text-muted-foreground/50">&gt; 90%</span>
              </div>
            </div>
          </div>

          {/* 5b. Rejection reasons */}
          <div id="metriques-rejets" className="scroll-mt-16 mt-8">
            <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Raisons de rejet</h2>
            <p className="text-sm text-foreground/80 leading-relaxed mb-3">
              Lorsqu&apos;une requête est rejetée, une raison est enregistrée dans les métriques. Voici les raisons possibles et comment les résoudre.
            </p>
            <div className="overflow-x-auto border border-border bg-card/30" style={{ borderRadius: '3px' }}>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-muted-foreground text-left border-b border-border bg-card/50">
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Raison</th>
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Description</th>
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Composants</th>
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Solution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rejectionReasons.map((r, i) => (
                    <tr key={r.reason} className={cn('text-foreground/80', i % 2 === 0 && 'bg-card/20')}>
                      <td className="py-2 px-4 text-foreground font-medium whitespace-nowrap">
                        <code className="px-1.5 py-0.5 text-[9px] font-mono border border-red-500/20 text-red-400 bg-red-500/10" style={{ borderRadius: '2px' }}>{r.reason}</code>
                      </td>
                      <td className="py-2 px-4">{r.description}</td>
                      <td className="py-2 px-4 text-muted-foreground whitespace-nowrap">{r.components}</td>
                      <td className="py-2 px-4 text-muted-foreground">{r.solution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5c. Interpretation guide */}
          <div id="metriques-interpretation" className="scroll-mt-16 mt-8">
            <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Guide d&apos;interprétation</h2>

            <div className="space-y-4">
              {/* RPS vs Latency */}
              <div className="p-4 border border-border bg-card/30" style={{ borderRadius: '3px' }}>
                <h3 className="font-mono text-[11px] font-semibold text-foreground mb-2">Comment lire un graphique RPS vs latence</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Le RPS (requêtes par seconde) et la latence sont inversement corrélés sous charge.
                  Quand le RPS augmente, la latence reste stable jusqu&apos;à un point d&apos;inflexion
                  où les ressources saturent. Au-delà, la latence augmente exponentiellement tandis que
                  le RPS plafonne ou diminue. Ce point d&apos;inflexion représente la capacité maximale
                  soutenable du système.
                </p>
              </div>

              {/* Bottleneck identification */}
              <div className="p-4 border border-border bg-card/30" style={{ borderRadius: '3px' }}>
                <h3 className="font-mono text-[11px] font-semibold text-foreground mb-2">Identifier les goulots d&apos;étranglement</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Utilisez la métrique <strong className="text-foreground">Saturation %</strong> de chaque serveur
                  pour identifier la ressource limitante. La saturation correspond au maximum de CPU, mémoire et réseau.
                  La première ressource à atteindre 100% est le goulot d&apos;étranglement. Surveillez aussi la file
                  d&apos;attente : une croissance continue indique que le serveur ne peut pas absorber le trafic entrant.
                </p>
              </div>

              {/* Typical patterns */}
              <div className="p-4 border border-border bg-card/30" style={{ borderRadius: '3px' }}>
                <h3 className="font-mono text-[11px] font-semibold text-foreground mb-2">Patterns typiques</h3>
                <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-signal-healthy mt-1.5 shrink-0" />
                    <span><strong className="text-foreground">Croissance linéaire</strong> — La latence augmente proportionnellement à la charge. Comportement sain avec dégradation linéaire. Le système scale prévisiblement.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-signal-warning mt-1.5 shrink-0" />
                    <span><strong className="text-foreground">Courbe en J</strong> — La latence reste basse puis explose soudainement. Typique de la dégradation quadratique ou exponentielle. Le point d&apos;inflexion indique la capacité maximale.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-signal-critical mt-1.5 shrink-0" />
                    <span><strong className="text-foreground">Plateau + effondrement</strong> — Le RPS plafonne puis chute brusquement. Les rejets augmentent. Le système est au-delà de sa capacité et commence à refuser du trafic.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 6: EDGES ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="edges"
            label="Connexions (Edges)"
            icon="06"
            color="oklch(0.75 0.18 75)"
            description="Les edges relient les composants et définissent le flux des requêtes. Chaque edge est configurable via un clic."
          />

          {/* 6a. Edge properties */}
          <div id="edges-proprietes" className="scroll-mt-16">
            <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Propriétés des edges</h2>
            <p className="text-sm text-foreground/80 leading-relaxed mb-3">
              Cliquez sur un edge pour ouvrir son panneau de configuration. Chaque edge possède les propriétés suivantes.
            </p>
            <div className="overflow-x-auto border border-border bg-card/30" style={{ borderRadius: '3px' }}>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-muted-foreground text-left border-b border-border bg-card/50">
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Propriété</th>
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Type</th>
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Défaut</th>
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {edgeProperties.map((prop, i) => (
                    <tr key={prop.name} className={cn('text-foreground/80', i % 2 === 0 && 'bg-card/20')}>
                      <td className="py-2 px-4 text-foreground font-medium whitespace-nowrap">{prop.name}</td>
                      <td className="py-2 px-4">
                        <span className={cn(
                          'px-1 py-px text-[9px] border',
                          prop.type === 'enum' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                          prop.type === 'number' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                          'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        )} style={{ borderRadius: '2px' }}>
                          {prop.type}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-muted-foreground">{prop.defaultValue}</td>
                      <td className="py-2 px-4 text-muted-foreground">{prop.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6b. Protocol matrix */}
          <div id="edges-protocoles" className="scroll-mt-16 mt-8">
            <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Matrice des protocoles</h2>
            <p className="text-sm text-foreground/80 leading-relaxed mb-3">
              Chaque type de composant supporte un ensemble de protocoles. Les composants de stockage (database, cache, message-queue) utilisent une connexion directe sans protocole applicatif.
            </p>
            <div className="overflow-x-auto border border-border bg-card/30" style={{ borderRadius: '3px' }}>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-muted-foreground text-left border-b border-border bg-card/50">
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Type composant</th>
                    <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Protocoles supportés</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {protocolMatrix.map((entry, i) => (
                    <tr key={entry.type} className={cn('text-foreground/80', i % 2 === 0 && 'bg-card/20')}>
                      <td className="py-2 px-4 text-foreground font-medium whitespace-nowrap">{entry.name}</td>
                      <td className="py-2 px-4">
                        {entry.protocols.length > 0 ? (
                          <div className="flex gap-1.5 flex-wrap">
                            {entry.protocols.map(p => (
                              <span key={p} className="px-1.5 py-0.5 text-[9px] font-mono border border-border text-muted-foreground" style={{ borderRadius: '2px' }}>
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[10px]">Connexion directe</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6c. Particle types */}
          <div id="edges-particules" className="scroll-mt-16 mt-8">
            <h2 className="font-mono text-sm font-semibold text-foreground mb-3">Particules animées</h2>
            <p className="text-sm text-foreground/80 leading-relaxed mb-3">
              Pendant la simulation, des particules animées circulent le long des edges pour visualiser le flux de requêtes et réponses.
            </p>
            <div className="space-y-2">
              {particleTypes.map(pt => (
                <div key={pt.type} className="flex items-center gap-3 p-3 border border-border bg-card/30" style={{ borderRadius: '3px' }}>
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: pt.color }}
                  />
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-foreground">{pt.label}</span>
                    <span className="text-[11px] text-muted-foreground ml-2">{pt.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ SECTION 7: TRACING DISTRIBUÉ ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="traces"
            label="Tracing distribué"
            icon="07"
            color="oklch(0.72 0.16 200)"
            description="Le simulateur trace chaque requête bout-en-bout à travers tous les composants traversés, générant des spans et des analyses de chemin critique."
          />

          {/* Concepts clés */}
          <div id="traces-concepts" className="scroll-mt-16">
            <h3 className="font-mono text-[11px] font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Concepts clés
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tracingConcepts.map(concept => (
                <div key={concept.title} className="p-3 border border-border bg-card/30" style={{ borderRadius: '3px' }}>
                  <h4 className="font-mono text-[11px] font-semibold text-foreground mb-1">{concept.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{concept.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* TraceSpan */}
          <div id="traces-span" className="scroll-mt-16 mt-8">
            <h3 className="font-mono text-[11px] font-semibold text-foreground mb-1 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Interface TraceSpan
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Unité de travail atomique — un span est créé à chaque traversée d&apos;un composant par une requête.
            </p>
            <div className="overflow-x-auto border border-border bg-card/30" style={{ borderRadius: '3px' }}>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-muted-foreground/70 text-left border-b border-border">
                    <th className="p-2 text-[8px] uppercase font-semibold">Champ</th>
                    <th className="p-2 text-[8px] uppercase font-semibold">Type</th>
                    <th className="p-2 text-[8px] uppercase font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {traceSpanFields.map(field => (
                    <tr key={field.name} className="text-foreground/80">
                      <td className="p-2 text-foreground font-medium whitespace-nowrap">{field.name}</td>
                      <td className="p-2">
                        <span className={cn(
                          'px-1 py-px text-[9px] border',
                          field.type === 'enum' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                          field.type === 'number' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                          field.type === 'object' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                          'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        )} style={{ borderRadius: '2px' }}>
                          {field.type}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground">{field.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RequestTrace */}
          <div id="traces-request" className="scroll-mt-16 mt-8">
            <h3 className="font-mono text-[11px] font-semibold text-foreground mb-1 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Interface RequestTrace
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Trace complète regroupant tous les spans d&apos;une chaîne de requêtes. Représente le parcours bout-en-bout.
            </p>
            <div className="overflow-x-auto border border-border bg-card/30" style={{ borderRadius: '3px' }}>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-muted-foreground/70 text-left border-b border-border">
                    <th className="p-2 text-[8px] uppercase font-semibold">Champ</th>
                    <th className="p-2 text-[8px] uppercase font-semibold">Type</th>
                    <th className="p-2 text-[8px] uppercase font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {requestTraceFields.map(field => (
                    <tr key={field.name} className="text-foreground/80">
                      <td className="p-2 text-foreground font-medium whitespace-nowrap">{field.name}</td>
                      <td className="p-2">
                        <span className={cn(
                          'px-1 py-px text-[9px] border',
                          field.type === 'enum' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                          field.type === 'number' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                          field.type === 'object' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                          'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        )} style={{ borderRadius: '2px' }}>
                          {field.type}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground">{field.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CriticalPathAnalysis */}
          <div id="traces-critical" className="scroll-mt-16 mt-8">
            <h3 className="font-mono text-[11px] font-semibold text-foreground mb-1 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Interface CriticalPathAnalysis
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Analyse automatique du chemin critique, détection des goulots d&apos;étranglement et des patterns N+1.
            </p>
            <div className="overflow-x-auto border border-border bg-card/30" style={{ borderRadius: '3px' }}>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-muted-foreground/70 text-left border-b border-border">
                    <th className="p-2 text-[8px] uppercase font-semibold">Champ</th>
                    <th className="p-2 text-[8px] uppercase font-semibold">Type</th>
                    <th className="p-2 text-[8px] uppercase font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {criticalPathFields.map(field => (
                    <tr key={field.name} className="text-foreground/80">
                      <td className="p-2 text-foreground font-medium whitespace-nowrap">{field.name}</td>
                      <td className="p-2">
                        <span className={cn(
                          'px-1 py-px text-[9px] border',
                          field.type === 'enum' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                          field.type === 'number' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                          field.type === 'object' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                          'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        )} style={{ borderRadius: '2px' }}>
                          {field.type}
                        </span>
                      </td>
                      <td className="p-2 text-muted-foreground">{field.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Guide du waterfall */}
          <div id="traces-waterfall" className="scroll-mt-16 mt-8">
            <h3 className="font-mono text-[11px] font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Guide du Waterfall
            </h3>
            <div className="space-y-3">
              {waterfallGuide.map(item => (
                <div key={item.title} className="p-3 border border-border bg-card/30" style={{ borderRadius: '3px' }}>
                  <h4 className="font-mono text-[11px] font-semibold text-foreground mb-1">{item.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ SECTION 8: ERREURS DE CONCEPTION ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="erreurs"
            label="Erreurs de conception"
            icon="08"
            color="oklch(0.65 0.22 25)"
            description="Erreurs courantes dans la conception d&apos;architectures et comment les corriger."
          />

          <div className="space-y-6">
            {errorCategories.map(category => {
              const errors = designErrors.filter(e => e.category === category);
              return (
                <div key={category}>
                  <h3 className="font-mono text-[11px] font-semibold text-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    {category}
                    <span className="text-[9px] font-mono px-1.5 py-0.5 border border-border text-muted-foreground" style={{ borderRadius: '2px' }}>
                      {errors.length}
                    </span>
                  </h3>
                  <div className="overflow-x-auto border border-border bg-card/30" style={{ borderRadius: '3px' }}>
                    <table className="w-full font-mono text-[11px]">
                      <thead>
                        <tr className="text-muted-foreground text-left border-b border-border bg-card/50">
                          <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Erreur</th>
                          <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Sévérité</th>
                          <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Description</th>
                          <th className="py-2.5 px-4 text-[9px] uppercase font-semibold">Solution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {errors.map((err, i) => (
                          <tr key={err.error} className={cn('text-foreground/80', i % 2 === 0 && 'bg-card/20')}>
                            <td className="py-2 px-4 text-foreground font-medium">{err.error}</td>
                            <td className="py-2 px-4 whitespace-nowrap">
                              <span className={cn(
                                'px-1.5 py-0.5 text-[9px] font-mono border',
                                err.severity === 'ERROR' && 'text-red-400 bg-red-500/10 border-red-500/20',
                                err.severity === 'WARNING' && 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                                err.severity === 'INFO' && 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                              )} style={{ borderRadius: '2px' }}>
                                {err.severity}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-muted-foreground">{err.description}</td>
                            <td className="py-2 px-4 text-muted-foreground">{err.solution}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom spacer */}
          <div className="h-16" />
        </main>
      </div>
    </div>
  );
}
