import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  Monitor, Server, Users, Shield, Share2, Database, Zap, MessageSquare,
  Layers, ShieldOff, Globe, ShieldCheck, Cloud, Box, Compass, HardDrive, KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { Assets, Texture } from 'pixi.js';

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

/**
 * Pré-génère les textures PixiJS pour toutes les icônes lucide.
 * Idempotent : les appels suivants retournent la même promesse.
 */
export function loadIconTextures(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const tasks = Object.entries(ICON_MAP).map(async ([type, Icon]) => {
      const svg = renderToStaticMarkup(
        createElement(Icon, {
          size: ICON_RENDER_SIZE,
          color: 'white',
          strokeWidth: 2,
        }),
      );
      // SVG → data URL (utf8 base64-safe)
      const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
      const tex = await Assets.load<Texture>(dataUrl);
      textureCache.set(type, tex);
    });
    await Promise.all(tasks);
  })();

  return loadPromise;
}

/** Retourne la texture pour un type de composant (ou null si pas chargée / type inconnu). */
export function getIconTexture(type: string): Texture | null {
  return textureCache.get(type) ?? null;
}
