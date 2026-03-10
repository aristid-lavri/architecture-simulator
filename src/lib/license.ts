import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LicenseTier } from '@/types';

/** Features reservees a l'edition Enterprise. */
const enterpriseFeatures = new Set<string>([
  // Placeholder — les features EE seront ajoutees au fil des phases
  'team-collaboration',
  'sso-auth',
  'advanced-export',
  'custom-branding',
]);

interface LicenseState {
  tier: LicenseTier;
  licenseKey?: string;
  setLicenseKey: (key: string) => void;
  clearLicense: () => void;
}

/**
 * Store Zustand pour la licence.
 * Persiste dans localStorage sous 'architecture-simulator-license'.
 */
export const useLicenseStore = create<LicenseState>()(
  persist(
    (set) => ({
      tier: 'community',
      licenseKey: undefined,

      setLicenseKey: (key: string) => {
        // Validation basique — en production ce serait une verification serveur
        if (key && key.startsWith('ASE-')) {
          set({ tier: 'enterprise', licenseKey: key });
        }
      },

      clearLicense: () => set({ tier: 'community', licenseKey: undefined }),
    }),
    {
      name: 'architecture-simulator-license',
      partialize: (state) => ({
        tier: state.tier,
        licenseKey: state.licenseKey,
      }),
    }
  )
);

/**
 * Verifie si une feature est disponible pour le tier courant.
 * Les features community sont toujours accessibles.
 * Les features enterprise necessitent le tier enterprise.
 */
export function isFeatureEnabled(feature: string): boolean {
  const { tier } = useLicenseStore.getState();
  if (!enterpriseFeatures.has(feature)) return true;
  return tier === 'enterprise';
}
