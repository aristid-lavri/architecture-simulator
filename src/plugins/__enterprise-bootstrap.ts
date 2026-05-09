/**
 * Bootstrap des plugins enterprise.
 *
 * Activation conditionnée à `NEXT_PUBLIC_EDITION === 'enterprise'` au build.
 * Webpack/Turbopack remplacent `process.env.NEXT_PUBLIC_EDITION` par le littéral
 * au build → en CE build (`NEXT_PUBLIC_EDITION` non posé), la fonction retourne
 * immédiatement et le bundler **élimine entièrement** le `await import('architecture-enterprise/plugins')`
 * du chunk client (dead-code elimination).
 *
 * Le bundle EE est résolu via une junction `node_modules/architecture-enterprise/`
 * pointant vers le dossier `architecture-enterprise/` du monorepo (dev local uniquement,
 * jamais publié). Cette junction est créée par `setup-enterprise-junction.ps1` ou
 * équivalent.
 */

let bootstrapped = false;

export async function bootstrapEnterprisePlugins(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    // Log inconditionnel pour diagnostiquer en dev : montre ce que webpack a inliné.
    // En CE build : `process.env.NEXT_PUBLIC_EDITION` devient `undefined` (ou la valeur
    // posée). En EE build : doit valoir 'enterprise' littéralement.
    // eslint-disable-next-line no-console
    console.info('[enterprise-bootstrap] called; NEXT_PUBLIC_EDITION =', JSON.stringify(process.env.NEXT_PUBLIC_EDITION));
  }
  if (process.env.NEXT_PUBLIC_EDITION !== 'enterprise') return;
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    // Le module `architecture-enterprise/plugins` n'est résolu qu'au build EE
    // (junction + alias dans next.config.ts). En CE pur, TS n'a pas de typings
    // pour ce module — l'import est éliminé du bundle par le `return` plus haut,
    // donc cette ligne n'est jamais exécutée. On supprime l'erreur statique.
    // @ts-expect-error — module résolu seulement en build enterprise
    const mod = await import('architecture-enterprise/plugins');
    if (typeof mod.register === 'function') {
      mod.register();
      if (process.env.NODE_ENV !== 'production') {
        console.info('[enterprise-bootstrap] Plugins EE enregistrés.');
      }
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn('[enterprise-bootstrap] Bundle EE chargé mais ne contient pas register().');
    }
  } catch (e) {
    // Le build EE a été lancé mais le bundle est introuvable (junction manquante).
    // On reste en mode community plutôt que de planter — log explicite en dev.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[enterprise-bootstrap] Échec chargement bundle EE, mode community actif.', e);
    }
  }
}
