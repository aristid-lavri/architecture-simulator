'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA install banner — appears when the browser fires beforeinstallprompt.
 * Auto-hides after dismiss or install.
 */
export function InstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show again if user already dismissed this session
    if (sessionStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-md shadow-lg font-mono text-xs">
      <Download className="w-4 h-4 text-signal-active shrink-0" />
      <span className="text-foreground">{t('pwa.installMessage')}</span>
      <button
        onClick={handleInstall}
        className="px-2 py-1 bg-signal-active text-background rounded-sm font-semibold hover:opacity-80 transition-opacity cursor-pointer"
      >
        {t('pwa.install')}
      </button>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        aria-label={t('common.close')}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
