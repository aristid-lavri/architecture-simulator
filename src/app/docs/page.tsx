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
} from 'lucide-react';
import { ComponentCard } from '@/components/docs/ComponentCard';
import { TemplateCard } from '@/components/docs/TemplateCard';
import { cn } from '@/lib/utils';

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
      { id: 'component-base-de-donnees', label: 'Base de données' },
      { id: 'component-cache', label: 'Cache' },
      { id: 'component-file-de-messages', label: 'File de messages' },
      { id: 'component-circuit-breaker', label: 'Circuit Breaker' },
      { id: 'component-cdn', label: 'CDN' },
      { id: 'component-waf', label: 'WAF' },
      { id: 'component-firewall', label: 'Firewall' },
      { id: 'component-serverless', label: 'Serverless' },
      { id: 'component-container', label: 'Container' },
      { id: 'component-service-discovery', label: 'Service Discovery' },
      { id: 'component-dns', label: 'DNS' },
      { id: 'component-cloud-storage', label: 'Cloud Storage' },
      { id: 'component-cloud-function', label: 'Cloud Function' },
      { id: 'component-zone-reseau', label: 'Zone Réseau' },
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
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onLinkClick?.();
    }
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

      {/* Content */}
      {isOpen && (
        <div className="border-t border-border/30 px-4 pt-4 pb-3 bg-background">
          <div className="space-y-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Collect all IDs for scroll spy
  const allIds = sections.flatMap(s => [s.id, ...s.children.map(c => c.id)]);
  const activeId = useScrollSpy(allIds);

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
                Des particules animées visualisent le flux des requêtes et réponses. Les composants changent de couleur selon leur état.
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
            description="22 types de composants répartis en 7 catégories. Chaque composant est configurable via le panneau de propriétés."
          />

          {/* Category: Simulation */}
          <CategoryAccordion label="Simulation" color="#3b82f6" count={3}>
              <ComponentCard
                icon={<Monitor className="w-4 h-4" />}
                name="Client HTTP"
                description="Envoie des requêtes HTTP vers un serveur. Point de départ du flux."
                category="simulation"
                properties={[
                  { name: 'method', type: 'enum', defaultValue: 'GET', description: 'Méthode HTTP (GET, POST, PUT, DELETE)' },
                  { name: 'path', type: 'string', defaultValue: '/api/data', description: 'Chemin de la requête' },
                  { name: 'mode', type: 'enum', defaultValue: 'single', description: 'Requête unique ou en boucle' },
                  { name: 'interval', type: 'number', defaultValue: '1000', description: 'Intervalle entre requêtes en ms (mode boucle)' },
                ]}
              />
              <ComponentCard
                icon={<Server className="w-4 h-4" />}
                name="Serveur HTTP"
                description="Reçoit et traite les requêtes HTTP. Simule la latence, les erreurs et la dégradation sous charge."
                category="simulation"
                properties={[
                  { name: 'responseDelay', type: 'number', defaultValue: '100', description: 'Latence de base en ms' },
                  { name: 'errorRate', type: 'number', defaultValue: '0', description: "Taux d'erreur (0-100%)" },
                  { name: 'resources.cpu', type: 'number', defaultValue: '4', description: 'Nombre de cœurs CPU' },
                  { name: 'resources.memory', type: 'number', defaultValue: '8192', description: 'Mémoire en MB' },
                  { name: 'connections.max', type: 'number', defaultValue: '100', description: 'Connexions simultanées max' },
                  { name: 'degradation', type: 'object', defaultValue: 'enabled', description: 'Augmentation de latence sous charge (linéaire/quadratique/exponentiel)' },
                ]}
              />
              <ComponentCard
                icon={<Users className="w-4 h-4" />}
                name="Groupe de clients"
                description="Simule 1 à 1000 clients virtuels pour stress testing avec distribution configurable."
                category="simulation"
                properties={[
                  { name: 'virtualClients', type: 'number', defaultValue: '10', description: 'Nombre de clients virtuels (1-1000)' },
                  { name: 'concurrency', type: 'enum', defaultValue: 'parallel', description: "Mode d'envoi : séquentiel ou parallèle" },
                  { name: 'distribution', type: 'enum', defaultValue: 'uniform', description: 'Distribution : uniform, random, burst' },
                  { name: 'rampUp.enabled', type: 'boolean', defaultValue: 'true', description: 'Montée en charge progressive' },
                  { name: 'rampUp.duration', type: 'number', defaultValue: '5000', description: 'Durée de la montée en charge (ms)' },
                  { name: 'baseInterval', type: 'number', defaultValue: '1000', description: 'Intervalle de base entre requêtes (ms)' },
                ]}
              />
          </CategoryAccordion>

          {/* Category: Infrastructure */}
          <CategoryAccordion label="Infrastructure" color="#a855f7" count={2}>
              <ComponentCard
                icon={<Shield className="w-4 h-4" />}
                name="API Gateway"
                description="Point d'entrée pour les requêtes API. Gère l'authentification, le rate limiting et le routage."
                category="infrastructure"
                properties={[
                  { name: 'authType', type: 'enum', defaultValue: 'none', description: "Type d'auth (none, API Key, JWT, OAuth2)" },
                  { name: 'authFailureRate', type: 'number', defaultValue: '0', description: "Taux d'échec auth (0-100%)" },
                  { name: 'rateLimiting.enabled', type: 'boolean', defaultValue: 'false', description: 'Activer la limitation de débit' },
                  { name: 'rateLimiting.rps', type: 'number', defaultValue: '100', description: 'Requêtes par seconde autorisées' },
                  { name: 'rateLimiting.burstSize', type: 'number', defaultValue: '10', description: 'Taille du burst autorisé' },
                  { name: 'baseLatencyMs', type: 'number', defaultValue: '10', description: 'Latence de base en ms' },
                ]}
              />
              <ComponentCard
                icon={<Share2 className="w-4 h-4" />}
                name="Load Balancer"
                description="Répartit la charge entre plusieurs serveurs selon un algorithme configurable."
                category="infrastructure"
                properties={[
                  { name: 'algorithm', type: 'enum', defaultValue: 'round-robin', description: 'Algorithme (Round Robin, Least Connections, IP Hash, Weighted)' },
                  { name: 'healthCheck.enabled', type: 'boolean', defaultValue: 'true', description: 'Activer le health check' },
                  { name: 'healthCheck.interval', type: 'number', defaultValue: '10', description: 'Intervalle du health check (s)' },
                  { name: 'healthCheck.threshold', type: 'number', defaultValue: '3', description: 'Échecs consécutifs avant exclusion' },
                  { name: 'stickySessions.enabled', type: 'boolean', defaultValue: 'false', description: 'Sessions persistantes (sticky)' },
                  { name: 'stickySessions.ttl', type: 'number', defaultValue: '300', description: 'Durée de la session (s)' },
                ]}
              />
          </CategoryAccordion>

          {/* Category: Data */}
          <CategoryAccordion label="Données" color="#10b981" count={3}>
              <ComponentCard
                icon={<Database className="w-4 h-4" />}
                name="Base de données"
                description="Stockage persistant avec pool de connexions et latences configurables."
                category="data"
                properties={[
                  { name: 'type', type: 'enum', defaultValue: 'postgresql', description: 'Type (PostgreSQL, MySQL, MongoDB)' },
                  { name: 'pool.maxConnections', type: 'number', defaultValue: '20', description: 'Connexions max dans le pool' },
                  { name: 'readLatency', type: 'number', defaultValue: '5', description: 'Latence lecture (ms)' },
                  { name: 'writeLatency', type: 'number', defaultValue: '10', description: 'Latence écriture (ms)' },
                  { name: 'maxQps', type: 'number', defaultValue: '1000', description: 'Max requêtes par seconde' },
                  { name: 'errorRate', type: 'number', defaultValue: '0', description: "Taux d'erreur (0-100%)" },
                ]}
              />
              <ComponentCard
                icon={<Zap className="w-4 h-4" />}
                name="Cache"
                description="Stockage temporaire en mémoire pour accès rapide. Simule les hit/miss et l'éviction."
                category="data"
                properties={[
                  { name: 'type', type: 'enum', defaultValue: 'redis', description: 'Type (Redis, Memcached)' },
                  { name: 'evictionPolicy', type: 'enum', defaultValue: 'lru', description: "Politique d'éviction (LRU, LFU, FIFO)" },
                  { name: 'maxMemory', type: 'number', defaultValue: '256', description: 'Mémoire max (MB)' },
                  { name: 'defaultTTL', type: 'number', defaultValue: '300', description: 'TTL par défaut (s)' },
                  { name: 'hitRatio', type: 'number', defaultValue: '80', description: 'Hit ratio initial (%)' },
                  { name: 'warmUp.enabled', type: 'boolean', defaultValue: 'false', description: 'Période de warm-up progressive' },
                ]}
              />
              <ComponentCard
                icon={<MessageSquare className="w-4 h-4" />}
                name="File de messages"
                description="Communication asynchrone entre services. Supporte FIFO et Pub/Sub."
                category="data"
                properties={[
                  { name: 'type', type: 'enum', defaultValue: 'rabbitmq', description: 'Type (RabbitMQ, Kafka, SQS)' },
                  { name: 'mode', type: 'enum', defaultValue: 'fifo', description: 'Mode (FIFO, Pub/Sub)' },
                  { name: 'maxQueueSize', type: 'number', defaultValue: '10000', description: 'Taille max de la file' },
                  { name: 'publishLatency', type: 'number', defaultValue: '5', description: 'Latence publication (ms)' },
                  { name: 'consumeLatency', type: 'number', defaultValue: '10', description: 'Latence consommation (ms)' },
                  { name: 'consumerCount', type: 'number', defaultValue: '1', description: 'Nombre de consommateurs' },
                ]}
              />
          </CategoryAccordion>

          {/* Category: Infrastructure (suite) */}
          <CategoryAccordion label="Infrastructure (suite)" color="#a855f7" count={5}>
              <ComponentCard
                icon={<Globe className="w-4 h-4" />}
                name="CDN"
                description="Content Delivery Network — cache en edge avec latence réduite. Simule les cache hit/miss."
                category="infrastructure"
                properties={[
                  { name: 'provider', type: 'enum', defaultValue: 'generic', description: 'Provider (Cloudflare, CloudFront, Akamai, Generic)' },
                  { name: 'cacheHitRatio', type: 'number', defaultValue: '85', description: 'Ratio de cache hit (0-100%)' },
                  { name: 'edgeLatencyMs', type: 'number', defaultValue: '5', description: 'Latence edge en ms (cache hit)' },
                  { name: 'originLatencyMs', type: 'number', defaultValue: '50', description: 'Latence origin en ms (cache miss)' },
                  { name: 'cacheTTLSeconds', type: 'number', defaultValue: '3600', description: 'TTL du cache en secondes' },
                ]}
              />
              <ComponentCard
                icon={<ShieldCheck className="w-4 h-4" />}
                name="WAF"
                description="Web Application Firewall — filtre les requêtes malveillantes (SQL injection, XSS, rate limiting)."
                category="infrastructure"
                properties={[
                  { name: 'provider', type: 'enum', defaultValue: 'generic', description: 'Provider (AWS WAF, Cloudflare, Azure WAF, Generic)' },
                  { name: 'blockRate', type: 'number', defaultValue: '5', description: 'Taux de blocage simulé (0-100%)' },
                  { name: 'inspectionLatencyMs', type: 'number', defaultValue: '2', description: "Latence d'inspection en ms" },
                  { name: 'rules.sqlInjection', type: 'boolean', defaultValue: 'true', description: 'Protection SQL Injection' },
                  { name: 'rules.xss', type: 'boolean', defaultValue: 'true', description: 'Protection XSS' },
                  { name: 'rules.rateLimiting', type: 'boolean', defaultValue: 'true', description: 'Rate limiting' },
                ]}
              />
              <ComponentCard
                icon={<ShieldOff className="w-4 h-4" />}
                name="Firewall"
                description="Firewall réseau — filtre le trafic par action par défaut (allow/deny) et ports autorisés."
                category="infrastructure"
                properties={[
                  { name: 'defaultAction', type: 'enum', defaultValue: 'allow', description: 'Action par défaut (allow, deny)' },
                  { name: 'inspectionLatencyMs', type: 'number', defaultValue: '1', description: "Latence d'inspection en ms" },
                  { name: 'allowedPorts', type: 'string', defaultValue: '80, 443, 8080', description: 'Ports autorisés (séparés par virgule)' },
                ]}
              />
              <ComponentCard
                icon={<Compass className="w-4 h-4" />}
                name="Service Discovery"
                description="Registre de services — résout dynamiquement les instances saines (Consul, Eureka, Kubernetes)."
                category="infrastructure"
                properties={[
                  { name: 'provider', type: 'enum', defaultValue: 'consul', description: 'Provider (Consul, Eureka, Kubernetes, Generic)' },
                  { name: 'lookupLatencyMs', type: 'number', defaultValue: '2', description: 'Latence de lookup en ms' },
                  { name: 'healthCheckIntervalMs', type: 'number', defaultValue: '10000', description: 'Intervalle health check en ms' },
                  { name: 'cacheTTLMs', type: 'number', defaultValue: '5000', description: 'TTL du cache de résolution en ms' },
                ]}
              />
              <ComponentCard
                icon={<Globe className="w-4 h-4" />}
                name="DNS"
                description="Résolution DNS avec TTL configurable et support du failover entre cibles."
                category="infrastructure"
                properties={[
                  { name: 'resolutionLatencyMs', type: 'number', defaultValue: '5', description: 'Latence de résolution en ms' },
                  { name: 'ttlSeconds', type: 'number', defaultValue: '300', description: 'TTL en secondes' },
                  { name: 'failoverEnabled', type: 'boolean', defaultValue: 'false', description: 'Activer le failover entre cibles' },
                ]}
              />
          </CategoryAccordion>

          {/* Category: Resilience */}
          <CategoryAccordion label="Résilience" color="#f43f5e" count={1}>
              <ComponentCard
                icon={<ShieldOff className="w-4 h-4" />}
                name="Circuit Breaker"
                description="Pattern Circuit Breaker — protège les services en aval. 3 états : closed, open, half-open."
                category="resilience"
                properties={[
                  { name: 'failureThreshold', type: 'number', defaultValue: '5', description: "Nombre d'erreurs avant ouverture du circuit" },
                  { name: 'successThreshold', type: 'number', defaultValue: '3', description: 'Succès nécessaires en half-open pour fermer' },
                  { name: 'timeout', type: 'number', defaultValue: '30000', description: "Délai avant passage en half-open (ms)" },
                  { name: 'halfOpenMaxRequests', type: 'number', defaultValue: '3', description: 'Requêtes autorisées en half-open' },
                ]}
              />
          </CategoryAccordion>

          {/* Category: Compute */}
          <CategoryAccordion label="Compute" color="#f59e0b" count={5}>
              <ComponentCard
                icon={<Cloud className="w-4 h-4" />}
                name="Serverless"
                description="Fonction serverless avec cold start, concurrence limitée et auto-scaling des instances."
                category="compute"
                properties={[
                  { name: 'provider', type: 'enum', defaultValue: 'aws', description: 'Provider (AWS, Azure, GCP, Generic)' },
                  { name: 'runtime', type: 'string', defaultValue: 'nodejs20.x', description: 'Runtime de la fonction' },
                  { name: 'memoryMB', type: 'number', defaultValue: '256', description: 'Mémoire allouée en MB' },
                  { name: 'coldStartMs', type: 'number', defaultValue: '500', description: 'Latence cold start en ms' },
                  { name: 'warmStartMs', type: 'number', defaultValue: '5', description: 'Latence warm start en ms' },
                  { name: 'concurrencyLimit', type: 'number', defaultValue: '100', description: 'Concurrence maximale' },
                  { name: 'minInstances', type: 'number', defaultValue: '0', description: "Instances minimum (provisioned)" },
                  { name: 'maxInstances', type: 'number', defaultValue: '100', description: 'Instances maximum' },
                ]}
              />
              <ComponentCard
                icon={<Box className="w-4 h-4" />}
                name="Container"
                description="Container Docker/Kubernetes avec replicas, limites de ressources et auto-scaling HPA."
                category="compute"
                properties={[
                  { name: 'image', type: 'string', defaultValue: 'app:latest', description: 'Image Docker' },
                  { name: 'replicas', type: 'number', defaultValue: '2', description: 'Nombre de replicas' },
                  { name: 'cpuLimit', type: 'string', defaultValue: '500m', description: 'Limite CPU (millicores)' },
                  { name: 'memoryLimit', type: 'string', defaultValue: '512Mi', description: 'Limite mémoire' },
                  { name: 'responseDelayMs', type: 'number', defaultValue: '20', description: 'Délai de réponse en ms' },
                  { name: 'autoScaling.enabled', type: 'boolean', defaultValue: 'true', description: 'Activer le HPA' },
                  { name: 'autoScaling.targetCPU', type: 'number', defaultValue: '70', description: 'Seuil CPU pour le scaling (%)' },
                ]}
              />
              <ComponentCard
                icon={<Monitor className="w-4 h-4" />}
                name="Serveur Hôte"
                description="Serveur physique ou VM hébergeant des containers Docker. Partage ses ressources CPU/RAM entre ses enfants."
                category="compute"
                properties={[
                  { name: 'os', type: 'enum', defaultValue: 'linux', description: "Système d'exploitation (Linux, Windows, macOS)" },
                  { name: 'ipAddress', type: 'string', defaultValue: '192.168.1.10', description: 'Adresse IP du serveur' },
                  { name: 'resources.cpu', type: 'number', defaultValue: '4', description: 'Nombre de cœurs CPU' },
                  { name: 'resources.memory', type: 'number', defaultValue: '4096', description: 'Mémoire en MB' },
                  { name: 'degradation', type: 'object', defaultValue: 'enabled', description: 'Dégradation de latence sous charge' },
                ]}
              />
              <ComponentCard
                icon={<Server className="w-4 h-4" />}
                name="API Service"
                description="Service API REST/gRPC hébergé dans un serveur ou container. Configurable en protocole et temps de réponse."
                category="compute"
                properties={[
                  { name: 'serviceName', type: 'string', defaultValue: 'my-service', description: 'Nom du service' },
                  { name: 'basePath', type: 'string', defaultValue: '/api', description: 'Route de base' },
                  { name: 'protocol', type: 'enum', defaultValue: 'rest', description: 'Protocole (REST, gRPC, WebSocket, GraphQL)' },
                  { name: 'responseTime', type: 'number', defaultValue: '50', description: 'Temps de réponse (ms)' },
                  { name: 'errorRate', type: 'number', defaultValue: '0', description: "Taux d'erreur (0-100%)" },
                  { name: 'maxConcurrentRequests', type: 'number', defaultValue: '100', description: 'Requêtes concurrentes max' },
                ]}
              />
              <ComponentCard
                icon={<Zap className="w-4 h-4" />}
                name="Background Job"
                description="Job en arrière-plan : cron (planifié), worker (consomme une queue), ou batch (traitement par lots)."
                category="compute"
                properties={[
                  { name: 'jobType', type: 'enum', defaultValue: 'worker', description: 'Type de job (cron, worker, batch)' },
                  { name: 'schedule', type: 'string', defaultValue: '—', description: 'Expression cron (type cron uniquement)' },
                  { name: 'concurrency', type: 'number', defaultValue: '1', description: 'Exécutions concurrentes max' },
                  { name: 'processingTimeMs', type: 'number', defaultValue: '500', description: 'Durée de traitement (ms)' },
                  { name: 'errorRate', type: 'number', defaultValue: '0', description: "Taux d'erreur (0-100%)" },
                ]}
              />
          </CategoryAccordion>

          {/* Category: Cloud */}
          <CategoryAccordion label="Cloud" color="#0ea5e9" count={2}>
              <ComponentCard
                icon={<HardDrive className="w-4 h-4" />}
                name="Cloud Storage"
                description="Stockage objet cloud (S3, Azure Blob, GCS) avec classes de stockage et rate limiting."
                category="cloud"
                properties={[
                  { name: 'provider', type: 'enum', defaultValue: 'aws', description: 'Provider (AWS S3, Azure Blob, GCS, Generic)' },
                  { name: 'storageClass', type: 'enum', defaultValue: 'standard', description: 'Classe (Standard, Infrequent Access, Archive)' },
                  { name: 'readLatencyMs', type: 'number', defaultValue: '20', description: 'Latence lecture en ms' },
                  { name: 'writeLatencyMs', type: 'number', defaultValue: '50', description: 'Latence écriture en ms' },
                  { name: 'maxRequestsPerSecond', type: 'number', defaultValue: '5500', description: 'Max requêtes par seconde' },
                ]}
              />
              <ComponentCard
                icon={<Cloud className="w-4 h-4" />}
                name="Cloud Function"
                description="Fonction cloud managée (AWS Lambda, Azure Function) — hérite de la configuration Serverless avec presets cloud."
                category="cloud"
                properties={[
                  { name: 'serviceType', type: 'enum', defaultValue: 'aws-lambda', description: 'Service (AWS Lambda, Azure Function, GCP Cloud Function)' },
                  { name: 'provider', type: 'enum', defaultValue: 'aws', description: 'Provider cloud' },
                  { name: 'coldStartMs', type: 'number', defaultValue: '500', description: 'Latence cold start en ms' },
                  { name: 'concurrencyLimit', type: 'number', defaultValue: '100', description: 'Concurrence maximale' },
                ]}
              />
          </CategoryAccordion>

          {/* Category: Zones */}
          <CategoryAccordion label="Zones" color="#64748b" count={1}>
              <ComponentCard
                icon={<Layers className="w-4 h-4" />}
                name="Zone Réseau"
                description="Zone de regroupement réseau (public, DMZ, backend, data). Les composants placés dans une zone héritent de sa latence inter-zone."
                category="zone"
                properties={[
                  { name: 'zoneType', type: 'enum', defaultValue: 'backend', description: 'Type de zone (public, dmz, backend, data, custom)' },
                  { name: 'domain', type: 'string', defaultValue: '', description: 'Domaine de la zone (ex: api.example.com)' },
                  { name: 'interZoneLatency', type: 'number', defaultValue: '0', description: 'Latence ajoutée pour les requêtes sortantes (ms)' },
                  { name: 'color', type: 'string', defaultValue: '#3b82f6', description: 'Couleur de la zone' },
                ]}
              />
          </CategoryAccordion>

          {/* ═══ SECTION 4: TEMPLATES ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="templates"
            label="Templates d'architecture"
            icon="04"
            color="oklch(0.68 0.18 290)"
            description="5 architectures pré-configurées accessibles depuis le menu TPL dans le header."
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
                {[
                  ['REQ', 'Requêtes envoyées', 'Volume total de trafic généré par les clients'],
                  ['RES', 'Réponses reçues', 'Total des réponses (succès + erreurs)'],
                  ['ERR (%)', "Taux d'erreur", '< 1% acceptable | 1-5% à surveiller | > 5% problème'],
                  ['P50', 'Latence médiane', 'La moitié des requêtes sont plus rapides'],
                  ['P95', 'Latence 95e percentile', '95% des requêtes sont sous ce seuil — indicateur clé'],
                  ['P99', 'Latence 99e percentile', 'Cas limite — révèle les pics de latence sous charge'],
                  ['RPS', 'Requêtes par seconde', 'Débit réel du système vs. débit attendu'],
                  ['CPU %', 'Utilisation CPU', '< 70% sain | 70-90% attention | > 90% saturation'],
                  ['RAM %', 'Utilisation mémoire', 'Mêmes seuils que CPU'],
                  ['Network %', 'Utilisation réseau', 'Bande passante relative au max configuré'],
                  ['Rejections', 'Requêtes rejetées', 'Capacité dépassée — ajoutez des serveurs'],
                  ['Queue', 'Requêtes en file', 'Indique du backpressure'],
                ].map(([metric, desc, interp], i) => (
                  <tr key={metric} className={cn('text-foreground/80', i % 2 === 0 && 'bg-card/20')}>
                    <td className="py-2 px-4 text-foreground font-medium whitespace-nowrap">{metric}</td>
                    <td className="py-2 px-4">{desc}</td>
                    <td className="py-2 px-4 text-muted-foreground">{interp}</td>
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

          {/* Bottom spacer */}
          <div className="h-16" />
        </main>
      </div>
    </div>
  );
}
