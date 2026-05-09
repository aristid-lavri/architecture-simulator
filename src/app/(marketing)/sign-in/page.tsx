'use client';
import { useRouter } from 'next/navigation';
import {
  SignInForm,
  useMarketingTranslation,
} from 'architecture-enterprise/plugins/marketing-site';

/**
 * `/sign-in` — paste an existing license key to activate.
 *
 * Client component: needs `useRouter` for the post-success redirect into the
 * simulator. The form lives in the EE marketing-site plugin and surfaces the
 * same activation errors as the in-app `LicenseDialog` (Plan 2).
 */
export default function SignInPage() {
  const router = useRouter();
  const { t } = useMarketingTranslation();
  return (
    <section className="max-w-md mx-auto px-6 py-24">
      <div className="font-display uppercase tracking-[0.08em] text-[10px] text-ee-elevation-bright mb-4">
        {t('signIn.eyebrow')}
      </div>
      <h1 className="font-display text-[32px] leading-tight tracking-tight text-ink mb-3">
        {t('signIn.h1')}
      </h1>
      <p className="font-mono text-[12px] text-ink-2 leading-relaxed mb-8">
        {t('signIn.sub')}
      </p>
      <SignInForm onSuccess={() => router.push('/simulator')} />
    </section>
  );
}
