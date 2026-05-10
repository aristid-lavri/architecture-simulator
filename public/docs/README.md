# `public/docs/` — Documentation user-facing assets

Convention de stockage des captures d'écran et GIF référencés depuis [`DocEntry`](../../src/data/docs-types.ts) et [`docs-data.ts`](../../src/data/docs-data.ts).

## Arborescence

```
public/docs/
├── components/
│   ├── <type>/                      ← ex: http-server, cache, database
│   │   ├── usage-*.png|gif          ← flow d'usage
│   │   ├── config-*.png             ← exemples de configuration
│   │   └── flow-*.gif               ← animations de comportement
│   └── ...
├── tutorials/                       ← tutoriels transverses
│   └── *.png|gif
└── ee/                              ← INJECTÉ AUTOMATIQUEMENT en build enterprise
    └── ...                          ← (copié depuis architecture-enterprise/public-assets/docs/)
```

## Conventions de nommage

- **kebab-case**, contexte préfixé : `usage-<topic>`, `config-<topic>`, `flow-<topic>`, `metrics-<topic>`.
- **PNG** pour les états fixes (config, capture statique). Optimiser via outil externe (TinyPNG, squoosh).
- **GIF** pour les flows à plusieurs étapes (drag-drop, drill-down, comportement runtime). Boucle naturelle, durée 3-8s.

## Référencement depuis le code

```ts
// docs-data.ts (CE) OU plugin EE register()
const entry: DocEntry = {
  ...
  screenshots: [
    { src: '/docs/components/http-server/usage-overview.png', kind: 'image', alt: 'HTTP Server overview', context: 'usage' },
    { src: '/docs/components/http-server/degradation-flow.gif', kind: 'gif', alt: 'Latence dégradée sous charge', context: 'flow' },
  ],
};
```

## Gating EE — assets

**Les assets EE ne doivent PAS vivre dans ce dossier `public/docs/`** — ils seraient servis publiquement même en build community.

Place les screenshots EE dans [`architecture-enterprise/public-assets/docs/`](../../../architecture-enterprise/public-assets/docs/). Un script copie ce dossier vers `public/docs/ee/` **uniquement** lors d'un build enterprise (`NEXT_PUBLIC_EDITION=enterprise`).

Voir `scripts/copy-ee-docs-assets.mjs` à la racine du projet.

## Maintenance

Quand tu ajoutes ou modifies un composant CE / un plugin EE, ajoute/mets à jour les screenshots ici (CE) ou dans `architecture-enterprise/public-assets/docs/` (EE) selon la discipline « au fil de l'eau » décrite dans le `CLAUDE.md` racine.
