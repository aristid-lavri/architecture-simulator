'use client';
import Link from 'next/link';
import { HeroChaos, useMarketingTranslation } from 'architecture-enterprise/plugins/marketing-site';

/**
 * `/welcome` — EE marketing landing.
 *
 * Brand-forward hero ("Cassez votre système avant que la réalité s'en
 * charge."), 3-column chaos narrative, 3 V1 pillars, secondary CTA. Companion
 * to the existing CE landing at `/` (untouched).
 *
 * Marked client because it consumes the marketing i18n store; the entire
 * marketing route group ships behind the same hook so the language switcher
 * can flip copy without a full reload.
 */
export default function WelcomePage() {
  const { t } = useMarketingTranslation();
  return (
    <>
      {/* Hero */}
      <section className="max-w-4xl mx-auto py-24 px-6">
        <div className="font-display uppercase tracking-[0.08em] text-[10px] text-ee-elevation-bright mb-6">
          {t('welcome.eyebrow')}
        </div>
        <h1 className="font-display text-[56px] leading-[1.05] tracking-tight text-ink mb-6">
          {t('welcome.h1')}
        </h1>
        <p className="font-mono text-[14px] text-ink-2 leading-relaxed mb-8 max-w-2xl">
          {t('welcome.sub')}
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Link
            href="/sign-up"
            className="bg-ee-elevation-bright text-paper font-display text-[10px] uppercase tracking-[0.08em] px-5 py-2.5"
          >
            {t('welcome.ctaTrial')}
          </Link>
          <Link
            href="/pricing"
            className="border border-ee-elevation-hairline text-ee-elevation-bright font-display text-[10px] uppercase tracking-[0.08em] px-5 py-2.5"
          >
            {t('welcome.ctaPricing')}
          </Link>
        </div>
        <p className="font-mono text-[10px] text-ink-3 mb-12">
          {t('welcome.noCard')}
        </p>
        <HeroChaos />
      </section>

      {/* Récit chaos */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-line">
        <div className="font-display uppercase tracking-[0.08em] text-[10px] text-ink-3 mb-2">
          {t('welcome.narrativeEyebrow')}
        </div>
        <h2 className="font-display text-[28px] tracking-tight text-ink mb-10">
          {t('welcome.narrativeTitle')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <article className="bg-paper border border-line p-6">
            <div className="font-display uppercase tracking-[0.08em] text-[10px] text-signal-fault mb-2">
              {t('welcome.cascadeFailure.tag')}
            </div>
            <h3 className="font-display text-[16px] text-ink mb-2">
              {t('welcome.cascadeFailure.title')}
            </h3>
            <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
              {t('welcome.cascadeFailure.desc')}
            </p>
          </article>
          <article className="bg-paper border border-line p-6">
            <div className="font-display uppercase tracking-[0.08em] text-[10px] text-signal-fault mb-2">
              {t('welcome.networkPartition.tag')}
            </div>
            <h3 className="font-display text-[16px] text-ink mb-2">
              {t('welcome.networkPartition.title')}
            </h3>
            <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
              {t('welcome.networkPartition.desc')}
            </p>
          </article>
          <article className="bg-paper border border-line p-6">
            <div className="font-display uppercase tracking-[0.08em] text-[10px] text-signal-fault mb-2">
              {t('welcome.rollingRestart.tag')}
            </div>
            <h3 className="font-display text-[16px] text-ink mb-2">
              {t('welcome.rollingRestart.title')}
            </h3>
            <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
              {t('welcome.rollingRestart.desc')}
            </p>
          </article>
        </div>
      </section>

      {/* 3 piliers V1 */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-line">
        <div className="font-display uppercase tracking-[0.08em] text-[10px] text-ink-3 mb-2">
          {t('welcome.pillarsEyebrow')}
        </div>
        <h2 className="font-display text-[28px] tracking-tight text-ink mb-10">
          {t('welcome.pillarsTitle')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <article className="bg-paper border border-line border-t-2 border-t-ee-elevation p-6">
            <div className="font-display text-[20px] text-ee-elevation-bright mb-2">
              {t('welcome.chaosPillar.title')}
            </div>
            <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
              {t('welcome.chaosPillar.desc')}
            </p>
          </article>
          <article className="bg-paper border border-line border-t-2 border-t-ee-elevation p-6">
            <div className="font-display text-[20px] text-ee-elevation-bright mb-2">
              {t('welcome.signPillar.title')}
            </div>
            <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
              {t('welcome.signPillar.desc')}
            </p>
          </article>
          <article className="bg-paper border border-line border-t-2 border-t-ee-elevation p-6">
            <div className="font-display text-[20px] text-ee-elevation-bright mb-2">
              {t('welcome.exportPillar.title')}
            </div>
            <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
              {t('welcome.exportPillar.desc')}
            </p>
          </article>
        </div>
      </section>

      {/* CTA secondaire */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-[28px] tracking-tight text-ink mb-6">
          {t('welcome.ctaBottomTitle')}
        </h2>
        <Link
          href="/sign-up"
          className="inline-block bg-ee-elevation-bright text-paper font-display text-[10px] uppercase tracking-[0.08em] px-6 py-3"
        >
          {t('welcome.ctaBottomButton')}
        </Link>
      </section>
    </>
  );
}
