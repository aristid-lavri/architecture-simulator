import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  Monitor, Server, Users, Shield, Share2, Database, Zap, MessageSquare,
  Layers, ShieldOff, Globe, ShieldCheck, Cloud, Box, Compass, HardDrive, KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { Assets, Texture } from 'pixi.js';
import { pluginRegistry } from '@/plugins/plugin-registry';

const ICON_MAP: Record<string, LucideIcon> = {
  'http-client': Monitor,
  'http-server': Server,
  'client-group': Users,
  'api-gateway': Shield,
  'load-balancer': Share2,
  'database': Database,
  'cache': Zap,
  'message-queue': MessageSquare,
  'network-zone': Layers,
  'host-server': Monitor,
  'circuit-breaker': ShieldOff,
  'cdn': Globe,
  'waf': ShieldCheck,
  'firewall': Shield,
  'serverless': Cloud,
  'container': Box,
  'api-service': Server,
  'background-job': Zap,
  'service-discovery': Compass,
  'dns': Globe,
  'cloud-storage': HardDrive,
  'cloud-function': Cloud,
  'identity-provider': KeyRound,
};

const ICON_RENDER_SIZE = 64; // Haute résolution pour rester net à tout zoom
const textureCache = new Map<string, Texture>();
let loadPromise: Promise<void> | null = null;

async function rasterizeAndCache(type: string, Icon: LucideIcon): Promise<void> {
  if (textureCache.has(type)) return;
  const svg = renderToStaticMarkup(
    createElement(Icon, {
      size: ICON_RENDER_SIZE,
      color: 'white',
      strokeWidth: 2,
    }),
  );
  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  const tex = await Assets.load<Texture>(dataUrl);
  textureCache.set(type, tex);
}

/**
 * Charge les icônes Lucide de TOUS les plugins enregistrés au moment de l'appel,
 * en évitant de re-rasteriser celles déjà en cache. Appelé une fois au boot et à chaque
 * notification du `pluginRegistry` pour rattraper les plugins enregistrés tardivement
 * (ex: bootstrap EE asynchrone après le mount du canvas).
 */
async function loadAllPluginIcons(): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const def of pluginRegistry.getNodeDefinitions()) {
    const pluginIcon = def.visual?.icon;
    if (!pluginIcon) continue;
    if (textureCache.has(def.type)) continue;
    tasks.push(rasterizeAndCache(def.type, pluginIcon));
  }
  if (tasks.length > 0) await Promise.all(tasks);
}

/**
 * Pré-génère les textures PixiJS pour toutes les icônes lucide (CE + plugins déjà enregistrés)
 * et installe un listener sur `pluginRegistry` pour charger à la volée les icônes des plugins
 * enregistrés tardivement.
 *
 * Idempotent : appels suivants retournent la même promesse.
 */
export function loadIconTextures(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const tasks = Object.entries(ICON_MAP).map(([type, Icon]) => rasterizeAndCache(type, Icon));
    await Promise.all(tasks);
    await loadAllPluginIcons();
  })();

  // Plugins enregistrés APRÈS le boot : on rattrape automatiquement leurs icônes.
  // Le listener fire-and-forget évite de bloquer la chaîne du registre.
  pluginRegistry.subscribe(() => {
    void loadAllPluginIcons();
  });

  return loadPromise;
}

/**
 * Charge à la demande la texture d'un type plugin (utile si le plugin est enregistré
 * après le boot initial). Retourne `true` si une texture a été générée (ou existait déjà),
 * `false` si le type n'a pas d'icône Lucide associée.
 */
export async function ensurePluginIcon(type: string): Promise<boolean> {
  if (textureCache.has(type)) return true;
  const Icon = pluginRegistry.getNodeVisual(type)?.icon;
  if (!Icon) return false;
  await rasterizeAndCache(type, Icon);
  return true;
}

/** Retourne la texture pour un type de composant (ou null si pas chargée / type inconnu). */
export function getIconTexture(type: string): Texture | null {
  return textureCache.get(type) ?? null;
}
