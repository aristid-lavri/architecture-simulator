'use client';
import { useRouter } from 'next/navigation';
import {
  SignUpForm,
  useMarketingTranslation,
} from 'architecture-enterprise/plugins/marketing-site';

/**
 * `/sign-up` — start a 30-day trial (no backend).
 *
 * Client component: needs `useRouter` for the post-success redirect into the
 * simulator. The form itself lives in the EE marketing-site plugin so it can
 * be tested in isolation.
 */
export default function SignUpPage() {
  const router = useRouter();
  const { t } = useMarketingTranslation();
  return (
    <section className="max-w-md mx-auto px-6 py-24">
      <div className="font-display uppercase tracking-[0.08em] text-[10px] text-ee-elevation-bright mb-4">
        {t('signUp.eyebrow')}
      </div>
      <h1 className="font-display text-[32px] leading-tight tracking-tight text-ink mb-3">
        {t('signUp.h1')}
      </h1>
      <p className="font-mono text-[12px] text-ink-2 leading-relaxed mb-8">
        {t('signUp.sub')}
      </p>
      <SignUpForm onSuccess={() => router.push('/simulator')} />
    </section>
  );
}
