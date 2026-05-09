/**
 * Ambient module stubs for EE design system imports.
 *
 * These modules are resolved by webpack alias at build time in EE edition
 * (`NEXT_PUBLIC_EDITION=enterprise`). The declarations here prevent TypeScript
 * from erroring on static imports in dev story pages — actual types come from
 * the compiled EE bundle at runtime. The real source lives at
 * `../architecture-enterprise/plugins/_design-system/`.
 *
 * We declare the module as ambient (not via tsconfig `paths`) so TypeScript
 * does NOT attempt to type-check the EE source files, which have their own
 * dependency resolution from a separate package root.
 */
declare module '@/_ds' {
  import type * as React from 'react';

  // Tokens
  export const eeTokens: Record<string, string>;
  export const categoryHues: Record<string, number>;

  // Primitives
  export type EEBadgeSize = 'xs' | 'sm' | 'md';
  export const EEBadge: React.ComponentType<{ size?: EEBadgeSize; muted?: boolean; className?: string }>;

  export type GovernanceBadgeSize = 'xs' | 'sm' | 'md';
  export const GovernanceBadge: React.ComponentType<{ size?: GovernanceBadgeSize; label?: string; className?: string }>;

  export type GovernanceStripVariant = 'default' | 'with-actions';
  export const GovernanceStrip: React.ComponentType<{
    variant?: GovernanceStripVariant;
    actionHref?: string;
    actionLabel?: string;
    children?: React.ReactNode;
    className?: string;
  }>;

  export const LockedOverlay: React.ComponentType<{ onUnlock?: () => void; className?: string }>;

  // Components
  export type ButtonEEVariant = 'primary' | 'ghost' | 'ee' | 'ee-ghost' | 'govern' | 'govern-ghost';
  export type ButtonEESize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';
  export const ButtonEE: React.ComponentType<
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: ButtonEEVariant;
      size?: ButtonEESize;
      withGlyph?: boolean;
    }
  >;
  export function buttonEEVariants(opts?: { variant?: ButtonEEVariant; size?: ButtonEESize; className?: string }): string;

  export const CardEE: React.ComponentType<
    React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'ee' }
  >;

  export const TabsEE: React.ComponentType<React.HTMLAttributes<HTMLDivElement> & { defaultValue?: string; value?: string; onValueChange?: (v: string) => void }>;
  export const TabsEEList: React.ComponentType<React.HTMLAttributes<HTMLDivElement>>;
  export const TabsEETrigger: React.ComponentType<React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string; gated?: boolean }>;
  export const TabsEEContent: React.ComponentType<React.HTMLAttributes<HTMLDivElement> & { value: string }>;

  export const DropdownItemEE: React.ComponentType<React.HTMLAttributes<HTMLDivElement> & { gated?: boolean; glyph?: string }>;

  export const EEPanelHeader: React.ComponentType<{ title: string; className?: string; children?: React.ReactNode }>;
  export const EEEmptyState: React.ComponentType<{ line: string; hint?: string; ctaLabel?: string; onCta?: () => void; className?: string }>;

  export const PaywallDialog: React.ComponentType<Record<string, unknown>>;
  export const WorkspaceFrame: React.ComponentType<{
    mode: string;
    title: string;
    onBack: () => void;
    toolbar: React.ReactNode;
    governance?: React.ReactNode;
    footer: React.ReactNode;
    children: React.ReactNode;
    className?: string;
  }>;

  export const HeaderPills: React.ComponentType<Record<string, unknown>>;

  export type CmdKSection = 'workspaces' | 'actions' | 'navigation';
  export interface CmdKItem {
    id: string;
    section: CmdKSection;
    name: string;
    glyph?: '◆' | '⬢';
    kbd?: string;
  }
  export const CmdKPalette: React.ComponentType<{
    open: boolean;
    items: CmdKItem[];
    onSelect: (item: CmdKItem) => void;
    onClose: () => void;
    initialQuery?: string;
    placeholder?: string;
  }>;

  export interface InspectorNode {
    id: string;
    type: string;
    label: string;
    meta?: Record<string, string>;
  }
  export const Inspector: React.ComponentType<{
    node: InspectorNode;
    onClose: () => void;
    onCta: () => void;
    ctaLabel: string;
    linkLabel?: string;
    onLink?: () => void;
    className?: string;
  }>;

  // Registry
  export function registerPaywall(id: string, content: Record<string, unknown>): void;
  export function unregisterPaywall(id: string): void;
  export function getPaywall(id: string): Record<string, unknown> | undefined;
  export function listPaywalls(): Record<string, unknown>[];
  export const paywalls: Map<string, Record<string, unknown>>;

  export function registerWorkspace(entry: Record<string, unknown>): void;
  export function unregisterWorkspace(id: string): void;
  export function listWorkspaces(): Record<string, unknown>[];
  export function subscribeWorkspaces(cb: () => void): () => void;

  // Hooks
  export function useFeatureGate(feature: string): Record<string, unknown>;
  export function useGovernance(): Record<string, unknown>;
  export function useWorkspaceMode(): Record<string, unknown>;
}

declare module 'architecture-enterprise/plugins/_design-system' {
  export * from '@/_ds';
}
