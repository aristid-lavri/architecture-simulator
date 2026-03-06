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
  Home,
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
    id: 'composants',
    label: 'Catalogue composants',
    icon: '02',
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
    ],
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: '03',
    color: 'oklch(0.68 0.18 290)',   // signal-server (purple)
    children: [],
  },
  {
    id: 'metriques',
    label: 'Métriques',
    icon: '04',
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
        <aside className="hidden md:flex flex-col w-56 border-r border-border shrink-0 overflow-y-auto">
          <div className="p-4 flex-1">
            <SidebarContent activeId={activeId} />
          </div>

          {/* Sidebar footer */}
          <div className="p-4 border-t border-border">
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
        <main ref={mainRef} className="flex-1 overflow-y-auto px-6 py-8 md:px-12 max-w-4xl">

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
                Ouvrez le panneau de composants à gauche (bouton <strong className="text-foreground">RACK</strong> dans le header). Les composants sont organisés en 3 catégories :
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

          {/* ═══ SECTION 2: COMPOSANTS ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="composants"
            label="Catalogue des composants"
            icon="02"
            color="oklch(0.70 0.15 220)"
            description="9 types de composants répartis en 3 catégories. Chaque composant est configurable via le panneau de propriétés."
          />

          {/* Category: Simulation */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-blue-500" style={{ borderRadius: '1px' }} />
              <span className="text-[10px] font-mono uppercase text-blue-400 font-semibold tracking-wider">Simulation</span>
              <div className="flex-1 h-px bg-blue-500/10" />
            </div>
            <div className="space-y-4">
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
            </div>
          </div>

          {/* Category: Infrastructure */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-purple-500" style={{ borderRadius: '1px' }} />
              <span className="text-[10px] font-mono uppercase text-purple-400 font-semibold tracking-wider">Infrastructure</span>
              <div className="flex-1 h-px bg-purple-500/10" />
            </div>
            <div className="space-y-4">
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
            </div>
          </div>

          {/* Category: Data */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-emerald-500" style={{ borderRadius: '1px' }} />
              <span className="text-[10px] font-mono uppercase text-emerald-400 font-semibold tracking-wider">Données</span>
              <div className="flex-1 h-px bg-emerald-500/10" />
            </div>
            <div className="space-y-4">
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
            </div>
          </div>

          {/* ═══ SECTION 3: TEMPLATES ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="templates"
            label="Templates d'architecture"
            icon="03"
            color="oklch(0.68 0.18 290)"
            description="4 architectures pré-configurées accessibles depuis le menu TPL dans le header."
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
          </div>

          {/* ═══ SECTION 4: MÉTRIQUES ═══ */}
          <div className="mt-16" />
          <SectionHeader
            id="metriques"
            label="Référence métriques"
            icon="04"
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
