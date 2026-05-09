/**
 * SimulationRNG — Pseudo-Random Number Generator deterministe pour la simulation.
 *
 * Pourquoi : `Math.random()` n'est pas seedable, donc deux runs de simulation avec
 * la meme configuration produisent des resultats differents. Ce module fournit un
 * PRNG seedable (mulberry32) pour rendre les simulations reproductibles bit-pour-bit
 * (a contexte temporel pres — voir Caveats).
 *
 * API :
 *   - `createSeededRNG(seed)` : retourne une fonction `() => number` deterministe
 *     produisant des valeurs dans [0, 1) (memes semantiques que Math.random).
 *   - `randomSeed()` : genere un seed entropique (32 bits) au boot.
 *   - `cyrb53(str)` : hash 53 bits d'une string vers un number (utilise pour
 *     accepter un seed sous forme string).
 *   - `SimulationRNG` (type alias) : `() => number`, threade dans le moteur via
 *     `RequestContext.rng` et expose dans les managers via leur constructeur.
 *
 * Caveats :
 *   - Le determinisme couvre tout `Math.random()` remplace par le RNG injecte.
 *   - `Date.now()` reste utilise pour les timestamps animation (non-metriques).
 *   - L'ordre des `setTimeout` dans une simulation reste deterministe tant que
 *     le scheduler du runtime est sequentiel (cas de Node/JSDOM en test).
 */

/**
 * mulberry32 — PRNG 32-bit ultra-compact, periode 2^32, qualite suffisante
 * pour des simulations Monte-Carlo non-cryptographiques.
 *
 * Source : https://stackoverflow.com/a/47593316 (domaine public).
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * cyrb53 — hash non-cryptographique 53-bit pour transformer une seed-string
 * en number deterministe. Retourne un nombre dans [0, 2^53 - 1].
 *
 * Source : https://stackoverflow.com/a/52171480 (domaine public).
 */
export function cyrb53(str: string, seed: number = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Type alias pour un PRNG injectable. Compatible avec Math.random.
 */
export type SimulationRNG = () => number;

/**
 * Cree un PRNG deterministe a partir d'une seed (number ou string).
 * Meme seed -> meme sequence (bit-pour-bit).
 */
export function createSeededRNG(seed: number | string): SimulationRNG {
  const numericSeed = typeof seed === 'string' ? cyrb53(seed) : seed;
  // Folder un seed 53-bit vers 32 bits pour mulberry32, en preservant l'entropie
  const seed32 = (numericSeed ^ Math.floor(numericSeed / 0x100000000)) >>> 0;
  return mulberry32(seed32);
}

/**
 * Genere un seed entropique (32 bits) base sur Date.now + Math.random.
 * Utilise quand l'utilisateur ne fournit pas de seed explicite.
 *
 * Le seed retourne est imprime/expose pour permettre la reproduction d'un run.
 */
export function randomSeed(): number {
  // 32-bit unsigned. Math.random pour disperser le low-order; Date.now pour high-order.
  return ((Date.now() & 0xFFFF) << 16 | (Math.floor(Math.random() * 0x10000))) >>> 0;
}

/**
 * Helpers utilitaires construits sur un RNG injecte (evite d'inliner les patterns
 * `Math.floor(rng() * n)` partout dans le moteur).
 */
export const rngUtils = {
  /** Retourne un entier aleatoire dans [0, max). */
  intRange(rng: SimulationRNG, max: number): number {
    return Math.floor(rng() * max);
  },
  /** Retourne true avec probabilite p (0..1). */
  chance(rng: SimulationRNG, p: number): boolean {
    return rng() < p;
  },
  /** Retourne un float uniforme dans [min, max). */
  floatRange(rng: SimulationRNG, min: number, max: number): number {
    return min + rng() * (max - min);
  },
};
