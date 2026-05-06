'use client';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { useTranslation } from '@/i18n';

export function OwaspValidationButton() {
  const setOpen = useAppStore((s) => s.setOwaspDrawerOpen);
  const { t } = useTranslation();
  return (
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
      <ShieldCheck className="h-4 w-4 mr-2" />
      {t('owasp.drawer.runValidation')}
    </Button>
  );
}
