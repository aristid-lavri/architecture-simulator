import { redirect } from 'next/navigation';
import CommunityLanding from './CommunityLanding';

// In CE builds, `/` renders the SIGNAL community landing.
// In EE builds, `/` redirects to `/welcome` (the brand-forward EE marketing
// landing, served from the `(marketing)` route group).
//
// `process.env.NEXT_PUBLIC_EDITION` is inlined at build time by Next.js
// (webpack/turbopack), so the dead branch is eliminated from each bundle —
// CE ships zero EE bytes, EE ships zero CE-landing bytes.
export default function HomePage() {
  if (process.env.NEXT_PUBLIC_EDITION === 'enterprise') {
    redirect('/welcome');
  }
  return <CommunityLanding />;
}
