/**
 * Ambient module stubs for the EE marketing-site plugin and its license dependency.
 *
 * The `(marketing)/` route group statically imports these modules in BOTH editions
 * (CE and EE) — the marketing site is brand-forward EE content but the routes
 * themselves render under the simulator host app, so webpack must resolve them
 * regardless of NEXT_PUBLIC_EDITION. The aliases live in `next.config.ts`.
 *
 * Mirroring the pattern in `enterprise-ds.d.ts`: declare modules ambiently so TS
 * does not attempt to type-check the EE source files (separate package root).
 */
declare module 'architecture-enterprise/plugins/marketing-site' {
  import type * as React from 'react';

  export const MarketingHeader: React.ComponentType;
  export const MarketingFooter: React.ComponentType;
  export const HeroChaos: React.ComponentType;

  export interface PricingTier {
    id: string;
    name: string;
    price: string;
    priceUnit?: string;
    bullets: string[];
    ctaLabel: string;
    ctaHref?: string;
    onCta?: () => void;
    highlighted?: boolean;
  }
  export const PricingCard: React.ComponentType<{ tier: PricingTier }>;

  export const SignUpForm: React.ComponentType<{ onSuccess?: () => void }>;
  export const SignInForm: React.ComponentType<{ onSuccess?: () => void }>;

  // i18n surface
  export type Locale = 'fr' | 'en';
  export const availableLocales: Locale[];
  export const localeNames: Record<Locale, string>;
  export const MARKETING_I18N_STORAGE_KEY: string;

  interface MarketingTier {
    name: string;
    price: string;
    priceUnit?: string;
    cta: string;
    bullets: readonly string[];
  }
  interface MarketingFaqItem { q: string; a: string }
  interface MarketingTranslations {
    header: { pricing: string; github: string; app: string; signIn: string; startTrial: string; locale: string };
    footer: { tagline: string; github: string };
    welcome: Record<string, string | { title: string; desc: string }>;
    pricing: {
      eyebrow: string;
      h1: string;
      sub: string;
      faqEyebrow: string;
      faqTitle: string;
      tiers: { community: MarketingTier; solo: MarketingTier; team: MarketingTier; enterprise: MarketingTier };
      faqItems: readonly MarketingFaqItem[];
    };
    signIn: { eyebrow: string; h1: string; sub: string; label: string; placeholder: string; cta: string; errors: Record<string, string> };
    signUp: { eyebrow: string; h1: string; sub: string; emailLabel: string; emailPlaceholder: string; nameLabel: string; namePlaceholder: string; cta: string; noCard: string; errors: Record<string, string> };
  }
  export function useMarketingTranslation(): {
    t: (key: string) => string;
    tList: (key: string) => string[];
    locale: Locale;
    setLocale: (locale: Locale) => void;
    translations: MarketingTranslations;
  };
  export const useMarketingLocaleStore: {
    (): { locale: Locale; setLocale: (locale: Locale) => void };
    getState: () => { locale: Locale; setLocale: (locale: Locale) => void };
    setState: (partial: Partial<{ locale: Locale }>) => void;
    subscribe: (cb: () => void) => () => void;
  };
}

declare module 'architecture-enterprise/plugins/license' {
  import type * as React from 'react';
  import type { StoreApi, UseBoundStore } from 'zustand';

  export type LicenseStatus = 'none' | 'trial-active' | 'expiring-soon' | 'active' | 'expired';
  export type Tier = 'community' | 'solo' | 'team' | 'enterprise';

  export interface LicenseState {
    status: LicenseStatus;
    tier: Tier;
    startedAt: number | null;
    expiresAt: number | null;
    licenseKey: string | null;
  }

  export interface ActivationResult {
    ok: boolean;
    error?: 'INVALID_FORMAT' | 'INVALID_CHECKSUM' | 'EXPIRED_KEY' | 'ALREADY_ACTIVE';
    newState?: LicenseState;
  }

  interface StoreApiShape extends LicenseState {
    startTrial: () => void;
    activate: (key: string) => ActivationResult;
    deactivate: () => void;
    refreshStatus: () => void;
    __setStateForTests: (s: Partial<LicenseState>) => void;
  }

  export const useLicenseStore: UseBoundStore<StoreApi<StoreApiShape>>;
  export function __resetLicenseStoreForTests(opts?: { keepStorage?: boolean }): void;

  // Selectors
  export function selectStatus(s: LicenseState): LicenseStatus;
  export function selectTier(s: LicenseState): Tier;
  export function selectIsUnlocked(s: LicenseState): boolean;
  export function selectReadOnly(s: LicenseState): boolean;
  export function selectDaysLeft(s: LicenseState): number | null;
  export function selectMaskedKey(s: LicenseState): string | null;

  export function validateLicenseKey(key: string): { ok: boolean; tier?: Tier; error?: ActivationResult['error'] };
  export function generateValidKeyForTests(tier: Tier): string;
  export function computeDaysLeft(expiresAt: number | null, now: number): number | null;
  export function deriveStatus(state: LicenseState, now: number): LicenseStatus;
  export function startTrialState(now: number): LicenseState;
  export function loadLicense(): LicenseState | null;
  export function saveLicense(s: LicenseState): void;
  export function clearLicense(): void;
  export const STORAGE_KEY: string;

  export const TRIAL_DAYS: number;
  export const EXPIRING_WINDOW_DAYS: number;

  export const LicenseDialog: React.ComponentType<{ open: boolean; onClose: () => void }>;
  export const TrialBanner: React.ComponentType<{ onActivate: () => void }>;
  export const ExpiredOverlay: React.ComponentType<{ onActivate: () => void }>;
  export const LicenseMenu: React.ComponentType<{ onActivate: () => void }>;
}
