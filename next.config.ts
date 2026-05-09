import type { NextConfig } from "next";
import path from "node:path";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const ceNodeModules = path.resolve(__dirname, "node_modules");
const enterpriseEntry = path.resolve(__dirname, "../architecture-enterprise/plugins/index.ts");
const enterpriseDsEntry = path.resolve(__dirname, "../architecture-enterprise/plugins/_design-system");
const enterpriseLicenseEntry = path.resolve(__dirname, "../architecture-enterprise/plugins/license/index.ts");
// Marketing site lives in the EE workspace for testing convenience but its components
// are pure-presentational (no feature gating) and the marketing routes (`(marketing)/`)
// must render in BOTH CE and EE builds. Alias is therefore unconditional.
const enterpriseMarketingSiteEntry = path.resolve(
  __dirname,
  "../architecture-enterprise/plugins/marketing-site/index.ts",
);

// Edition split — choose the entry CSS at build time.
// CE build (default)        → src/app/globals.css (pure CE, no EE token / @source / utility)
// EE build (NEXT_PUBLIC_EDITION=enterprise) → architecture-enterprise/styles/edition.css
//   which @imports the CE globals.css and layers EE tokens / @source / utilities on top.
//
// Tailwind v4 only processes the entry stylesheet, so swapping the entry is the only
// way to keep the CE build EE-free at build time.
const isEnterprise = process.env.NEXT_PUBLIC_EDITION === "enterprise";
const editionCssPath = isEnterprise
  ? path.resolve(__dirname, "../architecture-enterprise/styles/edition.css")
  : path.resolve(__dirname, "./src/app/globals.css");

// EE module aliases — only resolved in EE build. In CE build we set them to `false` which
// tells webpack to skip resolution (the dynamic `await import('architecture-enterprise/plugins')`
// is also dead-code-eliminated by the env-var early return in __enterprise-bootstrap.ts).
type AliasValue = string | false;
const eeAliases: Record<string, AliasValue> = isEnterprise
  ? {
      "architecture-enterprise/plugins/license": enterpriseLicenseEntry,
      "architecture-enterprise/plugins/marketing-site": enterpriseMarketingSiteEntry,
      "architecture-enterprise/plugins": enterpriseEntry,
      "architecture-enterprise": enterpriseEntry,
      "@/_ds": enterpriseDsEntry,
      "@/_ds/*": `${enterpriseDsEntry}/*`,
    }
  : {
      // license stays gated (SignUpForm/SignInForm in marketing-site need it; it's
      // small and edition-agnostic, so we ship it in CE for the marketing flows).
      "architecture-enterprise/plugins/license": enterpriseLicenseEntry,
      "architecture-enterprise/plugins/marketing-site": enterpriseMarketingSiteEntry,
      "architecture-enterprise/plugins": false,
      "architecture-enterprise": false,
      // CE has no @/_ds Tailwind utilities at runtime, but marketing-site components
      // import ButtonEE from `@/_ds`. Alias to source so webpack can resolve; the
      // EE-only Tailwind tokens (bg-paper, text-ink, etc.) are also provided via
      // architecture-enterprise/styles/edition.css when CE includes the marketing
      // entry CSS. For pure CE builds the EE classes simply have no styles applied
      // (gracefully degraded paper-look).
      "@/_ds": enterpriseDsEntry,
      "@/_ds/*": `${enterpriseDsEntry}/*`,
    };

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // `transpilePackages` indique à webpack de compiler les fichiers TS/TSX du package
  // `architecture-enterprise` (résolu via la junction `node_modules/architecture-enterprise/`).
  transpilePackages: ["architecture-enterprise"],
  // Turbopack (dev) ne suit pas les junctions Windows ; on résout via alias direct.
  // Turbopack ne supporte pas `false` comme valeur d'alias : en CE build, on omet
  // simplement les alias EE (le bootstrap est gated par env var → dead code).
  turbopack: {
    resolveAlias: {
      "#edition-styles": editionCssPath,
      // marketing-site is consumed by the `(marketing)/` route group in BOTH editions,
      // so its alias is unconditional. license is needed by marketing-site forms; @/_ds
      // is needed for ButtonEE inside those forms.
      "architecture-enterprise/plugins/license": enterpriseLicenseEntry,
      "architecture-enterprise/plugins/marketing-site": enterpriseMarketingSiteEntry,
      "@/_ds": enterpriseDsEntry,
      ...(isEnterprise
        ? {
            "architecture-enterprise/plugins": enterpriseEntry,
            "architecture-enterprise": enterpriseEntry,
          }
        : {}),
    },
  },
  // Webpack : ajoute le node_modules du CE comme racine de résolution pour TOUS les
  // fichiers (y compris EE). Évite la duplication de modules (zustand, react, lucide-react)
  // qui causerait des erreurs React hooks et de la casse sur Windows (D:\ vs d:\).
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.modules = [ceNodeModules, "node_modules"];
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "#edition-styles": editionCssPath,
      ...eeAliases,
    };
    return config;
  },
};

export default withSerwist(nextConfig);
