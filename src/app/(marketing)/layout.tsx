import type { Metadata } from 'next';
import { MarketingHeader, MarketingFooter } from 'architecture-enterprise/plugins/marketing-site';

/**
 * Marketing route group layout.
 *
 * Next.js parens convention `(marketing)` keeps the URL flat (`/welcome`,
 * `/pricing`, `/sign-in`, `/sign-up`) while scoping this layout so the
 * existing `/` landing (CE) is untouched.
 *
 * Light-only EE brand frame — bg-paper / text-ink tokens, no theme toggle.
 */
export const metadata: Metadata = {
  title: '◆ Architecture — Break your system before reality does.',
  description:
    'Design, simulate and govern distributed architectures. Light-mode IDE for systems thinkers.',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink antialiased flex flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
