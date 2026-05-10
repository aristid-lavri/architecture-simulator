// ============================================
// Documentation Types — shared across CE built-in entries and EE plugin-registered entries
// ============================================
//
// Le format historique (DocComponent avec strings inline FR) reste valide. Les nouveaux
// champs optionnels (`screenshots`, `eeFeature`, `referenceDoc`, `*Key`) permettent :
//   - aux nouvelles entrées d'utiliser des clés i18n et de pointer vers des screenshots,
//   - aux plugins EE de s'enregistrer via `registerDocEntry()` sans exposer leur code à la CE.
//
// Le rendu (page /docs, drawer Properties Panel) consomme indifféremment les deux formes :
// si `titleKey` existe il est résolu via `useTranslation()`, sinon `name` est utilisé tel quel.

// ── Screenshots ──

export type DocScreenshotKind = 'image' | 'gif';
export type DocScreenshotContext = 'usage' | 'config' | 'flow' | 'metrics';

export interface DocScreenshot {
  /** Chemin relatif depuis public/, ex: '/docs/components/cache/usage-bypass.gif'. */
  src: string;
  /** Type de média — détermine le composant de rendu (next/image vs <img>). */
  kind: DocScreenshotKind;
  /** Texte alternatif (a11y). Plain text OU clé i18n (le renderer tente t(alt) en premier). */
  alt: string;
  /** Légende affichée sous l'image. Plain text OU clé i18n. */
  caption?: string;
  /** Contexte d'usage — sert à grouper les screenshots dans l'UI (ex. tab usage / config / flow). */
  context?: DocScreenshotContext;
}

// ── Property / Field ──

export type DocPropertyType = 'enum' | 'number' | 'string' | 'boolean' | 'object';

export interface DocProperty {
  name: string;
  type: DocPropertyType;
  defaultValue: string;
  /** Description longue inline (legacy). Pour nouvelles entrées, préférer `descriptionKey`. */
  description: string;
  /** Plage de valeurs lisible (ex: '0-100 %', '1-1000', '50-10000 ms'). Optionnel. */
  range?: string;
  /**
   * Clé i18n pour la description. Si présente, surcharge `description`.
   * **Alimente AUSSI le tooltip du Properties Panel** : le wrapper Tooltip lit
   * `t('components.<type>.fields.<field>.description')` ou cette clé directement.
   */
  descriptionKey?: string;
}

// ── Metric ──

export interface DocMetric {
  name: string;
  description: string;
  interpretation: string;
  /** Optional i18n keys (priority over inline strings if provided). */
  nameKey?: string;
  descriptionKey?: string;
  interpretationKey?: string;
}

// ── Section ──

export interface DocSection {
  name: string;
  description: string;
  properties: DocProperty[];
  /** Optional i18n keys. */
  nameKey?: string;
  descriptionKey?: string;
  /** Texte libre additionnel (clé i18n) — utile pour expliquer un comportement non lié à un champ. */
  bodyKey?: string;
  /** Captures d'écran spécifiques à cette section (ex. flow d'usage, exemple de config). */
  screenshots?: DocScreenshot[];
}

// ── Categories ──

/** Catégories CE historiques (composants du simulateur). */
export type DocCEComponentCategory =
  | 'simulation'
  | 'infrastructure'
  | 'data'
  | 'resilience'
  | 'compute'
  | 'cloud'
  | 'zone'
  | 'security';

/** Catégories EE / transverses ajoutées pour les features et tutoriels. */
export type DocExtendedCategory = 'feature' | 'concept' | 'tutorial';

export type DocCategory = DocCEComponentCategory | DocExtendedCategory;

// ── Entry (canonique, super-ensemble de l'historique DocComponent) ──

export interface DocEntry {
  /**
   * Identifiant unique dans le registre/catalogue (ex. 'http-server', 'chaos.cascade-failure').
   * Si absent (entrées CE legacy), `type` fait office d'id.
   */
  id?: string;
  /** Nom inline (legacy). Pour nouvelles entrées, préférer `titleKey`. */
  name: string;
  /**
   * Pour les composants : matche `ComponentType` (ex. 'http-server'). Pour features EE : id arbitraire
   * (ex. 'c4-multilevel', 'chaos').
   */
  type: string;
  /** Description courte inline (1 phrase). Pour nouvelles entrées, préférer `descriptionKey`. */
  description: string;
  category: DocCategory;
  sections: DocSection[];
  /** Optional i18n keys (priorité sur inline). */
  titleKey?: string;
  descriptionKey?: string;

  // ── Champs spécifiques composants (optionnels pour les autres catégories) ──
  /** Métriques exposées par ce composant pendant la simulation. */
  metrics?: DocMetric[];
  /** Description du comportement runtime (texte libre). */
  behavior?: string;
  /** Description des connexions (qui peut connecter quoi). */
  connections?: string;
  /** Protocoles supportés. */
  protocols?: string[];
  /** Clés i18n pour behavior/connections. */
  behaviorKey?: string;
  connectionsKey?: string;

  // ── Nouveaux champs (V2 doc enrichie) ──
  /** Captures d'écran de niveau entrée (top de la page doc). */
  screenshots?: DocScreenshot[];
  /**
   * Si défini → cette entrée est gated derrière une feature EE.
   * Le registre expose ces entries uniquement quand le plugin EE est chargé (build EE)
   * ET la licence est active (`useFeatureGate(eeFeature).isUnlocked === true`).
   */
  eeFeature?: string;
  /**
   * Pointeur (URL ou chemin) vers la doc de référence dev (ex. REFERENCE-Composants-CE.md).
   * Affiché en footer de l'entrée comme « Référence technique ».
   */
  referenceDoc?: string;
}

/**
 * Alias rétro-compatible. Les fichiers legacy continuent d'utiliser `DocComponent`,
 * les nouveaux peuvent utiliser `DocEntry` directement.
 */
export type DocComponent = DocEntry;

// ── Edge & Design Errors (existing, unchanged) ──

export interface DocEdgeProperty {
  name: string;
  type: string;
  defaultValue: string;
  description: string;
}

export type DocDesignErrorSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface DocDesignError {
  error: string;
  severity: DocDesignErrorSeverity;
  description: string;
  solution: string;
  category: string;
}
