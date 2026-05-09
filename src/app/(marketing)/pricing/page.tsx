'use client';
import {
  PricingCard,
  type PricingTier,
  useMarketingTranslation,
} from 'architecture-enterprise/plugins/marketing-site';

/**
 * `/pricing` — 4 tiers + FAQ.
 *
 * Client component (consumes the marketing locale store). Cards are
 * presentational; the highlighted Solo tier links to `/sign-up`,
 * Community to `/simulator`, Team and Enterprise to `mailto:`. No Stripe
 * or backend coupling in V1.
 */
export default function PricingPage() {
  const { t, translations } = useMarketingTranslation();
  const tiersDict = translations.pricing.tiers;

  const tiers: PricingTier[] = [
    {
      id: 'community',
      name: tiersDict.community.name,
      price: tiersDict.community.price,
      bullets: [...tiersDict.community.bullets],
      ctaLabel: tiersDict.community.cta,
      ctaHref: '/simulator',
    },
    {
      id: 'solo',
      name: tiersDict.solo.name,
      price: tiersDict.solo.price,
      priceUnit: tiersDict.solo.priceUnit,
      bullets: [...tiersDict.solo.bullets],
      ctaLabel: tiersDict.solo.cta,
      ctaHref: '/sign-up',
      highlighted: true,
    },
    {
      id: 'team',
      name: tiersDict.team.name,
      price: tiersDict.team.price,
      priceUnit: tiersDict.team.priceUnit,
      bullets: [...tiersDict.team.bullets],
      ctaLabel: tiersDict.team.cta,
      ctaHref: 'mailto:hello@architecture.dev',
    },
    {
      id: 'enterprise',
      name: tiersDict.enterprise.name,
      price: tiersDict.enterprise.price,
      bullets: [...tiersDict.enterprise.bullets],
      ctaLabel: tiersDict.enterprise.cta,
      ctaHref: 'mailto:hello@architecture.dev',
    },
  ];

  const faq = translations.pricing.faqItems;

  return (
    <>
      {/* Hero */}
      <section className="max-w-4xl mx-auto py-20 px-6 text-center">
        <div className="font-display uppercase tracking-[0.08em] text-[10px] text-ee-elevation-bright mb-4">
          {t('pricing.eyebrow')}
        </div>
        <h1 className="font-display text-[42px] leading-tight tracking-tight text-ink mb-4">
          {t('pricing.h1')}
        </h1>
        <p className="font-mono text-[13px] text-ink-2 leading-relaxed max-w-xl mx-auto">
          {t('pricing.sub')}
        </p>
      </section>

      {/* Grid 4 cards */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier) => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16 border-t border-line">
        <div className="font-display uppercase tracking-[0.08em] text-[10px] text-ink-3 mb-2">
          {t('pricing.faqEyebrow')}
        </div>
        <h2 className="font-display text-[28px] tracking-tight text-ink mb-10">
          {t('pricing.faqTitle')}
        </h2>
        <dl className="space-y-8">
          {faq.map((item) => (
            <div key={item.q}>
              <dt className="font-display text-[16px] text-ink mb-2">{item.q}</dt>
              <dd className="font-mono text-[12px] text-ink-2 leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
