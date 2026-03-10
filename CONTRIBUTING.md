# Contribuer a Architecture Simulator

Merci de votre interet pour Architecture Simulator ! Ce guide vous explique comment contribuer efficacement au projet.

---

## Table des matieres

- [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
- [Code de conduite](#code-de-conduite)
- [Comment contribuer](#comment-contribuer)
- [Configurer l'environnement](#configurer-lenvironnement)
- [Workflow de developpement](#workflow-de-developpement)
- [Conventions de code](#conventions-de-code)
- [Ajouter un nouveau composant](#ajouter-un-nouveau-composant)
- [Tests](#tests)
- [Soumettre une Pull Request](#soumettre-une-pull-request)
- [Signaler un bug](#signaler-un-bug)
- [Proposer une fonctionnalite](#proposer-une-fonctionnalite)

---

## Contributor License Agreement (CLA)

Avant votre premiere Pull Request, vous devez signer notre **Contributor License Agreement (CLA)**. Cela nous permet de distribuer le projet sous differentes licences (open source et commerciale).

Le processus est automatise :
1. Ouvrez votre PR
2. Le bot CLA Assistant vous demande de signer (une seule fois)
3. Signez en commentant `I have read the CLA Document and I hereby sign the CLA`
4. Le bot valide automatiquement vos futures PRs

Le texte complet du CLA est disponible dans [.github/CLA.md](.github/CLA.md).

---

## Code de conduite

En participant a ce projet, vous vous engagez a maintenir un environnement accueillant et respectueux pour tous. Soyez courtois dans les discussions, constructif dans les revues de code et patient avec les nouveaux contributeurs.

---

## Comment contribuer

Il y a plusieurs facons de contribuer :

- **Signaler des bugs** — Ouvrez une issue avec les etapes de reproduction
- **Proposer des fonctionnalites** — Ouvrez une issue de type "Feature Request"
- **Corriger des bugs** — Cherchez les issues avec le label `bug` ou `good first issue`
- **Ajouter des composants** — Nouveaux types de noeuds pour le simulateur
- **Ameliorer la documentation** — Corrections, traductions, exemples
- **Ajouter des templates** — Nouvelles architectures predefinies
- **Ecrire des tests** — Ameliorer la couverture de tests

---

## Configurer l'environnement

### Prerequis

- Node.js >= 20
- npm >= 10
- Git

### Installation

```bash
# Forker le depot sur GitHub, puis :
git clone https://github.com/<votre-username>/architecture-simulator.git
cd architecture-simulator/architecture-simulator

# Installer les dependances
npm install

# Lancer le serveur de developpement
npm run dev
```

### Verifier que tout fonctionne

```bash
npm run lint        # Pas d'erreurs de linting
npm run test:run    # Tests passent
npm run build       # Build reussit
```

---

## Workflow de developpement

### Branches

- `main` — Branche stable, protegee
- `master` — Branche de developpement active
- Feature branches — `feature/nom-de-la-feature`
- Bug fixes — `fix/description-du-bug`

### Processus

1. **Creez une branche** depuis `main` :
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/ma-fonctionnalite
   ```

2. **Developpez** en suivant les conventions ci-dessous

3. **Verifiez** votre code :
   ```bash
   npm run lint
   npm run test:run
   npm run build
   ```

4. **Committez** avec des messages clairs (voir section commits)

5. **Poussez** et ouvrez une Pull Request vers `main`

---

## Conventions de code

### TypeScript

- **Mode strict** active — pas de `any` sauf cas justifie
- Toutes les definitions de types dans `src/types/index.ts`
- Interfaces prefixees selon le domaine (`HttpServerConfig`, `DatabaseConfig`...)

### React

- Composants fonctionnels uniquement (pas de classes)
- Hooks personnalises dans `src/hooks/`
- Props typees explicitement (pas de `React.FC`)

### Styles

- **Tailwind CSS** pour tout le styling — pas de CSS custom sauf `globals.css`
- Utilitaire `cn()` de `src/lib/utils.ts` pour fusionner les classes
- Composants Shadcn/ui pour les elements d'interface standard

### Fichiers et nommage

| Element | Convention | Exemple |
|---|---|---|
| Composants React | PascalCase | `HttpServerNode.tsx` |
| Stores Zustand | kebab-case | `app-store.ts` |
| Handlers | PascalCase + "Handler" | `LoadBalancerHandler.ts` |
| Managers | PascalCase + "Manager" | `CacheManager.ts` |
| Tests | `__tests__/` dans le dossier parent | `handlers/__tests__/CacheHandler.test.ts` |

### Commits

Utilisez des messages de commit descriptifs en anglais :

```
feat: add retry mechanism to HTTP server handler
fix: correct particle animation timing on slow connections
docs: update contributing guide with handler tutorial
test: add unit tests for CircuitBreakerHandler
refactor: extract particle logic from SimulationEngine
```

Prefixes : `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`

### Internationalisation

Toute chaine affichee a l'utilisateur doit etre dans les fichiers de traduction :
- `src/i18n/locales/fr.json` (francais — obligatoire)
- `src/i18n/locales/en.json` (anglais — obligatoire)

Utilisez le hook `useTranslation()` :
```tsx
const { t } = useTranslation();
return <span>{t('panel.title')}</span>;
```

---

## Ajouter un nouveau composant

L'architecture utilise le **Strategy Pattern**. Ajouter un composant implique 4 etapes :

### 1. Definir les types

Dans `src/types/index.ts`, ajoutez :

```typescript
// Le type de noeud
export type NodeType = '...' | 'monNouveauType';

// La configuration du noeud
export interface MonNouveauTypeConfig {
  propriete1: number;
  propriete2: string;
}
```

### 2. Creer le composant React

Dans `src/components/nodes/MonNouveauTypeNode.tsx` :

```tsx
import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

function MonNouveauTypeNode({ data, selected }: NodeProps) {
  return (
    <BaseNode selected={selected} status={data.status}>
      {/* Contenu du noeud */}
    </BaseNode>
  );
}

export default memo(MonNouveauTypeNode);
```

Puis exportez-le dans `src/components/nodes/index.ts`.

### 3. Creer le handler

Dans `src/engine/handlers/MonNouveauTypeHandler.ts` :

```typescript
import { NodeRequestHandler, RequestContext, RequestDecision } from './types';

export class MonNouveauTypeHandler implements NodeRequestHandler {
  canHandle(nodeType: string): boolean {
    return nodeType === 'monNouveauType';
  }

  handle(context: RequestContext): RequestDecision {
    // Logique de traitement
    return {
      action: 'forward',
      targetNodeId: context.targetEdges[0]?.target,
      delay: 50,
    };
  }
}
```

Enregistrez-le dans `src/engine/handlers/HandlerRegistry.ts`.

### 4. Ajouter les traductions

Dans `fr.json` et `en.json`, ajoutez les labels correspondants.

### 5. Ecrire les tests

Dans `src/engine/handlers/__tests__/MonNouveauTypeHandler.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { MonNouveauTypeHandler } from '../MonNouveauTypeHandler';

describe('MonNouveauTypeHandler', () => {
  const handler = new MonNouveauTypeHandler();

  it('should handle monNouveauType nodes', () => {
    expect(handler.canHandle('monNouveauType')).toBe(true);
  });

  it('should not handle other node types', () => {
    expect(handler.canHandle('httpServer')).toBe(false);
  });
});
```

---

## Tests

### Lancer les tests

```bash
npm run test          # Mode watch (relance a chaque modification)
npm run test:run      # Execution unique
npm run test:coverage # Avec rapport de couverture
```

### Organisation

- Tests des handlers : `src/engine/handlers/__tests__/`
- Tests des stores : `src/store/__tests__/`
- Tests du moteur : `src/engine/__tests__/`

### Bonnes pratiques

- Testez la logique metier (handlers, managers), pas les details d'implementation UI
- Un test par comportement, pas par methode
- Utilisez `describe` / `it` avec des descriptions claires
- Mockez les dependances externes, pas les modules internes

---

## Soumettre une Pull Request

### Checklist avant soumission

- [ ] Le code compile sans erreur (`npm run build`)
- [ ] Le linter passe (`npm run lint`)
- [ ] Les tests passent (`npm run test:run`)
- [ ] Les nouveaux composants ont des tests
- [ ] Les chaines UI sont dans les fichiers i18n (FR + EN)
- [ ] Le code suit les conventions du projet

### Format de la PR

**Titre** : court, descriptif, en anglais (< 70 caracteres)

**Description** :
```markdown
## Résumé
- Ce qui a ete ajoute/modifie et pourquoi

## Changements
- Liste des fichiers modifies et pourquoi

## Comment tester
1. Etapes pour verifier le changement
2. ...

## Captures d'ecran
(si changement visuel)
```

### Processus de revue

- Au moins 1 approbation requise avant merge
- Les reviewers peuvent demander des modifications
- Repondez aux commentaires ou expliquez vos choix
- Squash merge vers `main`

---

## Signaler un bug

Ouvrez une issue avec :

- **Description** du probleme
- **Etapes de reproduction** (numerotees)
- **Comportement attendu** vs **comportement observe**
- **Environnement** : OS, navigateur, version de Node
- **Captures d'ecran** si le bug est visuel

---

## Proposer une fonctionnalite

Ouvrez une issue "Feature Request" avec :

- **Probleme** que la fonctionnalite resout
- **Solution proposee** avec description detaillee
- **Alternatives considerees**
- **Maquettes ou schemas** si applicable

Discutez dans l'issue avant de commencer l'implementation pour s'assurer que la direction est alignee avec la vision du projet.

---

## Structure du projet — Reference rapide

```
src/
├── types/index.ts          # Tous les types TypeScript
├── engine/
│   ├── SimulationEngine.ts # Orchestrateur
│   └── handlers/           # 1 handler par type de composant
├── components/nodes/       # 1 composant React par type de noeud
├── store/                  # 3 stores Zustand independantes
├── i18n/locales/           # Traductions FR/EN
└── data/                   # Templates d'architectures
```

---

## Questions ?

N'hesitez pas a ouvrir une issue ou a poser vos questions dans les discussions GitHub. Aucune question n'est trop simple !

Merci de contribuer a Architecture Simulator.
