#!/usr/bin/env node
/**
 * Copy EE documentation assets (screenshots, GIFs) into the public bundle.
 *
 * Source : `architecture-enterprise/public-assets/docs/`
 * Cible  : `architecture-simulator/public/docs/ee/`
 *
 * Doit être appelé avant `next dev` / `next build` en build enterprise via
 * les hooks `predev:enterprise` / `prebuild:enterprise` du package.json.
 *
 * Pourquoi ce script ?
 *   Next.js sert tout `public/` statiquement. Les assets EE ne peuvent donc
 *   pas vivre dans `public/docs/ee/` directement (ils seraient téléchargeables
 *   en build community). Ils vivent dans `architecture-enterprise/public-assets/`
 *   et sont copiés ici UNIQUEMENT en build enterprise.
 *
 * En build community, le script :
 *   1. Ne fait rien si `NEXT_PUBLIC_EDITION !== 'enterprise'`.
 *   2. SUPPRIME `public/docs/ee/` s'il existait (résidu d'un build EE précédent).
 *      → Garantit que les assets EE ne fuient pas en CE.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SIMULATOR_ROOT = path.resolve(__dirname, '..');
const EE_SOURCE = path.resolve(SIMULATOR_ROOT, '../architecture-enterprise/public-assets/docs');
const CE_DEST = path.resolve(SIMULATOR_ROOT, 'public/docs/ee');

const isEnterprise = process.env.NEXT_PUBLIC_EDITION === 'enterprise';

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rmrf(p) {
  await fs.rm(p, { recursive: true, force: true });
}

/**
 * Copie récursive avec préservation de structure. Skip les fichiers `.md`
 * (README éditoriaux) pour ne pas polluer le bundle public.
 */
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(src, e.name);
    const destPath = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (e.isFile()) {
      if (e.name.endsWith('.md')) continue; // skip READMEs
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  if (!isEnterprise) {
    // Build community : on s'assure qu'aucun asset EE résiduel ne traîne.
    if (await exists(CE_DEST)) {
      console.log(`[copy-ee-docs-assets] community build → removing ${path.relative(SIMULATOR_ROOT, CE_DEST)}`);
      await rmrf(CE_DEST);
    }
    return;
  }

  if (!(await exists(EE_SOURCE))) {
    console.log(`[copy-ee-docs-assets] enterprise build : source absent (${path.relative(SIMULATOR_ROOT, EE_SOURCE)}), skipping.`);
    return;
  }

  // Wipe + copie fraîche pour éviter les anciens fichiers retirés du source.
  if (await exists(CE_DEST)) await rmrf(CE_DEST);
  await copyDir(EE_SOURCE, CE_DEST);

  const stats = { dirs: 0, files: 0 };
  async function count(p) {
    const items = await fs.readdir(p, { withFileTypes: true });
    for (const i of items) {
      if (i.isDirectory()) { stats.dirs++; await count(path.join(p, i.name)); }
      else if (i.isFile()) stats.files++;
    }
  }
  await count(CE_DEST);

  console.log(`[copy-ee-docs-assets] enterprise build : copied ${stats.files} files in ${stats.dirs} dirs to ${path.relative(SIMULATOR_ROOT, CE_DEST)}.`);
}

main().catch((err) => {
  console.error('[copy-ee-docs-assets] FAILED:', err);
  process.exit(1);
});
