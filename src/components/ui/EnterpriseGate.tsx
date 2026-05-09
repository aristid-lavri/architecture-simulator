'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { useLicenseStore } from '@/lib/license';
import { useTranslation } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { featureGateRegistry } from '@/plugins/extensions';

/** Set des features reservees Enterprise, miroir de license.ts. */
const builtinEnterpriseFeatures = new Set<string>([
  'team-collaboration',
  'sso-auth',
  'advanced-export',
  'custom-branding',
]);

interface EnterpriseGateProps {
  feature: string;
  children: ReactNode;
  /** Message personnalise au lieu du message par defaut. */
  message?: string;
}

/**
 * Gate conditionnel : affiche le contenu si la feature est disponible,
 * sinon affiche un CTA upgrade vers Enterprise.
 */
export function EnterpriseGate({ feature, children, message }: EnterpriseGateProps) {
  const tier = useLicenseStore((s) => s.tier);
  const { t } = useTranslation();

  // Consulte le registre étendu (plugins) pour savoir si la feature est gated.
  // Le useSyncExternalStore force un re-render si un plugin (dés)enregistre une feature.
  useSyncExternalStore(
    (cb) => featureGateRegistry.subscribe(cb),
    () => featureGateRegistry.list().length,
    () => 0,
  );

  const isGated = builtinEnterpriseFeatures.has(feature) || featureGateRegistry.has(feature);
  const enabled = !isGated || tier === 'enterprise';

  if (enabled) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
      <Badge variant="secondary" className="text-xs">
        {t('license.enterprise')}
      </Badge>
      <p className="text-xs text-muted-foreground text-center">
        {message || t('license.upgradeRequired')}
      </p>
      <span className="text-xs font-medium text-primary cursor-pointer hover:underline">
        {t('license.upgradeCta')}
      </span>
    </div>
  );
}
