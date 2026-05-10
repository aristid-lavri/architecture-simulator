import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    pool: 'threads',
    fileParallelism: false,
    // Inclut les tests CE (par défaut) + ceux des plugins EE résolus via la junction
    // node_modules/architecture-enterprise/. Le glob explicite est nécessaire : vitest
    // exclut node_modules par défaut, donc on pointe vers le source réel via le path
    // relatif au monorepo.
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      '../architecture-enterprise/plugins/**/__tests__/*.{test,spec}.{ts,tsx}',
    ],
  },
  resolve: {
    alias: {
      // EE design-system alias (mirrors the enterprise tsconfig paths).
      // Must come BEFORE the '@' catch-all so '@/_ds' is matched first.
      '@/_ds': path.resolve(__dirname, '../architecture-enterprise/plugins/_design-system'),
      '@': path.resolve(__dirname, './src'),
      // React and testing-library live in the simulator's node_modules.
      // EE plugin files outside this root cannot resolve them on their own,
      // so we pin all imports (including transitive CJS requires) to the
      // simulator copies via explicit aliases.
      '@testing-library/react': path.resolve(__dirname, './node_modules/@testing-library/react'),
      '@testing-library/dom': path.resolve(__dirname, './node_modules/@testing-library/dom'),
      '@testing-library/jest-dom': path.resolve(__dirname, './node_modules/@testing-library/jest-dom'),
      'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-dev-runtime'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
      'react-dom/client': path.resolve(__dirname, './node_modules/react-dom/client'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'class-variance-authority': path.resolve(__dirname, './node_modules/class-variance-authority'),
      'aria-hidden': path.resolve(__dirname, './node_modules/aria-hidden'),
      'zustand': path.resolve(__dirname, './node_modules/zustand'),
      '@radix-ui/react-dialog': path.resolve(__dirname, './node_modules/@radix-ui/react-dialog'),
      'yaml': path.resolve(__dirname, './node_modules/yaml'),
      'lucide-react': path.resolve(__dirname, './node_modules/lucide-react'),
      // next/link is imported by EE marketing-site components but the EE workspace has
      // no node_modules of its own. Pin to the simulator copy so vitest can resolve it.
      'next/link': path.resolve(__dirname, './node_modules/next/link.js'),
      // Resolve architecture-enterprise package imports (e.g. 'architecture-enterprise/plugins/license')
      // to the actual source on disk so EE plugin tests can import across the monorepo boundary.
      'architecture-enterprise': path.resolve(__dirname, '../architecture-enterprise'),
    },
  },
  // Vite restreint l'accès fichiers à la racine du projet par défaut. Les tests EE
  // vivent dans `../architecture-enterprise/`, donc on remonte d'un cran à la racine
  // du monorepo pour autoriser leur résolution via le dev server interne de vitest.
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
