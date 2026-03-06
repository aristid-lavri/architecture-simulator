import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '@/types';

import fr from './locales/fr.json';
import en from './locales/en.json';

// Type-safe translations
type TranslationKeys = typeof fr;

const translations: Record<Locale, TranslationKeys> = {
  fr,
  en,
};

/** Etat du store i18n avec locale courante et setter. */
interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/** Store Zustand pour la locale. Persiste dans localStorage sous 'architecture-simulator-i18n'. */
export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'fr',
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'architecture-simulator-i18n',
    }
  )
);

/**
 * Hook React pour acceder aux traductions.
 * @returns t - Fonction de traduction par cle en notation pointee (ex: "header.title").
 * @returns locale - Locale courante ('fr' | 'en').
 * @returns setLocale - Setter pour changer la locale.
 * @returns translations - Objet complet des traductions pour la locale courante.
 */
export function useTranslation() {
  const { locale, setLocale } = useI18nStore();
  const t = translations[locale];

  // Helper function to get nested translation by dot notation
  function translate(key: string): string {
    const keys = key.split('.');
    let result: unknown = t;

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = (result as Record<string, unknown>)[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    return typeof result === 'string' ? result : key;
  }

  return {
    t: translate,
    locale,
    setLocale,
    translations: t,
  };
}

/** Liste des locales disponibles dans l'application. */
export const availableLocales: Locale[] = ['fr', 'en'];

/** Noms lisibles des locales pour l'affichage dans l'UI. */
export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};
