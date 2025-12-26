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

// i18n Store
interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

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

// Hook to get translations
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

// Export available locales
export const availableLocales: Locale[] = ['fr', 'en'];

export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};
