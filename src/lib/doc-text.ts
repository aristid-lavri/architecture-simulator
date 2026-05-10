/**
 * Résolution de texte « i18n-key OR plain » pour les entrées doc.
 *
 * Les `DocEntry` / `DocScreenshot` acceptent indifféremment un texte brut FR
 * (legacy entries CE) ou une clé i18n (nouvelles entrées + EE). Ce helper
 * détecte le format par une heuristique simple et appelle `t()` uniquement
 * pour les clés probables — évite les warnings console sur du texte brut.
 *
 * Heuristique : `[a-z][a-zA-Z0-9.]+` avec au moins un point → considéré clé.
 * Tout le reste (phrases, ponctuation, espaces) → texte brut.
 */

const I18N_KEY_PATTERN = /^[a-z][a-zA-Z0-9.]+$/;

export function resolveDocText(
  text: string | undefined,
  t: (key: string) => string,
): string {
  if (!text) return '';
  if (I18N_KEY_PATTERN.test(text) && text.includes('.')) {
    const translated = t(text);
    // Si t() retourne la clé elle-même → traduction absente → on rend la clé
    // brute (visible en dev pour signaler le manque, mais acceptable en prod).
    return translated;
  }
  return text;
}
