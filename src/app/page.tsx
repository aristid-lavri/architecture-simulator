'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Monitor, Sun, Moon, Github, Star } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { InstallPrompt } from '@/components/layout/InstallPrompt';

// ═══════════════════════════════════════
// SIGNAL Landing Page
// "Chaque pixel est un capteur"
// ═══════════════════════════════════════

// ── Hooks ──

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

function useMouseGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
  }, []);
  return { ref, onMove };
}

// ── Floating Orbs Background ──
// Blurred, animated orbs that drift behind the hero content
function FloatingOrbs() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = 0;
    let h = 0;

    const orbs = [
      { x: 0.2, y: 0.3, r: 180, vx: 0.08, vy: 0.05, color: [70, 130, 220] },  // client blue
      { x: 0.7, y: 0.6, r: 220, vx: -0.06, vy: 0.04, color: [120, 80, 210] },  // server purple
      { x: 0.5, y: 0.2, r: 150, vx: 0.04, vy: -0.07, color: [45, 184, 126] },  // data green
      { x: 0.8, y: 0.3, r: 160, vx: -0.05, vy: 0.06, color: [200, 147, 10] },  // infra amber
      { x: 0.3, y: 0.7, r: 130, vx: 0.07, vy: -0.03, color: [70, 130, 220] },  // client blue
    ];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      for (const orb of orbs) {
        orb.x += orb.vx * 0.001;
        orb.y += orb.vy * 0.001;

        // Bounce softly
        if (orb.x < -0.1 || orb.x > 1.1) orb.vx *= -1;
        if (orb.y < -0.1 || orb.y > 1.1) orb.vy *= -1;

        const gradient = ctx.createRadialGradient(
          orb.x * w, orb.y * h, 0,
          orb.x * w, orb.y * h, orb.r
        );
        const [r, g, b] = orb.color;
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.12)`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.04)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x * w, orb.y * h, orb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ filter: 'blur(80px)' }}
    />
  );
}

// ── Demo Node (replicates the real node-instrument style) ──
function DemoNode({ label, icon, color, children, status, className = '' }: {
  label: string; icon: string; color: string; children?: React.ReactNode;
  status: 'idle' | 'processing'; className?: string;
}) {
  return (
    <div className={`node-instrument relative ${className}`} style={{ minWidth: 130 }}>
      {/* Signal bar — identical to real nodes */}
      <div
        className={`node-signal-bar ${status === 'processing' ? 'signal-pulse' : ''}`}
        style={{ backgroundColor: color }}
      />
      {/* Handle left */}
      <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-[8px] h-[14px] rounded-sm border-[1.5px] bg-background" style={{ borderColor: 'var(--border)' }} />
      {/* Handle right */}
      <div className="absolute -right-[5px] top-1/2 -translate-y-1/2 w-[8px] h-[14px] rounded-sm border-[1.5px] bg-background" style={{ borderColor: 'var(--border)' }} />

      {/* Header — icon + label + status dot */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span style={{ color }} className="text-[10px]">{icon}</span>
          <span className="text-instrument text-[8px] text-muted-foreground">{label}</span>
        </div>
        <div
          className={`w-[5px] h-[5px] rounded-full ${status === 'processing' ? 'signal-pulse' : 'bg-muted-foreground/30'}`}
          style={status === 'processing' ? { backgroundColor: color } : undefined}
        />
      </div>

      {/* Content */}
      {children && (
        <div className="px-3 pb-2 font-mono text-[8px] text-muted-foreground space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Resource Gauge Bar (replicates ResourceGauges) ──
function GaugeBar({ label, pct }: { label: string; pct: number }) {
  const color = pct > 85 ? 'bg-signal-critical' : pct > 65 ? 'bg-signal-warning' : 'bg-signal-healthy';
  const textColor = pct > 85 ? 'text-signal-critical' : pct > 65 ? 'text-signal-warning' : 'text-signal-healthy';
  return (
    <div className="flex items-center gap-1">
      <span className="text-[7px] text-muted-foreground w-5 font-mono">{label}</span>
      <div className="flex-1 h-[2px] bg-border rounded-full overflow-hidden">
        <div className={`h-full resource-bar ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-[7px] font-mono w-6 text-right ${textColor}`}>{Math.round(pct)}%</span>
    </div>
  );
}

// ── Simulation Demo (Hero) ──
function SimulationDemo() {
  const [tick, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 50);
    return () => clearInterval(interval);
  }, []);

  // Simulated live metrics — same as real simulation
  const elapsed = Math.floor(tick / 20);
  const reqSent = Math.min(elapsed * 47, 2847);
  const rps = elapsed > 0 ? Math.min(Math.floor(reqSent / Math.max(elapsed, 1)), 94) : 0;
  const errCount = elapsed > 4 ? Math.floor((elapsed - 4) * 1.2) : 0;
  const avgLatency = Math.min(12 + elapsed * 3, 142);
  const cpuA = Math.min(20 + elapsed * 5, 87);
  const cpuB = Math.min(15 + elapsed * 4, 72);
  const activeClients = Math.min(elapsed * 20, 200);

  // Node positions (percentages for responsive layout)
  const nodePositions = [
    { left: '2%',  top: '30%' },  // client group
    { left: '24%', top: '38%' },  // load balancer
    { left: '48%', top: '8%' },   // server A
    { left: '48%', top: '60%' },  // server B
    { left: '74%', top: '34%' },  // database
  ];

  // Edge connection points (from right handle to left handle)
  const edges = [
    { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 1, to: 3 },
    { from: 2, to: 4 }, { from: 3, to: 4 },
  ];

  // Node handle offsets as percentages of SVG viewBox (100x100)
  // Node rendered width ≈ 130*0.72 = ~94px, on ~700px container ≈ 13%
  // Node rendered height varies ~55-70px, on 240px container ≈ 25%
  // Right handle: left% + 13%, vertical center: top% + 12%
  // Left handle: left% - 0.5%, vertical center: top% + 12%
  const NODE_W_PCT = 13;
  const NODE_H_HALF_PCT = 12;

  // Bezier edge path between two nodes (coordinates in 0-100 percentage space)
  function edgePath(fromIdx: number, toIdx: number): string {
    const fp = nodePositions[fromIdx];
    const tp = nodePositions[toIdx];
    const fx = parseFloat(fp.left) + NODE_W_PCT; // right handle
    const fy = parseFloat(fp.top) + NODE_H_HALF_PCT;
    const tx = parseFloat(tp.left) - 0.5;        // left handle
    const ty = parseFloat(tp.top) + NODE_H_HALF_PCT;
    const cx = (fx + tx) / 2;
    return `M ${fx} ${fy} C ${cx} ${fy}, ${cx} ${ty}, ${tx} ${ty}`;
  }

  // Particle position along bezier
  function particleOnBezier(fromIdx: number, toIdx: number, t: number) {
    const fp = nodePositions[fromIdx];
    const tp = nodePositions[toIdx];
    const fx = parseFloat(fp.left) + NODE_W_PCT;
    const fy = parseFloat(fp.top) + NODE_H_HALF_PCT;
    const tx = parseFloat(tp.left) - 0.5;
    const ty = parseFloat(tp.top) + NODE_H_HALF_PCT;
    const cx = (fx + tx) / 2;
    // Cubic bezier: B(t) = (1-t)^3*P0 + 3(1-t)^2*t*P1 + 3(1-t)*t^2*P2 + t^3*P3
    const u = 1 - t;
    const x = u*u*u*fx + 3*u*u*t*cx + 3*u*t*t*cx + t*t*t*tx;
    const y = u*u*u*fy + 3*u*u*t*fy + 3*u*t*t*ty + t*t*t*ty;
    // Tangent angle
    const dx = 3*u*u*(cx-fx) + 6*u*t*(cx-cx) + 3*t*t*(tx-cx);
    const dy = 3*u*u*(fy-fy) + 6*u*t*(ty-fy) + 3*t*t*(ty-ty);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return { x, y, angle };
  }

  const particleColors = {
    request: 'oklch(0.70 0.15 220)',
    success: 'oklch(0.72 0.19 155)',
    error: 'oklch(0.65 0.22 25)',
  };

  return (
    <div className="demo-card w-full max-w-3xl mx-auto border border-border overflow-hidden hover:border-signal-active/30 transition-all duration-500" style={{ borderRadius: '4px' }}>
      {/* Mini status bar — identical to Header.tsx */}
      <div className="h-5 bg-card border-b border-border flex items-center justify-between px-2 font-mono text-[8px] text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-3 w-3" />
          <span className="text-foreground font-display font-semibold tracking-wider text-[7px]">ARCH.SIM</span>
          <span className="text-border">|</span>
          <span className="text-signal-active font-semibold">SIM</span>
          <span className="text-border">|</span>
          <span>N:5 E:5</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-signal-active signal-pulse tabular-nums">00:{elapsed.toString().padStart(2, '0')}</span>
          <span className="bg-signal-active text-background px-1 py-px text-[7px] font-semibold" style={{ borderRadius: '1px' }}>RUNNING</span>
        </div>
      </div>

      {/* Canvas area — HTML nodes + SVG edges (like real FlowCanvas) */}
      <div className="bg-background relative overflow-hidden" style={{ height: '240px' }}>
        {/* Grid — Lines variant like real FlowCanvas */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.4 }}>
          <defs>
            <pattern id="demo-minor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--grid-minor)" strokeWidth="0.5" />
            </pattern>
            <pattern id="demo-major-grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--grid-major)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#demo-minor-grid)" />
          <rect width="100%" height="100%" fill="url(#demo-major-grid)" />
        </svg>

        {/* SVG layer — edges + particles (viewBox 0-100 maps to 0-100% of container) */}
        <svg ref={svgRef} viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <filter id="demo-particle-glow">
              <feGaussianBlur stdDeviation="0.4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Bezier edges — same 1.5px stroke as AnimatedEdge */}
          {edges.map((e, i) => (
            <path
              key={`edge-${i}`}
              d={edgePath(e.from, e.to)}
              fill="none"
              stroke="var(--border)"
              strokeWidth="0.3"
            />
          ))}

          {/* Particles — 14×2px streaks with glow, identical to AnimatedEdge */}
          <g filter="url(#demo-particle-glow)">
            {edges.map((e, ei) =>
              [0, 1, 2].map(pi => {
                const progress = ((tick * 2.5 + ei * 25 + pi * 33) % 100) / 100;
                const { x, y, angle } = particleOnBezier(e.from, e.to, progress);
                const isReturn = ei >= 3;
                const isError = isReturn && pi === 2 && elapsed > 4;
                const isSuccess = isReturn && pi === 1;
                const color = isError ? particleColors.error : isSuccess ? particleColors.success : particleColors.request;
                return (
                  <rect
                    key={`p-${ei}-${pi}`}
                    x={x - 1} y={y - 0.4}
                    width={2} height={0.8} rx={0.2}
                    fill={color} opacity={0.9}
                    transform={`rotate(${angle}, ${x}, ${y})`}
                  />
                );
              })
            )}
          </g>
        </svg>

        {/* HTML nodes — positioned absolutely, using real node-instrument class */}
        {/* Client Group */}
        <div className="absolute" style={{ left: nodePositions[0].left, top: nodePositions[0].top, transform: 'scale(0.72)', transformOrigin: 'top left' }}>
          <DemoNode label="CLIENT GROUP" icon="&#9823;" color="oklch(0.70 0.15 220)" status="processing">
            <div className="flex items-center justify-between">
              <span>parallel x5</span>
              <span>uniform</span>
            </div>
            <div className="flex items-center justify-between pt-0.5 border-t border-border/50">
              <span><span className="text-foreground font-semibold">{activeClients}</span>/200 active</span>
              <span className="text-foreground font-semibold">{rps} <span className="text-muted-foreground font-normal">rps</span></span>
            </div>
            <div className="text-center">{reqSent.toLocaleString()} req</div>
          </DemoNode>
        </div>

        {/* Load Balancer */}
        <div className="absolute" style={{ left: nodePositions[1].left, top: nodePositions[1].top, transform: 'scale(0.72)', transformOrigin: 'top left' }}>
          <DemoNode label="LOAD BALANCER" icon="&#8644;" color="oklch(0.75 0.18 75)" status="processing">
            <div className="flex items-center justify-between">
              <span className="text-signal-infra font-semibold">RR</span>
              <span>HC:ON</span>
            </div>
            <div className="pt-0.5 border-t border-border/50 space-y-0.5">
              <div className="flex items-center justify-between">
                <span>backends <span className="text-signal-healthy font-semibold">2</span>/2</span>
                <span>active <span className="text-foreground font-semibold">{Math.floor(activeClients * 0.4)}</span></span>
              </div>
            </div>
          </DemoNode>
        </div>

        {/* HTTP Server A */}
        <div className="absolute" style={{ left: nodePositions[2].left, top: nodePositions[2].top, transform: 'scale(0.72)', transformOrigin: 'top left' }}>
          <DemoNode label="HTTP SERVER" icon="&#9641;" color="oklch(0.68 0.18 290)" status="processing">
            <div className="flex items-center justify-between">
              <span>:8080</span>
              <span className="text-signal-healthy font-semibold">200</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{Math.round(avgLatency * 0.8)}ms</span>
            </div>
            <div className="pt-0.5 border-t border-border/50 space-y-0.5">
              <GaugeBar label="CPU" pct={cpuA} />
              <GaugeBar label="MEM" pct={cpuA * 0.6} />
            </div>
          </DemoNode>
        </div>

        {/* HTTP Server B */}
        <div className="absolute" style={{ left: nodePositions[3].left, top: nodePositions[3].top, transform: 'scale(0.72)', transformOrigin: 'top left' }}>
          <DemoNode label="HTTP SERVER" icon="&#9641;" color="oklch(0.68 0.18 290)" status="processing">
            <div className="flex items-center justify-between">
              <span>:8081</span>
              <span className="text-signal-healthy font-semibold">200</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{Math.round(avgLatency * 0.7)}ms</span>
            </div>
            <div className="pt-0.5 border-t border-border/50 space-y-0.5">
              <GaugeBar label="CPU" pct={cpuB} />
              <GaugeBar label="MEM" pct={cpuB * 0.55} />
            </div>
          </DemoNode>
        </div>

        {/* Database */}
        <div className="absolute" style={{ left: nodePositions[4].left, top: nodePositions[4].top, transform: 'scale(0.72)', transformOrigin: 'top left' }}>
          <DemoNode label="DATABASE" icon="&#9707;" color="oklch(0.72 0.19 155)" status="processing">
            <div className="flex items-center justify-between">
              <span className="text-signal-data font-semibold">PGSQL</span>
              <span>50 conn</span>
            </div>
            <div className="pt-0.5 border-t border-border/50 space-y-0.5">
              <GaugeBar label="POOL" pct={Math.min(activeClients * 0.3, 85)} />
              <div className="flex items-center justify-between">
                <span>latency {(avgLatency * 0.3).toFixed(1)}ms</span>
              </div>
            </div>
          </DemoNode>
        </div>

        {/* Mode badge — top left, same as real FlowCanvas */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 font-mono text-[7px] font-semibold text-signal-active border border-signal-active/30 bg-signal-active/10" style={{ borderRadius: '2px' }}>
          MODE:SIM
        </div>
      </div>

      {/* Mini telemetry bar — identical to MetricsPanel compact bar */}
      <div className="h-6 bg-card/95 border-t border-border flex items-center justify-between px-3 font-mono text-[8px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-signal-healthy signal-pulse" />
            <span className="uppercase text-[7px]">running</span>
          </div>
          <span className="text-border">|</span>
          <span>REQ:<span className="text-foreground ml-0.5">{reqSent.toLocaleString()}</span></span>
          <span>RES:<span className="text-foreground ml-0.5">{reqSent - errCount}</span></span>
          <span>ERR:<span className={errCount > 0 ? 'text-signal-critical ml-0.5' : 'text-foreground ml-0.5'}>{errCount}{reqSent > 0 ? ` (${((errCount / reqSent) * 100).toFixed(1)}%)` : ''}</span></span>
          <span className="text-border">|</span>
          <span>P50:<span className={`ml-0.5 ${avgLatency < 50 ? 'text-signal-healthy' : avgLatency < 100 ? 'text-signal-warning' : 'text-signal-critical'}`}>{avgLatency}ms</span></span>
          <span>RPS:<span className="text-foreground ml-0.5">{rps}</span></span>
        </div>
      </div>
    </div>
  );
}

// ── Terminal Degradation ──
function TerminalDegradation() {
  const { ref, isInView } = useInView();
  const [visibleLines, setVisibleLines] = useState(0);

  const lines = [
    { text: '[12:03:41] INFO  Server response: 200 OK (12ms)', color: 'text-signal-healthy' },
    { text: '[12:03:42] INFO  Server response: 200 OK (15ms)', color: 'text-signal-healthy' },
    { text: '[12:03:44] WARN  Server response: 200 OK (340ms)', color: 'text-signal-warning' },
    { text: '[12:03:45] WARN  CPU utilization: 87%', color: 'text-signal-warning' },
    { text: '[12:03:46] ERROR Server response: 503 Service Unavailable', color: 'text-signal-critical' },
    { text: '[12:03:46] ERROR Connection pool exhausted', color: 'text-signal-critical' },
    { text: '[12:03:47] FATAL Circuit breaker OPEN', color: 'text-signal-critical font-bold' },
  ];

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setVisibleLines(prev => {
        if (prev >= lines.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [isInView, lines.length]);

  return (
    <div ref={ref} className="bg-background border border-border p-4 font-mono text-[11px] leading-relaxed hover:border-signal-critical/30 transition-colors duration-500" style={{ borderRadius: '3px' }}>
      {lines.slice(0, visibleLines).map((line, i) => (
        <div key={i} className={`${line.color} animate-fade-in-up`} style={{ animationDelay: `${i * 80}ms` }}>
          {line.text}
        </div>
      ))}
      {visibleLines < lines.length && (
        <span className="terminal-cursor text-signal-active">_</span>
      )}
    </div>
  );
}

// ── Stat Counter (animated number) ──
function AnimatedStat({ value, label, color }: { value: string; label: string; color: string }) {
  const { ref, isInView } = useInView(0.3);
  return (
    <div
      ref={ref}
      className={`stat-card px-3 py-2.5 border border-border text-left transition-all duration-700 ${
        isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ borderRadius: '2px' }}
    >
      <span className="text-instrument text-[9px] text-muted-foreground block mb-0.5">{label}</span>
      <span className="text-foreground" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Main Page ──
