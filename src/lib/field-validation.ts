/**
 * Validators field-level utilisés par PropertiesPanel (A4.2).
 *
 * Why : sans validation in-form, les erreurs (`port: 100000`, `clients: -5`)
 * remontent uniquement à la simulation — ou pire sont silencieusement avant
 * la formule. La couche est délibrément découplée du store et du rendu : on peut
 * tester chaque règle isolément et la réutiliser ailleurs (yaml-parser, presets).
 *
 * Toutes les fonctions retournent `null` si valides, ou une string FR-locale
 * prête à afficher sous le champ. Pas d’i18n key ici — le message vit avec la
 * règle pour rester explicite à la lecture du code.
 */

export type FieldValidator<T = number> = (value: T) => string | null;

/** Compose plusieurs validators ; renvoie la première erreur trouvée. */
export function compose<T>(...validators: FieldValidator<T>[]): FieldValidator<T> {
  return (value: T) => {
    for (const v of validators) {
      const err = v(value);
      if (err) return err;
    }
    return null;
  };
}

// ===========================================================================
// Validators numériques
// ===========================================================================

export function required(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return 'Champ obligatoire';
  if (typeof value === 'string' && value.trim() === '') return 'Champ obligatoire';
  return null;
}

export function isFiniteNumber(value: number): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Doit être un nombre valide';
  return null;
}

export function isInteger(value: number): string | null {
  if (!Number.isInteger(value)) return 'Doit être un entier';
  return null;
}

export function min(bound: number): FieldValidator<number> {
  return (value) => (value < bound ? `Doit être ≥ ${bound}` : null);
}

export function max(bound: number): FieldValidator<number> {
  return (value) => (value > bound ? `Doit être ≤ ${bound}` : null);
}

export function range(low: number, high: number): FieldValidator<number> {
  return (value) => {
    if (value < low || value > high) return `Doit être entre ${low} et ${high}`;
    return null;
  };
}

export function positive(value: number): string | null {
  if (value <= 0) return 'Doit être > 0';
  return null;
}

export function nonNegative(value: number): string | null {
  if (value < 0) return 'Doit être ≥ 0';
  return null;
}

// ===========================================================================
// Validators métier
// ===========================================================================

/** TCP/UDP port — 1-65535 (port 0 = wildcard, refusé ici car ambiguë). */
export const validatePort: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  isInteger,
  range(1, 65535),
);

/** Pourcentage exprimé 0-1 (cache hit ratio, error rate, etc.). */
export const validateRatio01: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  range(0, 1),
);

/** Pourcentage exprimé 0-100 (CPU utilization threshold, etc.). */
export const validatePercent100: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  range(0, 100),
);

/** Latence en ms — 0 à 60_000 (1 min). */
export const validateLatencyMs: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  range(0, 60_000),
);

/** RPS — 0 à 1_000_000 (entier). */
export const validateRps: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  isInteger,
  range(0, 1_000_000),
);

/** Compteur entier strictement positif (clients virtuels, replicas, etc.). */
export const validatePositiveCount: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  isInteger,
  positive,
);

/** Compteur entier non-négatif. */
export const validateNonNegativeCount: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  isInteger,
  nonNegative,
);

/** CPU cores — entier 1-256. */
export const validateCpuCores: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  isInteger,
  range(1, 256),
);

/** Mémoire MB — entier 1-1_048_576 (1 To). */
export const validateMemoryMb: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  isInteger,
  range(1, 1_048_576),
);

/** Bande passante Gbps — 0.001 à 1000. */
export const validateBandwidthGbps: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  range(0.001, 1000),
);

/** Taille payload KB — 0 à 1_048_576 (1 GB). */
export const validatePayloadKb: FieldValidator<number> = compose<number>(
  isFiniteNumber,
  range(0, 1_048_576),
);