export default function LandingPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const { theme, toggleTheme } = useAppStore();

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  const ctaGlow = useMouseGlow();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── STATUS BAR ── */}
      <div className={`h-8 border-b border-border flex items-center justify-between px-4 font-mono text-[10px] text-muted-foreground transition-all duration-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 group cursor-default">
            <img src="/logo.svg" alt="" className="h-4 w-4 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-foreground font-display font-semibold tracking-wider group-hover:text-signal-active transition-colors duration-300">ARCH.SIM</span>
          </div>
          <span className="text-border">|</span>
          <Link href="/simulator" className="hover:text-foreground transition-colors">SIMULATEUR</Link>
          <span className="text-border">|</span>
          <Link href="/docs" className="hover:text-foreground transition-colors">DOCS</Link>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://github.com/aristid-lavri/architecture-simulator" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
            <Github className="w-3 h-3" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <span className="text-border">|</span>
          <span className="text-signal-healthy hidden sm:inline">Open Source</span>
          <span className="text-border hidden sm:inline">|</span>
          <span className="hover:text-foreground transition-colors">v0.1</span>
          <span className="text-border">|</span>
          <button
            onClick={toggleTheme}
            className="hover:text-foreground transition-colors"
            aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
          >
            {theme === 'dark' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SECTION 1: HERO — Compact, emotional hook
          Objectif: Proposition de valeur en 3 secondes
         ══════════════════════════════════════════ */}
      <section className="min-h-[85vh] flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
        <FloatingOrbs />
        <div className="hero-dot-grid" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Logo */}
          <div className={`flex items-center gap-3 mb-8 transition-all duration-700 delay-200 ${heroLoaded ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
            <img src="/logo.svg" alt="ARCH.SIM" className="h-12 w-12 hover:rotate-6 transition-transform duration-500" />
            <span className="font-display font-bold tracking-wider text-2xl text-foreground">ARCH.SIM</span>
          </div>

          {/* Headline */}
          <h1
            className={`font-display font-bold text-center leading-tight mb-4 transition-all duration-700 delay-400 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            TESTEZ VOTRE ARCHITECTURE
            <br />
            <span className="text-signal-active hero-glow">AVANT DE LA CONSTRUIRE</span>
          </h1>

          {/* Subtitle — orienté résultat, pas features */}
          <p className={`font-mono text-sm text-muted-foreground text-center max-w-xl mb-10 leading-relaxed transition-all duration-700 delay-500 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            Modélisez vos composants distribués, simulez jusqu&apos;à 1000 clients virtuels,
            <br className="hidden sm:block" />
            et identifiez les bottlenecks avant votre premier déploiement.
          </p>

          {/* CTA */}
          <div className={`flex flex-col sm:flex-row items-center gap-4 transition-all duration-700 delay-700 ${heroLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div
              ref={ctaGlow.ref}
              onMouseMove={ctaGlow.onMove}
              className="cta-glow-wrapper relative"
            >
              <Link
                href="/simulator"
                className="cta-button group relative inline-flex items-center gap-2 bg-signal-active text-background font-display font-semibold text-sm uppercase tracking-wider px-8 py-3 transition-all duration-300 hover:shadow-[0_0_30px_oklch(0.75_0.18_75_/_30%)] hover:scale-[1.02] active:scale-[0.98]"
                style={{ borderRadius: '2px' }}
              >
                LANCER LE SIMULATEUR
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
              </Link>
            </div>
            <Link
              href="/docs"
              className="group inline-flex items-center gap-2 border border-border text-muted-foreground font-display font-semibold text-sm uppercase tracking-wider px-6 py-3 transition-all duration-300 hover:border-foreground/30 hover:text-foreground hover:scale-[1.02] active:scale-[0.98]"
              style={{ borderRadius: '2px' }}
            >
              <BookOpen className="w-4 h-4" />
              DOCUMENTATION
            </Link>
          </div>

          <p className={`font-mono text-[10px] text-muted-foreground/70 mt-5 transition-all duration-700 delay-900 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}>
            Open Source &bull; Gratuit &bull; Aucune inscription &bull; Première simulation en 2 min
          </p>

          <a
            href="https://github.com/aristid-lavri/architecture-simulator"
            target="_blank"
            rel="noopener noreferrer"
            className={`group inline-flex items-center gap-2 border border-border text-muted-foreground font-mono text-[11px] px-4 py-1.5 mt-2 transition-all duration-500 hover:border-foreground/30 hover:text-foreground hover:scale-[1.02] active:scale-[0.98] ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ borderRadius: '2px', transitionDelay: '950ms' }}
          >
            <Github className="w-3.5 h-3.5" />
            <Star className="w-3 h-3 group-hover:text-signal-warning transition-colors duration-300" />
            Star on GitHub
          </a>

          <div className={`flex items-center gap-1.5 mt-3 font-mono text-[11px] font-semibold text-muted-foreground/50 transition-all duration-700 delay-1000 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <Monitor className="w-3.5 h-3.5" />
            <span>Expérience optimisée pour desktop</span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-all duration-700 delay-1100 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}>
          <span className="font-mono text-[9px] text-muted-foreground/50">SCROLL</span>
          <div className="scroll-indicator w-px h-8 bg-gradient-to-b from-muted-foreground/30 to-transparent" />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2: DIAGNOSTIC — Le problème
          Objectif: Créer la tension. "Tu connais ce moment."
         ══════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12">
          <RevealBlock className="md:col-span-2 space-y-4" direction="left">
            <span className="text-instrument text-[10px] text-muted-foreground">DIAGNOSTIC</span>
            <h2 className="font-display font-bold text-2xl leading-tight">
              Vos diagrammes n&apos;ont jamais vu une requête réelle.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vous dessinez des boîtes et des flèches sur un whiteboard.
              En production, le load balancer sature à 200 rps, le pool de connexions s&apos;épuise,
              et le circuit breaker s&apos;ouvre à 3h du matin.
            </p>
            <p className="text-sm text-muted-foreground/60 leading-relaxed">
              Vous le découvrez en post-mortem. Nous pensons que vous devriez le découvrir avant.
            </p>
          </RevealBlock>

          <RevealBlock className="md:col-span-3" direction="right" delay={200}>
            <TerminalDegradation />
          </RevealBlock>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 3: DEMO LIVE — La solution
          Objectif: "Voilà ce que ça change." Preuve immédiate.
         ══════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <RevealBlock>
            <div className="text-center mb-10">
              <span className="text-instrument text-[10px] text-muted-foreground block mb-3">LA SOLUTION</span>
              <h2 className="font-display font-bold text-2xl leading-tight">
                Simulez avant de déployer.
              </h2>
              <p className="font-mono text-sm text-muted-foreground mt-3 max-w-lg mx-auto">
                Votre architecture, soumise à une charge réelle. Les métriques que vous cherchez en post-mortem, accessibles en temps réel.
              </p>
            </div>
          </RevealBlock>

          <RevealBlock delay={200}>
            <SimulationDemo />
            <p className="text-center font-mono text-[9px] text-muted-foreground/50 mt-2">
              Aperçu en temps réel — lancez le simulateur pour interagir
            </p>
          </RevealBlock>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 4: COMMENT ÇA MARCHE — 3 steps
          Objectif: Rassurer sur la simplicité du workflow
         ══════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <RevealBlock>
            <span className="text-instrument text-[10px] text-muted-foreground block text-center mb-8">COMMENT ÇA MARCHE</span>
          </RevealBlock>

          <div className="relative">
            <div className="hidden md:block absolute top-[22px] left-[16.66%] right-[16.66%] h-px bg-border z-0" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              <InstrumentBlock
                color="oklch(0.70 0.15 220)"
                label="MODÉLISATION"
                step="01"
                title="Dessinez. Connectez. Configurez."
                description="9 types de composants : clients, serveurs, load balancers, caches, bases de données. Chacun avec ses paramètres réalistes. Ou tout définir en YAML."
                delay={0}
              />
              <InstrumentBlock
                color="oklch(0.75 0.18 75)"
                label="SIMULATION"
                step="02"
                title="Lancez la charge. Observez."
                description="Jusqu'à 1000 clients virtuels en parallèle, montée en charge progressive, distribution configurable. Votre architecture prend vie."
                delay={150}
              />
              <InstrumentBlock
                color="oklch(0.65 0.22 25)"
                label="ANALYSE"
                step="03"
                title="Trouvez les ruptures."
                description="Latence P50/P95/P99, taux d'erreur, saturation CPU/mémoire par noeud. Le tout visualisé en temps réel."
                delay={300}
              />
            </div>
          </div>

          {/* CTA intermédiaire */}
          <RevealBlock delay={400}>
            <div className="text-center mt-14">
              <p className="font-mono text-[11px] text-muted-foreground mb-4">Première simulation en 2 minutes. Sans inscription.</p>
              <Link
                href="/simulator"
                className="group inline-flex items-center gap-2 border border-signal-active/40 text-signal-active font-display font-semibold text-sm uppercase tracking-wider px-6 py-2.5 transition-all duration-300 hover:bg-signal-active/10 hover:border-signal-active/60 hover:scale-[1.02] active:scale-[0.98]"
                style={{ borderRadius: '2px' }}
              >
                ESSAYER MAINTENANT
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 4b: YAML — Infrastructure as Code
          Objectif: Mettre en avant le workflow YAML
         ══════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <RevealBlock direction="left">
            <span className="text-instrument text-[10px] text-signal-infra block mb-3">YAML-FIRST</span>
            <h2 className="font-display font-bold text-2xl leading-tight mb-4">
              Votre architecture,{' '}
              <span className="text-signal-infra">en quelques lignes.</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Pas besoin de drag &amp; drop. Décrivez vos composants, zones et connexions en YAML.
              Importez, exportez, versionnez. Votre infrastructure devient du code.
            </p>
            <ul className="space-y-2 font-mono text-[11px] text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-signal-infra shrink-0" />
                Import / export en un clic
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-signal-infra shrink-0" />
                Compatible Git — diff, review, historique
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-signal-infra shrink-0" />
                Zones réseau, 17 types de composants
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-signal-infra shrink-0" />
                Éditeur intégré avec validation instantanée
              </li>
            </ul>
          </RevealBlock>

          <RevealBlock direction="right" delay={200}>
            <div className="border border-border overflow-hidden" style={{ borderRadius: '3px' }}>
              {/* Mini header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/80">
                <div className="flex items-center gap-2">
                  <div className="yaml-signal-bar-static h-0.5 w-4 rounded-full bg-signal-infra" />
                  <span className="text-instrument text-[8px] text-signal-infra">YAML</span>
                  <span className="text-border text-[8px]">|</span>
                  <span className="font-mono text-[8px] text-muted-foreground">architecture.yaml</span>
                </div>
                <span className="font-mono text-[7px] text-muted-foreground/40">UTF-8</span>
              </div>
              {/* Code block */}
              <div className="bg-muted/20 p-4 font-mono text-[10px] leading-relaxed">
                <div className="flex">
                  <div className="select-none pr-3 text-right text-muted-foreground/25 shrink-0">
                    {Array.from({ length: 18 }, (_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <pre className="text-foreground overflow-x-auto"><code>{`version: 1
name: "E-commerce API"

zones:
  backend:
    type: backend
    domain: "api.shop.com"

components:
  clients:
    type: client-group
    config:
      virtualClients: 200

  api:
    type: http-server
    zone: backend
    config: { port: 8080 }`}</code></pre>
                </div>
              </div>
              {/* Status bar */}
              <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-card/80 font-mono text-[7px] text-muted-foreground/40">
                <span>LN:18 CH:284 KEYS:4</span>
                <span>YAML</span>
              </div>
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 5: CAS D'USAGE — Remplace "Sous le capot"
          Objectif: Ancrer dans des scénarios concrets
         ══════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <RevealBlock>
            <div className="text-center mb-12">
              <span className="text-instrument text-[10px] text-muted-foreground block mb-3">CAS D&apos;USAGE</span>
              <h2 className="font-display font-bold text-2xl">À quoi ça sert concrètement ?</h2>
            </div>
          </RevealBlock>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                color: 'oklch(0.70 0.15 220)',
                title: 'Valider un scaling strategy',
                description: 'Votre API tient-elle 5000 rps avec 3 serveurs derrière un load balancer ? Round-robin ou least-connections ? Testez les deux en 30 secondes.',
                label: 'CAPACITY PLANNING',
              },
              {
                color: 'oklch(0.72 0.19 155)',
                title: 'Trouver le bottleneck',
                description: 'Pool de connexions DB saturé ? CPU serveur à 95% ? Cache miss rate trop élevé ? Identifiez le maillon faible avant qu\'il casse en prod.',
                label: 'PERFORMANCE AUDIT',
              },
              {
                color: 'oklch(0.68 0.18 290)',
                title: 'Comparer des architectures',
                description: 'Monolithe vs microservices, cache-aside vs write-through, sync vs event-driven. Simulez chaque option et comparez les métriques.',
                label: 'ARCHITECTURE DECISION',
              },
            ].map((useCase, i) => (
              <RevealBlock key={useCase.label} delay={i * 150}>
                <div
                  className="border border-border p-5 h-full group hover:border-border/80 transition-all duration-300 cursor-default"
                  style={{ borderRadius: '3px', borderTopWidth: '2px', borderTopColor: useCase.color }}
                >
                  <span className="text-instrument text-[9px] block mb-2" style={{ color: useCase.color }}>{useCase.label}</span>
                  <h3 className="font-display font-semibold text-base mb-2 group-hover:translate-x-0.5 transition-transform duration-300">{useCase.title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{useCase.description}</p>
                </div>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 6: CTA FINAL — Accès anticipé
          Objectif: Conversion finale + contexte projet privé
         ══════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-card relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, oklch(0.75 0.18 75), transparent)', filter: 'blur(80px)' }} />
        </div>

        <RevealBlock>
          <div className="max-w-lg mx-auto text-center space-y-6 relative z-10">
            <h2 className="font-display font-bold text-2xl">
              VOTRE PROCHAINE ARCHITECTURE<br />
              <span className="text-signal-active">MÉRITE MIEUX QU&apos;UN WHITEBOARD</span>
            </h2>

            <Link
              href="/simulator"
              className="group inline-flex items-center gap-2 bg-signal-active text-background font-display font-semibold text-sm uppercase tracking-wider px-10 py-4 transition-all duration-300 hover:shadow-[0_0_40px_oklch(0.75_0.18_75_/_30%)] hover:scale-[1.02] active:scale-[0.98]"
              style={{ borderRadius: '2px' }}
            >
              OUVRIR LE SIMULATEUR
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
            </Link>

            <p className="font-mono text-[10px] text-muted-foreground">
              Open Source &bull; Gratuit &bull; Données 100% locales (localStorage)
            </p>

            <div className="pt-4 border-t border-border/50 space-y-3">
              <p className="font-mono text-[10px] text-muted-foreground/60">
                Projet open source — contributions bienvenues.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a
                  href="https://github.com/aristid-lavri/architecture-simulator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 border border-border text-muted-foreground font-mono text-[11px] px-4 py-1.5 transition-all duration-300 hover:border-foreground/30 hover:text-foreground hover:scale-[1.02] active:scale-[0.98]"
                  style={{ borderRadius: '2px' }}
                >
                  <Github className="w-3.5 h-3.5" />
                  Voir sur GitHub
                </a>
                <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 font-mono text-[10px]">
                  Documentation
                </Link>
              </div>
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* ── PWA Install Banner ── */}
      <InstallPrompt />

      {/* ── FOOTER ── */}
      <footer className="h-12 border-t border-border flex items-center justify-center gap-2 font-mono text-[10px] text-muted-foreground">
        <img src="/logo.svg" alt="" className="h-3.5 w-3.5 opacity-50 hover:opacity-100 hover:scale-110 transition-all duration-300" />
        ARCH.SIM v0.1 &bull; NEXT.JS 16 &bull; REACT 19 &bull; TYPESCRIPT 5
        <span className="text-border">&bull;</span>
        <a href="https://github.com/aristid-lavri/architecture-simulator" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
          <Github className="w-3 h-3" />
          GitHub
        </a>
      </footer>
    </div>
  );
}

// ── Reveal Block (scroll-triggered) ──
function RevealBlock({
  children,
  className = '',
  direction = 'up',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'left' | 'right';
  delay?: number;
}) {
  const { ref, isInView } = useInView(0.15);
  const translate = direction === 'left' ? 'translate-x-[-30px]' : direction === 'right' ? 'translate-x-[30px]' : 'translate-y-[30px]';

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className} ${
        isInView ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${translate}`
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ── Instrument Block (horizontal step card) ──
function InstrumentBlock({
  color,
  label,
  step,
  title,
  description,
  delay = 0,
}: {
  color: string;
  label: string;
  step: string;
  title: string;
  description: string;
  delay?: number;
}) {
  const { ref, isInView } = useInView();
  const glowRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = glowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Step number circle */}
      <div className="flex justify-center mb-4">
        <div
          className="w-11 h-11 flex items-center justify-center font-mono text-xs font-bold border-2 bg-background"
          style={{ borderColor: color, color, borderRadius: '50%' }}
        >
          {step}
        </div>
      </div>

      <div
        ref={glowRef}
        onMouseMove={onMove}
        className="instrument-card border border-border p-5 relative overflow-hidden group cursor-default h-full"
        style={{ borderRadius: '3px', borderTopWidth: '2px', borderTopColor: color }}
      >
        {/* Mouse-follow glow */}
        <div
          className="pointer-events-none absolute w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle, ${color}15, transparent 70%)`,
            left: 'var(--glow-x, 50%)',
            top: 'var(--glow-y, 50%)',
            transform: 'translate(-50%, -50%)',
          }}
        />

        <span className="text-instrument text-[10px] block mb-2 relative z-10 group-hover:tracking-widest transition-all duration-500" style={{ color }}>
          {label}
        </span>
        <h3 className="font-display font-semibold text-base mb-2 relative z-10 group-hover:translate-x-1 transition-transform duration-300">{title}</h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed relative z-10">{description}</p>
      </div>
    </div>
  );
}
